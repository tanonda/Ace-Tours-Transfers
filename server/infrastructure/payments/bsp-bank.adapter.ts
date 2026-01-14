// server/infrastructure/payments/bsp-bank.adapter.ts

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
import { BspBankCredentialsSchema, LocalBankConfigSchema } from '../../../shared/schema.js';
import { z } from 'zod';

export type BspBankCredentials = z.infer<typeof BspBankCredentialsSchema>;
export type LocalBankConfig = z.infer<typeof LocalBankConfigSchema>;

export class BspBankAdapter implements PaymentGatewayService {
  private credentials: BspBankCredentials;
  private config: LocalBankConfig;
  private gatewayConfig: PaymentGateway;

  constructor(gatewayConfig: PaymentGateway) {
    if (!gatewayConfig.credentials) {
      throw new Error('BSP Bank credentials are not provided.');
    }
    if (!gatewayConfig.config) {
        throw new Error('BSP Bank configuration is not provided.');
    }

    // Validate credentials and config using Zod schemas
    const parsedCredentials = BspBankCredentialsSchema.safeParse(gatewayConfig.credentials);
    if (!parsedCredentials.success) {
      throw new Error(`Invalid BSP Bank credentials: ${parsedCredentials.error.errors.map((e: z.ZodIssue) => e.message).join(', ')}`);
    }
    this.credentials = parsedCredentials.data;

    const parsedConfig = LocalBankConfigSchema.safeParse(gatewayConfig.config);
    if (!parsedConfig.success) {
      throw new Error(`Invalid BSP Bank configuration: ${parsedConfig.error.errors.map((e: z.ZodIssue) => e.message).join(', ')}`);
    }
    this.config = parsedConfig.data;
    this.gatewayConfig = gatewayConfig;

    console.log(`BSP Bank Adapter initialized for ${this.gatewayConfig.slug}`);
  }

  async initiatePayment(request: PaymentInitiationRequest): Promise<PaymentInitiationResponse> {
    console.log(`BSP Bank: Initiating payment for booking ${request.bookingId}`);
    // Simulate API call to BSP Bank
    const transactionId = `BSP-${Date.now()}-${request.bookingId.substring(0, 8)}`;

    // Ensure currency is supported by this gateway
    if (!this.config.supportedCurrencies.includes(request.currency)) {
      return { success: false, message: `Currency ${request.currency} not supported by ${this.gatewayConfig.displayName}.` };
    }

    // Example: Construct redirect URL for hosted page or direct API call
    const redirectUrl = `${this.config.bankApiEndpointUrl || this.credentials.apiEndpoint}/pay?amount=${request.amount}&currency=${request.currency}&returnUrl=${request.successUrl}`;

    return {
      success: true,
      message: 'Payment initiated with BSP Bank.',
      redirectUrl: redirectUrl,
      paymentId: request.metadata?.ourPaymentId,
      transactionId: transactionId,
    };
  }

  async handleWebhook(event: WebhookEvent): Promise<WebhookResponse> {
    console.log(`BSP Bank: Handling webhook event for ${event.gatewaySlug}.`);
    // Simulate webhook handling logic
    if (event.signature === 'invalid') {
        return { success: false, message: 'Invalid webhook signature.' };
    }

    const externalTransactionId = event.rawEvent?.transactionId || 'mock-bsp-external-id';
    const ourPaymentId = event.rawEvent?.ourPaymentId || event.rawEvent?.bookingId;

    return {
      success: true,
      message: 'Webhook processed successfully. Payment confirmed.',
      paymentId: ourPaymentId,
      newPaymentStatus: PaymentStatus.Completed,
    };
  }

  async queryPaymentStatus(request: PaymentStatusRequest): Promise<PaymentStatusResponse> {
    console.log(`BSP Bank: Querying status for payment ${request.paymentId}`);
    return {
      status: PaymentStatus.Completed,
      gatewayReference: request.gatewayReference || 'mock-bsp-ref',
      amount: 1000,
      currency: this.config.defaultDisplayCurrency || 'VUV',
      message: 'Payment status queried (mock completed).',
    };
  }

  async refundPayment(payment: Payment, amount?: number, reason?: string): Promise<PaymentStatusResponse> {
    console.log(`BSP Bank: Refunding payment ${payment.id} for amount ${amount || 'full'}`);
    return {
      status: PaymentStatus.Refunded,
      gatewayReference: payment.gatewayReference || 'mock-bsp-refund',
      amount: amount || payment.amount,
      currency: payment.currency,
      message: 'Payment refunded (mock).',
    };
  }
}
