
import { Express, Request, Response } from "express";
import { userProfileDomainService } from "../domain/users/user-profile.domain-service.js";
import { requireAdmin } from "../routes.js";
import { insertUserSchema, adminInsertUserSchema } from '../../shared/schema.js';
import { ZodError } from "zod";

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

  app.post("/api/users", async (req, res) => {
    try {
      const isAdmin = req.session.userRole === 'admin';
      const schema = isAdmin ? adminInsertUserSchema : insertUserSchema;
      const validatedData = schema.parse(req.body);

      // If not admin, force role to customer
      if (!isAdmin) {
        (validatedData as any).role = 'customer';
      }

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
      } else if (error instanceof Error && error.message.includes("User with this email already exists")) {
        res.status(409).json({ error: error.message });
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
      // SECURITY: Owner or Admin check
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

  app.get("/api/customers", requireAdmin, async (req, res) => {
    try {
      const customers = await userProfileDomainService.getCustomers();
      res.json(customers);
    } catch (error) {
      console.error("Failed to fetch customers:", error);
      res.status(500).json({ error: "Failed to fetch customers" });
    }
  });

  // E: Send welcome/invite email to a user
  app.post("/api/users/:id/send-welcome", requireAdmin, async (req, res) => {
    try {
      const user = await userProfileDomainService.getUserById(req.params.id);
      if (!user) return res.status(404).json({ error: "User not found" });

      // Use existing email infrastructure (nodemailer via GMAIL_USER env)
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore – email module path may vary by build; graceful fallback below
      const { sendEmail } = await import("../lib/email.js").catch(() => ({ sendEmail: null }));
      if (!sendEmail) {
        return res.status(503).json({ error: "Email not configured. Set GMAIL_USER and GMAIL_APP_PASSWORD." });
      }

      const token = await userProfileDomainService.generatePasswordResetToken(user.id);
      const appUrl = process.env.APP_URL || "https://acetours.vu";
      const resetLink = `${appUrl}/reset-password?token=${token}`;

      await (sendEmail as any)({
        to: user.email,
        subject: "Welcome to Ace Tours & Transfers",
        html: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
<h2 style="color: #004165;">Welcome, ${user.name ?? "Staff Member"}! 👋</h2>
<p>You have been invited to join the Ace Tours & Transfers admin platform.</p>
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
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to send welcome email:", error);
      res.status(500).json({ error: "Failed to send welcome email" });
    }
  });
}
