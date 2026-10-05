// server/infrastructure/payments/payzen.adapter.ts

import { randomInt } from 'crypto';
import { z } from 'zod';
import { PaymentGateway, BredBankCredentialsSchema } from '../../../shared/schema.js';
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
import { computePayzenSignature, verifyPayzenSignature } from './payzen-signature.js';

const DEFAULT_PAYMENT_URL = 'https://secure.payzen.eu/vads-payment/';

// ISO 4217 numeric codes. Amounts in this app are whole units of a
// zero-decimal currency (see PaymentInitiationRequest.amount for VUV).
// VUV is not in PayZen's published currency table: BRED must enable it on the shop.
const CURRENCY_CODES: Record<string, string> = { VUV: '548' };

// vads_trans_id is case-insensitive, so draw from one case only.
const TRANS_ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

type PayzenCredentials = z.infer<typeof BredBankCredentialsSchema>;

/**
 * Maps a PayZen vads_trans_status to our payment status.
 * Returns undefined when the payment should stay as it is (a later IPN will follow).
 */
export function mapPayzenTransStatus(transStatus: string): PaymentStatus | undefined {
  switch (transStatus) {
    // Paid: with vads_capture_delay=0 and automatic validation, AUTHORISED is captured the same day.
    case 'AUTHORISED':
    case 'CAPTURED':
      return PaymentStatus.Completed;
    case 'REFUSED':
    case 'CAPTURE_FAILED':
      return PaymentStatus.Failed;
    case 'ABANDONED':
    case 'CANCELLED':
      return PaymentStatus.Cancelled;
    case 'EXPIRED':
      return PaymentStatus.Expired;
    // Needs a person: manual validation in the PayZen Back Office.
    case 'AUTHORISED_TO_VALIDATE':
      return PaymentStatus.ManualReviewRequired;
    // Still in progress: PayZen sends another IPN when this settles.
    case 'INITIAL':
    case 'UNDER_VERIFICATION':
    case 'WAITING_AUTHORISATION':
    case 'WAITING_AUTHORISATION_TO_VALIDATE':
    case 'WAITING_FOR_PAYMENT':
    case 'SUSPENDED':
      return undefined;
    // Never guess "paid" from a status we don't know.
    default:
      return PaymentStatus.ManualReviewRequired;
  }
}

/**
 * BRED Bank hosted card payments on Lyra PayZen (Hosted Payment Page, V2 form API).
 * The browser POSTs a signed form to PayZen; the result arrives server-to-server
 * as an Instant Payment Notification (IPN) at /api/payments/webhook/bred-bank.
 */
export class PayzenAdapter implements PaymentGatewayService {
  private credentials: PayzenCredentials;
  private now: () => Date;

  constructor(gatewayConfig: PaymentGateway, deps: { now?: () => Date } = {}) {
    if (!gatewayConfig.credentials) {
      throw new Error('BRED Bank (PayZen) credentials are not provided.');
    }
    const parsed = BredBankCredentialsSchema.safeParse(gatewayConfig.credentials);
    if (!parsed.success) {
      throw new Error(`Invalid BRED Bank (PayZen) credentials: ${parsed.error.errors.map((e: z.ZodIssue) => e.message).join(', ')}`);
    }
    if (parsed.data.mode === 'PRODUCTION' && !parsed.data.productionKey) {
      throw new Error('BRED Bank (PayZen) is set to PRODUCTION but no production key is entered.');
    }
    this.credentials = parsed.data;
    this.now = deps.now ?? (() => new Date());
  }

  private keyFor(mode: string): string {
    return mode === 'PRODUCTION' ? this.credentials.productionKey! : this.credentials.testKey;
  }

  async initiatePayment(request: PaymentInitiationRequest): Promise<PaymentInitiationResponse> {
    const currencyCode = CURRENCY_CODES[request.currency];
    if (!currencyCode) {
      return { success: false, message: `Currency ${request.currency} is not configured for BRED Bank (PayZen).` };
    }
    const paymentId: string | undefined = request.metadata?.paymentId;
    if (!paymentId) {
      return { success: false, message: 'Missing payment ID for the PayZen order reference.' };
    }

    const transId = Array.from({ length: 6 }, () => TRANS_ID_ALPHABET[randomInt(TRANS_ID_ALPHABET.length)]).join('');
    const transDate = this.now().toISOString().replace(/\D/g, '').slice(0, 14); // UTC YYYYMMDDHHMMSS

    const fields: Record<string, string> = {
      vads_action_mode: 'INTERACTIVE',
      vads_amount: String(request.amount),
      vads_capture_delay: '0',
      vads_ctx_mode: this.credentials.mode,
      vads_currency: currencyCode,
      vads_order_id: paymentId,
      vads_page_action: 'PAYMENT',
      vads_payment_config: 'SINGLE',
      vads_site_id: this.credentials.shopId,
      vads_trans_date: transDate,
      vads_trans_id: transId,
      vads_url_cancel: request.cancelUrl,
      vads_url_refused: request.cancelUrl,
      vads_url_return: request.cancelUrl,
      vads_url_success: request.successUrl,
      vads_validation_mode: '0',
      vads_version: 'V2',
    };
    // PayZen signs field VALUES joined with "+", not field names. A "+" inside a value
    // lets those values be re-split under other names into a validly signed "paid"
    // IPN, so nothing a guest types (e.g. their email) goes in, and no value may hold "+".
    if (Object.values(fields).some((v) => v.includes('+'))) {
      return { success: false, message: 'Refusing to sign a PayZen form value containing "+".' };
    }
    fields.signature = computePayzenSignature(fields, this.keyFor(this.credentials.mode));

    return {
      success: true,
      message: 'PayZen payment form created.',
      formPost: { action: this.credentials.paymentUrl || DEFAULT_PAYMENT_URL, fields },
      transactionId: transId,
      paymentId,
    };
  }

  async handleWebhook(event: WebhookEvent): Promise<WebhookResponse> {
    const ipn: Record<string, string> = event.rawEvent ?? {};

    if (ipn.vads_site_id !== this.credentials.shopId) {
      return { success: false, message: 'IPN is for a different PayZen shop.' };
    }
    if (ipn.vads_ctx_mode !== this.credentials.mode) {
      return { success: false, message: `IPN mode ${ipn.vads_ctx_mode} does not match shop mode ${this.credentials.mode}.` };
    }
    if (!verifyPayzenSignature(ipn, this.keyFor(ipn.vads_ctx_mode))) {
      return { success: false, message: 'Invalid PayZen IPN signature.' };
    }
    // Only a real notification carries these (vads_hash is sent in notifications only);
    // without them a signed checkout form could be replayed here as an "IPN".
    if (!ipn.vads_hash || !ipn.vads_trans_status || !ipn.vads_trans_uuid) {
      return { success: false, message: 'Not a PayZen payment notification.' };
    }

    const base: WebhookResponse = {
      success: true,
      paymentId: ipn.vads_order_id,
      gatewayReference: ipn.vads_trans_uuid,
      amount: Number(ipn.vads_amount),
      currency: Object.keys(CURRENCY_CODES).find((c) => CURRENCY_CODES[c] === ipn.vads_currency) ?? ipn.vads_currency,
    };

    // Refunds made in the Back Office notify too; they must never complete a payment.
    if (ipn.vads_operation_type === 'CREDIT') {
      return { ...base, message: 'Refund notification recorded; payment status unchanged.' };
    }

    const newPaymentStatus = mapPayzenTransStatus(ipn.vads_trans_status);
    return {
      ...base,
      message: `PayZen status ${ipn.vads_trans_status}`,
      newPaymentStatus,
      failureReason: newPaymentStatus === PaymentStatus.Failed ? `payzen_${ipn.vads_trans_status.toLowerCase()}` : undefined,
    };
  }

  async queryPaymentStatus(_request: PaymentStatusRequest): Promise<PaymentStatusResponse> {
    throw new Error('PayZen results arrive by IPN; check the PayZen Back Office or reconcile manually.');
  }
}
