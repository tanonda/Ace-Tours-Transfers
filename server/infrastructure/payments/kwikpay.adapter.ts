/**
 * KwikPay Payment Gateway Adapter
 *
 * Production integration for KwikPay e-wallet in Vanuatu.
 * Supports API, USSD, and QR code integration modes.
 *
 * Flow:
 * 1. initiatePayment → POST to KwikPay API to create payment / generate QR
 * 2. Customer confirms via KwikPay app, USSD, or QR scan
 * 3. KwikPay calls our webhook endpoint
 * 4. queryPaymentStatus → GET transaction status from KwikPay API
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
import { KwikPayCredentialsSchema, LocalEWalletConfigSchema } from '../../../shared/schema.js';
import { z } from 'zod';
import crypto from 'crypto';

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

    console.log(`[KWIKPAY] Adapter initialized (${this.credentials.integrationType} mode, merchant: ${this.credentials.merchantId})`);
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
    return configUrl || `https://api.kwikpay.vu/v1`;
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
      },
      body: body ? bodyStr : undefined,
      signal: AbortSignal.timeout(30_000),
    });

    const responseBody = response.headers.get('content-type')?.includes('application/json')
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      throw new Error(`KwikPay API ${method} ${endpoint} failed (${response.status}): ${typeof responseBody === 'object' ? JSON.stringify(responseBody) : responseBody}`);
    }

    return responseBody;
  }

  // ── PaymentGatewayService ────────────────────────────────────────────────

  async initiatePayment(request: PaymentInitiationRequest): Promise<PaymentInitiationResponse> {
    console.log(`[KWIKPAY] Initiating ${this.credentials.integrationType} payment for booking ${request.bookingId}`);

    const transactionId = `KPK-${Date.now()}-${request.bookingId.substring(0, 8)}`;
    const currencies = (this.gatewayConfig.supportedCurrencies as string[]) || ['VUV'];

    try {
      const payload = {
        merchantId: this.credentials.merchantId,
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
      if (this.credentials.integrationType === 'QR') {
        customerPrompt = result.qrCodeUrl || result.qrData || 'Scan the QR code with KwikPay app to pay';
      } else if (this.credentials.integrationType === 'USSD') {
        customerPrompt = result.ussdPrompt
          || this.config.customerPromptText
          || `Use KwikPay to pay ${request.amount} VUV to Merchant ${this.credentials.merchantId}`;
      } else {
        customerPrompt = result.paymentUrl || result.redirectUrl || 'Complete payment in the KwikPay app';
      }

      return {
        success: true,
        message: 'Payment initiated. Complete payment via KwikPay.',
        redirectUrl: customerPrompt,
        paymentId: request.metadata?.ourPaymentId,
        transactionId: result.transactionId || transactionId,
      };
    } catch (error: any) {
      console.error('[KWIKPAY] Initiation error:', error.message);
      return {
        success: false,
        message: error.message,
        failureReason: 'system_error',
      };
    }
  }

  async handleWebhook(event: WebhookEvent): Promise<WebhookResponse> {
    console.log(`[KWIKPAY] Processing webhook callback`);

    try {
      // 1. Verify signature
      if (this.config.signatureVerificationKey || event.signature) {
        const rawBody = typeof event.rawEvent === 'string'
          ? event.rawEvent
          : JSON.stringify(event.rawEvent);

        const sig = event.signature
          || event.headers?.['x-signature']
          || event.headers?.['x-kwikpay-signature']
          || '';

        if (!this.verifySignature(rawBody, sig)) {
          console.error('[KWIKPAY] Webhook signature verification failed');
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
        message: `KwikPay callback: ${status}`,
        paymentId,
        bookingId,
        newPaymentStatus: newStatus,
        gatewayReference: data.transactionId || data.transactionRef,
      };
    } catch (error: any) {
      console.error('[KWIKPAY] Webhook error:', error.message);
      return { success: false, message: error.message };
    }
  }

  async queryPaymentStatus(request: PaymentStatusRequest): Promise<PaymentStatusResponse> {
    const txnRef = request.gatewayReference;
    if (!txnRef) {
      return { status: PaymentStatus.Pending, message: 'No transaction reference available.' };
    }

    console.log(`[KWIKPAY] Querying status for ${txnRef}`);

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
        message: `KwikPay status: ${status}`,
      };
    } catch (error: any) {
      console.error('[KWIKPAY] Status query error:', error.message);
      return { status: PaymentStatus.Pending, message: `Status query failed: ${error.message}` };
    }
  }

  async refundPayment(payment: Payment, amount?: number, reason?: string): Promise<PaymentStatusResponse> {
    console.log(`[KWIKPAY] Refunding payment ${payment.id}, amount: ${amount || 'full'}`);

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
      console.error('[KWIKPAY] Refund error:', error.message);
      return { status: PaymentStatus.Failed, message: error.message };
    }
  }
}
