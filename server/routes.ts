import type { Express } from "express";
import { type Server } from "http";
import { storage } from "./storage.js";
// LOW-4: stripeClient import removed — Stripe route deprecated
import { registerAuthRoutes } from "./application/auth.routes.js";
import { registerUserRoutes } from "./application/user.routes.js";
import { registerPaymentRoutes } from "./application/payment.routes.js";
import { AvailabilityApplicationService } from "./application/availability/availability.application-service.js";
import { registerRecoveryRoutes } from "./routes/recovery.js";
import { registerBookingEngineRoutes } from "./routes/booking-engine.js";
import { BackupIntegrityGuard } from "./infrastructure/recovery/integrity-guard.js";
import { AvailabilityDomainService } from "./domain/services/availability.domain-service.js";
import { BookingApplicationService } from "./application/booking.application-service.js";

import { registerSeoRoutes } from "./routes/seo.routes.js";
import { registerAvailabilityRoutes } from "./routes/availability.routes.js";
import { registerAdminOpsRoutes } from "./routes/admin-ops.routes.js";
import { registerBookingsRoutes } from "./routes/bookings.routes.js";
import { registerCatalogRoutes } from "./routes/catalog.routes.js";
import { registerReviewRoutes } from "./routes/reviews.routes.js";
import { registerSiteRoutes } from "./routes/site.routes.js";
import { registerNotificationsRoutes } from "./routes/notifications.routes.js";
import { registerReportingRoutes } from "./routes/reporting.routes.js";
import { registerContentRoutes } from "./routes/content.routes.js";
import { requireAdmin, type RouteDeps } from "./routes/shared.js";

// Auth middlewares live in routes/shared.ts; re-exported for existing importers.
export { requireAuth, requireAdmin, requireStaff, requireBookingSession } from "./routes/shared.js";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // 1. Enforce Integrity Guard
  app.use(BackupIntegrityGuard.enforceReadOnly);

  registerSeoRoutes(app);

  registerAuthRoutes(app);
  registerUserRoutes(app);

  const availabilityDomainService = new AvailabilityDomainService(storage);
  const bookingApplicationService = new BookingApplicationService(storage, availabilityDomainService);
  const availabilityAppService = new AvailabilityApplicationService(storage);

  const routeDeps: RouteDeps = {
    bookingApplicationService,
    availabilityAppService,
    sseClients: [],
  };

  registerAvailabilityRoutes(app, routeDeps);

  registerAdminOpsRoutes(app);

  registerBookingsRoutes(app, routeDeps);

  registerCatalogRoutes(app);

  registerReviewRoutes(app);

  registerSiteRoutes(app);

  registerNotificationsRoutes(app, routeDeps);

  registerReportingRoutes(app);

  registerPaymentRoutes(app, storage);
  await registerRecoveryRoutes(app, storage);
  registerBookingEngineRoutes(app, storage, requireAdmin);

  registerContentRoutes(app);

  // Safety 404 for unknown API routes. This must remain the final API route:
  // Express matches in registration order, so placing it earlier makes every
  // subsequently registered endpoint (including the public blog API) unreachable.
  app.all("/api/*any", (req, res) => {
    res.status(404).json({ error: `Route ${req.method} ${req.originalUrl} not found` });
  });

  return httpServer;
}
