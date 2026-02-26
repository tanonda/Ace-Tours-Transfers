// server/infrastructure/payments/bred-egate.adapter.ts

import { PaymentGateway, BredBankCredentialsSchema, LocalBankConfigSchema } from '../../../shared/schema.js';
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
import { MastercardGatewayAdapter } from './mastercard-gateway.adapter.js';
import { z } from 'zod';

/**
 * BRED Bank Payment Gateway Adapter.
 * Thin wrapper around MastercardGatewayAdapter — BRED uses the standard
 * MIGS/VPC protocol with the same accessCode + secureHashSecret credential
 * structure. All core payment logic is delegated to the shared adapter.
 */
export class BredEGateAdapter implements PaymentGatewayService {
    private mastercardAdapter: MastercardGatewayAdapter;

    constructor(gatewayConfig: PaymentGateway) {
        if (!gatewayConfig.credentials) {
            throw new Error('BRED Bank credentials are not provided.');
        }
        if (!gatewayConfig.config) {
            throw new Error('BRED Bank configuration is not provided.');
        }

        const parsedCredentials = BredBankCredentialsSchema.safeParse(gatewayConfig.credentials);
        if (!parsedCredentials.success) {
            throw new Error(`Invalid BRED Bank credentials: ${parsedCredentials.error.errors.map((e: z.ZodIssue) => e.message).join(', ')}`);
        }

        const parsedConfig = LocalBankConfigSchema.safeParse(gatewayConfig.config);
        if (!parsedConfig.success) {
            throw new Error(`Invalid BRED Bank configuration: ${parsedConfig.error.errors.map((e: z.ZodIssue) => e.message).join(', ')}`);
        }

        // BRED credentials are a superset of MastercardGatewayCredentials —
        // merchantId, accessCode, secureHashSecret, apiEndpoint all match.
        this.mastercardAdapter = new MastercardGatewayAdapter({
            ...gatewayConfig,
            credentials: parsedCredentials.data,
            config: parsedConfig.data,
        });

        console.log(`BRED Bank Adapter initialized, delegating to Mastercard Gateway for ${gatewayConfig.displayName}`);
    }

    async initiatePayment(request: PaymentInitiationRequest): Promise<PaymentInitiationResponse> {
        return this.mastercardAdapter.initiatePayment(request);
    }

    async handleWebhook(event: WebhookEvent): Promise<WebhookResponse> {
        return this.mastercardAdapter.handleWebhook(event);
    }

    async queryPaymentStatus(request: PaymentStatusRequest): Promise<PaymentStatusResponse> {
        return this.mastercardAdapter.queryPaymentStatus(request);
    }

    async refundPayment(payment: Payment, amount?: number, reason?: string): Promise<PaymentStatusResponse> {
        return this.mastercardAdapter.refundPayment(payment, amount, reason);
    }
}
