/**
 * Digicel Mobile Money (MyCash) Payment Gateway Adapter
 *
 * Production integration for Digicel MyCash / Mobile Money in Vanuatu.
 * Supports API, USSD, and QR code integration modes.
 *
 * Flow:
 * 1. initiatePayment → POST to Digicel API to create STK push or payment request
 * 2. Customer confirms via USSD (*888#), mobile app, or QR scan
 * 3. Digicel sends callback to our webhook endpoint
 * 4. queryPaymentStatus → GET transaction status from Digicel API
 */

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
import crypto from 'crypto';

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

    console.log(`[DIGICEL] Adapter initialized (${this.credentials.integrationType} mode, merchant: ${this.credentials.merchantId})`);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private signRequest(payload: string): string {
    return crypto
      .createHmac('sha256', this.credentials.apiSecret)
      .update(payload)
      .digest('hex');
  }

  private verifySignature(payload: string, receivedSignature: string): boolean {
    const key = this.config.signatureVerificationKey || this.credentials.apiSecret;
    const expected = crypto
      .createHmac('sha256', key)
      .update(payload)
      .digest('hex');

    if (expected.length !== receivedSignature.length) return false;
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(receivedSignature));
  }

  private get apiBaseUrl(): string {
    const configUrl = (this.gatewayConfig.config as any)?.bankApiEndpointUrl;
    return configUrl || `https://api.mycash.digi.vu/v1`;
  }

  private async apiRequest(method: string, endpoint: string, body?: any): Promise<any> {
    const url = `${this.apiBaseUrl}${endpoint}`;
    const bodyStr = body ? JSON.stringify(body) : '';
    const signature = this.signRequest(bodyStr);

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.credentials.apiKey,
        'X-Merchant-Id': this.credentials.merchantId,
        'X-Signature': signature,
        ...(this.credentials.paymentBusinessNumber && {
          'X-Business-Number': this.credentials.paymentBusinessNumber,
        }),
      },
      body: body ? bodyStr : undefined,
      signal: AbortSignal.timeout(30_000),
    });

    const responseBody = response.headers.get('content-type')?.includes('application/json')
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      throw new Error(`Digicel API ${method} ${endpoint} failed (${response.status}): ${typeof responseBody === 'object' ? JSON.stringify(responseBody) : responseBody}`);
    }

    return responseBody;
  }

  // ── PaymentGatewayService ────────────────────────────────────────────────

  async initiatePayment(request: PaymentInitiationRequest): Promise<PaymentInitiationResponse> {
    console.log(`[DIGICEL] Initiating ${this.credentials.integrationType} payment for booking ${request.bookingId}`);

    const transactionId = `DMM-${Date.now()}-${request.bookingId.substring(0, 8)}`;
    const currencies = (this.gatewayConfig.supportedCurrencies as string[]) || ['VUV'];
    const ussdCode = this.credentials.ussdCode || '*888#';

    try {
      const payload = {
        merchantId: this.credentials.merchantId,
        businessNumber: this.credentials.paymentBusinessNumber,
        transactionRef: transactionId,
        amount: request.amount,
        currency: currencies[0] || request.currency || 'VUV',
        description: `Booking ${request.bookingId}`,
        callbackUrl: this.config.webhookUrl || request.successUrl,
        integrationType: this.credentials.integrationType,
        expiryMinutes: this.config.transactionExpiryMinutes || 30,
        metadata: {
          bookingId: request.bookingId,
          customerEmail: request.customerEmail,
          ourPaymentId: request.metadata?.ourPaymentId,
        },
      };

      const result = await this.apiRequest('POST', '/payments/initiate', payload);

      let customerPrompt: string;
      if (this.credentials.integrationType === 'USSD') {
        customerPrompt = result.ussdPrompt
          || this.config.customerPromptText
          || `Dial ${ussdCode} and follow prompts to pay ${request.amount} VUV to Merchant ${this.credentials.merchantId}`;
      } else if (this.credentials.integrationType === 'QR') {
        customerPrompt = result.qrCodeUrl || result.qrData || 'Scan the QR code to complete payment';
      } else {
        customerPrompt = result.paymentUrl || result.redirectUrl || 'Complete payment in the MyCash app';
      }

      return {
        success: true,
        message: 'Payment initiated. Customer needs to complete payment via MyCash.',
        redirectUrl: customerPrompt,
        paymentId: request.metadata?.ourPaymentId,
        transactionId: result.transactionId || transactionId,
      };
    } catch (error: any) {
      console.error('[DIGICEL] Initiation error:', error.message);
      return {
        success: false,
        message: error.message,
        failureReason: 'system_error',
      };
    }
  }

  async handleWebhook(event: WebhookEvent): Promise<WebhookResponse> {
    console.log(`[DIGICEL] Processing webhook callback`);

    try {
      // 1. Verify signature
      if (this.config.signatureVerificationKey || event.signature) {
        const rawBody = typeof event.rawEvent === 'string'
          ? event.rawEvent
          : JSON.stringify(event.rawEvent);

        const sig = event.signature
          || event.headers?.['x-signature']
          || event.headers?.['x-digicel-signature']
          || '';

        if (!this.verifySignature(rawBody, sig)) {
          console.error('[DIGICEL] Webhook signature verification failed');
          return { success: false, message: 'Signature verification failed.' };
        }
      }

      // 2. Extract transaction data
      const data = typeof event.rawEvent === 'string' ? JSON.parse(event.rawEvent) : event.rawEvent;
      const status = data.status?.toLowerCase();
      const bookingId = data.metadata?.bookingId || data.bookingId;
      const paymentId = data.metadata?.ourPaymentId || data.ourPaymentId;

      let newStatus: PaymentStatus;
      switch (status) {
        case 'completed':
        case 'successful':
        case 'confirmed':
          newStatus = PaymentStatus.Completed;
          break;
        case 'pending':
        case 'processing':
          newStatus = PaymentStatus.Processing;
          break;
        case 'failed':
        case 'declined':
          newStatus = PaymentStatus.Failed;
          break;
        case 'expired':
        case 'timeout':
          newStatus = PaymentStatus.Expired;
          break;
        case 'cancelled':
          newStatus = PaymentStatus.Cancelled;
          break;
        default:
          newStatus = PaymentStatus.Pending;
      }

      return {
        success: true,
        message: `Digicel MyCash callback: ${status}`,
        paymentId,
        bookingId,
        newPaymentStatus: newStatus,
        gatewayReference: data.transactionId || data.transactionRef,
      };
    } catch (error: any) {
      console.error('[DIGICEL] Webhook error:', error.message);
      return { success: false, message: error.message };
    }
  }

  async queryPaymentStatus(request: PaymentStatusRequest): Promise<PaymentStatusResponse> {
    const txnRef = request.gatewayReference;
    if (!txnRef) {
      return { status: PaymentStatus.Pending, message: 'No transaction reference available.' };
    }

    console.log(`[DIGICEL] Querying status for ${txnRef}`);

    try {
      const result = await this.apiRequest('GET', `/payments/status/${txnRef}`);
      const status = result.status?.toLowerCase();

      let paymentStatus: PaymentStatus;
      switch (status) {
        case 'completed':
        case 'successful':
          paymentStatus = PaymentStatus.Completed;
          break;
        case 'pending':
        case 'processing':
          paymentStatus = PaymentStatus.Processing;
          break;
        case 'failed':
          paymentStatus = PaymentStatus.Failed;
          break;
        case 'expired':
          paymentStatus = PaymentStatus.Expired;
          break;
        default:
          paymentStatus = PaymentStatus.Pending;
      }

      return {
        status: paymentStatus,
        gatewayReference: result.transactionId || txnRef,
        amount: result.amount,
        currency: result.currency || (this.gatewayConfig.supportedCurrencies as string[])?.[0] || 'VUV',
        message: `Digicel status: ${status}`,
      };
    } catch (error: any) {
      console.error('[DIGICEL] Status query error:', error.message);
      return { status: PaymentStatus.Pending, message: `Status query failed: ${error.message}` };
    }
  }

  async refundPayment(payment: Payment, amount?: number, reason?: string): Promise<PaymentStatusResponse> {
    console.log(`[DIGICEL] Refunding payment ${payment.id}, amount: ${amount || 'full'}`);

    const txnRef = payment.gatewayReference;
    if (!txnRef) {
      return { status: PaymentStatus.Failed, message: 'No transaction reference for refund.' };
    }

    try {
      const payload = {
        transactionRef: txnRef,
        amount: amount || payment.amount,
        currency: payment.currency,
        reason: reason || 'Customer refund',
      };

      const result = await this.apiRequest('POST', '/payments/refund', payload);

      return {
        status: result.status === 'completed' ? PaymentStatus.Refunded : PaymentStatus.Processing,
        gatewayReference: result.refundId || txnRef,
        amount: amount || payment.amount,
        currency: payment.currency,
        message: `Refund ${result.status}: ${result.refundId || 'processing'}`,
      };
    } catch (error: any) {
      console.error('[DIGICEL] Refund error:', error.message);
      return { status: PaymentStatus.Failed, message: error.message };
    }
  }
}
