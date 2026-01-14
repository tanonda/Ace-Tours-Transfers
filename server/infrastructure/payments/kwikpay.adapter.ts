// server/infrastructure/payments/kwikpay.adapter.ts

import { PaymentGateway } from '../../../shared/schema.js';
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
import { KwikPayCredentialsSchema, LocalEWalletConfigSchema } from '../../../shared/schema.js';
import { z } from 'zod';

export type KwikPayCredentials = z.infer<typeof KwikPayCredentialsSchema>;
export type LocalEWalletConfig = z.infer<typeof LocalEWalletConfigSchema>;

export class KwikPayAdapter implements PaymentGatewayService {
  private credentials: KwikPayCredentials;
  private config: LocalEWalletConfig;
  private gatewayConfig: PaymentGateway;

  constructor(gatewayConfig: PaymentGateway) {
    if (!gatewayConfig.credentials) {
      throw new Error('KwikPay credentials are not provided.');
    }
    if (!gatewayConfig.config) {
        throw new Error('KwikPay configuration is not provided.');
    }

    // Validate credentials and config using Zod schemas
    const parsedCredentials = KwikPayCredentialsSchema.safeParse(gatewayConfig.credentials);
    if (!parsedCredentials.success) {
      throw new Error(`Invalid KwikPay credentials: ${parsedCredentials.error.errors.map((e: z.ZodIssue) => e.message).join(', ')}`);
    }
    this.credentials = parsedCredentials.data;

    const parsedConfig = LocalEWalletConfigSchema.safeParse(gatewayConfig.config);
    if (!parsedConfig.success) {
      throw new Error(`Invalid KwikPay configuration: ${parsedConfig.error.errors.map((e: z.ZodIssue) => e.message).join(', ')}`);
    }
    this.config = parsedConfig.data;
    this.gatewayConfig = gatewayConfig;

    console.log(`KwikPay Adapter initialized for ${this.gatewayConfig.slug}`);
  }

  async initiatePayment(request: PaymentInitiationRequest): Promise<PaymentInitiationResponse> {
    console.log(`KwikPay: Initiating payment for booking ${request.bookingId}`);
    // Simulate API call to KwikPay
    const transactionId = `KPK-${Date.now()}-${request.bookingId.substring(0, 8)}`;
    const paymentPrompt = `Scan QR code or use KwikPay app to pay ${request.amount} to Merchant ${this.credentials.merchantId}`;

    return {
      success: true,
      message: 'Payment initiated. Customer needs to complete payment via KwikPay app/QR.',
      redirectUrl: this.config.customerPromptText || paymentPrompt,
      paymentId: request.metadata?.ourPaymentId,
      transactionId: transactionId,
    };
  }

  async handleWebhook(event: WebhookEvent): Promise<WebhookResponse> {
    console.log(`KwikPay: Handling webhook event for ${event.gatewaySlug}.`);
    // In a real scenario, this would involve:
    // 1. Verifying the webhook signature
    // 2. Parsing the event.rawEvent to extract transaction details
    // 3. Updating the internal payment status based on the webhook data

    if (this.config.signatureVerificationKey && event.signature !== 'mock_valid_signature') {
      console.warn('KwikPay Webhook: Invalid signature.');
      return { success: false, message: 'Invalid webhook signature.' };
    }

    const externalTransactionId = event.rawEvent?.transactionId || 'mock-external-id';
    const ourPaymentId = event.rawEvent?.ourPaymentId || event.rawEvent?.bookingId;

    return {
      success: true,
      message: 'Webhook processed successfully. Payment confirmed.',
      paymentId: ourPaymentId,
      newPaymentStatus: PaymentStatus.Completed,
    };
  }

  async queryPaymentStatus(request: PaymentStatusRequest): Promise<PaymentStatusResponse> {
    console.log(`KwikPay: Querying status for payment ${request.paymentId}`);
    return {
      status: PaymentStatus.Completed,
      gatewayReference: request.gatewayReference || 'mock-kpk-ref',
      amount: 1000,
      currency: (this.gatewayConfig.supportedCurrencies as string[])?.[0] || 'VUV',
      message: 'Payment status queried (mock completed).',
    };
  }

  async refundPayment(payment: Payment, amount?: number, reason?: string): Promise<PaymentStatusResponse> {
    console.log(`KwikPay: Refunding payment ${payment.id} for amount ${amount || 'full'}`);
    return {
      status: PaymentStatus.Refunded,
      gatewayReference: payment.gatewayReference || `mock-kpk-refund-${Date.now()}`,
      amount: amount || payment.amount,
      currency: payment.currency,
      message: 'Payment refunded (mock).',
    };
  }
}
