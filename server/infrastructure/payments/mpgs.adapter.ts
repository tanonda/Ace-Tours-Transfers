// server/infrastructure/payments/mpgs.adapter.ts

import { randomBytes, timingSafeEqual } from 'crypto';
import { z } from 'zod';
import { PaymentGateway, Payment, MpgsCredentialsSchema, MPGS_GATEWAY_SLUGS } from '../../../shared/schema.js';
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

type MpgsCredentials = z.infer<typeof MpgsCredentialsSchema>;

export const isMpgsGateway = (slug: string) => (MPGS_GATEWAY_SLUGS as readonly string[]).includes(slug);
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
 * Bank card payments on Mastercard Payment Gateway Services (MPGS), Hosted Checkout.
 * One adapter serves every bank whose merchant profile is on MPGS (ANZ, BSP, NBV);
 * each bank is its own gateway row with its own credentials.
 *
 * 1. initiatePayment: server calls INITIATE_CHECKOUT and gets a session ID.
 *    The guest is sent to our launch page, which loads the bank's checkout.js and
 *    shows the hosted payment page. Card details never touch this site.
 * 2. The guest returns to /api/payments/callback/<slug>?order=<paymentId>,
 *    and the bank may also POST a notification to /api/payments/webhook/<slug>.
 *    Neither is trusted: both only trigger a server-to-server Retrieve Order,
 *    whose answer decides the payment status.
 *
 * 3. createPaymentLink: the same order, but the bank hosts a link the admin
 *    sends to the guest (phone and email bookings).
 *
 * Order ID = our payment ID; order reference = booking ID.
 */
export class MpgsHostedCheckoutAdapter implements PaymentGatewayService {
  private credentials: MpgsCredentials;
  private fetchFn: FetchFn;
  private slug: string;
  private bankName: string;

  constructor(gatewayConfig: PaymentGateway, deps: { fetch?: FetchFn } = {}) {
    this.slug = gatewayConfig.slug;
    this.bankName = `${gatewayConfig.displayName} (MPGS)`;
    if (!isMpgsGateway(this.slug)) {
      throw new Error(`${gatewayConfig.slug} is not an MPGS gateway.`);
    }
    if (!gatewayConfig.credentials) {
      throw new Error(`${this.bankName} credentials are not provided.`);
    }
    const parsed = MpgsCredentialsSchema.safeParse(gatewayConfig.credentials);
    if (!parsed.success) {
      throw new Error(`Invalid ${this.bankName} credentials: ${parsed.error.errors.map((e: z.ZodIssue) => e.message).join(', ')}`);
    }
    if (parsed.data.mode === 'PRODUCTION' && (!parsed.data.productionMerchantId || !parsed.data.productionApiPassword)) {
      throw new Error(`${this.bankName} is set to PRODUCTION but the production merchant ID or API password is missing.`);
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

  /** The bank's checkout.js, which the launch page loads to show the hosted payment page. */
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

  /** Where the guest comes back to, for one of the three exits from the bank's page. */
  private backUrl(siteOrigin: string, paymentId: string, bookingId: string, outcome: 'return' | 'cancel' | 'failed'): string {
    return `${siteOrigin}/api/payments/callback/${this.slug}?order=${encodeURIComponent(paymentId)}` +
      `&booking=${encodeURIComponent(bookingId)}&outcome=${outcome}`;
  }

  /**
   * A payment link stays payable after a cancel or a decline (the bank allows 25 attempts
   * until it expires), so links only return the guest on success: a cancel or failed
   * outcome would close a payment the guest can still make.
   */
  private checkoutRequest(
    order: { paymentId: string; bookingId: string; amount: number; currency: string },
    siteOrigin: string,
    mode: 'WEBSITE' | 'PAYMENT_LINK',
  ) {
    const exits = mode === 'WEBSITE'
      ? {
        cancelUrl: this.backUrl(siteOrigin, order.paymentId, order.bookingId, 'cancel'),
        // After 3 declined attempts the guest comes back instead of being stuck on the bank's page.
        redirectMerchantUrl: this.backUrl(siteOrigin, order.paymentId, order.bookingId, 'failed'),
        retryAttemptCount: 3,
      }
      : {};
    return {
      apiOperation: 'INITIATE_CHECKOUT',
      checkoutMode: mode,
      interaction: {
        operation: 'PURCHASE',
        returnUrl: this.backUrl(siteOrigin, order.paymentId, order.bookingId, 'return'),
        ...exits,
        merchant: { name: this.credentials.merchantName || DEFAULT_MERCHANT_NAME, url: siteOrigin },
        displayControl: { billingAddress: 'HIDE', shipping: 'HIDE' },
      },
      order: {
        id: order.paymentId,
        reference: order.bookingId,
        amount: String(order.amount),
        currency: order.currency,
        description: `Booking ACT-${order.bookingId.slice(0, 8).toUpperCase()}`,
      },
    };
  }

  private rejection(status: number, json: any, what: string, paymentId: string): PaymentInitiationResponse {
    const reason = json?.error?.explanation || json?.error?.cause || `HTTP ${status}`;
    logger.error(`${what} failed`, { gateway: this.slug, paymentId, status, reason });
    return { success: false, message: `${this.bankName} could not start the payment: ${reason}`, failureReason: 'mpgs_initiate_failed' };
  }

  async initiatePayment(request: PaymentInitiationRequest): Promise<PaymentInitiationResponse> {
    if (!ZERO_DECIMAL_CURRENCIES.has(request.currency)) {
      return { success: false, message: `Currency ${request.currency} is not configured for ${this.bankName}.` };
    }
    const paymentId: string | undefined = request.metadata?.paymentId;
    if (!paymentId) {
      return { success: false, message: 'Missing payment ID for the MPGS order ID.' };
    }

    const siteOrigin = new URL(request.successUrl).origin;
    const { status, json } = await this.call('POST', '/session',
      this.checkoutRequest({ paymentId, bookingId: request.bookingId, amount: request.amount, currency: request.currency }, siteOrigin, 'WEBSITE'));

    const sessionId: string | undefined = json?.session?.id;
    if (status >= 300 || json?.result !== 'SUCCESS' || !sessionId || !SESSION_ID_PATTERN.test(sessionId)) {
      return this.rejection(status, json, 'INITIATE_CHECKOUT', paymentId);
    }

    return {
      success: true,
      message: 'MPGS checkout session created.',
      redirectUrl: `${siteOrigin}/api/payments/checkout/${this.slug}?session=${encodeURIComponent(sessionId)}`,
      transactionId: paymentId, // the MPGS order ID
      paymentId,
    };
  }

  /**
   * A bank-hosted payment link for the same order, to send to a guest by email or text.
   * The link stops working at expiresAt, after 25 attempts, or once paid.
   */
  async createPaymentLink(link: {
    paymentId: string; bookingId: string; amount: number; currency: string; expiresAt: Date; siteOrigin: string;
  }): Promise<{ success: true; url: string; linkId: string } | { success: false; message: string }> {
    if (!ZERO_DECIMAL_CURRENCIES.has(link.currency)) {
      return { success: false, message: `Currency ${link.currency} is not configured for ${this.bankName}.` };
    }
    const { status, json } = await this.call('POST', '/session', {
      ...this.checkoutRequest(link, link.siteOrigin, 'PAYMENT_LINK'),
      paymentLink: {
        expiryDateTime: link.expiresAt.toISOString(),
        numberOfAllowedAttempts: 25,
        errorUrl: `${link.siteOrigin}/payment/cancel?booking=${encodeURIComponent(link.bookingId)}&reason=link_unavailable`,
      },
    });
    const url: string | undefined = json?.paymentLink?.url;
    if (status >= 300 || json?.result !== 'SUCCESS' || !url || !url.startsWith(`${this.origin}/`)) {
      const { message } = this.rejection(status, json, 'PAYMENT_LINK', link.paymentId);
      return { success: false, message: message ?? 'Payment link could not be created.' };
    }
    return { success: true, url, linkId: String(json.paymentLink.id ?? '') };
  }

  /** Asks the bank for the order's real state. Undefined order = the bank has no such order. */
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
   * - a bank notification (rawEvent = JSON body, headers carry X-Notification-Secret)
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
      // A guest who cancels before paying leaves no order at the bank.
      if (notFound && !isNotification && raw.outcome === 'cancel') {
        return { success: true, message: 'Guest cancelled before paying.', paymentId: orderId, gatewayReference: orderId, newPaymentStatus: PaymentStatus.Cancelled };
      }
      logger.warn('Retrieve Order gave no answer; payment left for reconciliation', { orderId, error });
      return { success: true, message: `Order not confirmed by the bank yet (${error}).`, paymentId: orderId, gatewayReference: orderId };
    }

    let newPaymentStatus = mapMpgsOrder(order);
    // A declined card can be retried on the hosted page while the guest is still there,
    // so a notification only ever confirms; failures are settled when the guest comes back.
    if (isNotification && newPaymentStatus !== PaymentStatus.Completed) {
      newPaymentStatus = undefined;
    }
    // The guest has left the bank's page: cancelled mid-way (e.g. during 3-D Secure),
    // or sent back after the last declined attempt.
    if (!isNotification && newPaymentStatus === undefined) {
      if (raw.outcome === 'cancel') newPaymentStatus = PaymentStatus.Cancelled;
      if (raw.outcome === 'failed') newPaymentStatus = PaymentStatus.Failed;
    }
    return this.toWebhookResponse(orderId, order, newPaymentStatus);
  }

  async queryPaymentStatus(request: PaymentStatusRequest): Promise<PaymentStatusResponse> {
    const { order, notFound, error } = await this.retrieveOrder(request.paymentId);
    if (!order) {
      // Unchanged: an unpaid payment link has no order yet. Reconciliation expires the
      // payment once its expiry passes.
      return {
        status: PaymentStatus.Processing,
        message: notFound ? `${this.bankName} has no order for this payment yet.` : `Status query failed: ${error}. Will retry later.`,
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
 * The page that hands the guest to the bank's hosted payment page. checkout.js needs a
 * page of ours to run on; it then navigates to the bank. Returns the HTML and the CSP
 * that lets only the bank's script (and our nonce'd snippet) run.
 */
export function renderMpgsLaunchPage(scriptUrl: string, sessionId: string, cancelUrl: string): { html: string; csp: string } {
  const nonce = randomBytes(16).toString('base64');
  const origin = new URL(scriptUrl).origin;
  const js = (v: string) => JSON.stringify(v).replace(/</g, '\\u003c');
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>Secure payment</title>
<style>body{font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;color:#1f2937;background:#fff}p{text-align:center;padding:0 16px}</style>
</head><body><p id="msg">Opening your bank&rsquo;s secure payment page&hellip;</p>
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
