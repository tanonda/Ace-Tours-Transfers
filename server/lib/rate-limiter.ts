import { Request, Response, NextFunction } from "express";

interface RateLimitRecord {
    count: number;
    resetAt: number;
}

const records = new Map<string, RateLimitRecord>();

/**
 * Simple in-memory rate limiter middleware.
 * @param windowMs Time window in milliseconds
 * @param max Max requests per window
 * @param message Error message
 */
export const rateLimit = (
    windowMs: number = 60000,
    max: number = 10,
    message: string = "Too many requests, please try again later."
) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const key = req.ip || "anonymous";
        const now = Date.now();
        const record = records.get(key);

        if (!record || now > record.resetAt) {
            records.set(key, {
                count: 1,
                resetAt: now + windowMs
            });
            return next();
        }

        record.count++;
        if (record.count > max) {
            return res.status(429).json({ error: message });
        }

        next();
    };
};
