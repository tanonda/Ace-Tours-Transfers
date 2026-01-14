// server/infrastructure/payments/wantok-money.adapter.ts

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
import { WanTokCredentialsSchema, LocalEWalletConfigSchema } from '../../../shared/schema.js';
import { z } from 'zod';

export type WanTokCredentials = z.infer<typeof WanTokCredentialsSchema>;
export type LocalEWalletConfig = z.infer<typeof LocalEWalletConfigSchema>;

export class WanTokMoneyAdapter implements PaymentGatewayService {
  private credentials: WanTokCredentials;
  private config: LocalEWalletConfig;
  private gatewayConfig: PaymentGateway;

  constructor(gatewayConfig: PaymentGateway) {
    if (!gatewayConfig.credentials) {
      throw new Error('WanTok Money credentials are not provided.');
    }
    if (!gatewayConfig.config) {
        throw new Error('WanTok Money configuration is not provided.');
    }

    // Validate credentials and config using Zod schemas
    const parsedCredentials = WanTokCredentialsSchema.safeParse(gatewayConfig.credentials);
    if (!parsedCredentials.success) {
      throw new Error(`Invalid WanTok Money credentials: ${parsedCredentials.error.errors.map((e: z.ZodIssue) => e.message).join(', ')}`);
    }
    this.credentials = parsedCredentials.data;

    const parsedConfig = LocalEWalletConfigSchema.safeParse(gatewayConfig.config);
    if (!parsedConfig.success) {
      throw new Error(`Invalid WanTok Money configuration: ${parsedConfig.error.errors.map((e: z.ZodIssue) => e.message).join(', ')}`);
    }
    this.config = parsedConfig.data;
    this.gatewayConfig = gatewayConfig;

    console.log(`WanTok Money Adapter initialized for ${this.gatewayConfig.slug}`);
  }

  async initiatePayment(request: PaymentInitiationRequest): Promise<PaymentInitiationResponse> {
    console.log(`WanTok Money: Initiating payment for booking ${request.bookingId}`);
    // Simulate API call to WanTok Money
    // In a real scenario, this would involve sending an API request to WanTok Money
    // and potentially returning a QR code or USSD prompt to the user.

    // For demonstration, let's assume it always "succeeds" in initiating and returns a mock USSD code
    const transactionId = `WTM-${Date.now()}-${request.bookingId.substring(0, 8)}`;
    const ussdPrompt = `Dial *147# and enter ${request.amount} for Merchant ${this.credentials.merchantId}`;

    return {
      success: true,
      message: 'Payment initiated. Customer needs to complete payment via USSD/App.',
      redirectUrl: this.config.customerPromptText || ussdPrompt, // Using redirectUrl for prompt text
      paymentId: request.metadata?.ourPaymentId,
      transactionId: transactionId,
    };
  }

  async handleWebhook(event: WebhookEvent): Promise<WebhookResponse> {
    console.log(`WanTok Money: Handling webhook event for ${event.gatewaySlug}.`);
    // In a real scenario, this would involve:
    // 1. Verifying the webhook signature using this.config.signatureVerificationKey
    // 2. Parsing the event.rawEvent to extract transaction details
    // 3. Updating the internal payment status based on the webhook data

    // For mock, assume the webhook always confirms success after some time
    if (this.config.signatureVerificationKey && event.signature !== 'mock_valid_signature') {
      console.warn('WanTok Money Webhook: Invalid signature.');
      return { success: false, message: 'Invalid webhook signature.' };
    }

    const externalTransactionId = event.rawEvent?.transactionId || 'mock-external-id';
    const ourPaymentId = event.rawEvent?.ourPaymentId || event.rawEvent?.bookingId; // Assuming our ID is passed in webhook

    return {
      success: true,
      message: 'Webhook processed successfully. Payment confirmed.',
      paymentId: ourPaymentId,
      newPaymentStatus: PaymentStatus.Completed,
    };
  }

  async queryPaymentStatus(request: PaymentStatusRequest): Promise<PaymentStatusResponse> {
    console.log(`WanTok Money: Querying status for payment ${request.paymentId}`);
    // In a real scenario, this would involve making an API call to WanTok Money
    // to check the status of a transaction.

    // For mock, assume all initiated payments eventually complete
    return {
      status: PaymentStatus.Completed,
      gatewayReference: request.gatewayReference || 'mock-wtm-ref',
      amount: 1000, // Mock amount
      currency: (this.gatewayConfig.supportedCurrencies as string[])?.[0] || 'VUV',
      message: 'Payment status queried (mock completed).',
    };
  }

  async refundPayment(payment: Payment, amount?: number, reason?: string): Promise<PaymentStatusResponse> {
    console.log(`WanTok Money: Refunding payment ${payment.id} for amount ${amount || 'full'}`);
    // Simulate refund API call
    return {
      status: PaymentStatus.Refunded,
      gatewayReference: payment.gatewayReference || `mock-wtm-refund-${Date.now()}`,
      amount: amount || payment.amount,
      currency: payment.currency,
      message: 'Payment refunded (mock).',
    };
  }
}
