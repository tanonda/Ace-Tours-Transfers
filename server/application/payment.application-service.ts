// server/application/payment.application-service.ts

import { getPaymentGatewayService as getLegacyGatewayService } from '../domain/payments/factory.js';
import {
  PaymentInitiationRequest,
  PaymentInitiationResponse,
  PaymentStatus,
  WebhookEvent,
  WebhookResponse,
} from '../domain/payments/interfaces.js';
import { IStorage } from '../storage.js';
import { PaymentFactory } from "../infrastructure/payments/factory.js";
import { PaymentGateway, Booking } from '../../shared/schema.js';
import { config } from "../config.js";
import { PaymentIntent } from "../domain/payments/PaymentIntent.js";
import { eventDispatcher } from "../infrastructure/events/event-dispatcher.js";
import { BookingConfirmationService } from "./booking/BookingConfirmationService.js";

export interface PaymentOptions {
  bookingId: string;
  userId?: string;
  sessionId: string;
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
                   (booking.bookingSessionId === options.sessionId);
    
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
    if ((gateway.slug === 'stripe' || gateway.slug.includes('card')) && config.killSwitches.cardPaymentsPaused) {
      return { success: false, message: "Card payments are currently disabled for maintenance. Please use Bank Transfer." };
    }

    if (gateway.slug.includes('manual') && config.killSwitches.bankTransferPaused) {
      return { success: false, message: "Bank transfers are currently paused. Please try again later." };
    }

    const amountCents = booking.totalAmountCents;

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 2);

    const payment = await this.storage.createPayment({
      bookingId: booking.id,
      gatewayId: gateway.id,
      amount: amountCents,
      currency: 'VUV',
      status: PaymentStatus.Pending,
      expiresAt: expiresAt,
    });

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
        await this.storage.updatePayment(payment.id, {
          gatewayReference: response.transactionId,
          status: PaymentStatus.Processing
        });
        
        response.paymentId = payment.id;
        response.provider = gateway.slug;
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

    if (result.success && result.paymentId && result.newPaymentStatus) {
      const existingPayment = await this.storage.getPayment(result.paymentId);
      
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
        method: gateway.slug.includes('manual') ? 'Bank Transfer' : (gateway.slug === 'stripe' ? 'Card' : 'Other'),
        provider: gateway.slug
      });

      if (result.newPaymentStatus === PaymentStatus.Completed) {
        intent.receive(); // Emits PaymentConfirmed event
      } else if ([PaymentStatus.Failed, PaymentStatus.Cancelled, PaymentStatus.Expired].includes(result.newPaymentStatus)) {
        intent.fail(result.failureReason || 'gateway_notification');
      }

      await this.storage.updatePayment(result.paymentId, {
        status: result.newPaymentStatus,
        gatewayReference: result.gatewayReference,
        failureReason: result.newPaymentStatus === PaymentStatus.Failed ? 'gateway_failure' : undefined
      });
    }

    return result;
  }

  async getPaymentStatus(paymentId: string) {
    const payment = await this.storage.getPayment(paymentId);
    if (!payment) return undefined;

    if (payment.status === PaymentStatus.Pending || payment.status === PaymentStatus.Processing) {
      const isExpired = await this.storage.checkPaymentExpiration(paymentId);
      if (isExpired) {
        await this.storage.updatePayment(paymentId, { status: PaymentStatus.Expired });
      }
    }

    return payment;
  }

  async expirePayment(paymentId: string): Promise<void> {
    const payment = await this.storage.getPayment(paymentId);
    if (!payment || payment.status !== PaymentStatus.Pending) return;

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

    intent.fail('expired_timeout'); // Emits PaymentFailed/Expired event

    await this.storage.updatePayment(payment.id, {
      status: PaymentStatus.Expired,
      failureReason: 'expired_timeout'
    });

    // Cancel the booking to release holds
    if (payment.bookingId) {
      await this.bookingConfirmation.cancelBooking(payment.bookingId, "payment_expired");
    }
  }
}
