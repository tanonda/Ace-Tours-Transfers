import { Express, Request, Response } from "express";
import { userProfileDomainService } from "../domain/users/user-profile.domain-service";
import { insertUserSchema } from "@shared/schema";

// Middleware local to this file for now, or imported from routes.ts if shared
function requireAdmin(req: Request, res: Response, next: any) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Authentication required" });
  }
  if (req.session.userRole !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

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
      // Matching A's response shape: { id, username, email, name }
      res.status(201).json({ 
        id: user.id, 
        username: user.username, 
        email: user.email, 
        name: user.name 
      });
    } catch (error) {
      console.error("User creation error:", error);
      res.status(400).json({ error: "Invalid user data" });
    }
  });

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
      // Matching A's response shape: { id, username, email, name, role }
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
