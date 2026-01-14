import { Express, Request, Response } from "express";
import { PaymentApplicationService } from "./payment.application-service.js";
import { IStorage } from "../storage.js";
import { getStripePublishableKey } from "../stripeClient.js";
import { requireAuth, requireAdmin } from "../routes.js";
import { config } from "../config.js";

export function registerPaymentRoutes(app: Express, storage: IStorage) {
  const paymentAppService = new PaymentApplicationService(storage);

  // Get configuration
  app.get("/api/payments/config", async (req, res) => {
    try {
      const publishableKey = await getStripePublishableKey();
      const gateways = await storage.getPaymentGateways();
      
      // Filter gateways based on VISIBLE feature flags
      const visibleGateways = gateways.filter((g: any) => {
        if (!g.active) return false;
        const slug = g.slug.toLowerCase();
        
        // Manual legacy slugs should be visible if manual is generally allowed
        if (slug === 'manual') return (config.payments.manual as any)?.visible ?? true;
        
        // Handle bank specific flags
        if (slug === 'anz' || slug === 'anz-egate') return config.payments.anz.visible;
        if (slug === 'bsp') return config.payments.bsp.visible;
        if (slug === 'bred' || slug === 'bred-bank') return config.payments.bred.visible;
        if (slug === 'stripe') return config.payments.stripe.visible;
        
        return false;
      });

      res.json({ 
        stripePublishableKey: publishableKey,
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
  app.post("/api/payments/checkout", requireAuth, async (req, res) => {
    try {
      const { bookingId, provider } = req.body;
      const baseUrl = `${req.protocol}://${req.get('host')}`;

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

  // Standardized Webhook Handler
  app.post("/api/payments/webhook/:gateway", async (req, res) => {
    const gatewaySlug = req.params.gateway;
    const signature = req.headers['stripe-signature'] as string; // or dynamic based on gateway

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

  app.put("/api/admin/payment-gateways/:id", requireAdmin, async (req, res) => {
    try {
      const gateway = await storage.updatePaymentGateway(req.params.id, req.body);
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
