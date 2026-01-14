// server/infrastructure/payments/digicel-mobile-money.adapter.ts

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
import { DigicelMobileMoneyCredentialsSchema, LocalEWalletConfigSchema } from '../../../shared/schema.js';
import { z } from 'zod';

export type DigicelMobileMoneyCredentials = z.infer<typeof DigicelMobileMoneyCredentialsSchema>;
export type LocalEWalletConfig = z.infer<typeof LocalEWalletConfigSchema>;

export class DigicelMobileMoneyAdapter implements PaymentGatewayService {
  private credentials: DigicelMobileMoneyCredentials;
  private config: LocalEWalletConfig;
  private gatewayConfig: PaymentGateway;

  constructor(gatewayConfig: PaymentGateway) {
    if (!gatewayConfig.credentials) {
      throw new Error('Digicel Mobile Money credentials are not provided.');
    }
    if (!gatewayConfig.config) {
        throw new Error('Digicel Mobile Money configuration is not provided.');
    }

    // Validate credentials and config using Zod schemas
    const parsedCredentials = DigicelMobileMoneyCredentialsSchema.safeParse(gatewayConfig.credentials);
    if (!parsedCredentials.success) {
      throw new Error(`Invalid Digicel Mobile Money credentials: ${parsedCredentials.error.errors.map((e: z.ZodIssue) => e.message).join(', ')}`);
    }
    this.credentials = parsedCredentials.data;

    const parsedConfig = LocalEWalletConfigSchema.safeParse(gatewayConfig.config);
    if (!parsedConfig.success) {
      throw new Error(`Invalid Digicel Mobile Money configuration: ${parsedConfig.error.errors.map((e: z.ZodIssue) => e.message).join(', ')}`);
    }
    this.config = parsedConfig.data;
    this.gatewayConfig = gatewayConfig;

    console.log(`Digicel Mobile Money Adapter initialized for ${this.gatewayConfig.slug}`);
  }

  async initiatePayment(request: PaymentInitiationRequest): Promise<PaymentInitiationResponse> {
    console.log(`Digicel Mobile Money: Initiating payment for booking ${request.bookingId}`);
    // Simulate API call to Digicel Mobile Money
    const transactionId = `DMM-${Date.now()}-${request.bookingId.substring(0, 8)}`;
    const ussdPrompt = `Dial ${this.credentials.ussdCode || '*888#'} and follow prompts to pay ${request.amount} to Merchant ${this.credentials.merchantId}`;

    return {
      success: true,
      message: 'Payment initiated. Customer needs to complete payment via USSD/App.',
      redirectUrl: this.config.customerPromptText || ussdPrompt,
      paymentId: request.metadata?.ourPaymentId,
      transactionId: transactionId,
    };
  }

  async handleWebhook(event: WebhookEvent): Promise<WebhookResponse> {
    console.log(`Digicel Mobile Money: Handling webhook event for ${event.gatewaySlug}.`);
    // In a real scenario, this would involve:
    // 1. Verifying the webhook signature
    // 2. Parsing the event.rawEvent to extract transaction details
    // 3. Updating the internal payment status based on the webhook data

    if (this.config.signatureVerificationKey && event.signature !== 'mock_valid_signature') {
      console.warn('Digicel Mobile Money Webhook: Invalid signature.');
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
    console.log(`Digicel Mobile Money: Querying status for payment ${request.paymentId}`);
    return {
      status: PaymentStatus.Completed,
      gatewayReference: request.gatewayReference || 'mock-dmm-ref',
      amount: 1000,
      currency: (this.gatewayConfig.supportedCurrencies as string[])?.[0] || 'VUV',
      message: 'Payment status queried (mock completed).',
    };
  }

  async refundPayment(payment: Payment, amount?: number, reason?: string): Promise<PaymentStatusResponse> {
    console.log(`Digicel Mobile Money: Refunding payment ${payment.id} for amount ${amount || 'full'}`);
    return {
      status: PaymentStatus.Refunded,
      gatewayReference: payment.gatewayReference || 'mock-dmm-refund',
      amount: amount || payment.amount,
      currency: payment.currency,
      message: 'Payment refunded (mock).',
    };
  }
}
