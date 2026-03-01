
import { Express, Request, Response } from "express";
import { authDomainService } from "../domain/users/auth.domain-service.js";
import { AuthApplicationService } from "./auth.application-service.js";
import { ExpressSessionAdapter } from "../infrastructure/session.adapter.js";
import { requireAuth } from "../routes.js";
import { rateLimit } from "express-rate-limit";

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: "Too many login/registration attempts, please try again later." },
});


export function registerAuthRoutes(app: Express) {
  app.post("/api/auth/login", authLimiter, async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }

      const authAppService = new AuthApplicationService(
        authDomainService,
        new ExpressSessionAdapter(req)
      );

      console.log(`[AUTH] Login attempt for: ${email}`);
      const authResult = await authAppService.login(email, password);

      if (!authResult) {
        console.log(`[AUTH] Login failed: Invalid credentials for ${email}`);
        return res.status(401).json({ error: "Invalid email or password" });
      }

      console.log(`[AUTH] Login successful for: ${email}`);
      res.json(authResult);
    } catch (error) {
      console.error("[AUTH] Login error:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });

  app.post("/api/auth/register", authLimiter, async (req: Request, res: Response) => {
    try {
      const authAppService = new AuthApplicationService(
        authDomainService,
        new ExpressSessionAdapter(req)
      );
      const { name, email, password } = req.body;
      const authResult = await authAppService.register(name, email, password);

      res.status(201).json(authResult);
    } catch (error: any) {
      console.error("Registration error:", error);
      if (error.message.includes("User with this email already exists")) {
        return res.status(409).json({ error: error.message });
      }
      res.status(500).json({ error: "Registration failed" });
    }
  });

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

  app.get("/api/auth/me", async (req: Request, res: Response) => {
    try {
      if (!req.session) {
        console.error("[AUTH] req.session is missing!");
        return res.status(500).json({ error: "Session middleware error" });
      }

      const userId = req.session.userId;
      console.log(`[AUTH] /api/auth/me - session.userId: ${userId}`);

      if (!userId) {
        return res.json(null);
      }

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
