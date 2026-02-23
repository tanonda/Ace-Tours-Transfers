import "dotenv/config";
import * as Sentry from "@sentry/node";

if (process.env.SENTRY_DSN) {
    Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.NODE_ENV || "development",
        tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    });
    console.log('[SENTRY] Error monitoring initialized via separate ESM import');
} else {
    console.warn('[SENTRY] SENTRY_DSN not found. Error monitoring disabled.');
}
