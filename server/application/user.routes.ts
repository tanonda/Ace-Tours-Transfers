
import { Express, Request, Response } from "express";
import { userProfileDomainService } from "../domain/users/user-profile.domain-service.js";
import { requireAdmin } from "../routes.js";
import { insertUserSchema } from '../../shared/schema.js';
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
      const validatedData = insertUserSchema.parse(req.body);
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
      } else {
        res.status(500).json({ error: "Failed to update user role" });
      }
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
}
