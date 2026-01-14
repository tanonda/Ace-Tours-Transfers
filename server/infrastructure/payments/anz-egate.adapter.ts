// server/infrastructure/payments/anz-egate.adapter.ts

import { PaymentGateway, AnzEGateCredentialsSchema, LocalBankConfigSchema } from '../../../shared/schema.js';
import {
  PaymentGatewayService,
  PaymentInitiationRequest,
  PaymentInitiationResponse,
  PaymentStatusRequest,
  PaymentStatusResponse,
  WebhookEvent,
  WebhookResponse,
} from '../../domain/payments/interfaces.js';
import { Payment } from '../../../shared/schema.js';
import { MastercardGatewayAdapter, MastercardGatewayCredentials } from './mastercard-gateway.adapter.js'; // Import the new adapter
import { z } from 'zod';

export type AnzEGateCredentials = z.infer<typeof AnzEGateCredentialsSchema>;
export type LocalBankConfig = z.infer<typeof LocalBankConfigSchema>;

/**
 * ANZ eGate Payment Gateway Adapter.
 * This class acts as a thin wrapper around the MastercardGatewayAdapter,
 * providing ANZ eGate specific branding and delegating all core payment logic
 * to the generic Mastercard integration.
 */
export class AnzEGateAdapter implements PaymentGatewayService {
  private mastercardAdapter: MastercardGatewayAdapter;
  private gatewayConfig: PaymentGateway;

  constructor(gatewayConfig: PaymentGateway) {
    if (!gatewayConfig.credentials) {
      throw new Error('ANZ eGate credentials are not provided.');
    }
    if (!gatewayConfig.config) {
        throw new Error('ANZ eGate configuration is not provided.');
    }

    // Validate credentials and config using Zod schemas
    const parsedCredentials = AnzEGateCredentialsSchema.safeParse(gatewayConfig.credentials);
    if (!parsedCredentials.success) {
      throw new Error(`Invalid ANZ eGate credentials: ${parsedCredentials.error.errors.map((e: z.ZodIssue) => e.message).join(', ')}`);
    }
    const validatedCredentials = parsedCredentials.data;

    const parsedConfig = LocalBankConfigSchema.safeParse(gatewayConfig.config);
    if (!parsedConfig.success) {
      throw new Error(`Invalid ANZ eGate configuration: ${parsedConfig.error.errors.map((e: z.ZodIssue) => e.message).join(', ')}`);
    }
    const validatedConfig = parsedConfig.data;

    // Delegate to MastercardGatewayAdapter with validated credentials and config
    this.mastercardAdapter = new MastercardGatewayAdapter({
        ...gatewayConfig,
        credentials: validatedCredentials,
        config: validatedConfig,
    });
    this.gatewayConfig = gatewayConfig;

    console.log(`ANZ eGate Adapter initialized, delegating to Mastercard Gateway for ${this.gatewayConfig.displayName}`);
  }

  async initiatePayment(request: PaymentInitiationRequest): Promise<PaymentInitiationResponse> {
    return this.mastercardAdapter.initiatePayment(request);
  }

  async handleWebhook(event: WebhookEvent): Promise<WebhookResponse> {
    // If ANZ eGate has specific webhook/callback nuances beyond generic MCPGS,
    // they would be handled here before or after delegating.
    return this.mastercardAdapter.handleWebhook(event);
  }

  async queryPaymentStatus(request: PaymentStatusRequest): Promise<PaymentStatusResponse> {
    return this.mastercardAdapter.queryPaymentStatus(request);
  }

  async refundPayment(payment: Payment, amount?: number, reason?: string): Promise<PaymentStatusResponse> {
    return this.mastercardAdapter.refundPayment(payment, amount, reason);
  }
}


