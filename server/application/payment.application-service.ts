// server/application/payment.application-service.ts

import {
  PaymentGatewayService,
  PaymentInitiationRequest,
  PaymentInitiationResponse,
  PaymentStatus,
  WebhookEvent,
  WebhookResponse,
} from '../domain/payments/interfaces.js';
import { PaymentMethodClassifier } from '../domain/payments/payment-method-classifier.js';
import { IStorage } from '../storage.js';
import { PaymentFactory } from "../infrastructure/payments/factory.js";
import type { MpgsHostedCheckoutAdapter } from "../infrastructure/payments/mpgs.adapter.js";
import { PaymentGateway, Booking, Payment } from '../../shared/schema.js';
import { escapeHtml } from '../lib/escape-html.js';
import { config } from "../config.js";
import { PaymentIntent } from "../domain/payments/PaymentIntent.js";
import { isTestModeGateway } from "./public-gateway.js";
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
  isAdmin?: boolean; // admins may use a gateway whose bank shop is still in TEST mode
}

/** Review reasons set from a bank's report; only an admin may move these payments on. */
const REVIEW_HOLD_REASONS = ['paid_after_close', 'amount_currency_mismatch'];

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
        await this.extendHolds(booking, hold.id, extendedExpiry);
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

    // A bank shop in TEST mode accepts published test cards: only admins running
    // the bank's test payments may use it, or guests could confirm bookings unpaid.
    if (isTestModeGateway(gateway) && !options.isAdmin) {
      return { success: false, message: `Payment provider ${gateway.slug} is not active` };
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
          // Await email sending to guarantee delivery before the connection closes on serverless/ephemeral hosts.
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
          } catch (emailErr: any) {
            console.error('[PAYMENT] Email notification failed (non-fatal):', emailErr?.message || emailErr);
            if (emailErr?.stack) console.error(emailErr.stack);
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

  /** Keeps a booking's seats (all holds in its session) until `expiresAt`. */
  private async extendHolds(booking: Booking, holdId: string, expiresAt: Date): Promise<void> {
    await this.storage.updateHold(holdId, { expiresAt });
    if (booking.bookingSessionId) {
      const sessionHolds = await this.storage.getHoldsBySession(booking.bookingSessionId);
      for (const sh of sessionHolds) {
        if (sh.id !== holdId) {
          await this.storage.updateHold(sh.id, { expiresAt });
        }
      }
    }
  }

  /**
   * Admin: a bank-hosted payment link for a pending booking (phone and email bookings).
   * The booking's seats are held, and the payment stays open, for as long as the link
   * works (MANUAL_PAYMENT_TTL_MINUTES); the bank's notification, the guest's return or
   * reconciliation then confirms it like any card payment.
   */
  async createPaymentLink(options: { bookingId: string; gatewaySlug: string; siteOrigin: string }):
    Promise<{ success: true; url: string; paymentId: string; expiresAt: Date } | { success: false; message: string }> {
    if (config.killSwitches.paymentsPaused) {
      return { success: false, message: "Payments are paused for maintenance." };
    }
    const booking = await this.storage.getBooking(options.bookingId);
    if (!booking) return { success: false, message: "Booking not found" };
    if (booking.status !== 'pending') {
      return { success: false, message: `Only pending bookings can be sent a payment link (this one is '${booking.status}').` };
    }

    const gateway = await this.storage.getPaymentGatewayBySlug(options.gatewaySlug);
    if (!gateway || !gateway.active) {
      return { success: false, message: `Payment provider ${options.gatewaySlug} is not active` };
    }
    const adapter = PaymentFactory.getPaymentGatewayService(gateway) as PaymentGatewayService & {
      createPaymentLink?: MpgsHostedCheckoutAdapter['createPaymentLink'];
    };
    if (typeof adapter.createPaymentLink !== 'function') {
      return { success: false, message: `${gateway.displayName} does not offer payment links.` };
    }

    // Includes a bank transfer or flagged card payment awaiting review: a link on top
    // of either could charge the guest twice.
    const existingPayments = await this.storage.getPaymentsByBooking(booking.id);
    const open = [PaymentStatus.Pending, PaymentStatus.Processing, PaymentStatus.ManualReviewRequired];
    if (existingPayments.some(p => open.includes(p.status as PaymentStatus))) {
      return { success: false, message: "This booking already has a payment in progress or awaiting review." };
    }

    const { MANUAL_PAYMENT_TTL_MINUTES } = await import("./availability/availability.application-service.js");
    const expiresAt = new Date(Date.now() + MANUAL_PAYMENT_TTL_MINUTES * 60_000);

    if (booking.holdId) {
      const hold = await this.storage.getHold(booking.holdId);
      if (!hold || hold.status !== 'ACTIVE') {
        return { success: false, message: "The booking's seat hold has expired; check availability and re-create the booking." };
      }
      await this.extendHolds(booking, hold.id, expiresAt);
    }

    const payment = await this.storage.createPayment({
      bookingId: booking.id,
      gatewayId: gateway.id,
      amount: booking.totalAmountCents,
      currency: 'VUV',
      status: PaymentStatus.Pending,
      expiresAt,
    });

    const link = await adapter.createPaymentLink({
      paymentId: payment.id,
      bookingId: booking.id,
      amount: booking.totalAmountCents,
      currency: 'VUV',
      expiresAt,
      siteOrigin: options.siteOrigin,
    });
    if (!link.success) {
      await this.storage.updatePayment(payment.id, { status: PaymentStatus.Failed, failureReason: 'payment_link_failed' });
      return link;
    }

    await this.storage.updatePayment(payment.id, {
      status: PaymentStatus.Processing,
      gatewayReference: payment.id, // the MPGS order ID
      metadata: { paymentLink: { url: link.url, id: link.linkId, expiresAt: expiresAt.toISOString() } },
    });
    return { success: true, url: link.url, paymentId: payment.id, expiresAt };
  }

  /** A payment captured by the bank after we had failed, cancelled or expired it. */
  private async flagPaidAfterClose(payment: Payment, result: WebhookResponse, gatewayName: string): Promise<void> {
    console.error(`[WEBHOOK] Payment ${payment.id} was ${payment.status} but ${gatewayName} reports it paid; manual review`);
    await this.storage.updatePayment(payment.id, {
      status: PaymentStatus.ManualReviewRequired,
      gatewayReference: result.gatewayReference,
      failureReason: 'paid_after_close',
      metadata: {
        ...((payment.metadata as Record<string, any>) || {}),
        closedStatus: payment.status,
        bankReportedAmount: result.amount,
        bankReportedCurrency: result.currency,
      },
    });
    try {
      await sendAdminEmail(
        `⚠️ Paid after closing — Booking ACT-${shortBookingRef(payment.bookingId)}`,
        `<div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
          <h2 style="color: #d35400;">⚠️ A closed payment was paid</h2>
          <p>${escapeHtml(gatewayName)} reports a successful card payment of ${escapeHtml(String(result.amount ?? ''))} ${escapeHtml(String(result.currency ?? ''))}
          for a payment this site had already marked <strong>${escapeHtml(payment.status)}</strong>.</p>
          <p><strong>Payment ID:</strong> ${escapeHtml(payment.id)}<br><strong>Booking:</strong> ACT-${escapeHtml(shortBookingRef(payment.bookingId))}</p>
          <p>The payment is now <strong>manual_review_required</strong>. Confirm the booking if seats are still available, or refund the guest from the bank's portal.</p>
        </div>`
      );
    } catch (emailErr) {
      console.error('[WEBHOOK] Failed to send paid-after-close email:', emailErr);
    }
  }

  async handlePaymentWebhook(event: WebhookEvent): Promise<WebhookResponse> {
    const gateway = await this.storage.getPaymentGatewayBySlug(event.gatewaySlug);
    if (!gateway) return { success: false, message: "Gateway not found" };
    // Every gateway row is seeded on boot (inactive), so a callback naming one
    // the admin never switched on must not be able to complete a payment.
    if (!gateway.active) {
      console.warn(`[WEBHOOK] Ignored callback for inactive gateway ${event.gatewaySlug}; reconcile manually if a payment was in flight`);
      return { success: false, message: "Gateway is not active" };
    }

    const adapter = PaymentFactory.getPaymentGatewayService(gateway, 'existing');
    const result = await adapter.handleWebhook(event);

    // Resolve the payment: prefer explicit paymentId, then resolve by gatewayReference (vpc_MerchTxnRef),
    // and finally fall back to bookingId lookup (vpc_OrderInfo) if needed.
    let resolvedPaymentId = result.paymentId;
    if (!resolvedPaymentId && result.gatewayReference) {
      const paymentByRef = await this.storage.getPaymentByGatewayReference(result.gatewayReference);
      if (paymentByRef) {
        resolvedPaymentId = paymentByRef.id;
        console.log(`[WEBHOOK] Resolved paymentId ${resolvedPaymentId} from gatewayReference ${result.gatewayReference}`);
      }
    }
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

      // A callback may only move payments made through its own gateway: otherwise a
      // return URL naming another payment's ID (e.g. a bank transfer awaiting review)
      // could cancel it via a gateway that has no such order.
      if (existingPayment && existingPayment.gatewayId !== gateway.id) {
        console.warn(`[WEBHOOK] ${event.gatewaySlug} callback named payment ${resolvedPaymentId} of another gateway; ignored`);
        return { ...result, success: false, newPaymentStatus: undefined, message: 'Payment does not belong to this gateway' };
      }

      const terminalStates = [PaymentStatus.Completed, PaymentStatus.Failed, PaymentStatus.Cancelled, PaymentStatus.Expired];
      if (existingPayment && terminalStates.includes(existingPayment.status as PaymentStatus)) {
        // The bank took the money for a payment we had already closed (the guest came back
        // to a still-open payment link or hosted page). Never drop that: a person must
        // confirm the booking or refund the guest.
        if (result.newPaymentStatus === PaymentStatus.Completed && existingPayment.status !== PaymentStatus.Completed) {
          await this.flagPaidAfterClose(existingPayment, result, gateway.displayName);
          return { ...result, success: false, newPaymentStatus: PaymentStatus.ManualReviewRequired, message: 'Paid after the payment was closed; sent to manual review.' };
        }
        return result;
      }

      // A payment held for review because of what the bank reported (paid after we closed
      // it, or the wrong amount) is settled by a person; a later callback must not
      // complete it behind the admin's back.
      if (existingPayment?.status === PaymentStatus.ManualReviewRequired &&
          REVIEW_HOLD_REASONS.includes(existingPayment.failureReason ?? '')) {
        return { ...result, success: false, newPaymentStatus: undefined, message: 'Payment is held for manual review.' };
      }

      // A payment link can still be paid after a cancel or decline on the bank's page,
      // so only the bank's "paid" (or reconciliation's expiry) closes a link payment.
      const isPaymentLink = !!(existingPayment?.metadata as { paymentLink?: unknown } | null)?.paymentLink;
      if (isPaymentLink && [PaymentStatus.Cancelled, PaymentStatus.Failed].includes(result.newPaymentStatus)) {
        return { ...result, newPaymentStatus: undefined, message: 'Payment link is still open; status unchanged.' };
      }

      // Verify callback amount + currency (Item 2)
      let amountMismatch = false;
      let currencyMismatch = false;

      if (existingPayment) {
        if (result.amount !== undefined && result.amount !== existingPayment.amount) {
          amountMismatch = true;
        }
        if (result.currency !== undefined && result.currency !== existingPayment.currency) {
          currencyMismatch = true;
        }
      }

      if ((amountMismatch || currencyMismatch) && result.newPaymentStatus === PaymentStatus.Completed) {
        console.error(`[WEBHOOK] Payment mismatch detected for payment ${resolvedPaymentId}. Expected: ${existingPayment!.amount} ${existingPayment!.currency}, Received: ${result.amount} ${result.currency}`);

        // Mismatch! Transition to manual_review_required and do NOT mark as Completed.
        result.newPaymentStatus = PaymentStatus.ManualReviewRequired;
        result.success = false;
        result.message = `Amount or currency mismatch: expected ${existingPayment!.amount} ${existingPayment!.currency}, received ${result.amount} ${result.currency}`;

        await this.storage.updatePayment(resolvedPaymentId, {
          status: PaymentStatus.ManualReviewRequired,
          gatewayReference: result.gatewayReference,
          failureReason: 'amount_currency_mismatch',
          metadata: {
            ...(existingPayment!.metadata as Record<string, any> || {}),
            bankReportedAmount: result.amount,
            bankReportedCurrency: result.currency,
          }
        });

        // Emit an admin alert email
        try {
          const booking = await this.storage.getBooking(existingPayment!.bookingId);
          const customerName = booking?.customerName || "Customer";
          await sendAdminEmail(
            `⚠️ Payment Discrepancy Alert — Booking ACT-${shortBookingRef(existingPayment!.bookingId)}`,
            `<div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
              <h2 style="color: #d35400;">⚠️ Payment Verification Mismatch Detected</h2>
              <p>A payment callback was received from BRED Bank/eGate with a mismatch in the amount or currency.</p>
              <table style="border-collapse: collapse; width: 100%; max-width: 500px; margin: 20px 0;">
                <tr style="background-color: #f2f2f2;">
                  <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Field</th>
                  <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Expected (Us)</th>
                  <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Received (Bank)</th>
                </tr>
                <tr>
                  <td style="padding: 10px; border: 1px solid #ddd;"><strong>Amount</strong></td>
                  <td style="padding: 10px; border: 1px solid #ddd;">${existingPayment!.amount}</td>
                  <td style="padding: 10px; border: 1px solid #ddd; color: ${amountMismatch ? 'red' : 'inherit'};">${result.amount}</td>
                </tr>
                <tr>
                  <td style="padding: 10px; border: 1px solid #ddd;"><strong>Currency</strong></td>
                  <td style="padding: 10px; border: 1px solid #ddd;">${existingPayment!.currency}</td>
                  <td style="padding: 10px; border: 1px solid #ddd; color: ${currencyMismatch ? 'red' : 'inherit'};">${result.currency}</td>
                </tr>
              </table>
              <p><strong>Payment ID:</strong> ${existingPayment!.id}</p>
              <p><strong>Booking ID:</strong> ${existingPayment!.bookingId} (ACT-${shortBookingRef(existingPayment!.bookingId)})</p>
              <p><strong>Customer:</strong> ${customerName}</p>
              <p><strong>Gateway Reference:</strong> ${result.gatewayReference || "N/A"}</p>
              <p>The payment status has been set to <strong>manual_review_required</strong>. Please reconcile this booking manually in the Admin Dashboard.</p>
            </div>`
          );
        } catch (emailErr) {
          console.error('[WEBHOOK] Failed to send admin mismatch email:', emailErr);
        }

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
