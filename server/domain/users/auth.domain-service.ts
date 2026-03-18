
import { type User, type InsertUser } from "../../../shared/schema.js";
import { type IStorage, storage } from "../../storage.js";
import { mailingService } from "../../infrastructure/mailing/MailingService.js";
import bcrypt from "bcryptjs";
import { verify } from "otplib";

export interface AuthResult extends User {
  // Add any extra fields needed for the auth response
}

export class AuthDomainService {
  private storage: IStorage;

  constructor(storage: IStorage) {
    this.storage = storage;
  }

  async login(email: string, password: string, mfaToken?: string): Promise<{ user: AuthResult, requiresMfa?: boolean } | null> {
    const user = await this.storage.getUserByEmail(email.trim().toLowerCase());
    if (!user) return null;

    const isPasswordValid = await this.verifyPassword(password, user.password);
    if (!isPasswordValid) return null;

    if (user.isActive === false) {
      throw new Error("Account is suspended. Please contact administrator.");
    }

    if (user.totpEnabled && user.totpSecret) {
      if (!mfaToken) {
        return { user, requiresMfa: true };
      }
      const isValid = await verify({ token: mfaToken.replace(/\s/g, ''), secret: user.totpSecret });
      if (!isValid) throw new Error("Invalid verification code.");
    }

    return { user };
  }

  private async verifyPassword(password: string, storedPassword: string): Promise<boolean> {
    if (!storedPassword) {
      return false;
    }

    try {
      return await bcrypt.compare(password, storedPassword);
    } catch (error) {
      // Backwards compatibility for legacy plaintext passwords.
      // If bcrypt compare fails due to an invalid hash format, gracefully
      // fall back to direct comparison instead of surfacing a 500.
      const bcryptErrorMessage = error instanceof Error ? error.message : "";
      if (bcryptErrorMessage.toLowerCase().includes("invalid salt")) {
        return password === storedPassword;
      }
      return false;
    }
  }

  /**
   * Domain logic for registration.
   * Ensures business rules (unique email) and side effects (welcome email).
   */
  async register(name: string, email: string, password: string): Promise<AuthResult> {
    const existing = await this.storage.getUserByEmail(email);
    if (existing) {
      throw new Error(`User with this email already exists: ${email}`);
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const username = email.split('@')[0] + Math.random().toString(36).substring(2, 5);

    const user = await this.storage.createUser({
      name,
      email,
      username,
      password: hashedPassword,
    });

    // Side Effect: Welcome Email (Fire and forget or handle error gracefully)
    try {
      const { sendEmail } = await import("../../lib/mail.js");
      const { UserProfileDomainService } = await import("./user-profile.domain-service.js");
      const token = await new UserProfileDomainService(this.storage).generatePasswordResetToken(user.id);
      const appUrl = process.env.APP_URL || "https://acetours.vu";
      const resetLink = `${appUrl}/reset-password?token=${token}`;

      await sendEmail({
        to: user.email,
        subject: "Welcome to Ace Tours & Transfers",
        html: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
<h2 style="color: #004165;">Welcome, ${user.name ?? "Staff Member"}! 👋</h2>
<p>You have been invited to join the Ace Tours & Transfers platform.</p>
<p>Your role is: <strong>${user.role}</strong></p>
<p>To get started, please set your password by clicking the link below:</p>
<div style="text-align: center; margin: 30px 0;">
  <a href="${resetLink}" style="background-color: #004165; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Set Your Password</a>
</div>
<p style="color: #6b7280; font-size: 14px;">This link will expire in 24 hours.</p>
<hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
<p style="font-size: 12px; color: #9ca3af;">Ace Tours & Transfers · Port Vila, Vanuatu</p>
</div>`,
      });
      console.log(`[AUTH] Welcome email sent to ${user.email}`);
    } catch (e) {
      console.error("[AUTH] Failed to send welcome email:", e);
    }

    return user;
  }

  async getAuthenticatedUser(userId: string): Promise<AuthResult | null> {
    const user = await this.storage.getUser(userId);
    return user || null;
  }

  /** Used by the registration flow to check if an email is already taken before sending an OTP. */
  async getUserByEmail(email: string) {
    return this.storage.getUserByEmail(email);
  }
}

export const authDomainService = new AuthDomainService(storage);
