import { Express, Request, Response } from "express";
import { authDomainService } from "../domain/users/auth.domain-service.js";
import { AuthApplicationService } from "./auth.application-service.js";
import { ExpressSessionAdapter } from "../infrastructure/session.adapter.js";
import { requireAuth } from "../routes.js";
import { rateLimit } from "express-rate-limit";
import crypto from "crypto";
import { generateSecret, generateURI, verify } from "otplib";
import qr from "qr-image";
import { storage } from "../storage.js";

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,                   // 5 login attempts per 15 min — brute-force protection
  message: { error: "Too many login attempts, please try again later." },
});

// Stricter limiter for registration OTP — prevents email flooding
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,                    // 5 registration attempts per IP per hour
  message: { error: "Too many registration attempts, please try again later." },
});

// ── In-memory OTP store ────────────────────────────────────────────────────
// Keyed by email (lowercased). Each entry holds a 6-digit code, expiry, and
// the registration payload so we don't ask the user to re-enter it.
// Entries are cleaned up on use or after expiry. No DB required.
interface PendingRegistration {
  code: string;
  expiresAt: number;
  name: string;
  email: string;
  password: string; // already validated on the client — we just hold it here
}

const pendingRegistrations = new Map<string, PendingRegistration>();

// Periodically sweep expired entries (every 10 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of pendingRegistrations) {
    if (entry.expiresAt < now) pendingRegistrations.delete(key);
  }
}, 10 * 60 * 1000);

function generateOTP(): string {
  // 6-digit numeric code — familiar to users from SMS/2FA flows
  return Math.floor(100000 + crypto.randomInt(900000)).toString();
}


export function registerAuthRoutes(app: Express) {
  // ── Login ────────────────────────────────────────────────────────────────
  app.post("/api/auth/login", authLimiter, async (req: Request, res: Response) => {
    try {
      const { email, password, mfaToken } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }

      const authAppService = new AuthApplicationService(
        authDomainService,
        new ExpressSessionAdapter(req)
      );

      console.log(`[AUTH] Login attempt for: ${email}`);
      const authResult = await authAppService.login(email, password, mfaToken);

      if (!authResult) {
        console.log(`[AUTH] Login failed: Invalid credentials for ${email}`);
        return res.status(401).json({ error: "Invalid email or password" });
      }

      if (authResult.requiresMfa) {
        return res.status(200).json({ requiresMfa: true });
      }

      console.log(`[AUTH] Login successful for: ${email}`);
      res.json(authResult.user);
    } catch (error: any) {
      console.error("[AUTH] Login error:", error);
      if (error.message === "Invalid verification code.") {
        return res.status(400).json({ error: "Invalid verification code." });
      }
      res.status(500).json({ error: "Login failed" });
    }
  });

  // ── MFA Setup ────────────────────────────────────────────────────────────
  app.get("/api/auth/mfa/setup", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ error: "User not found" });

      const secret = generateSecret();
      const otpauth = generateURI({ issuer: "Ace Tours & Transfers", label: user.email, secret });

      const qrCode = qr.imageSync(otpauth, { type: "svg" });

      res.json({
        secret,
        qrCode: qrCode.toString("base64"),
      });
    } catch (error) {
      console.error("[AUTH] MFA Setup error:", error);
      res.status(500).json({ error: "Failed to generate MFA setup" });
    }
  });

  app.post("/api/auth/mfa/verify-setup", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const { token, secret } = req.body;
      if (!token || !secret) {
        return res.status(400).json({ error: "Token and secret are required" });
      }

      const isValid = await verify({ token: token.replace(/\s/g, ''), secret });

      if (isValid) {
        await storage.updateUserMfa(userId, secret, true);
        return res.json({ success: true });
      } else {
        return res.status(400).json({ error: "Invalid token" });
      }
    } catch (error) {
      console.error("[AUTH] MFA Verify Setup error:", error);
      res.status(500).json({ error: "Failed to verify MFA setup" });
    }
  });

  // ── Step 1: Request registration OTP ────────────────────────────────────
  // Validates input, sends a 6-digit OTP to the email, stores the pending
  // registration. Does NOT create the account yet.
  app.post("/api/auth/register", registerLimiter, async (req: Request, res: Response) => {
    try {
      const { name, email, password } = req.body;

      // Basic validation
      if (!name || typeof name !== "string" || name.trim().length < 2) {
        return res.status(400).json({ error: "A valid name is required." });
      }
      if (!email || typeof email !== "string") {
        return res.status(400).json({ error: "A valid email is required." });
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email) || email.length > 254) {
        return res.status(400).json({ error: "Invalid email address." });
      }
      if (!password || typeof password !== "string" || password.length < 8) {
        return res.status(400).json({ error: "Password must be at least 8 characters." });
      }

      const normEmail = email.toLowerCase().trim();

      // Check if email is already registered — return same generic message to
      // avoid leaking whether an account exists (timing-safe enough at this scale)
      const existing = await authDomainService.getUserByEmail(normEmail);
      if (existing) {
        // Don't reveal the account exists — just say "check your email"
        console.log(`[AUTH][REGISTER] Email already registered: ${normEmail}`);
        return res.status(200).json({
          message: "If this email is not already registered, a verification code has been sent.",
          requiresVerification: true,
        });
      }

      // Generate and store OTP (10-minute expiry)
      const code = generateOTP();
      pendingRegistrations.set(normEmail, {
        code,
        expiresAt: Date.now() + 10 * 60 * 1000,
        name: name.trim(),
        email: normEmail,
        password,
      });

      // Send OTP email
      try {
        const { sendEmail } = await import("../lib/mail.js");
        const appUrl = process.env.APP_URL || "https://ace-tours-transfers.onrender.com";
        await sendEmail({
          to: normEmail,
          subject: "Your Ace Tours verification code",
          html: `
            <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; border: 1px solid #e5e7eb; border-radius: 12px;">
              <img src="${appUrl}/assets/logo.png" alt="Ace Tours & Transfers" style="height: 48px; margin-bottom: 24px;" />
              <h2 style="color: #004165; margin: 0 0 8px 0;">Verify your email</h2>
              <p style="color: #6b7280; font-size: 14px; margin: 0 0 24px 0;">
                Hi ${name.trim().split(" ")[0]}! Enter this code on the registration page to complete your account:
              </p>
              <div style="background: #f0f9ff; border: 2px solid #0ea5e9; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
                <span style="font-size: 40px; font-weight: 900; letter-spacing: 10px; color: #004165; font-family: monospace;">${code}</span>
              </div>
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">This code expires in <strong>10 minutes</strong>. If you didn't request this, you can safely ignore this email.</p>
              <hr style="border: 0; border-top: 1px solid #f3f4f6; margin: 20px 0;" />
              <p style="font-size: 11px; color: #d1d5db; margin: 0;">Ace Tours &amp; Transfers · Port Vila, Vanuatu</p>
            </div>
          `,
        });
      } catch (emailErr) {
        console.error("[AUTH][REGISTER] Failed to send OTP email:", emailErr);
        pendingRegistrations.delete(normEmail);
        return res.status(503).json({ error: "Could not send verification email. Please try again." });
      }

      console.log(`[AUTH][REGISTER] OTP sent to ${normEmail}`);
      return res.status(200).json({
        message: "Verification code sent. Please check your email.",
        requiresVerification: true,
      });
    } catch (error: any) {
      console.error("[AUTH][REGISTER] Error:", error);
      res.status(500).json({ error: "Registration failed. Please try again." });
    }
  });

  // ── Step 2: Verify OTP and create account ───────────────────────────────
  app.post("/api/auth/verify-email", registerLimiter, async (req: Request, res: Response) => {
    try {
      const { email, code } = req.body;
      if (!email || !code) {
        return res.status(400).json({ error: "Email and verification code are required." });
      }

      const normEmail = email.toLowerCase().trim();
      const pending = pendingRegistrations.get(normEmail);

      // Generic error — don't leak whether the email has a pending registration
      const FAIL = { error: "Invalid or expired verification code." };

      if (!pending) return res.status(400).json(FAIL);
      if (Date.now() > pending.expiresAt) {
        pendingRegistrations.delete(normEmail);
        return res.status(400).json(FAIL);
      }
      if (pending.code !== code.trim()) {
        return res.status(400).json(FAIL);
      }

      // OTP valid — create the account
      pendingRegistrations.delete(normEmail);

      const authAppService = new AuthApplicationService(
        authDomainService,
        new ExpressSessionAdapter(req)
      );

      const authResult = await authAppService.register(pending.name, pending.email, pending.password);

      console.log(`[AUTH][REGISTER] Account created and session started for: ${normEmail}`);
      return res.status(201).json(authResult);
    } catch (error: any) {
      console.error("[AUTH][VERIFY] Error:", error);
      if (error.message?.includes("already exists")) {
        return res.status(409).json({ error: "An account with this email already exists." });
      }
      res.status(500).json({ error: "Account creation failed. Please try again." });
    }
  });

  // ── Logout ───────────────────────────────────────────────────────────────
  app.post("/api/auth/logout", async (req: Request, res: Response) => {
    try {
      const authAppService = new AuthApplicationService(
        authDomainService,
        new ExpressSessionAdapter(req)
      );
      await authAppService.logout();
      res.json({ message: "Logged out successfully" });
    } catch (err) {
      console.error("Logout error:", err);
      res.status(500).json({ error: "Logout failed" });
    }
  });

  // ── Get current user ─────────────────────────────────────────────────────
  app.get("/api/auth/me", async (req: Request, res: Response) => {
    try {
      if (!req.session) {
        console.error("[AUTH] req.session is missing!");
        return res.status(500).json({ error: "Session middleware error" });
      }

      const userId = req.session.userId;
      if (!userId) return res.json(null);

      const authAppService = new AuthApplicationService(
        authDomainService,
        new ExpressSessionAdapter(req)
      );
      const authResult = await authAppService.getAuthenticatedUser();

      if (!authResult) {
        console.log(`[AUTH] User not found for ID: ${userId}, destroying session`);
        await new ExpressSessionAdapter(req).destroySession();
        return res.status(401).json({ error: "User not found" });
      }

      res.json(authResult);
    } catch (error) {
      console.error("[AUTH] Failed to get authenticated user:", error);
      res.status(500).json({ error: "Failed to get user" });
    }
  });
}
