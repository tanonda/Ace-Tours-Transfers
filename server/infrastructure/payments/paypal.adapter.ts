// server/infrastructure/payments/paypal.adapter.ts

import { PaymentGateway, PayPalCredentialsSchema, InternationalFallbackConfigSchema } from '../../../shared/schema.js';
import {
  PaymentGatewayService,
  PaymentInitiationRequest,
  PaymentInitiationResponse,
  PaymentStatusRequest,
  PaymentStatusResponse,
  WebhookEvent,
  WebhookResponse,
  PaymentStatus,
} from '../../domain/payments/interfaces.js';
import { Payment } from '../../../shared/schema.js';
import { z } from 'zod';

export type PayPalCredentials = z.infer<typeof PayPalCredentialsSchema>;
export type InternationalFallbackConfig = z.infer<typeof InternationalFallbackConfigSchema>;

/**
 * PayPal Payment Gateway Adapter.
 * This class implements the PaymentGatewayService interface for PayPal.
 * It simulates interaction with the PayPal API for payment initiation, webhooks, and status queries.
 */
export class PayPalAdapter implements PaymentGatewayService {
  private credentials: PayPalCredentials;
  private config: InternationalFallbackConfig;
  private gatewayConfig: PaymentGateway;

  constructor(gatewayConfig: PaymentGateway) {
    if (!gatewayConfig.credentials) {
      throw new Error('PayPal credentials are not provided.');
    }
    if (!gatewayConfig.config) {
        throw new Error('PayPal configuration is not provided.');
    }

    // Validate credentials and config using Zod schemas
    const parsedCredentials = PayPalCredentialsSchema.safeParse(gatewayConfig.credentials);
    if (!parsedCredentials.success) {
      throw new Error(`Invalid PayPal credentials: ${parsedCredentials.error.errors.map((e: z.ZodIssue) => e.message).join(', ')}`);
    }
    this.credentials = parsedCredentials.data;

    const parsedConfig = InternationalFallbackConfigSchema.safeParse(gatewayConfig.config);
    if (!parsedConfig.success) {
      throw new Error(`Invalid PayPal configuration: ${parsedConfig.error.errors.map((e: z.ZodIssue) => e.message).join(', ')}`);
    }
    this.config = parsedConfig.data;
    this.gatewayConfig = gatewayConfig;

    console.log(`PayPal Adapter initialized for ${this.credentials.clientId} in ${this.credentials.mode} mode.`);
  }

  /**
   * Initiates a payment process with PayPal.
   * This typically involves creating an order (payment) and then redirecting the user to PayPal for approval.
   * For now, this is a mock implementation.
   */
  async initiatePayment(request: PaymentInitiationRequest): Promise<PaymentInitiationResponse> {
    console.log(`Mock PayPal: Initiating payment for booking ${request.bookingId} with amount ${request.amount} ${request.currency}`);

    // In a real scenario, you would make an API call to PayPal to create an order.
    // The response would contain a 'approve' link to which the user needs to be redirected.

    const mockOrderId = `PAYPAL-${Date.now()}-${request.bookingId.substring(0, 8)}`;
    const apiEndpoint = this.credentials.mode === 'sandbox'
        ? 'https://api-m.sandbox.paypal.com'
        : 'https://api-m.paypal.com';

    // Simplified mock redirect using PayPal's checkout experience preference
    let mockRedirectUrl = `${apiEndpoint}/checkout?orderId=${mockOrderId}&amount=${request.amount}&currency=${request.currency}&returnUrl=${encodeURIComponent(request.successUrl)}`;

    if (this.credentials.checkoutExperience === 'PAY_WITH_CARD_OR_PAYPAL') {
        mockRedirectUrl += '&enableGuestCheckout=true';
    }


    return {
      success: true,
      message: 'Payment initiation successful (mock PayPal).',
      redirectUrl: mockRedirectUrl,
      transactionId: mockOrderId, // Using orderId as transactionId for simplicity in mock
    };
  }

  /**
   * Handles webhook events from PayPal.
   * This method would verify the webhook signature and process the event data.
   * For now, this is a mock implementation.
   */
  async handleWebhook(event: WebhookEvent): Promise<WebhookResponse> {
    console.log('Mock PayPal: Handling webhook event.', event.rawEvent);

    // In a real scenario, you would:
    // 1. Verify the authenticity of the webhook (e.g., using a webhook-id header and event data).
    // 2. Parse the event data (e.g., payment.capture.completed, checkout.order.approved).
    // 3. Find the corresponding payment record in your database using the order/transaction ID.
    // 4. Update the payment and booking status based on the event.

    if (this.credentials.ipnWebhookUrl && event.signature !== 'mock_valid_signature') {
        console.warn('PayPal Webhook: Invalid signature.');
        return { success: false, message: 'Invalid webhook signature.' };
    }

    const rawEvent = event.rawEvent;
    const eventType = rawEvent.event_type; // e.g., 'CHECKOUT.ORDER.COMPLETED'
    const resource = rawEvent.resource; // Contains details about the transaction
    const transactionReference = resource?.id || 'unknown'; // Order ID or Capture ID

    let newStatus: PaymentStatus = PaymentStatus.Failed;
    if (eventType === 'CHECKOUT.ORDER.COMPLETED' || eventType === 'PAYMENT.CAPTURE.COMPLETED') {
      newStatus = PaymentStatus.Completed;
    } else if (eventType === 'PAYMENT.CAPTURE.PENDING') {
      newStatus = PaymentStatus.Pending;
    } else if (eventType === 'REFUND.COMPLETED') {
        newStatus = PaymentStatus.Refunded;
    }

    const mockPaymentId = rawEvent.paymentId || 'mock-payment-id';
    const mockBookingId = rawEvent.bookingId || 'mock-booking-id';

    return {
      success: true,
      message: `PayPal webhook event '${eventType}' processed successfully (mock).`,
      paymentId: mockPaymentId,
      bookingId: mockBookingId,
      newPaymentStatus: newStatus,
    };
  }

  /**
   * Queries the current status of a PayPal payment.
   * For now, this is a mock implementation.
   */
  async queryPaymentStatus(request: PaymentStatusRequest): Promise<PaymentStatusResponse> {
    console.log(`Mock PayPal: Querying status for payment ${request.paymentId} / ${request.gatewayReference}`);

    // In a real scenario, you would make an API call to PayPal to get order or capture details.

    const mockStatus = request.gatewayReference ? PaymentStatus.Completed : PaymentStatus.Pending;

    return {
      status: mockStatus,
      gatewayReference: request.gatewayReference || `mock-paypal-ref-${Date.now()}`,
      amount: 25000, // Mock amount in cents
      currency: this.credentials.settlementCurrency || 'VUV', // Use configured settlement currency
      message: 'Status retrieved (mock PayPal).',
    };
  }

  /**
   * Initiates a refund for a completed PayPal payment.
   * For now, this is a mock implementation.
   */
  async refundPayment(payment: Payment, amount?: number, reason?: string): Promise<PaymentStatusResponse> {
    console.log(`Mock PayPal: Refunding payment ${payment.id} for amount ${amount || 'full'} with reason: ${reason}`);

    // In a real scenario, this would involve an API call to PayPal for refund.

    return {
      status: PaymentStatus.Refunded,
      gatewayReference: payment.gatewayReference || `mock-paypal-refund-ref-${Date.now()}`,
      amount: amount || payment.amount,
      currency: payment.currency,
      message: 'Payment refunded (mock PayPal).',
    };
  }
}


