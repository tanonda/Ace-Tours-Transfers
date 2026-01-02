import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { runMigrations } from 'stripe-replit-sync';
import { getStripeSync } from './stripeClient';
import { config, validateConfig } from "./config";

// 1. Validate environment & Log posture
validateConfig();

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

declare module "express-session" {
  interface SessionData {
    userId: string;
    userRole: string;
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
    const webhookBaseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;
    try {
      const result = await stripeSync.findOrCreateManagedWebhook(
        `${webhookBaseUrl}/api/stripe/webhook`
      );
      if (result?.webhook?.url) {
        console.log(`Webhook configured: ${result.webhook.url}`);
      } else {
        console.log('Webhook setup returned empty result - webhooks may not work in development');
      }
    } catch (webhookError) {
      console.log('Webhook setup skipped - may not work in development mode');
    }

    stripeSync.syncBackfill()
      .then(() => console.log('Stripe data synced'))
      .catch((err: any) => console.error('Error syncing Stripe data:', err));
  } catch (error) {
    console.error('Failed to initialize Stripe:', error);
  }
}

initStripe().catch(err => {
  console.error('Critical Stripe Init Failure:', err);
});

// Modular Webhook Body Parser - must be BEFORE express.json()
app.use((req, res, next) => {
  if (req.path === '/api/stripe/webhook' || req.path.startsWith('/api/payments/webhook/')) {
    express.raw({ type: 'application/json' })(req, res, next);
  } else {
    next();
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
      const { PaymentApplicationService } = await import('./application/payment.application-service');
      const { storage } = await import('./storage');
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

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

app.use(
  session({
    secret: config.session.secret!,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: config.env === "production",
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  })
);

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
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // 1. Database Integrity Protection
  try {
    const { BackupIntegrityGuard } = await import('./infrastructure/recovery/integrity-guard');
    const integrityGuard = new BackupIntegrityGuard();
    const status = await integrityGuard.checkIntegrity();
    if (!status.isSafe) {
      console.error(`[INTEGRITY] CRITICAL: ${status.message}`);
    } else {
      console.log(`[INTEGRITY] Database verified: ${status.message}`);
    }
  } catch (error) {
    console.error('[INTEGRITY] Failed to perform initial integrity check:', error);
  }

  await registerRoutes(httpServer, app);

  // Initialize Reconciliation Worker (Phase 4)
  try {
    const { storage } = await import('./storage');
    const { PaymentReconciliationService } = await import('./application/payment-reconciliation.service');
    const { ReconciliationWorker } = await import('./infrastructure/payments/reconciliation.worker');

    const reconService = new PaymentReconciliationService(storage);
    const reconWorker = new ReconciliationWorker(reconService, 15);
    reconWorker.start();
  } catch (reconError) {
    console.error('Failed to initialize Reconciliation Worker:', reconError);
  }

  // Initialize Hold Expiry Job
  try {
    const { storage } = await import('./storage');
    const { HoldExpiryJob } = await import('./infrastructure/jobs/hold-expiry.job');
    const holdExpiryJob = new HoldExpiryJob(storage);
    holdExpiryJob.start(60000); // Check every minute
  } catch (holdError) {
    console.error('Failed to initialize Hold Expiry Job:', holdError);
  }

  // Initialize Domain Event Handlers
  try {
    const { storage } = await import('./storage');
    const { AvailabilityApplicationService } = await import('./application/availability/availability.application-service');
    const { BookingEventHandler } = await import('./application/events/BookingEventHandler');
    
    const availabilityService = new AvailabilityApplicationService(storage);
    const bookingEventHandler = new BookingEventHandler(storage, availabilityService);
    bookingEventHandler.register();

    // Initialize Projections
    const { projectionEngine } = await import('./infrastructure/projections/projection-engine');
    const { BookingSummaryHandler } = await import('./application/projections/BookingSummaryHandler');
    const { RevenueByDayHandler } = await import('./application/projections/RevenueByDayHandler');
    const { PaymentOverviewHandler } = await import('./application/projections/PaymentOverviewHandler');

    projectionEngine.register(await import('./domain/events').then(m => m.BookingCreated), new BookingSummaryHandler(storage));
    projectionEngine.register(await import('./domain/events').then(m => m.PaymentConfirmed), new BookingSummaryHandler(storage));
    projectionEngine.register(await import('./domain/events').then(m => m.PaymentConfirmed), new RevenueByDayHandler(storage));
    projectionEngine.register(await import('./domain/events').then(m => m.PaymentInitiated), new PaymentOverviewHandler(storage));
    projectionEngine.register(await import('./domain/events').then(m => m.PaymentConfirmed), new PaymentOverviewHandler(storage));

    // Initialize Sagas
    const { BankTransferReconciliationSaga } = await import('./application/sagas/BankTransferReconciliationSaga');
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

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
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
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
