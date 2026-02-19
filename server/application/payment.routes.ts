import { Express, Request, Response } from "express";
import { PaymentApplicationService } from "./payment.application-service.js";
import { IStorage } from "../storage.js";
// LOW-4: stripeClient import removed — Stripe not available to Vanuatu merchants
import { requireAuth, requireAdmin } from "../routes.js";
import { config } from "../config.js";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";

const paymentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: "Too many payment attempts, please try again later." },
});


export function registerPaymentRoutes(app: Express, storage: IStorage) {
  const paymentAppService = new PaymentApplicationService(storage);

  // Get configuration
  app.get("/api/payments/config", async (req, res) => {
    try {
      const publishableKey = null; // LOW-4: Stripe removed — no publishable key
      const gateways = await storage.getPaymentGateways();
      const flags = await storage.getFeatureFlags();

      const isFlagEnabled = (slug: string) => {
        const flag = flags.find(f => f.slug === slug);
        return flag ? flag.enabled : false;
      };

      // FIX: Stripe is not available to Vanuatu merchants.
      // It is excluded from the active gateway list unless explicitly enabled via
      // the STRIPE_ENABLED=true environment variable AND the 'payment-stripe' feature flag.
      const stripeExplicitlyEnabled = process.env.STRIPE_ENABLED === 'true';

      // Filter gateways based on FEATURE FLAGS
      const visibleGateways = gateways.filter((g: any) => {
        if (!g.active) return false;
        const slug = g.slug.toLowerCase();

        if (slug === 'stripe') return stripeExplicitlyEnabled && isFlagEnabled('payment-stripe');
        if (slug === 'bank-transfer' || slug === 'manual' || slug === 'manual_transfer' || slug === 'bank') {
          return isFlagEnabled('payment-bank-transfer');
        }
        if (slug === 'cash') {
          return isFlagEnabled('payment-cash-on-delivery');
        }

        // Default to active if no specific flag
        return true;
      });

      res.json({
        stripePublishableKey: null, // LOW-4: Stripe removed
        availableGateways: visibleGateways.map((g: any) => ({
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
      const isFlagEnabled = (slug: string) => flags.find(f => f.slug === slug)?.enabled ?? false;

      if (provider === 'stripe' && !isFlagEnabled('payment-stripe')) {
        return res.status(403).json({ error: "Stripe payments are currently disabled" });
      }
      if ((provider === 'manual' || provider === 'bank-transfer') && !isFlagEnabled('payment-bank-transfer')) {
        return res.status(403).json({ error: "Bank transfer payments are currently disabled" });
      }
      if (provider === 'cash' && !isFlagEnabled('payment-cash-on-delivery')) {
        return res.status(403).json({ error: "Cash on delivery is currently disabled" });
      }

      const result = await paymentAppService.initiateBookingPayment({
        bookingId,
        userId: req.session.userId,
        sessionId: req.sessionID, // CRITICAL: Pass session ID for guest ownership
        provider: provider || 'stripe',
        successUrl: `${baseUrl}/payment/success?booking=${bookingId}`,
        cancelUrl: `${baseUrl}/payment/cancel?booking=${bookingId}`,
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
      const isOwner = booking && (booking.userId === req.session.userId || booking.bookingSessionId === req.sessionID);

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
      const isOwner = booking && (booking.userId === req.session.userId || booking.bookingSessionId === req.sessionID);

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
  const BANK_GATEWAY_SLUGS = ['anz-egate', 'bsp-bank', 'bred-bank', 'wantok-money', 'generic-local-bank'];

  app.get("/api/payments/callback/:gateway", async (req, res) => {
    const { gateway } = req.params;

    if (!BANK_GATEWAY_SLUGS.includes(gateway)) {
      return res.status(404).json({ error: "Unknown gateway callback" });
    }

    try {
      // The bank sends all vpc_ parameters in the query string.
      // We pass them as-is to the adapter's handleWebhook().
      const vpcParams = req.query as Record<string, string>;
      const bookingId: string = vpcParams.vpc_OrderInfo || "";

      const result = await paymentAppService.handlePaymentWebhook({
        gatewaySlug: gateway,
        rawEvent: vpcParams,
        signature: vpcParams.vpc_SecureHash || "",
      });

      // Always redirect the browser — never show a raw JSON error to the customer.
      if (result.success) {
        console.log(`[BANK CALLBACK][${gateway}] Payment confirmed for booking ${bookingId}`);
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
  app.post("/api/payments/callback/:gateway", async (req, res) => {
    const { gateway } = req.params;

    if (!BANK_GATEWAY_SLUGS.includes(gateway)) {
      return res.status(404).json({ error: "Unknown gateway callback" });
    }

    try {
      const vpcParams = { ...req.body, ...req.query } as Record<string, string>;
      const bookingId: string = vpcParams.vpc_OrderInfo || "";

      const result = await paymentAppService.handlePaymentWebhook({
        gatewaySlug: gateway,
        rawEvent: vpcParams,
        signature: vpcParams.vpc_SecureHash || "",
      });

      if (result.success) {
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

  // Additional Payment Routes for parity
  app.get("/api/payment-gateways/active", async (req, res) => {
    try {
      const gateway = await storage.getActivePaymentGateway();
      if (!gateway) {
        return res.status(404).json({ error: "No active payment gateway" });
      }
      res.json(gateway);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch active payment gateway" });
    }
  });

  app.get("/api/payment-gateways", async (req, res) => {
    try {
      const gateways = await storage.getPaymentGateways();
      res.json(gateways.map((g: any) => ({
        id: g.id,
        slug: g.slug,
        displayName: g.displayName,
        description: g.description,
        active: g.active,
        isDefault: g.isDefault,
        supportedCurrencies: g.supportedCurrencies
      })));
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

  // CRIT-5 FIX: Validate update body — only allow known, safe fields.
  // Credentials and slug are excluded to prevent injection.
  const gatewayUpdateSchema = z.object({
    displayName: z.string().min(1).max(100).optional(),
    description: z.string().max(500).nullable().optional(),
    active: z.boolean().optional(),
    isDefault: z.boolean().optional(),
    priority: z.number().int().min(0).max(100).optional(),
    config: z.record(z.any()).optional(),
  }).strict(); // .strict() rejects any extra keys

  app.put("/api/admin/payment-gateways/:id", requireAdmin, async (req, res) => {
    try {
      const parsed = gatewayUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "Invalid gateway update data",
          details: parsed.error.flatten().fieldErrors,
        });
      }
      const gateway = await storage.updatePaymentGateway(req.params.id, parsed.data);
      res.json(gateway);
    } catch (error) {
      res.status(400).json({ error: "Failed to update payment gateway" });
    }
  });

  app.post("/api/admin/payment-gateways/:id/set-default", requireAdmin, async (req, res) => {
    try {
      await storage.setDefaultPaymentGateway(req.params.id);
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
      res.json({ success: true, message: "Payment status synced with gateway" });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to sync payment status" });
    }
  });
}
