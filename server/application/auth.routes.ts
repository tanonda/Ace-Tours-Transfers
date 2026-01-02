import { Express, Request, Response } from "express";
import { authDomainService } from "../domain/users/auth.domain-service";
import { AuthApplicationService } from "./auth.application-service";
import { ExpressSessionAdapter } from "../infrastructure/session.adapter";

/**
 * Middleware adapter to use the requireAuth from the main routes file if needed,
 * or we can define a simple one here that uses the session adapter.
 */
function requireAuth(req: Request, res: Response, next: any) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
}

export function registerAuthRoutes(app: Express) {
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }

      const authAppService = new AuthApplicationService(
        authDomainService,
        new ExpressSessionAdapter(req)
      );
      
      const authResult = await authAppService.login(email, password);

      if (!authResult) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      res.json(authResult);
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Login failed" });
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
      const userId = req.session.userId;
      if (!userId) {
        return res.json(null);
      }

      const authAppService = new AuthApplicationService(
        authDomainService,
        new ExpressSessionAdapter(req)
      );
      const authResult = await authAppService.getAuthenticatedUser();

      if (!authResult) {
        req.session.destroy(() => {});
        return res.status(401).json({ error: "User not found" });
      }

      res.json(authResult);
    } catch (error) {
      console.error("Failed to get user:", error);
      res.status(500).json({ error: "Failed to get user" });
    }
  });
}
