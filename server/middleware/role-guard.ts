import type { NextFunction, Request, Response } from "express";

type UserLookup = (id: string) => Promise<{ role: string; isActive: boolean } | undefined>;

/**
 * Privileged-route guard that re-reads the user's role and active flag on every request.
 * The role cached in the session at login would otherwise keep a demoted or deactivated
 * admin in the dashboard until the 24h session expired.
 */
export function requireRole(getUser: UserLookup, roles: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.session.userId;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const user = await getUser(userId);
    if (!user || user.isActive === false) {
      return res.status(401).json({ error: "Authentication required" });
    }

    req.session.userRole = user.role;
    if (!roles.includes(user.role)) {
      console.log(`[AUTH] 403 Forbidden (${roles.join("/")} required): ${req.method} ${req.path}`);
      return res.status(403).json({ error: roles.includes("admin") && roles.length === 1 ? "Admin access required" : "Staff access required" });
    }

    next();
  };
}
