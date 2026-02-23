import { config } from "dotenv";
config();
import * as Sentry from "@sentry/node";
Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || "development",
    tracesSampleRate: 1.0,
});
console.log("Sentry testing...");
Sentry.captureException(new Error("Test Sentry Error"));
console.log("Done");
