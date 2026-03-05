// server/application/payment.application-service.ts

import {
  PaymentInitiationRequest,
  PaymentInitiationResponse,
  PaymentStatus,
  WebhookEvent,
  WebhookResponse,
} from '../domain/payments/interfaces.js';
import { PaymentMethodClassifier } from '../domain/payments/payment-method-classifier.js';
import { IStorage } from '../storage.js';
import { PaymentFactory } from "../infrastructure/payments/factory.js";
import { PaymentGateway, Booking } from '../../shared/schema.js';
import { config } from "../config.js";
import { PaymentIntent } from "../domain/payments/PaymentIntent.js";
import { eventDispatcher } from "../infrastructure/events/event-dispatcher.js";
import { BookingConfirmationService } from "./booking/BookingConfirmationService.js";
import {
  sendEmail,
  sendAdminEmail,
  getPaymentConfirmationTemplate,
  getBookingRequestTemplate,
  getAdminNewBookingTemplate,
  shortBookingRef
} from "../lib/mail.js";

export interface PaymentOptions {
  bookingId: string;
  userId?: string;
  sessionId: string;
  recentBookingIds?: string[]; // Recently created booking IDs from this session (checkout flow)
  provider?: string;
  successUrl: string;
  cancelUrl: string;
}

export class PaymentApplicationService {

  private storage: IStorage;
  private bookingConfirmation: BookingConfirmationService;

  constructor(storage: IStorage) {
    this.storage = storage;
    this.bookingConfirmation = new BookingConfirmationService(storage);
  }

  async initiateBookingPayment(options: PaymentOptions): Promise<PaymentInitiationResponse> {
    // 0. Kill Switch Enforcement
    if (config.killSwitches.paymentsPaused) {
      return { success: false, message: "CRITICAL: Payment systems are currently paused for maintenance. Existing bookings are safe." };
    }

    const booking = await this.storage.getBooking(options.bookingId);
    if (!booking) {
      return { success: false, message: "Booking not found" };
    }

    if (booking.status !== 'pending') {
      return { success: false, message: `Checkout rejected: Booking is in state '${booking.status}'` };
    }

    const isOwner = (booking.userId && booking.userId === options.userId) ||
      (booking.bookingSessionId === options.sessionId) ||
      (options.recentBookingIds?.includes(options.bookingId));

    if (!isOwner) {
      return { success: false, message: "Unauthorized: Access denied." };
    }

    const existingPayments = await this.storage.getPaymentsByBooking(booking.id);
    const activePayment = existingPayments.find(p =>
      [PaymentStatus.Pending, PaymentStatus.Processing].includes(p.status as PaymentStatus)
    );

    if (activePayment) {
      return {
        success: false,
        message: "An active payment attempt already exists for this booking.",
        paymentId: activePayment.id
      };
    }

    if (booking.holdId) {
      const hold = await this.storage.getHold(booking.holdId);
      if (!hold || hold.status !== 'ACTIVE') {
        return {
          success: false,
          message: "Checkout rejected: Inventory hold expired."
        };
      }

      // FIX: Extend hold TTL for offline payment methods (bank transfer / cash).
      // The initial hold is created at booking time with a short TTL (15 min) because
      // the payment method is not yet known.  Once the customer selects an offline method
      // we extend to 72 hours so the hold survives the payment window.
      const { MANUAL_PAYMENT_TTL_MINUTES } = await import("./availability/availability.application-service.js");
      const chosenSlug = (options.provider || '').toLowerCase();
      const isManual = PaymentMethodClassifier.isOffline(chosenSlug);
      if (isManual) {
        const extendedExpiry = new Date();
        extendedExpiry.setMinutes(extendedExpiry.getMinutes() + MANUAL_PAYMENT_TTL_MINUTES);
        await this.storage.updateHold(hold.id, { expiresAt: extendedExpiry });

        // Also extend all session holds (multi-item bookings)
        if (booking.bookingSessionId) {
          const sessionHolds = await this.storage.getHoldsBySession(booking.bookingSessionId);
          for (const sh of sessionHolds) {
            if (sh.id !== hold.id) {
              await this.storage.updateHold(sh.id, { expiresAt: extendedExpiry });
            }
          }
        }
        console.log(`[PAYMENT] Extended hold TTL to 72h for manual payment method '${chosenSlug}', booking ${booking.id}`);
      }
    }

    const user = options.userId ? await this.storage.getUser(options.userId) : null;
    const customerEmail = user?.email || booking.customerEmail;
    const customerName = user?.name || booking.customerName;

    if (!customerEmail || !customerName) {
      return { success: false, message: "Customer details missing for payment" };
    }

    let gateway: PaymentGateway | undefined;
    if (options.provider) {
      gateway = await this.storage.getPaymentGatewayBySlug(options.provider);
      if (!gateway || !gateway.active) {
        return { success: false, message: `Payment provider ${options.provider} is not active` };
      }
    } else {
      gateway = await this.storage.getActivePaymentGateway();
      if (!gateway) {
        return { success: false, message: "No active payment provider found" };
      }
    }

    // PRODUCTION GUARD: Card providers might be disabled
    if (PaymentMethodClassifier.isOnlineCard(gateway.slug) && config.killSwitches.cardPaymentsPaused) {
      return { success: false, message: "Card payments are currently disabled for maintenance. Please use Bank Transfer." };
    }

    if (PaymentMethodClassifier.isOffline(gateway.slug) && config.killSwitches.bankTransferPaused) {
      return { success: false, message: "Bank transfers are currently paused. Please try again later." };
    }

    const amountCents = booking.totalAmountCents;

    // HIGH-7 FIX: Align payment expiry with hold TTL to prevent orphaned payments
    // outliving their seat reservation. Previously hardcoded to 2 hours.
    const { MANUAL_PAYMENT_TTL_MINUTES: MANUAL_TTL, CARD_PAYMENT_TTL_MINUTES } =
      await import("./availability/availability.application-service.js");
    const gwIsManual = PaymentMethodClassifier.isOffline(gateway.slug);
    const paymentTtlMinutes = gwIsManual ? MANUAL_TTL : CARD_PAYMENT_TTL_MINUTES;
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + paymentTtlMinutes);

    const payment = await this.storage.createPayment({
      bookingId: booking.id,
      gatewayId: gateway.id,
      amount: amountCents,
      currency: 'VUV',
      status: PaymentStatus.Pending,
      expiresAt: expiresAt,
    });

    // Domain Event Initiation
    try {
      PaymentIntent.initiate(
        payment.id,
        booking.id,
        amountCents,
        gateway.slug === 'stripe' ? 'Card' : 'Manual',
        gateway.slug
      );
    } catch (e) {
      console.warn("[PAYMENT] Intent initiation event failed (non-fatal):", e);
    }

    try {
      const adapter = PaymentFactory.getPaymentGatewayService(gateway);
      const request: PaymentInitiationRequest = {
        bookingId: booking.id,
        amount: amountCents,
        currency: 'VUV',
        successUrl: options.successUrl,
        cancelUrl: options.cancelUrl,
        customerEmail,
        customerName,
        metadata: { paymentId: payment.id }
      };

      const response = await adapter.initiatePayment(request);

      if (response.success && response.transactionId) {
        // Determine status: offline gateways wait for admin reconciliation; online gateways go to Processing.
        const isManual = PaymentMethodClassifier.isOffline(gateway.slug);

        const nextStatus = isManual ? PaymentStatus.ManualReviewRequired : PaymentStatus.Processing;

        await this.storage.updatePayment(payment.id, {
          gatewayReference: response.transactionId,
          status: nextStatus
        });

        response.paymentId = payment.id;
        response.provider = gateway.slug;

        // ✅ Send payment instructions email for manual/offline gateways.
        // IMPORTANT: We do NOT say "booking confirmed" here — that only happens
        // when the admin verifies receipt and changes the status to confirmed.
        // Instead we send the booking request email with payment instructions.
        if (isManual) {
          try {
            const bookingItems = await this.storage.getBookingItems(booking.id);
            const firstItem = bookingItems[0];
            const tourData = firstItem ? await this.storage.getProduct(firstItem.productId) : null;
            const tourInfo = tourData || { title: 'Tour/Transfer Booking', id: '' };

            function buildGuestString(item: any): string {
              const parts: string[] = [
                `${item?.adultPax || 1} Adult(s)`,
              ];
              if (item?.childPax) parts.push(`${item.childPax} Child(ren)`);
              if (item?.infantPax) parts.push(`${item.infantPax} Infant(s)`);
              if (item?.petPax) parts.push(`${item.petPax} Pet(s)`);
              return parts.join(", ");
            }

            const emailBooking = {
              ...booking,
              date: booking.date || new Date().toISOString().split('T')[0],
              guests: buildGuestString(firstItem),
              amount: `VT ${(booking.totalAmountCents || 0).toLocaleString()}`,
            };

            const isCashPayment = gateway.slug === 'cash';
            const paymentMethodType: 'cash' | 'bank_transfer' = isCashPayment ? 'cash' : 'bank_transfer';

            const subject = isCashPayment
              ? `Booking Request Received — ACT-${shortBookingRef(booking.id)}`
              : `Payment Instructions — ACT-${shortBookingRef(booking.id)}`;

            if (customerEmail) {
              await sendEmail({
                to: customerEmail,
                subject,
                html: await getBookingRequestTemplate(emailBooking, tourInfo, paymentMethodType),
              });
            }

            await sendAdminEmail(
              `💳 Manual Payment Submitted (${PaymentMethodClassifier.displayLabel(gateway.slug)}): ${booking.customerName}`,
              await getAdminNewBookingTemplate(emailBooking, tourInfo)
            );
          } catch (emailErr) {
            console.error('[PAYMENT] Email notification failed (non-fatal):', emailErr);
          }
        }

      } else if (!response.success) {
        await this.storage.updatePayment(payment.id, {
          status: PaymentStatus.Failed,
          failureReason: response.failureReason || 'initiation_failed'
        });
      }

      return response;
    } catch (error: any) {
      await this.storage.updatePayment(payment.id, {
        status: PaymentStatus.Failed,
        failureReason: 'system_error'
      });
      return { success: false, message: error.message };
    }
  }

  async handlePaymentWebhook(event: WebhookEvent): Promise<WebhookResponse> {
    const gateway = await this.storage.getPaymentGatewayBySlug(event.gatewaySlug);
    if (!gateway) return { success: false, message: "Gateway not found" };

    const adapter = PaymentFactory.getPaymentGatewayService(gateway);
    const result = await adapter.handleWebhook(event);

    // Resolve the payment: prefer explicit paymentId, fall back to bookingId lookup.
    // Bank gateway callbacks (ANZ eGate, BSP, BRED) don't carry our internal paymentId
    // through the redirect — only the bookingId survives as vpc_OrderInfo.
    let resolvedPaymentId = result.paymentId;
    if (!resolvedPaymentId && result.bookingId) {
      const bookingPayments = await this.storage.getPaymentsByBooking(result.bookingId);
      const activePayment = bookingPayments.find(p =>
        [PaymentStatus.Pending, PaymentStatus.Processing, PaymentStatus.ManualReviewRequired].includes(p.status as PaymentStatus)
      );
      if (activePayment) {
        resolvedPaymentId = activePayment.id;
        console.log(`[WEBHOOK] Resolved paymentId ${resolvedPaymentId} from bookingId ${result.bookingId}`);
      } else {
        console.warn(`[WEBHOOK] No active payment found for bookingId ${result.bookingId}`);
      }
    }

    if (result.success && resolvedPaymentId && result.newPaymentStatus) {
      const existingPayment = await this.storage.getPayment(resolvedPaymentId);

      const terminalStates = [PaymentStatus.Completed, PaymentStatus.Failed, PaymentStatus.Cancelled, PaymentStatus.Expired];
      if (existingPayment && terminalStates.includes(existingPayment.status as PaymentStatus)) {
        return result;
      }

      // Reconstruct Aggregate to enforce transitions
      const intent = new PaymentIntent({
        id: existingPayment!.id,
        bookingId: existingPayment!.bookingId,
        amount: existingPayment!.amount,
        currency: existingPayment!.currency,
        status: existingPayment!.status as any,
        method: PaymentMethodClassifier.isOffline(gateway.slug) ? 'Bank Transfer' : (gateway.slug === 'stripe' ? 'Card' : 'Other'),
        provider: gateway.slug
      });

      await this.storage.updatePayment(resolvedPaymentId, {
        status: result.newPaymentStatus,
        gatewayReference: result.gatewayReference,
        failureReason: result.newPaymentStatus === PaymentStatus.Failed ? 'gateway_failure' : undefined
      });

      if (result.newPaymentStatus === PaymentStatus.Completed) {
        intent.receive(); // Emits PaymentConfirmed event
      } else if ([PaymentStatus.Failed, PaymentStatus.Cancelled, PaymentStatus.Expired].includes(result.newPaymentStatus)) {
        intent.fail(result.failureReason || 'gateway_notification');
      }
    }

    return result;
  }

  async getPaymentStatus(paymentId: string) {
    let payment = await this.storage.getPayment(paymentId);
    if (!payment) return undefined;

    if (payment.status === PaymentStatus.Pending ||
      payment.status === PaymentStatus.Processing ||
      payment.status === PaymentStatus.ManualReviewRequired) {
      const isExpired = await this.storage.checkPaymentExpiration(paymentId);
      if (isExpired) {
        await this.storage.updatePayment(paymentId, { status: PaymentStatus.Expired });
        // HIGH-1 FIX: Re-fetch to return current state, not stale pre-update data
        payment = (await this.storage.getPayment(paymentId))!;
      }
    }

    return payment;
  }

  async expirePayment(paymentId: string): Promise<void> {
    const payment = await this.storage.getPayment(paymentId);
    const nonTerminalStatuses = [PaymentStatus.Pending, PaymentStatus.Processing, PaymentStatus.ManualReviewRequired];
    if (!payment || !nonTerminalStatuses.includes(payment.status as PaymentStatus)) return;

    // Reconstruct Aggregate
    const intent = new PaymentIntent({
      id: payment.id,
      bookingId: payment.bookingId,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status as any,
      method: 'Bank Transfer',
      provider: 'manual'
    });

    await this.storage.updatePayment(payment.id, {
      status: PaymentStatus.Expired,
      failureReason: 'expired_timeout'
    });

    intent.fail('expired_timeout'); // Emits PaymentFailed/Expired event

    // Cancel the booking to release holds
    if (payment.bookingId) {
      await this.bookingConfirmation.cancelBooking(payment.bookingId, "payment_expired");
    }
  }
}
