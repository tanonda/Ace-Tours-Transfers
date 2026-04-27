import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { pool as neonPool, db, initializeDatabase } from "./db.js";
import { registerRoutes } from "./routes.js";
import { serveStatic } from "./static.js";
import { createServer } from "http";
import path from "path";
import { runMigrations } from 'stripe-replit-sync';
import { getStripeSync } from './stripeClient.js';
import { config, validateConfig } from "./config.js";
import * as Sentry from "@sentry/node";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import cookieParser from "cookie-parser";
import { csrfProtection, generateCsrfToken } from "./middleware/csrf.js";


// Sentry is now initialized via --import ./server/instrument.ts for ESM compatibility

// 1. Validate environment & Log posture
validateConfig();

// Global handler for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('[FATAL] Unhandled Rejection at:', promise, 'reason:', reason);
  if (process.env.SENTRY_DSN) {
    Sentry.captureException(reason);
  }
  // Log and continue - some library-level errors (like Neon's ErrorEvent issue) 
  // shouldn't crash the entire process.
});

// Global handler for uncaught exceptions
process.on('uncaughtException', async (err) => {
  console.error('[FATAL] Uncaught Exception:', err);

  // If it's the specific Neon TypeError, we can safely ignore/log it as it's a library bug
  // related to ErrorEvent property modification in Node 24.
  if (err instanceof TypeError && err.message.includes('Cannot set property message of #<ErrorEvent>')) {
    console.warn('[RECOVERY] Suppressed Neon library bug. Continuing...');
    return;
  }

  if (process.env.SENTRY_DSN) {
    Sentry.captureException(err);
    await Sentry.flush(2000);
  }

  // H6 Fix: Crash on all other critical errors to allow process manager restart
  console.error('[FATAL] Process must exit to recover from clean state.');
  process.exit(1);
});

const app = express();
app.disable('x-powered-by'); // H4 Fix: Explicitly disable X-Powered-By

// H4 & M9 Fix: Security headers and CORS - MUST BE FIRST
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'", // Required for React inline event handlers & JSON-LD scripts
        "https://js.stripe.com",
        "https://fonts.googleapis.com",
        "https://www.googletagmanager.com",
        "https://widget.trustpilot.com", // Trustpilot review widget
      ],
      scriptSrcElem: [
        "'self'",
        "'unsafe-inline'",
        "https://js.stripe.com",
        "https://fonts.googleapis.com",
        "https://www.googletagmanager.com",
        "https://widget.trustpilot.com", // Trustpilot review widget
      ],
      styleSrc: [
        "'self'",
        "'unsafe-inline'", // Tailwind / CSS-in-JS
        "https://fonts.googleapis.com",
      ],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      imgSrc: [
        "'self'",
        "data:",
        "blob:",
        "https://res.cloudinary.com",
        "https://lh3.googleusercontent.com",
        "https://*.stripe.com",
        "https://www.googletagmanager.com",
        "https://www.transparenttextures.com", // Background texture patterns
      ],
      connectSrc: [
        "'self'",
        "https://api.stripe.com",
        "https://res.cloudinary.com",
        "https://www.googletagmanager.com",
        "https://cdn.jsdelivr.net", // Live currency exchange rates (VUV)
        "https://widget.trustpilot.com", // Trustpilot widget sourcemaps
        "https://*.ingest.de.sentry.io",
        "wss:",
        "ws:",
      ],
      frameSrc: [
        "https://js.stripe.com",
        "https://hooks.stripe.com",
        "https://widget.trustpilot.com", // Trustpilot iframe
      ],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: process.env.NODE_ENV === "production" ? [] : null,
    } as any,
  },
}));
// Session references will be initialized in the async block
let sessionStore: any;
let sessionMiddleware: any;


app.use(compression()); // L5 Fix: Add gzip compression
app.use(cors({
  origin: config.appUrl || (config.env === 'production' ? false : true), // M9 Fix: Lockdown CORS in prod
  credentials: true,
}));


const httpServer = createServer(app);

// Trust proxy for production (Render, etc.)
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

declare module "express-session" {
  interface SessionData {
    userId: string;
    userRole: string;
    bookingSessionId: string;       // scoped booking ID for guest access
    bookingSessionExpiresAt: number; // Unix timestamp, 30-min TTL
  }
}

async function initStripe() {
  if (!config.payments.stripe.enabled) {
    console.log('[STRIPE] Stripe is disabled via feature flag. Skipping initialization.');
    return;
  }

  const databaseUrl = process.env.DATABASE_URL;

  try {
    console.log('Initializing Stripe schema...');
    if (!databaseUrl) {
      throw new Error('DATABASE_URL is required but was not provided.');
    }
    await runMigrations({ databaseUrl });
    console.log('Stripe schema ready');

    const stripeSync = await getStripeSync();

    console.log('Setting up managed webhook...');
    // FIX (MED-9): Use APP_URL env var so this works on any deployment platform,
    // not just Replit.  REPLIT_DOMAINS is undefined on Render, Railway, Fly.io, etc.
    const appUrl = process.env.APP_URL ||
      (process.env.REPLIT_DOMAINS
        ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
        : null);
    if (!appUrl) {
      console.warn('[STRIPE] APP_URL is not set — skipping webhook registration. Set APP_URL=https://yourdomain.vu');
    } else {
      try {
        const result = await stripeSync.findOrCreateManagedWebhook(
          `${appUrl}/api/stripe/webhook`
        );
        if (result?.webhook?.url) {
          console.log(`Webhook configured: ${result.webhook.url}`);
        } else {
          console.log('Webhook setup returned empty result - webhooks may not work in development');
        }
      } catch (webhookError) {
        console.log('Webhook setup skipped - may not work in development mode');
      }
    }

    stripeSync.syncBackfill()
      .then(() => console.log('Stripe data synced'))
      .catch((err: any) => console.error('Error syncing Stripe data:', err));
  } catch (error) {
    console.error('Failed to initialize Stripe:', error);
  }
}

// Middleware to get raw body for webhooks, and JSON for others
app.use((req, res, next) => {
  if (req.path === '/api/stripe/webhook' || req.path.startsWith('/api/payments/webhook/') || req.path.startsWith('/api/webhooks/')) {
    express.raw({ type: '*/*' })(req, res, next);
  } else {
    express.json({
      limit: "50kb", // Prevent oversized JSON body DoS attacks
      verify: (req: any, _res, buf) => {
        req.rawBody = buf;
      },
    })(req, res, next);
  }
});

app.get('/api/health', async (_req, res) => {
  try {
    // 1. Check DB
    if (!neonPool) {
       return res.status(503).json({ status: 'starting', message: 'Database pool not initialized' });
    }
    await neonPool.query('SELECT 1');

    res.json({
      status: 'ok',
      database: 'connected',
      sessionStore: sessionStore ? 'initialized' : 'pending',
      env: {
        nodeEnv: process.env.NODE_ENV,
        hasSentry: !!process.env.SENTRY_DSN,
        hasDatabase: !!process.env.DATABASE_URL,
      }
    });
  } catch (error: any) {
    console.error('[HEALTH CHECK FAILED]', error);
    res.status(503).json({
      status: 'error',
      message: error.message,
    });
  }
});

app.post(
  '/api/stripe/webhook',
  async (req, res) => {
    const signature = req.headers['stripe-signature'] as string;
    if (!signature) {
      return res.status(400).json({ error: 'Missing stripe-signature' });
    }

    try {
      if (!Buffer.isBuffer(req.body)) {
        console.error('Webhook body is not a Buffer');
        return res.status(500).json({ error: 'Webhook processing error' });
      }

      // Redirect to modular payment service for processing
      // We pass 'stripe' as the gateway slug
      const { PaymentApplicationService } = await import('./application/payment.application-service.js');
      const { storage } = await import('./storage.js');
      const paymentAppService = new PaymentApplicationService(storage);

      const result = await paymentAppService.handlePaymentWebhook({
        gatewaySlug: 'stripe',
        rawEvent: req.body,
        signature,
      });

      if (result.success) {
        res.status(200).json({ received: true });
      } else {
        res.status(400).json({ error: result.message });
      }
    } catch (error: any) {
      console.error('Webhook error:', error.message);
      res.status(400).json({ error: 'Webhook processing error' });
    }
  }
);

app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// CSRF token endpoint — client calls this once on load
app.get("/api/csrf-token", (req, res) => {
  const token = generateCsrfToken();
  res.cookie("csrf_token", token, {
    httpOnly: false,          // JS must read this to send it as a header
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
    path: "/",
    maxAge: 24 * 60 * 60 * 1000,
  });
  res.json({ csrfToken: token });
});

// Enforce CSRF on all state-changing API requests
app.use("/api", csrfProtection);

const pgPool = neonPool;
// PGStore initialized below after middleware setup for clarity

// Session setup is now handled inside initializeDatabase block


app.use((req, res, next) => {
  // log(`[DEBUG] Session middleware checking path: ${req.path}`);
  // Skip session for Vite internal paths and static assets in dev
  const isViteDevAsset = req.path.startsWith('/@') ||
    req.path.startsWith('/vite-hmr') ||
    req.path.includes('node_modules') ||
    (process.env.NODE_ENV !== 'production' && (
      req.path.endsWith('.tsx') ||
      req.path.endsWith('.ts') ||
      req.path.endsWith('.css') ||
      req.path.endsWith('.scss') ||
      req.path.endsWith('.json') ||
      req.path.startsWith('/src/') ||
      req.path.startsWith('/assets/') ||
      req.path.match(/\.(png|jpe?g|gif|svg|woff2?|ico)$/i)
    ));

  if (isViteDevAsset || !sessionMiddleware) {
    return next();
  }

  sessionMiddleware(req, res, next);
});

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        // L7 Fix: Scrub sensitive fields before logging
        const sensitiveKeys = ['password', 'token', 'secret', 'credentials', 'credit_card', 'cvv'];
        const scrubbedResponse = JSON.parse(JSON.stringify(capturedJsonResponse, (key, value) => {
          if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
            return '[SCRUBBED]';
          }
          return value;
        }));
        logLine += ` :: ${JSON.stringify(scrubbedResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // 0. Initialize Database
  try {
    await initializeDatabase();
  } catch (dbError) {
    console.error('[FATAL] Failed to initialize database:', dbError);
    process.exit(1);
  }

  // 0.1 Initialize Session Store
  const PGStore = connectPgSimple(session);
  sessionStore = new PGStore({
    pool: neonPool as any,
    tableName: "session",
    createTableIfMissing: true,
    pruneSessionInterval: false,
  });

  sessionStore.on('error', (err: Error) => {
    console.error(`[SESSION ERROR] ${err.message}`);
  });

  sessionMiddleware = session({
    store: sessionStore,
    secret: config.session.secret!,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: config.env === "production",
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: config.env === "production" ? "strict" : "lax",
    },
  });

  // 1. Database Integrity Protection
  try {
    const { BackupIntegrityGuard } = await import('./infrastructure/recovery/integrity-guard.js');
    const integrityGuard = new BackupIntegrityGuard();

    // Run database migrations first using the existing shared pool — avoids
    // spawning a competing WebSocket connection at startup that races and times out.
    try {
      console.log('[MIGRATIONS] Running migrations...');
      const { runIdempotentMigrations } = await import('./migrate.js');
      await runIdempotentMigrations(neonPool as any);
      console.log('[MIGRATIONS] Migrations completed successfully');
    } catch (migrationError: any) {
      // Don't fail startup if migrations fail - they might already be applied.
      // Neon throws an ErrorEvent (not a standard Error) on WebSocket timeouts,
      // so we extract the real error from the nested symbol if .message is empty.
      const errMsg =
        migrationError?.message ||
        migrationError?.[Symbol.for('kError')]?.message ||
        migrationError?.code ||
        String(migrationError);
      console.warn('[MIGRATIONS] Migration execution warning:', errMsg);
    }

    const { initFeatureFlags } = await import('./feature-flags.js');
    await initFeatureFlags();

    const status = await integrityGuard.checkIntegrity();
    if (!status.isSafe) {
      console.error(`[INTEGRITY] CRITICAL: ${status.message}`);
    } else {
      console.log(`[INTEGRITY] Database verified: ${status.message}`);
    }
  } catch (error) {
    console.error('[INTEGRITY] Failed to perform initial integrity check:', error);
  }

  await initStripe();
  try {
    const { fetchLiveExchangeRates } = await import('./domain/pricing/PricingEngine.js');
    await fetchLiveExchangeRates();
  } catch (err) {
    console.warn("Could not fetch initial exchange rates", err);
  }

  // SMTP verification (non-blocking — logs warning if unreachable)
  try {
    const { verifyEmailConfig } = await import('./lib/mail.js');
    const smtpOk = await verifyEmailConfig();
    if (!smtpOk && process.env.NODE_ENV === 'production') {
      console.error('[STARTUP] WARNING: SMTP connection failed — emails will not be delivered!');
    }
  } catch (err) {
    console.warn('[STARTUP] SMTP verification skipped:', err);
  }

  // Notification cleanup (non-blocking)
  try {
    const { cleanupNotifications } = await import('./infrastructure/cleanup/notification-cleanup.js');
    await cleanupNotifications();
  } catch (err) {
    console.warn('[STARTUP] Notification cleanup skipped:', err);
  }

  await registerRoutes(httpServer, app);

  // ── Feature Flag Seed + FIU Enforcement ───────────────────────────────────
  // Inserts default flags only if missing (preserves admin UI edits) and
  // force-applies FIU-mandated overrides (e.g. vehicle-hire = false) on every
  // boot. See server/seed-flags.ts for the split.
  try {
    const { seedFlags } = await import('./seed-flags.js');
    await seedFlags();
  } catch (flagSeedErr) {
    console.error('[STARTUP] Feature flag seed failed:', flagSeedErr);
    // FIU enforcement is non-negotiable — fail fast if the seed didn't run.
    throw flagSeedErr;
  }

  // ── Gateway Auto-Seed Guard ────────────────────────────────────────────────
  // Ensures payment_gateways is never empty after a DB reset or reprovisioning.
  // Only inserts rows that don't already exist (idempotent ON CONFLICT skip).
  try {
    const { storage } = await import('./storage.js');
    const existing = await storage.getPaymentGateways();
    if (existing.length === 0) {
      console.log('[STARTUP] payment_gateways table is empty — running auto-seed...');
      const { seedGateways } = await import('./seed-gateways.js');
      await seedGateways();
    } else {
      console.log(`[STARTUP] payment_gateways OK — ${existing.length} gateways registered.`);
    }
  } catch (gwSeedErr) {
    console.warn('[STARTUP] Gateway auto-seed check failed (non-fatal):', gwSeedErr);
  }

  // Initialize Reconciliation Worker (Phase 4)
  try {
    const { storage } = await import('./storage.js');
    const { PaymentReconciliationService } = await import('./application/payment-reconciliation.service.js');
    const { ReconciliationWorker } = await import('./infrastructure/payments/reconciliation.worker.js');

    const reconService = new PaymentReconciliationService(storage);
    const reconWorker = new ReconciliationWorker(reconService, 15);
    reconWorker.start();
  } catch (reconError) {
    console.error('Failed to initialize Reconciliation Worker:', reconError);
  }

  // Initialize Hold Expiry Job
  try {
    const { storage } = await import('./storage.js');
    const { HoldExpiryJob } = await import('./infrastructure/jobs/hold-expiry.job.js');
    const holdExpiryJob = new HoldExpiryJob(storage);
    holdExpiryJob.start(60000); // Check every minute
  } catch (holdError) {
    console.error('Failed to initialize Hold Expiry Job:', holdError);
  }

  // Initialize Archive Cleanup Job (runs daily)
  try {
    const { storage } = await import('./storage.js');
    const { ArchiveCleanupJob } = await import('./infrastructure/jobs/archive-cleanup.job.js');
    const archiveCleanupJob = new ArchiveCleanupJob(storage);
    archiveCleanupJob.start();
  } catch (archiveError) {
    console.error('Failed to initialize Archive Cleanup Job:', archiveError);
  }

  // Initialize Domain Event Handlers
  try {
    const { storage } = await import('./storage.js');
    const { AvailabilityApplicationService } = await import('./application/availability/availability.application-service.js');
    const { BookingEventHandler } = await import('./application/events/BookingEventHandler.js');

    const availabilityService = new AvailabilityApplicationService(storage);
    const bookingEventHandler = new BookingEventHandler(storage, availabilityService);
    bookingEventHandler.register();

    const { AdminNotificationHandler } = await import('./application/events/AdminNotificationHandler.js');
    const adminNotificationHandler = new AdminNotificationHandler(storage, (app as any)._sseClients || []);
    adminNotificationHandler.register();

    const { GuestNotificationHandler } = await import('./application/events/GuestNotificationHandler.js');
    const guestNotificationHandler = new GuestNotificationHandler(storage);
    guestNotificationHandler.register();

    // Initialize Projections
    const { projectionEngine } = await import('./infrastructure/projections/projection-engine.js');
    const { BookingSummaryHandler } = await import('./application/projections/BookingSummaryHandler.js');
    const { RevenueByDayHandler } = await import('./application/projections/RevenueByDayHandler.js');
    const { PaymentOverviewHandler } = await import('./application/projections/PaymentOverviewHandler.js');

    projectionEngine.register(await import('./domain/events.js').then(m => m.BookingCreated), new BookingSummaryHandler(storage));
    projectionEngine.register(await import('./domain/events.js').then(m => m.PaymentConfirmed), new BookingSummaryHandler(storage));
    projectionEngine.register(await import('./domain/events.js').then(m => m.PaymentConfirmed), new RevenueByDayHandler(storage));
    projectionEngine.register(await import('./domain/events.js').then(m => m.PaymentInitiated), new PaymentOverviewHandler(storage));
    projectionEngine.register(await import('./domain/events.js').then(m => m.PaymentConfirmed), new PaymentOverviewHandler(storage));

    // Initialize Sagas
    const { BankTransferReconciliationSaga } = await import('./application/sagas/BankTransferReconciliationSaga.js');
    const saga = new BankTransferReconciliationSaga(storage);
    saga.register();

    // Periodic Saga check (every 5 minutes)
    setInterval(() => {
      saga.checkAndExpireOverduePayments().catch(err => console.error('[SAGA][ERROR] Expiry check failed:', err));
    }, 5 * 60 * 1000);

    console.log('[PROJECTION] Read-model projections registered');
    console.log('[SAGA] Bank transfer reconciliation saga active');
    console.log('[EVENT] Global event handlers registered');
  } catch (eventError) {
    console.error('Failed to initialize Domain Event Handlers:', eventError);
  }

  // Seed default feature flags (idempotent — uses upsert)
  try {
    const { storage: flagStorage } = await import('./storage.js');
    const defaultFlags = [
      { slug: 'vehicle-hire', enabled: true, displayName: 'Vehicle Hire', description: 'Enable vehicle and bus hire services' },
      { slug: 'client-dashboard', enabled: false, displayName: 'Client Dashboard', description: 'Enable user-facing booking history and profile' },
      { slug: 'reviews-system', enabled: false, displayName: 'Reviews System', description: 'Enable customer reviews and moderation' },
      { slug: 'guest-reviews', enabled: true, displayName: 'Guest Reviews', description: 'Allow guests (non-logged-in users) to submit product reviews. Disable to require account sign-in for reviews.' },
    ];
    for (const flag of defaultFlags) {
      const existing = await flagStorage.getFeatureFlag(flag.slug);
      if (!existing) {
        await flagStorage.upsertFeatureFlag(flag);
        console.log(`[FLAGS] Seeded flag: ${flag.slug}`);
      }
    }
    console.log('[FLAGS] Feature flag initialization complete');
  } catch (flagError) {
    console.error('Failed to seed feature flags:', flagError);
  }

  // Set up native Express error handler automatically provided by Sentry
  if (process.env.SENTRY_DSN) {
    // Normalizes ErrorEvents from Neon so Sentry can extract a meaningful title/message
    app.use((err: any, _req: Request, _res: Response, next: NextFunction) => {
      if (err && err.constructor && err.constructor.name === 'ErrorEvent') {
        const normalizedErr = new Error(err.message || "Neon Database Connection Error (ErrorEvent)");
        normalizedErr.name = "NeonConnectionError";
        normalizedErr.stack = err.stack;
        return next(normalizedErr);
      }
      next(err);
    });
    Sentry.setupExpressErrorHandler(app);
  }

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    if (status >= 500) {
      console.error(`[SERVER ERROR] ${status} - ${message}`);
      console.error(err.stack);
    }

    res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite.js");
    await setupVite(httpServer, app);
  }


  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})()
