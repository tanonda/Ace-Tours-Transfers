// server/infrastructure/payments/mpgs.adapter.ts

import { randomBytes, timingSafeEqual } from 'crypto';
import { z } from 'zod';
import { PaymentGateway, Payment, AnzEGateCredentialsSchema } from '../../../shared/schema.js';
import {
  PaymentGatewayService,
  PaymentInitiationRequest,
  PaymentInitiationResponse,
  PaymentStatusRequest,
  PaymentStatusResponse,
  PaymentStatus,
  WebhookEvent,
  WebhookResponse,
} from '../../domain/payments/interfaces.js';
import { createLogger } from '../../lib/logger.js';

const logger = createLogger('mpgs-adapter');

type MpgsCredentials = z.infer<typeof AnzEGateCredentialsSchema>;
type FetchFn = typeof fetch;

const DEFAULT_API_VERSION = '100';
const DEFAULT_MERCHANT_NAME = 'Ace Tours & Transfers';

// MPGS order amounts are decimal strings in major units. Amounts in this app are
// whole units of a zero-decimal currency (VUV), so only those are accepted here.
const ZERO_DECIMAL_CURRENCIES = new Set(['VUV']);

// Session IDs end up inside a <script> on the launch page: allow only plain tokens.
const SESSION_ID_PATTERN = /^[A-Za-z0-9]{8,64}$/;

/** The order fields we read from a Retrieve Order response. */
interface MpgsOrder {
  result?: string;
  status?: string;
  amount?: number | string;
  currency?: string;
  totalCapturedAmount?: number | string;
  reference?: string;
  error?: { cause?: string; explanation?: string };
}

/**
 * Maps an MPGS order status to our payment status. The site always sends
 * operation PURCHASE, so a paid order is CAPTURED in full.
 * Returns undefined when the order is still in progress.
 */
export function mapMpgsOrder(order: MpgsOrder): PaymentStatus | undefined {
  switch (order.status) {
    case 'CAPTURED':
      // A partial capture would confirm a booking that was not paid in full.
      return Number(order.totalCapturedAmount) === Number(order.amount)
        ? PaymentStatus.Completed
        : PaymentStatus.ManualReviewRequired;
    case 'FAILED':
    case 'AUTHENTICATION_UNSUCCESSFUL':
      return PaymentStatus.Failed;
    case 'CANCELLED':
      return PaymentStatus.Cancelled;
    case 'INITIATED':
    case 'AUTHENTICATION_INITIATED':
    case 'AUTHENTICATION_AVAILABLE':
    case 'AUTHENTICATION_NOT_NEEDED':
      return undefined;
    // AUTHORIZED (held, not captured), PARTIALLY_CAPTURED, REFUNDED, DISPUTED and
    // anything unknown need a person: never guess "paid".
    default:
      return PaymentStatus.ManualReviewRequired;
  }
}

/**
 * ANZ eGate on Mastercard Payment Gateway Services (MPGS), Hosted Checkout.
 *
 * 1. initiatePayment: server calls INITIATE_CHECKOUT and gets a session ID.
 *    The guest is sent to our launch page, which loads ANZ's checkout.js and
 *    shows the hosted payment page. Card details never touch this site.
 * 2. The guest returns to /api/payments/callback/anz-egate?order=<paymentId>,
 *    and ANZ may also POST a notification to /api/payments/webhook/anz-egate.
 *    Neither is trusted: both only trigger a server-to-server Retrieve Order,
 *    whose answer decides the payment status.
 *
 * Order ID = our payment ID; order reference = booking ID.
 */
export class MpgsHostedCheckoutAdapter implements PaymentGatewayService {
  private credentials: MpgsCredentials;
  private fetchFn: FetchFn;

  constructor(gatewayConfig: PaymentGateway, deps: { fetch?: FetchFn } = {}) {
    if (!gatewayConfig.credentials) {
      throw new Error('ANZ eGate (MPGS) credentials are not provided.');
    }
    const parsed = AnzEGateCredentialsSchema.safeParse(gatewayConfig.credentials);
    if (!parsed.success) {
      throw new Error(`Invalid ANZ eGate (MPGS) credentials: ${parsed.error.errors.map((e: z.ZodIssue) => e.message).join(', ')}`);
    }
    if (parsed.data.mode === 'PRODUCTION' && (!parsed.data.productionMerchantId || !parsed.data.productionApiPassword)) {
      throw new Error('ANZ eGate (MPGS) is set to PRODUCTION but the production merchant ID or API password is missing.');
    }
    this.credentials = parsed.data;
    this.fetchFn = deps.fetch ?? fetch;
  }

  private get isProduction(): boolean {
    return this.credentials.mode === 'PRODUCTION';
  }

  private get merchantId(): string {
    return this.isProduction ? this.credentials.productionMerchantId! : this.credentials.testMerchantId;
  }

  private get apiPassword(): string {
    return this.isProduction ? this.credentials.productionApiPassword! : this.credentials.testApiPassword;
  }

  private get notificationSecret(): string | undefined {
    const secret = this.isProduction ? this.credentials.productionNotificationSecret : this.credentials.testNotificationSecret;
    return secret || undefined;
  }

  private get origin(): string {
    return new URL(this.credentials.gatewayUrl).origin;
  }

  /** ANZ's checkout.js, which the launch page loads to show the hosted payment page. */
  get checkoutScriptUrl(): string {
    return `${this.origin}/static/checkout/checkout.min.js`;
  }

  private merchantUrl(path: string): string {
    const version = this.credentials.apiVersion || DEFAULT_API_VERSION;
    return `${this.origin}/api/rest/version/${version}/merchant/${encodeURIComponent(this.merchantId)}${path}`;
  }

  private async call(method: 'GET' | 'POST' | 'PUT', path: string, body?: unknown): Promise<{ status: number; json: any }> {
    const auth = Buffer.from(`merchant.${this.merchantId}:${this.apiPassword}`).toString('base64');
    const response = await this.fetchFn(this.merchantUrl(path), {
      method,
      headers: {
        Authorization: `Basic ${auth}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15_000),
    });
    const json = await response.json().catch(() => ({}));
    return { status: response.status, json };
  }

  async initiatePayment(request: PaymentInitiationRequest): Promise<PaymentInitiationResponse> {
    if (!ZERO_DECIMAL_CURRENCIES.has(request.currency)) {
      return { success: false, message: `Currency ${request.currency} is not configured for ANZ eGate (MPGS).` };
    }
    const paymentId: string | undefined = request.metadata?.paymentId;
    if (!paymentId) {
      return { success: false, message: 'Missing payment ID for the MPGS order ID.' };
    }

    const siteOrigin = new URL(request.successUrl).origin;
    const back = (outcome: 'return' | 'cancel') =>
      `${siteOrigin}/api/payments/callback/anz-egate?order=${encodeURIComponent(paymentId)}` +
      `&booking=${encodeURIComponent(request.bookingId)}&outcome=${outcome}`;

    const { status, json } = await this.call('POST', '/session', {
      apiOperation: 'INITIATE_CHECKOUT',
      checkoutMode: 'WEBSITE',
      interaction: {
        operation: 'PURCHASE',
        returnUrl: back('return'),
        cancelUrl: back('cancel'),
        merchant: { name: this.credentials.merchantName || DEFAULT_MERCHANT_NAME },
        displayControl: { billingAddress: 'HIDE', shipping: 'HIDE' },
      },
      order: {
        id: paymentId,
        reference: request.bookingId,
        amount: String(request.amount),
        currency: request.currency,
        description: `Booking ACT-${request.bookingId.slice(0, 8).toUpperCase()}`,
      },
    });

    const sessionId: string | undefined = json?.session?.id;
    if (status >= 300 || json?.result !== 'SUCCESS' || !sessionId || !SESSION_ID_PATTERN.test(sessionId)) {
      const reason = json?.error?.explanation || json?.error?.cause || `HTTP ${status}`;
      logger.error('INITIATE_CHECKOUT failed', { paymentId, status, reason });
      return { success: false, message: `ANZ eGate could not start the payment: ${reason}`, failureReason: 'mpgs_initiate_failed' };
    }

    return {
      success: true,
      message: 'MPGS checkout session created.',
      redirectUrl: `${siteOrigin}/api/payments/checkout/anz-egate?session=${encodeURIComponent(sessionId)}`,
      transactionId: paymentId, // the MPGS order ID
      paymentId,
    };
  }

  /** Asks ANZ for the order's real state. Undefined order = ANZ has no such order. */
  private async retrieveOrder(orderId: string): Promise<{ order?: MpgsOrder; notFound: boolean; error?: string }> {
    try {
      const { status, json } = await this.call('GET', `/order/${encodeURIComponent(orderId)}`);
      if (status < 300 && json?.result !== 'ERROR') return { order: json, notFound: false };
      const explanation: string = json?.error?.explanation || '';
      // MPGS answers an unknown order with an INVALID_REQUEST error naming the order.
      const notFound = status === 404 || /unable to find order|order not found/i.test(explanation);
      return { notFound, error: explanation || `HTTP ${status}` };
    } catch (error: any) {
      return { notFound: false, error: error?.message || 'network error' };
    }
  }

  private toWebhookResponse(orderId: string, order: MpgsOrder, newPaymentStatus: PaymentStatus | undefined): WebhookResponse {
    const captured = order.status === 'CAPTURED' && order.totalCapturedAmount !== undefined;
    return {
      success: true,
      message: `MPGS order status ${order.status ?? 'unknown'}`,
      paymentId: orderId,
      bookingId: order.reference,
      gatewayReference: orderId,
      newPaymentStatus,
      // Compared against the payment by the application service before anything is confirmed.
      amount: Number(captured ? order.totalCapturedAmount : order.amount),
      currency: order.currency,
      failureReason: newPaymentStatus === PaymentStatus.Failed ? `mpgs_${String(order.status).toLowerCase()}` : undefined,
    };
  }

  /**
   * Two callers:
   * - the guest's browser coming back (rawEvent = query: order, booking, outcome)
   * - an ANZ notification (rawEvent = JSON body, headers carry X-Notification-Secret)
   */
  async handleWebhook(event: WebhookEvent): Promise<WebhookResponse> {
    const raw = event.rawEvent ?? {};
    const isNotification = typeof raw.order === 'object' && raw.order !== null;

    if (isNotification) {
      const expected = this.notificationSecret;
      if (expected) {
        const received = Buffer.from(String(event.headers?.['x-notification-secret'] ?? ''));
        const wanted = Buffer.from(expected);
        if (received.length !== wanted.length || !timingSafeEqual(received, wanted)) {
          return { success: false, message: 'Invalid MPGS notification secret.' };
        }
      }
      if (raw.merchant && raw.merchant !== this.merchantId) {
        return { success: false, message: `Notification is for merchant ${raw.merchant}, not the ${this.credentials.mode} merchant.` };
      }
    }

    const orderId = String(isNotification ? raw.order.id ?? '' : raw.order ?? '');
    if (!orderId) {
      return { success: false, message: 'No MPGS order ID in the callback.' };
    }

    const { order, notFound, error } = await this.retrieveOrder(orderId);
    if (!order) {
      // A guest who cancels before paying leaves no order at ANZ.
      if (notFound && !isNotification && raw.outcome === 'cancel') {
        return { success: true, message: 'Guest cancelled before paying.', paymentId: orderId, gatewayReference: orderId, newPaymentStatus: PaymentStatus.Cancelled };
      }
      logger.warn('Retrieve Order gave no answer; payment left for reconciliation', { orderId, error });
      return { success: true, message: `Order not confirmed by ANZ yet (${error}).`, paymentId: orderId, gatewayReference: orderId };
    }

    let newPaymentStatus = mapMpgsOrder(order);
    // A declined card can be retried on the hosted page while the guest is still there,
    // so a notification only ever confirms; failures are settled when the guest comes back.
    if (isNotification && newPaymentStatus !== PaymentStatus.Completed) {
      newPaymentStatus = undefined;
    }
    // Cancelled from the hosted page after starting (e.g. mid 3-D Secure): the guest has left.
    if (!isNotification && raw.outcome === 'cancel' && newPaymentStatus === undefined) {
      newPaymentStatus = PaymentStatus.Cancelled;
    }
    return this.toWebhookResponse(orderId, order, newPaymentStatus);
  }

  async queryPaymentStatus(request: PaymentStatusRequest): Promise<PaymentStatusResponse> {
    const { order, notFound, error } = await this.retrieveOrder(request.paymentId);
    if (!order) {
      return {
        status: PaymentStatus.Pending,
        message: notFound ? 'ANZ has no order for this payment (guest never paid).' : `Status query failed: ${error}. Will retry later.`,
      };
    }
    const status = mapMpgsOrder(order) ?? PaymentStatus.Processing;
    return {
      status,
      gatewayReference: request.paymentId,
      amount: Number(order.status === 'CAPTURED' ? order.totalCapturedAmount : order.amount),
      currency: order.currency,
      message: `MPGS order status ${order.status}`,
      failureReason: status === PaymentStatus.Failed ? `mpgs_${String(order.status).toLowerCase()}` : undefined,
    };
  }

  async refundPayment(payment: Payment, amount?: number, _reason?: string): Promise<PaymentStatusResponse> {
    const refundAmount = amount ?? payment.amount;
    const transactionId = `refund-${randomBytes(6).toString('hex')}`;
    try {
      const { status, json } = await this.call('PUT', `/order/${encodeURIComponent(payment.id)}/transaction/${transactionId}`, {
        apiOperation: 'REFUND',
        transaction: { amount: String(refundAmount), currency: payment.currency },
      });
      if (status < 300 && json?.result === 'SUCCESS') {
        return { status: PaymentStatus.Refunded, gatewayReference: transactionId, amount: refundAmount, currency: payment.currency, message: 'Refund successful.' };
      }
      return { status: PaymentStatus.Failed, message: `Refund declined: ${json?.error?.explanation || json?.response?.gatewayCode || `HTTP ${status}`}` };
    } catch (error: any) {
      return { status: PaymentStatus.Failed, message: `Refund failed: ${error?.message}` };
    }
  }
}

/** The ID-checked session, or undefined. */
export function parseMpgsSessionId(value: unknown): string | undefined {
  return typeof value === 'string' && SESSION_ID_PATTERN.test(value) ? value : undefined;
}

/**
 * The page that hands the guest to ANZ's hosted payment page. checkout.js needs a
 * page of ours to run on; it then navigates to ANZ. Returns the HTML and the CSP
 * that lets only ANZ's script (and our nonce'd snippet) run.
 */
export function renderMpgsLaunchPage(scriptUrl: string, sessionId: string, cancelUrl: string): { html: string; csp: string } {
  const nonce = randomBytes(16).toString('base64');
  const origin = new URL(scriptUrl).origin;
  const js = (v: string) => JSON.stringify(v).replace(/</g, '\\u003c');
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>Secure payment</title>
<style>body{font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;color:#1f2937;background:#fff}p{text-align:center;padding:0 16px}</style>
</head><body><p id="msg">Opening ANZ secure payment&hellip;</p>
<script nonce="${nonce}">
window.mpgsError = function () {
  document.getElementById('msg').textContent = 'The payment page could not be opened. Returning to your booking…';
  setTimeout(function () { location.href = ${js(cancelUrl)}; }, 2500);
};
</script>
<script src="${scriptUrl}" data-error="mpgsError"></script>
<script nonce="${nonce}">
try { Checkout.configure({ session: { id: ${js(sessionId)} } }); Checkout.showPaymentPage(); } catch (e) { window.mpgsError(); }
</script>
</body></html>`;
  const csp = [
    "default-src 'none'",
    `script-src 'nonce-${nonce}' ${origin}`,
    `connect-src ${origin}`,
    `frame-src ${origin}`,
    `img-src ${origin} data:`,
    "style-src 'unsafe-inline'",
    `form-action ${origin}`,
    "base-uri 'none'",
  ].join('; ');
  return { html, csp };
}
