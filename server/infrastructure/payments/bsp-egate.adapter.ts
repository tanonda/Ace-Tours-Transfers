// server/infrastructure/payments/bsp-egate.adapter.ts

import { PaymentGateway, BspBankCredentialsSchema, LocalBankConfigSchema } from '../../../shared/schema.js';
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
 * BSP Bank Payment Gateway Adapter.
 * Thin wrapper around MastercardGatewayAdapter — BSP uses the standard
 * MIGS/VPC protocol but their credential schema uses "password" for the
 * secure hash secret and does not expose a separate "accessCode" field.
 *
 * This wrapper maps BSP's credential names to the Mastercard-standard names
 * so the shared adapter works unchanged.
 *
 * NOTE: If BSP turns out to use a genuinely different auth mechanism
 * (not HMAC-SHA256 VPC hashing), this wrapper will need to be updated
 * once the BSP merchant integration pack is received.
 */
export class BspEGateAdapter implements PaymentGatewayService {
    private mastercardAdapter: MastercardGatewayAdapter;

    constructor(gatewayConfig: PaymentGateway) {
        if (!gatewayConfig.credentials) {
            throw new Error('BSP Bank credentials are not provided.');
        }
        if (!gatewayConfig.config) {
            throw new Error('BSP Bank configuration is not provided.');
        }

        const parsedCredentials = BspBankCredentialsSchema.safeParse(gatewayConfig.credentials);
        if (!parsedCredentials.success) {
            throw new Error(`Invalid BSP Bank credentials: ${parsedCredentials.error.errors.map((e: z.ZodIssue) => e.message).join(', ')}`);
        }

        const parsedConfig = LocalBankConfigSchema.safeParse(gatewayConfig.config);
        if (!parsedConfig.success) {
            throw new Error(`Invalid BSP Bank configuration: ${parsedConfig.error.errors.map((e: z.ZodIssue) => e.message).join(', ')}`);
        }

        const bspCreds = parsedCredentials.data;

        // Map BSP credential names to Mastercard-standard names:
        //   BSP "password"   → Mastercard "secureHashSecret" (used for HMAC-SHA256)
        //   BSP "merchantId" → Mastercard "merchantId" (same)
        //   BSP has no separate "accessCode" — use merchantId as accessCode
        //     (common in some MIGS deployments where the access code equals the merchant ID)
        const mastercardCredentials = {
            merchantId: bspCreds.merchantId,
            accessCode: bspCreds.merchantId, // BSP uses merchantId as access code
            secureHashSecret: bspCreds.password,
            apiEndpoint: bspCreds.apiEndpoint,
        };

        this.mastercardAdapter = new MastercardGatewayAdapter({
            ...gatewayConfig,
            credentials: mastercardCredentials,
            config: parsedConfig.data,
        });

        console.log(`BSP Bank Adapter initialized, delegating to Mastercard Gateway for ${gatewayConfig.displayName}`);
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
