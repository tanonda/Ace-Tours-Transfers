/**
 * CSRF Protection — Double-Submit Cookie Pattern
 *
 * How it works:
 * 1. GET /api/csrf-token returns a random token AND sets it as a cookie.
 * 2. The client sends the token back in the X-CSRF-Token header on every
 *    state-changing request (POST, PUT, PATCH, DELETE).
 * 3. The middleware compares the header value against the cookie value.
 *    If they don't match (or are missing), the request is rejected.
 *
 * Why this is safe:
 * - A cross-origin attacker can cause the browser to *send* the cookie,
 *   but cannot *read* it (same-origin policy), so they can't set the header.
 * - Uses crypto.timingSafeEqual to prevent timing side-channels.
 */

import crypto from "crypto";
import type { Request, Response, NextFunction } from "express";

const CSRF_COOKIE = "csrf_token";
const CSRF_HEADER = "x-csrf-token";
const TOKEN_BYTES = 32;

/** Paths that are exempt from CSRF checks (webhooks, bank callbacks). */
const EXEMPT_PREFIXES = [
  "/api/payments/webhook/",
  "/api/payments/callback/",
  "/api/stripe/webhook",
  "/api/health",
];

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function generateCsrfToken(): string {
  return crypto.randomBytes(TOKEN_BYTES).toString("hex");
}

/**
 * Express middleware that enforces CSRF on unsafe methods.
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  // Safe methods don't mutate state — skip.
  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  // Exempt webhook / callback endpoints (they use signature verification instead).
  if (EXEMPT_PREFIXES.some((p) => req.path.startsWith(p))) {
    return next();
  }

  const cookieToken: string | undefined = req.cookies?.[CSRF_COOKIE];
  const headerToken: string | undefined = req.get(CSRF_HEADER);

  if (!cookieToken || !headerToken) {
    res.status(403).json({ error: "CSRF token missing. Please refresh the page and try again." });
    return;
  }

  // Constant-time comparison
  try {
    const a = Buffer.from(cookieToken, "utf8");
    const b = Buffer.from(headerToken, "utf8");
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      res.status(403).json({ error: "CSRF token mismatch. Please refresh the page and try again." });
      return;
    }
  } catch {
    res.status(403).json({ error: "CSRF token invalid." });
    return;
  }

  next();
}
