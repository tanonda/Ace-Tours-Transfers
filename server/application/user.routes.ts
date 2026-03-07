
import { Express, Request, Response } from "express";
import { userProfileDomainService } from "../domain/users/user-profile.domain-service.js";
import { requireAdmin } from "../routes.js";
import { adminInsertUserSchema } from '../../shared/schema.js';
import { ZodError } from "zod";
import { storage } from "../storage.js";

export function registerUserRoutes(app: Express) {
  // Admin-only User Management
  app.get("/api/users", requireAdmin, async (req, res) => {
    try {
      const users = await userProfileDomainService.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Failed to fetch users:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  /**
   * POST /api/users
   * Admin-only: create a staff or customer account directly (invitation flow).
   * Public self-registration goes through POST /api/auth/register (OTP-verified).
   */
  app.post("/api/users", requireAdmin, async (req, res) => {
    try {
      const validatedData = adminInsertUserSchema.parse(req.body);
      const user = await userProfileDomainService.createUser(validatedData);
      res.status(201).json({
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name,
        role: user.role
      });
    } catch (error) {
      console.error("User creation error:", error);
      if (error instanceof ZodError) {
        res.status(400).json({ error: "Invalid user data", details: error.flatten() });
      } else if (error instanceof Error && error.message.includes("email already exists")) {
        res.status(409).json({ error: "A user with this email address already exists." });
      } else if (error instanceof Error && error.message.includes("username already exists")) {
        res.status(409).json({ error: "That username is already taken. Please choose a different username." });
      } else {
        res.status(500).json({ error: "Failed to create user" });
      }
    }
  });

  // Password Reset consume endpoint
  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { token, newPassword } = req.body;
      if (!token || !newPassword) {
        return res.status(400).json({ error: "Token and new password are required" });
      }
      await userProfileDomainService.resetPasswordWithToken(token, newPassword);
      res.json({ success: true, message: "Password updated successfully" });
    } catch (error) {
      console.error("Password reset error:", error);
      res.status(400).json({ error: error instanceof Error ? error.message : "Failed to reset password" });
    }
  });

  app.patch("/api/users/:id/role", requireAdmin, async (req, res) => {
    try {
      const { role } = req.body;
      const user = await userProfileDomainService.updateUserRole(req.params.id, role);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(user);
    } catch (error) {
      console.error("Failed to update user role:", error);
      if (error instanceof Error && error.message.includes("Invalid role")) {
        res.status(400).json({ error: error.message });
      }
    }
  });

  app.patch("/api/users/:id/status", requireAdmin, async (req, res) => {
    try {
      const { isActive } = req.body;
      const user = await userProfileDomainService.updateUserStatus(req.params.id, isActive);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(user);
    } catch (error) {
      console.error("Failed to update user status:", error);
      res.status(500).json({ error: "Failed to update user status" });
    }
  });

  app.patch("/api/users/:id/password", requireAdmin, async (req, res) => {
    try {
      const { newPassword } = req.body;
      const user = await userProfileDomainService.updateUserPassword(req.params.id, newPassword);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(user);
    } catch (error) {
      console.error("Failed to reset user password:", error);
      if (error instanceof Error && error.message.includes("New password is required")) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Failed to reset user password" });
      }
    }
  });

  // Public access to user details (with owner check)
  app.get("/api/users/:id", async (req, res) => {
    try {
      if (req.session.userRole !== 'admin' && req.session.userId !== req.params.id) {
        return res.status(403).json({ error: "Access denied" });
      }
      const user = await userProfileDomainService.getUserById(req.params.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json({
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name,
        role: user.role
      });
    } catch (error) {
      console.error("Failed to fetch user:", error);
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });

  /**
   * POST /api/users/:id/send-welcome
   * Admin sends (or re-sends) the invitation email with a password-set link.
   */
  app.post("/api/users/:id/send-welcome", requireAdmin, async (req, res) => {
    try {
      const user = await userProfileDomainService.getUserById(req.params.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const { sendEmail } = await import("../lib/mail.js");
      const token = await userProfileDomainService.generatePasswordResetToken(user.id);
      const appUrl = process.env.APP_URL || "https://ace-tours-transfers.onrender.com";
      const resetLink = `${appUrl}/reset-password?token=${token}`;

      await sendEmail({
        to: user.email,
        subject: "You're invited — Ace Tours & Transfers",
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 32px; border: 1px solid #e5e7eb; border-radius: 12px;">
            <img src="${appUrl}/assets/logo.png" alt="Ace Tours & Transfers" style="height: 48px; margin-bottom: 24px;" />
            <h2 style="color: #004165; margin: 0 0 8px 0;">Welcome, ${user.name ?? "Team Member"}! 👋</h2>
            <p style="color: #374151; font-size: 14px; margin: 0 0 8px 0;">You've been invited to join the Ace Tours &amp; Transfers platform.</p>
            <p style="color: #6b7280; font-size: 14px; margin: 0 0 24px 0;">Your role is: <strong>${user.role}</strong></p>
            <div style="text-align: center; margin: 28px 0;">
              <a href="${resetLink}" style="display: inline-block; background: #004165; color: white; padding: 14px 36px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 15px;">
                Set Your Password
              </a>
            </div>
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">This link expires in 24 hours. If you weren't expecting this invitation, you can safely ignore it.</p>
            <hr style="border: 0; border-top: 1px solid #f3f4f6; margin: 20px 0;" />
            <p style="font-size: 11px; color: #d1d5db; margin: 0;">Ace Tours &amp; Transfers · Port Vila, Vanuatu</p>
          </div>
        `,
      });

      console.log(`[USER] Welcome email sent to ${user.email} by admin`);
      res.json({ success: true, message: "Welcome email sent successfully" });
    } catch (error) {
      console.error("Failed to send welcome email:", error);
      res.status(500).json({ error: "Failed to send welcome email" });
    }
  });

  app.get("/api/customers", requireAdmin, async (req, res) => {
    try {
      const customers = await userProfileDomainService.getCustomers();
      res.json(customers);
    } catch (error) {
      console.error("Failed to fetch customers:", error);
      res.status(500).json({ error: "Failed to fetch customers" });
    }
  });

  // Self-service: Update own profile (name, email, phone)
  app.patch("/api/users/:id/profile", async (req, res) => {
    try {
      if (!req.session.userId) return res.status(401).json({ error: "Unauthorized" });
      if (req.session.userRole !== 'admin' && req.session.userId !== req.params.id) {
        return res.status(403).json({ error: "Access denied" });
      }
      const { name, email, phone } = req.body;
      const updated = await storage.updateUserProfile(req.params.id, { name, email, phone });
      if (!updated) return res.status(404).json({ error: "User not found" });
      res.json({ id: updated.id, name: updated.name, email: updated.email, phone: updated.phone, role: updated.role });
    } catch (error) {
      console.error("Failed to update user profile:", error);
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  // Self-service: Change own password (with current password verification)
  app.patch("/api/users/:id/change-password", async (req, res) => {
    try {
      if (!req.session.userId) return res.status(401).json({ error: "Unauthorized" });
      if (req.session.userRole !== 'admin' && req.session.userId !== req.params.id) {
        return res.status(403).json({ error: "Access denied" });
      }
      const { currentPassword, newPassword } = req.body;
      if (!newPassword || newPassword.length < 8) {
        return res.status(400).json({ error: "New password must be at least 8 characters" });
      }
      const user = await storage.getUser(req.params.id);
      if (!user) return res.status(404).json({ error: "User not found" });
      const bcrypt = await import("bcryptjs");
      const valid = await bcrypt.compare(currentPassword, user.password);
      if (!valid) return res.status(400).json({ error: "Current password is incorrect" });
      const hashed = await bcrypt.hash(newPassword, 10);
      await storage.updateUserPassword(req.params.id, hashed);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to change password:", error);
      res.status(500).json({ error: "Failed to change password" });
    }
  });
}
