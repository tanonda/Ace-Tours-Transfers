import { Express, Request, Response } from "express";
import { PaymentApplicationService } from "./payment.application-service.js";
import { IStorage } from "../storage.js";
// LOW-4: stripeClient import removed — Stripe not available to Vanuatu merchants
import { requireAuth, requireAdmin } from "../routes.js";
import { config } from "../config.js";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { adminAudit } from "../infrastructure/audit/admin-audit-log.service.js";
import { toPublicGateway, visibleGateways, isTestModeGateway } from "./public-gateway.js";
import { PaymentStatus, WebhookResponse } from "../domain/payments/interfaces.js";
import { MpgsHostedCheckoutAdapter, isMpgsGateway, parseMpgsSessionId, renderMpgsLaunchPage } from "../infrastructure/payments/mpgs.adapter.js";

const paymentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: "Too many payment attempts, please try again later." },
});

const callbackLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: "Too many callback requests." },
});


export function registerPaymentRoutes(app: Express, storage: IStorage) {
  const paymentAppService = new PaymentApplicationService(storage);

  // Get configuration
  app.get("/api/payments/config", async (req, res) => {
    try {
      const publishableKey = null; // LOW-4: Stripe removed — no publishable key
      const gateways = await storage.getPaymentGateways();
      const flags = await storage.getFeatureFlags();

      const shown = visibleGateways(gateways, flags, { isAdmin: req.session.userRole === 'admin' });

      res.set('Cache-Control', 'private, no-store'); // differs for admins (TEST-mode gateways)
      res.json({
        stripePublishableKey: null, // LOW-4: Stripe removed
        availableGateways: shown.map((g: any) => ({
          id: g.id,
          slug: g.slug,
          displayName: g.displayName,
          isDefault: g.isDefault,
        }))
      });
    } catch (error) {
      console.error("Payment config error:", error);
      res.status(500).json({ error: "Failed to get payment configuration" });
    }
  });

  // Create checkout session
  app.post("/api/payments/checkout", paymentLimiter, async (req, res) => {  // Guest-friendly: ownership verified inside
    try {
      const { bookingId, provider } = req.body;
      const baseUrl = `${req.protocol}://${req.get('host')}`;

      // FEATURE FLAG GUARD
      const flags = await storage.getFeatureFlags();
      const isFlagEnabled = (slug: string, defaultValue = true) => flags.find(f => f.slug === slug)?.enabled ?? defaultValue;

      if (provider === 'stripe' && !isFlagEnabled('payment-stripe')) {
        return res.status(403).json({ error: "Stripe payments are currently disabled" });
      }
      // Check canonical bank transfer slug
      if ((provider === 'manual' || provider === 'manual_transfer') && !isFlagEnabled('payment-bank-transfer')) {
        return res.status(403).json({ error: "Bank transfer payments are currently disabled" });
      }
      if (provider === 'cash' && !isFlagEnabled('payment-cash-on-delivery')) {
        return res.status(403).json({ error: "Cash on delivery is currently disabled" });
      }

      const result = await paymentAppService.initiateBookingPayment({
        bookingId,
        userId: req.session.userId,
        sessionId: req.sessionID, // CRITICAL: Pass session ID for guest ownership
        recentBookingIds: (req.session as any).recentBookingIds || [], // Checkout flow: recently created bookings
        provider: provider,
        successUrl: `${req.protocol}://${req.get('host')}/payment/success?booking=${bookingId}`,
        cancelUrl: `${req.protocol}://${req.get('host')}/payment/cancel?booking=${bookingId}`,
        isAdmin: req.session.userRole === 'admin',
      });

      if (!result.success) {
        return res.status(400).json({ error: result.message });
      }

      // Return in the shape expected by the frontend (PaymentIntent type)
      res.json({
        id: result.paymentId, // The frontend expects the internal payment ID here for Stripe flow in A
        bookingId: bookingId,
        amount: result.amount, // This matches A's weird amount parsing if I check carefully? No, A used booking_amount.
        checkoutUrl: result.redirectUrl,
        checkoutForm: result.formPost, // PayZen: the browser must POST these fields
        status: 'pending',
        provider: result.provider,
        currency: result.currency,
      });
    } catch (error: any) {
      console.error("Checkout error:", error);
      res.status(500).json({ error: "Failed to create checkout session" });
    }
  });

  // Get payment status
  app.get("/api/payments/:id/status", requireAuth, async (req, res) => {
    try {
      const payment = await paymentAppService.getPaymentStatus(req.params.id);
      if (!payment) {
        return res.status(404).json({ error: "Payment not found" });
      }

      // SECURITY: Ownership or Admin check
      const booking = await storage.getBooking(payment.bookingId);
      const isAdmin = req.session.userRole === 'admin';
      const isOwner = booking && (booking.userId === req.session.userId || booking.bookingSessionId === req.sessionID
        || (req.session as any).recentBookingIds?.includes(booking.id)); // bookings now key holds by their own ID

      if (!isAdmin && !isOwner) {
        return res.status(403).json({ error: "Access denied" });
      }

      // SECURITY: Mask PII for non-admins
      if (!isAdmin) {
        const { selectPublicPaymentSchema } = await import("../../shared/schema.js");
        return res.json(selectPublicPaymentSchema.parse(payment));
      }

      res.json(payment);
    } catch (error) {
      res.status(500).json({ error: "Failed to get payment status" });
    }
  });

  // Get payments for a booking
  app.get("/api/bookings/:id/payments", requireAuth, async (req, res) => {
    try {
      const bookingId = req.params.id;
      const booking = await storage.getBooking(bookingId);

      const isAdmin = req.session.userRole === 'admin';
      const isOwner = booking && (booking.userId === req.session.userId || booking.bookingSessionId === req.sessionID
        || (req.session as any).recentBookingIds?.includes(booking.id)); // bookings now key holds by their own ID

      if (!isAdmin && !isOwner) {
        return res.status(403).json({ error: "Access denied" });
      }

      const payments = await storage.getPaymentsByBooking(bookingId);

      // Mask PII for non-admins
      if (!isAdmin) {
        const { selectPublicPaymentSchema } = await import("../../shared/schema.js");
        return res.json(payments.map((p: any) => selectPublicPaymentSchema.parse(p)));
      }

      res.json(payments);
    } catch (error) {
      res.status(500).json({ error: "Failed to get booking payments" });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // BANK GATEWAY RETURN-URL CALLBACKS
  //
  // ANZ eGate, BSP, and BRED Bank redirect the customer back to our site
  // after the hosted checkout completes.  The bank appends vpc_ parameters
  // (result code, merchant transaction ref, secure hash) to the ReturnURL.
  //
  // This route verifies the hash, records the payment outcome, and then
  // redirects the customer to the success or cancel page.
  // ─────────────────────────────────────────────────────────────────────────
  const BANK_GATEWAY_SLUGS = ['anz-egate', 'bsp-bank', 'nbv-bank', 'bred-bank', 'wantok-money', 'generic-local-bank'];

  // A payment is shown the success page (which polls the booking) unless the bank said no.
  const paidOrPending = (result: WebhookResponse) =>
    result.success &&
    ![PaymentStatus.Failed, PaymentStatus.Cancelled, PaymentStatus.Expired].includes(result.newPaymentStatus as PaymentStatus);

  // MPGS launch page (ANZ, BSP, NBV): loads the bank's checkout.js for the session created
  // by initiatePayment and hands the guest to the bank's hosted payment page.
  app.get("/api/payments/checkout/:gateway", callbackLimiter, async (req, res) => {
    const sessionId = parseMpgsSessionId(req.query.session);
    if (!sessionId || !isMpgsGateway(req.params.gateway)) return res.redirect('/payment/cancel?reason=system_error');
    try {
      const gateway = await storage.getPaymentGatewayBySlug(req.params.gateway);
      if (!gateway || !gateway.active) return res.redirect('/payment/cancel?reason=system_error');
      const adapter = new MpgsHostedCheckoutAdapter(gateway);
      const { html, csp } = renderMpgsLaunchPage(adapter.checkoutScriptUrl, sessionId, '/payment/cancel?reason=gateway_rejected');
      res.set('Content-Security-Policy', csp);
      res.set('Cache-Control', 'no-store');
      res.set('Referrer-Policy', 'no-referrer');
      return res.type('html').send(html);
    } catch (error: any) {
      console.error('[MPGS LAUNCH] Error:', error);
      return res.redirect('/payment/cancel?reason=system_error');
    }
  });

  app.get("/api/payments/callback/:gateway", callbackLimiter, async (req, res) => {
    const { gateway } = req.params;

    if (!BANK_GATEWAY_SLUGS.includes(gateway)) {
      return res.status(404).json({ error: "Unknown gateway callback" });
    }

    try {
      // VPC banks send vpc_ parameters in the query string; ANZ (MPGS) sends back the
      // order/booking we put in its return URL. Either way the adapter decides.
      const vpcParams = req.query as Record<string, string>;

      const result = await paymentAppService.handlePaymentWebhook({
        gatewaySlug: gateway,
        rawEvent: vpcParams,
        signature: vpcParams.vpc_SecureHash || "",
      });
      const bookingId: string = result.bookingId || vpcParams.vpc_OrderInfo || vpcParams.booking || "";

      // Always redirect the browser — never show a raw JSON error to the customer.
      if (paidOrPending(result)) {
        console.log(`[BANK CALLBACK][${gateway}] ${result.message} for booking ${bookingId}`);
        return res.redirect(`/payment/success?booking=${encodeURIComponent(bookingId)}`);
      } else {
        console.warn(`[BANK CALLBACK][${gateway}] Payment failed/rejected for booking ${bookingId}: ${result.message}`);
        return res.redirect(`/payment/cancel?booking=${encodeURIComponent(bookingId)}&reason=gateway_rejected`);
      }
    } catch (error: any) {
      console.error(`[BANK CALLBACK][${gateway}] Error:`, error);
      // Redirect to a generic error page rather than showing a 500
      return res.redirect(`/payment/cancel?reason=system_error`);
    }
  });

  // POST variant — some banks POST the callback parameters instead of GET
  app.post("/api/payments/callback/:gateway", callbackLimiter, async (req, res) => {
    const { gateway } = req.params;

    if (!BANK_GATEWAY_SLUGS.includes(gateway)) {
      return res.status(404).json({ error: "Unknown gateway callback" });
    }

    try {
      const vpcParams = { ...req.body, ...req.query } as Record<string, string>;

      const result = await paymentAppService.handlePaymentWebhook({
        gatewaySlug: gateway,
        rawEvent: vpcParams,
        signature: vpcParams.vpc_SecureHash || "",
      });
      const bookingId: string = result.bookingId || vpcParams.vpc_OrderInfo || vpcParams.booking || "";

      if (paidOrPending(result)) {
        return res.redirect(`/payment/success?booking=${encodeURIComponent(bookingId)}`);
      } else {
        return res.redirect(`/payment/cancel?booking=${encodeURIComponent(bookingId)}&reason=gateway_rejected`);
      }
    } catch (error: any) {
      console.error(`[BANK CALLBACK POST][${gateway}] Error:`, error);
      return res.redirect(`/payment/cancel?reason=system_error`);
    }
  });

  // Standardized Webhook Handler
  app.post("/api/payments/webhook/:gateway", async (req, res) => {
    const gatewaySlug = req.params.gateway;
    const signature = req.headers['stripe-signature'] as string;

    // BRED Bank (PayZen) Instant Payment Notification: a form-encoded POST whose
    // signature is inside the body. PayZen logs the first 256 bytes of the reply
    // in its Back Office and retries on any non-200 status.
    if (gatewaySlug === 'bred-bank') {
      try {
        const result = await paymentAppService.handlePaymentWebhook({ gatewaySlug, rawEvent: req.body });
        if (!result.success) {
          console.warn(`[PAYZEN IPN] Rejected: ${result.message}`);
        }
        return res
          .status(result.success ? 200 : 400)
          .type('text/plain')
          .send(result.message || (result.success ? 'OK' : 'Rejected'));
      } catch (error: any) {
        console.error('[PAYZEN IPN] Error:', error);
        return res.status(500).type('text/plain').send('Error while processing the notification');
      }
    }

    // MPGS notification (ANZ, BSP, NBV): JSON body, X-Notification-Secret header. The adapter
    // re-reads the order from the bank, so the body itself is never trusted. MPGS retries on non-200.
    if (isMpgsGateway(gatewaySlug)) {
      try {
        const result = await paymentAppService.handlePaymentWebhook({
          gatewaySlug,
          rawEvent: req.body,
          headers: req.headers as Record<string, string>,
        });
        if (!result.success) console.warn(`[MPGS NOTIFICATION] Rejected: ${result.message}`);
        return res.status(result.success ? 200 : 400).type('text/plain').send(result.success ? 'OK' : 'Rejected');
      } catch (error: any) {
        console.error('[MPGS NOTIFICATION] Error:', error);
        return res.status(500).type('text/plain').send('Error while processing the notification');
      }
    }

    // H7 Fix: Signature verification and Method Not Allowed for manual
    if (gatewaySlug !== 'stripe') {
      return res.status(405).json({ error: "Method Not Allowed: Webhooks not supported for this gateway." });
    }

    try {
      const result = await paymentAppService.handlePaymentWebhook({
        gatewaySlug,
        rawEvent: req.body,
        signature,
      });

      if (result.success) {
        res.json({ received: true });
      } else {
        res.status(400).json({ error: result.message });
      }
    } catch (error: any) {
      console.error(`Webhook error (${gatewaySlug}):`, error);
      res.status(500).json({ error: "Webhook processing failed" });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // GUEST-FACING: Payment Methods (grouped by category)
  //
  // Returns guest-friendly payment method options (Card, PayPal, Mobile Money,
  // etc.) instead of raw gateway slugs. The admin's gateway configuration
  // (priority, isDefault) determines which gateway is auto-selected per category.
  // ─────────────────────────────────────────────────────────────────────────
  app.get("/api/payment-methods", async (req, res) => {
    try {
      const { PaymentMethodClassifier } = await import("../domain/payments/payment-method-classifier.js");
      const gateways = await storage.getPaymentGateways();
      const flags = await storage.getFeatureFlags();
      const shown = visibleGateways(gateways, flags, { isAdmin: req.session.userRole === 'admin' });

      const methods = PaymentMethodClassifier.groupByMethod(shown);
      res.set('Cache-Control', 'private, no-store'); // differs for admins (TEST-mode gateways)
      res.json(methods);
    } catch (error) {
      console.error("Payment methods error:", error);
      res.status(500).json({ error: "Failed to fetch payment methods" });
    }
  });

  // Additional Payment Routes for parity
  app.get("/api/payment-gateways/active", async (req, res) => {
    try {
      const gateway = await storage.getActivePaymentGateway();
      if (!gateway || (isTestModeGateway(gateway) && req.session.userRole !== 'admin')) {
        return res.status(404).json({ error: "No active payment gateway" });
      }
      res.set('Cache-Control', 'private, no-store');
      res.json(toPublicGateway(gateway));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch active payment gateway" });
    }
  });

  app.get("/api/payment-gateways", async (req, res) => {
    try {
      const gateways = await storage.getPaymentGateways();
      const flags = await storage.getFeatureFlags();
      const shown = visibleGateways(gateways, flags, { isAdmin: req.session.userRole === 'admin' });

      res.set('Cache-Control', 'private, no-store'); // differs for admins (TEST-mode gateways)
      res.json(shown.map(toPublicGateway));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch payment gateways" });
    }
  });

  app.get("/api/admin/payment-gateways", requireAdmin, async (req, res) => {
    try {
      const gateways = await storage.getPaymentGateways();
      res.json(gateways);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch payment gateways" });
    }
  });

  // Allow updating credentials and config — credentials must be an object (not validated here,
  // schema-level validation happens client-side via Zod schemas in payments.tsx).
  const gatewayUpdateSchema = z.object({
    displayName: z.string().min(1).max(100).optional(),
    description: z.string().max(500).nullable().optional(),
    active: z.boolean().optional(),
    isDefault: z.boolean().optional(),
    priority: z.number().int().min(0).max(100).optional(),
    credentials: z.record(z.any()).optional(), // Gateway API keys/secrets
    config: z.record(z.any()).optional(),
  }); // No .strict() — allow forward-compatible fields

  app.put("/api/admin/payment-gateways/:id", requireAdmin, async (req, res) => {
    try {
      const parsed = gatewayUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "Invalid gateway update data",
          details: parsed.error.flatten().fieldErrors,
        });
      }
      // Fetch before-state for diff
      const before = await storage.getPaymentGateway(req.params.id);
      const gateway = await storage.updatePaymentGateway(req.params.id, parsed.data);

      // Determine action label: credentials-only save vs general update
      const hasCredentials = parsed.data.credentials && Object.keys(parsed.data.credentials).length > 0;
      const action = hasCredentials ? "gateway.credentials_update" : "gateway.update";

      await adminAudit.log({
        action,
        entityType: "payment_gateway",
        entityId: gateway.slug,
        entityName: gateway.displayName,
        performedBy: (req.session as any)?.userId,
        previousValue: before,
        newValue: gateway,
        req,
      });

      res.json(gateway);
    } catch (error: any) {
      if (error?.message?.includes("PAYMENT_CREDENTIALS_KEY")) {
        console.error("[GATEWAY] Cannot save credentials:", error.message);
        return res.status(500).json({ error: "Gateway keys cannot be saved: the server's PAYMENT_CREDENTIALS_KEY is not configured." });
      }
      res.status(400).json({ error: "Failed to update payment gateway" });
    }
  });

  // Admin: a bank-hosted payment link (ANZ/BSP/NBV on MPGS) for a pending booking,
  // to send to the guest by email or text.
  const paymentLinkSchema = z.object({ gateway: z.string().min(1) });
  app.post("/api/admin/bookings/:id/payment-link", requireAdmin, async (req, res) => {
    const parsed = paymentLinkSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Choose a bank for the payment link." });
    try {
      const result = await paymentAppService.createPaymentLink({
        bookingId: req.params.id,
        gatewaySlug: parsed.data.gateway,
        siteOrigin: `${req.protocol}://${req.get('host')}`,
      });
      if (!result.success) return res.status(400).json({ error: result.message });

      await adminAudit.log({
        action: "payment.link_created",
        entityType: "booking",
        entityId: req.params.id,
        performedBy: (req.session as any)?.userId,
        newValue: { gateway: parsed.data.gateway, paymentId: result.paymentId, expiresAt: result.expiresAt },
        req,
      });
      res.json({ url: result.url, paymentId: result.paymentId, expiresAt: result.expiresAt });
    } catch (error: any) {
      console.error("[PAYMENT LINK] Error:", error);
      res.status(500).json({ error: "Failed to create the payment link." });
    }
  });

  app.post("/api/admin/payment-gateways/:id/set-default", requireAdmin, async (req, res) => {
    try {
      const before = await storage.getPaymentGateway(req.params.id);
      await storage.setDefaultPaymentGateway(req.params.id);
      const after = await storage.getPaymentGateway(req.params.id);

      await adminAudit.log({
        action: "gateway.set_default",
        entityType: "payment_gateway",
        entityId: before?.slug,
        entityName: before?.displayName,
        performedBy: (req.session as any)?.userId,
        previousValue: { isDefault: before?.isDefault },
        newValue: { isDefault: after?.isDefault },
        req,
      });

      res.json({ message: "Default gateway set successfully" });
    } catch (error) {
      res.status(400).json({ error: "Failed to set default gateway" });
    }
  });

  app.get("/api/admin/payments", requireAdmin, async (req, res) => {
    try {
      const payments = await storage.getPayments();
      res.json(payments);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch payments" });
    }
  });

  // Admin: Manual reconciliation
  app.post("/api/admin/payments/:id/reconcile", requireAdmin, async (req, res) => {
    try {
      const { PaymentReconciliationService } = await import("./payment-reconciliation.service.js");
      const reconService = new PaymentReconciliationService(storage);

      const { note, forceStatus } = req.body;
      if (!note) {
        return res.status(400).json({ error: "Reconciliation note is required" });
      }

      await reconService.reconcileManually(
        req.params.id,
        (req.session as any).userId,
        note,
        forceStatus
      );

      await adminAudit.log({
        action: "payment.reconcile",
        entityType: "booking",
        entityId: req.params.id,
        performedBy: (req.session as any)?.userId,
        metadata: { note, forceStatus },
        req,
      });

      res.json({ success: true, message: "Payment reconciled successfully" });
    } catch (error: any) {
      console.error("Manual reconciliation error:", error);
      res.status(500).json({ error: error.message || "Failed to reconcile payment" });
    }
  });

  // Admin: Trigger sync for a specific payment
  app.post("/api/admin/payments/:id/sync", requireAdmin, async (req, res) => {
    try {
      const { PaymentReconciliationService } = await import("./payment-reconciliation.service.js");
      const reconService = new PaymentReconciliationService(storage);

      await reconService.syncPaymentStatus(req.params.id);

      await adminAudit.log({
        action: "payment.sync",
        entityType: "booking",
        entityId: req.params.id,
        performedBy: (req.session as any)?.userId,
        req,
      });

      res.json({ success: true, message: "Payment status synced with gateway" });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to sync payment status" });
    }
  });
}
