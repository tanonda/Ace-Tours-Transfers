/**
 * PayPal REST API v2 Payment Gateway Adapter
 *
 * Production integration using PayPal Orders API v2.
 * - OAuth2 client_credentials token with auto-refresh
 * - Create Order → redirect to PayPal approval → Capture on webhook/return
 * - Webhook signature verification via PayPal Notifications API
 * - Status polling via Orders API
 * - Refunds via Payments API v2
 */

import { PaymentGateway, PayPalCredentialsSchema, InternationalFallbackConfigSchema } from '../../../shared/schema.js';
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
import { z } from 'zod';
import crypto from 'crypto';

export type PayPalCredentials = z.infer<typeof PayPalCredentialsSchema>;
export type InternationalFallbackConfig = z.infer<typeof InternationalFallbackConfigSchema>;

// ── Internal token cache ────────────────────────────────────────────────────
interface TokenCache {
  accessToken: string;
  expiresAt: number; // Unix timestamp ms
}

export class PayPalAdapter implements PaymentGatewayService {
  private credentials: PayPalCredentials;
  private config: InternationalFallbackConfig;
  private gatewayConfig: PaymentGateway;
  private tokenCache: TokenCache | null = null;

  constructor(gatewayConfig: PaymentGateway) {
    if (!gatewayConfig.credentials) {
      throw new Error('PayPal credentials are not provided.');
    }
    if (!gatewayConfig.config) {
      throw new Error('PayPal configuration is not provided.');
    }

    const parsedCredentials = PayPalCredentialsSchema.safeParse(gatewayConfig.credentials);
    if (!parsedCredentials.success) {
      throw new Error(`Invalid PayPal credentials: ${parsedCredentials.error.errors.map((e: z.ZodIssue) => e.message).join(', ')}`);
    }
    this.credentials = parsedCredentials.data;

    const parsedConfig = InternationalFallbackConfigSchema.safeParse(gatewayConfig.config);
    if (!parsedConfig.success) {
      throw new Error(`Invalid PayPal configuration: ${parsedConfig.error.errors.map((e: z.ZodIssue) => e.message).join(', ')}`);
    }
    this.config = parsedConfig.data;
    this.gatewayConfig = gatewayConfig;

    console.log(`[PAYPAL] Adapter initialized (${this.credentials.mode} mode)`);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private get baseUrl(): string {
    return this.credentials.mode === 'live'
      ? 'https://api-m.paypal.com'
      : 'https://api-m.sandbox.paypal.com';
  }

  /**
   * Obtain and cache an OAuth2 access token using client_credentials grant.
   * Automatically refreshes when token is expired or about to expire (60s buffer).
   */
  private async getAccessToken(): Promise<string> {
    if (this.tokenCache && Date.now() < this.tokenCache.expiresAt - 60_000) {
      return this.tokenCache.accessToken;
    }

    const auth = Buffer.from(`${this.credentials.clientId}:${this.credentials.clientSecret}`).toString('base64');

    const response = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`PayPal OAuth failed (${response.status}): ${body}`);
    }

    const data = await response.json() as { access_token: string; expires_in: number };
    this.tokenCache = {
      accessToken: data.access_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    };

    return this.tokenCache.accessToken;
  }

  private async apiRequest(method: string, path: string, body?: any): Promise<any> {
    const token = await this.getAccessToken();
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    // PayPal requires a unique idempotency key for certain POST requests
    if (method === 'POST') {
      headers['PayPal-Request-Id'] = crypto.randomUUID();
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30_000),
    });

    const responseBody = response.headers.get('content-type')?.includes('application/json')
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      const errMsg = typeof responseBody === 'object'
        ? JSON.stringify(responseBody)
        : responseBody;
      throw new Error(`PayPal API ${method} ${path} failed (${response.status}): ${errMsg}`);
    }

    return responseBody;
  }

  // ── PaymentGatewayService ────────────────────────────────────────────────

  async initiatePayment(request: PaymentInitiationRequest): Promise<PaymentInitiationResponse> {
    console.log(`[PAYPAL] Initiating payment for booking ${request.bookingId}, amount ${request.amount} ${request.currency}`);

    try {
      // PayPal expects amount as a decimal string (e.g., "150.00"), NOT cents.
      // Our system stores amounts in cents/smallest unit, so divide by 100 for most currencies.
      const currencyUpper = (request.currency || 'VUV').toUpperCase();
      // VUV has no decimal places; most others have 2
      const isZeroDecimal = ['VUV', 'JPY', 'KRW', 'HUF'].includes(currencyUpper);
      const amountStr = isZeroDecimal
        ? request.amount.toString()
        : (request.amount / 100).toFixed(2);

      const orderPayload = {
        intent: 'CAPTURE',
        purchase_units: [{
          reference_id: request.bookingId,
          description: request.customerName
            ? `Booking for ${request.customerName}`
            : `Booking ${request.bookingId}`,
          amount: {
            currency_code: currencyUpper,
            value: amountStr,
          },
          custom_id: request.bookingId,
        }],
        payment_source: {
          paypal: {
            experience_context: {
              return_url: request.successUrl,
              cancel_url: request.cancelUrl,
              brand_name: 'Ace Tours & Transfers',
              landing_page: this.credentials.checkoutExperience === 'PAY_WITH_CARD_OR_PAYPAL'
                ? 'NO_PREFERENCE'
                : 'LOGIN',
              user_action: 'PAY_NOW',
              shipping_preference: 'NO_SHIPPING',
            },
          },
        },
        application_context: {
          ...(request.customerEmail && { payer_email: request.customerEmail }),
        },
      };

      const order = await this.apiRequest('POST', '/v2/checkout/orders', orderPayload);

      // Find the approval link from the HATEOAS links
      const approveLink = order.links?.find((l: any) => l.rel === 'payer-action' || l.rel === 'approve');
      if (!approveLink?.href) {
        return {
          success: false,
          message: 'PayPal did not return an approval URL.',
          failureReason: 'no_approval_link',
        };
      }

      return {
        success: true,
        message: 'PayPal order created.',
        redirectUrl: approveLink.href,
        transactionId: order.id,
      };
    } catch (error: any) {
      console.error('[PAYPAL] Initiation error:', error.message);
      return {
        success: false,
        message: error.message,
        failureReason: 'system_error',
      };
    }
  }

  async handleWebhook(event: WebhookEvent): Promise<WebhookResponse> {
    console.log(`[PAYPAL] Processing webhook event`);

    try {
      // 1. Verify webhook signature via PayPal Notifications API
      if (this.credentials.ipnWebhookUrl && event.headers) {
        const verificationPayload = {
          auth_algo: event.headers['paypal-auth-algo'],
          cert_url: event.headers['paypal-cert-url'],
          transmission_id: event.headers['paypal-transmission-id'],
          transmission_sig: event.headers['paypal-transmission-sig'],
          transmission_time: event.headers['paypal-transmission-time'],
          webhook_id: this.credentials.ipnWebhookUrl, // Webhook ID from PayPal dashboard
          webhook_event: event.rawEvent,
        };

        const verification = await this.apiRequest('POST', '/v1/notifications/verify-webhook-signature', verificationPayload);

        if (verification.verification_status !== 'SUCCESS') {
          console.error('[PAYPAL] Webhook signature verification failed');
          return { success: false, message: 'Webhook signature verification failed.' };
        }
      }

      // 2. Process the event
      const eventType = event.rawEvent?.event_type;
      const resource = event.rawEvent?.resource;

      let newStatus: PaymentStatus | undefined;
      let bookingId: string | undefined;

      switch (eventType) {
        case 'CHECKOUT.ORDER.APPROVED': {
          // Auto-capture the approved order
          const orderId = resource?.id;
          if (orderId) {
            try {
              const capture = await this.apiRequest('POST', `/v2/checkout/orders/${orderId}/capture`, {});
              const captureStatus = capture.status;
              newStatus = captureStatus === 'COMPLETED' ? PaymentStatus.Completed : PaymentStatus.Processing;
              bookingId = capture.purchase_units?.[0]?.custom_id || capture.purchase_units?.[0]?.reference_id;
            } catch (captureError: any) {
              console.error('[PAYPAL] Auto-capture failed:', captureError.message);
              newStatus = PaymentStatus.Failed;
            }
          }
          break;
        }
        case 'PAYMENT.CAPTURE.COMPLETED':
          newStatus = PaymentStatus.Completed;
          bookingId = resource?.custom_id || resource?.supplementary_data?.related_ids?.order_id;
          break;
        case 'PAYMENT.CAPTURE.DENIED':
        case 'PAYMENT.CAPTURE.DECLINED':
          newStatus = PaymentStatus.Failed;
          bookingId = resource?.custom_id;
          break;
        case 'PAYMENT.CAPTURE.PENDING':
          newStatus = PaymentStatus.Processing;
          bookingId = resource?.custom_id;
          break;
        case 'PAYMENT.CAPTURE.REFUNDED':
          newStatus = PaymentStatus.Refunded;
          bookingId = resource?.custom_id;
          break;
        default:
          console.log(`[PAYPAL] Unhandled event type: ${eventType}`);
          return { success: true, message: `Unhandled event type: ${eventType}` };
      }

      return {
        success: true,
        message: `PayPal webhook '${eventType}' processed.`,
        bookingId,
        newPaymentStatus: newStatus,
        gatewayReference: resource?.id,
      };
    } catch (error: any) {
      console.error('[PAYPAL] Webhook error:', error.message);
      return { success: false, message: error.message };
    }
  }

  async queryPaymentStatus(request: PaymentStatusRequest): Promise<PaymentStatusResponse> {
    const orderId = request.gatewayReference;
    if (!orderId) {
      return { status: PaymentStatus.Pending, message: 'No PayPal order ID available.' };
    }

    console.log(`[PAYPAL] Querying status for order ${orderId}`);

    try {
      const order = await this.apiRequest('GET', `/v2/checkout/orders/${orderId}`);

      let status: PaymentStatus;
      switch (order.status) {
        case 'COMPLETED':
          status = PaymentStatus.Completed;
          break;
        case 'APPROVED':
          status = PaymentStatus.Processing;
          break;
        case 'VOIDED':
          status = PaymentStatus.Cancelled;
          break;
        case 'CREATED':
        case 'SAVED':
          status = PaymentStatus.Pending;
          break;
        case 'PAYER_ACTION_REQUIRED':
          status = PaymentStatus.Pending;
          break;
        default:
          status = PaymentStatus.Pending;
      }

      const capture = order.purchase_units?.[0]?.payments?.captures?.[0];
      return {
        status,
        gatewayReference: order.id,
        amount: capture ? parseInt(capture.amount?.value || '0', 10) : undefined,
        currency: capture?.amount?.currency_code || this.credentials.settlementCurrency || 'VUV',
        message: `PayPal order status: ${order.status}`,
      };
    } catch (error: any) {
      console.error('[PAYPAL] Status query error:', error.message);
      return { status: PaymentStatus.Pending, message: error.message };
    }
  }

  async refundPayment(payment: Payment, amount?: number, reason?: string): Promise<PaymentStatusResponse> {
    console.log(`[PAYPAL] Refunding payment ${payment.id}, amount: ${amount || 'full'}`);

    const captureId = payment.gatewayReference;
    if (!captureId) {
      return { status: PaymentStatus.Failed, message: 'No capture ID available for refund.' };
    }

    try {
      // First, get the order to find the capture ID
      const order = await this.apiRequest('GET', `/v2/checkout/orders/${captureId}`);
      const actualCaptureId = order.purchase_units?.[0]?.payments?.captures?.[0]?.id || captureId;

      const refundPayload: any = {};
      if (amount) {
        const isZeroDecimal = ['VUV', 'JPY', 'KRW', 'HUF'].includes(payment.currency.toUpperCase());
        refundPayload.amount = {
          value: isZeroDecimal ? amount.toString() : (amount / 100).toFixed(2),
          currency_code: payment.currency.toUpperCase(),
        };
      }
      if (reason) {
        refundPayload.note_to_payer = reason;
      }

      const refund = await this.apiRequest(
        'POST',
        `/v2/payments/captures/${actualCaptureId}/refund`,
        Object.keys(refundPayload).length > 0 ? refundPayload : undefined,
      );

      return {
        status: refund.status === 'COMPLETED' ? PaymentStatus.Refunded : PaymentStatus.Processing,
        gatewayReference: refund.id,
        amount: amount || payment.amount,
        currency: payment.currency,
        message: `Refund ${refund.status}: ${refund.id}`,
      };
    } catch (error: any) {
      console.error('[PAYPAL] Refund error:', error.message);
      return { status: PaymentStatus.Failed, message: error.message };
    }
  }
}
