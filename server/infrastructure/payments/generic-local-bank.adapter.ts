// server/infrastructure/payments/generic-local-bank.adapter.ts

import { PaymentGateway } from '../../../shared/schema.js';
import {
  PaymentGatewayService,
  PaymentInitiationRequest,
  PaymentInitiationResponse,
  PaymentStatusRequest,
  PaymentStatusResponse,
  WebhookEvent,
  WebhookResponse,
  // PaymentStatus, // Removed as it's not directly used in delegation
} from '../../domain/payments/interfaces.js';
import { Payment } from '../../../shared/schema.js';
import { MastercardGatewayAdapter, MastercardGatewayCredentials } from './mastercard-gateway.adapter.js'; // Import the new adapter

/**
 * Interface for Generic Local Bank specific credentials.
 * These are essentially Mastercard Gateway credentials.
 */
export interface GenericLocalBankCredentials extends MastercardGatewayCredentials {
  // Can add generic local bank-specific fields here if any, otherwise it's just an alias
  // The 'sharedSecret' from the original mock is not standard MCPGS,
  // so if a generic local bank requires it, it'd be an additional field here and handled within this adapter
  // or passed through config to the MastercardAdapter if it had a way to handle custom fields.
  // For now, we assume standard MCPGS credentials.
}

/**
 * Generic Local Bank Payment Gateway Adapter.
 * This class acts as a thin wrapper around the MastercardGatewayAdapter,
 * providing generic local bank specific branding and delegating all core payment logic
 * to the generic Mastercard integration.
 */
export class GenericLocalBankAdapter implements PaymentGatewayService {
  private mastercardAdapter: MastercardGatewayAdapter;
  private gatewayConfig: PaymentGateway;

  constructor(gatewayConfig: PaymentGateway) {
    // Basic validation is done within MastercardGatewayAdapter constructor
    this.mastercardAdapter = new MastercardGatewayAdapter(gatewayConfig);
    this.gatewayConfig = gatewayConfig;

    console.log(`Generic Local Bank Adapter initialized, delegating to Mastercard Gateway for ${this.gatewayConfig.displayName}`);
  }

  async initiatePayment(request: PaymentInitiationRequest): Promise<PaymentInitiationResponse> {
    return this.mastercardAdapter.initiatePayment(request);
  }

  async handleWebhook(event: WebhookEvent): Promise<WebhookResponse> {
    // If a generic local bank has specific webhook/callback nuances beyond generic MCPGS,
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
