/**
 * Apple Pay Payment Gateway Adapter (Processor-Agnostic)
 *
 * Routes Apple Pay tokenized payments through the configured underlying
 * processor — either a local Vanuatu bank (ANZ/BSP/BRED via MCPGS) or Stripe.
 *
 * Flow:
 * 1. Client-side Apple Pay button (Safari / iOS) collects an encrypted payment token
 * 2. Client sends the token to our backend via the payment initiation endpoint
 * 3. This adapter delegates to the configured processor:
 *    - **Local bank (MCPGS)**: Builds a server-to-server VPC `pay` request
 *      with tokenized card data (DPAN + cryptogram from PKPaymentToken)
 *    - **Stripe**: Creates a Stripe PaymentIntent with the token, or falls
 *      back to a Checkout Session if no token is provided.
 * 4. Webhook/callback handling delegates to the processor's native flow
 *
 * Default: local bank (first available ANZ/BSP/BRED config).
 * Override via `config.processorSlug` in Admin → Payments.
 *
 * Requirements for local bank:
 * - Apple Pay merchant certificate registered with the domain
 * - Domain verification file at /.well-known/apple-developer-merchantid-domain-association
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
import { ApplePayCredentialsSchema, DigitalWalletConfigSchema, MastercardGatewayCredentialsSchema, LocalBankConfigSchema } from '../../../shared/schema.js';
import { z } from 'zod';
import crypto from 'crypto';

export type ApplePayCredentials = z.infer<typeof ApplePayCredentialsSchema>;
type DigitalWalletConfig = z.infer<typeof DigitalWalletConfigSchema>;
type McpgsCredentials = z.infer<typeof MastercardGatewayCredentialsSchema>;
type McpgsConfig = z.infer<typeof LocalBankConfigSchema>;

export class ApplePayAdapter implements PaymentGatewayService {
  private credentials: ApplePayCredentials;
  private walletConfig: DigitalWalletConfig;
  private gatewayConfig: PaymentGateway;

  constructor(gatewayConfig: PaymentGateway) {
    if (!gatewayConfig.credentials) {
      throw new Error('Apple Pay credentials are not provided.');
    }

    const parsed = ApplePayCredentialsSchema.safeParse(gatewayConfig.credentials);
    if (!parsed.success) {
      throw new Error(`Invalid Apple Pay credentials: ${parsed.error.errors.map((e: z.ZodIssue) => e.message).join(', ')}`);
    }
    this.credentials = parsed.data;

    const configParsed = DigitalWalletConfigSchema.safeParse(gatewayConfig.config || {});
    if (!configParsed.success) {
      throw new Error(`Invalid Apple Pay config: ${configParsed.error.errors.map((e: z.ZodIssue) => e.message).join(', ')}`);
    }
    this.walletConfig = configParsed.data;
    this.gatewayConfig = gatewayConfig;

    const processor = this.walletConfig.processorSlug || 'local-bank';
    console.log(`[APPLE_PAY] Adapter initialized (merchant: ${this.credentials.merchantId}, domain: ${this.credentials.domainName}, env: ${this.credentials.environment}, processor: ${processor})`);
  }

  // ── Processor detection ──────────────────────────────────────────────────

  private get isStripeProcessor(): boolean {
    return this.walletConfig.processorSlug === 'stripe';
  }

  // ── MCPGS helpers ────────────────────────────────────────────────────────

  private generateVpcHash(params: Record<string, string>, secret: string): string {
    const sortedKeys = Object.keys(params)
      .filter(k => k.startsWith('vpc_') && k !== 'vpc_SecureHash')
      .sort();
    let hashData = '';
    for (const key of sortedKeys) {
      if (params[key] !== null && params[key] !== undefined) {
        hashData += params[key];
      }
    }
    return crypto
      .createHmac('sha256', secret)
      .update(hashData)
      .digest('hex')
      .toUpperCase();
  }

  private verifyVpcHash(params: Record<string, string>, receivedHash: string, secret: string): boolean {
    const expected = this.generateVpcHash(params, secret);
    if (expected.length !== receivedHash.toUpperCase().length) return false;
    return crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(receivedHash.toUpperCase()),
    );
  }

  private getBankCredentials(): { credentials: McpgsCredentials; config: McpgsConfig } | null {
    const processorCreds = (this.gatewayConfig.config as any)?.processorCredentials;
    const processorConfig = (this.gatewayConfig.config as any)?.processorConfig;
    if (processorCreds && processorConfig) {
      const creds = MastercardGatewayCredentialsSchema.safeParse(processorCreds);
      const conf = LocalBankConfigSchema.safeParse(processorConfig);
      if (creds.success && conf.success) {
        return { credentials: creds.data, config: conf.data };
      }
    }
    return null;
  }

  // ── PaymentGatewayService ────────────────────────────────────────────────

  async initiatePayment(request: PaymentInitiationRequest): Promise<PaymentInitiationResponse> {
    console.log(`[APPLE_PAY] Initiating payment for booking ${request.bookingId}, amount ${request.amount}`);

    const applePayToken = request.metadata?.paymentToken;

    if (this.isStripeProcessor) {
      return this.initiateViaStripe(request, applePayToken);
    }

    return this.initiateViaMcpgs(request, applePayToken);
  }

  private async initiateViaMcpgs(request: PaymentInitiationRequest, token?: string): Promise<PaymentInitiationResponse> {
    const bank = this.getBankCredentials();
    if (!bank) {
      console.warn('[APPLE_PAY] No local bank credentials configured');
      return {
        success: false,
        message: 'Apple Pay processing unavailable: no local bank processor configured. Configure bank credentials in Admin → Payments.',
        failureReason: 'no_processor',
      };
    }

    const transactionId = `apay-${this.walletConfig.processorSlug || 'bank'}-${Date.now()}-${request.bookingId.substring(0, 8)}`;

    const vpcParams: Record<string, string> = {
      vpc_AccessCode: bank.credentials.accessCode,
      vpc_Merchant: bank.credentials.merchantId,
      vpc_Command: 'pay',
      vpc_Locale: 'en',
      vpc_Version: bank.credentials.version || '1',
      vpc_ReturnURL: bank.config.callbackWebhookUrl || request.successUrl,
      vpc_Amount: request.amount.toString(),
      vpc_Currency: request.currency || bank.config.supportedCurrencies[0] || 'VUV',
      vpc_MerchTxnRef: transactionId,
      vpc_OrderInfo: request.bookingId,
    };

    // Parse Apple Pay PKPaymentToken and add tokenized card parameters
    // Apple Pay token structure: { paymentData: { data, header, signature, version } }
    if (token) {
      try {
        const tokenData = typeof token === 'string' ? JSON.parse(token) : token;
        const paymentData = tokenData.paymentData || tokenData;

        // After decryption (which happens server-side with the merchant certificate),
        // you get the DPAN, expiry, and cryptogram
        if (paymentData.dpan || paymentData.applicationPrimaryAccountNumber) {
          vpcParams.vpc_CardNum = paymentData.dpan || paymentData.applicationPrimaryAccountNumber;
        }
        if (paymentData.applicationExpirationDate) {
          // Apple format: YYMMDD
          const exp = paymentData.applicationExpirationDate;
          vpcParams.vpc_CardExp = exp.substring(0, 4); // YYMM
        } else if (paymentData.expirationMonth && paymentData.expirationYear) {
          vpcParams.vpc_CardExp = `${String(paymentData.expirationYear).slice(-2)}${String(paymentData.expirationMonth).padStart(2, '0')}`;
        }
        if (paymentData.paymentDataType === '3DSecure' || paymentData.onlinePaymentCryptogram) {
          vpcParams.vpc_3DSECI = paymentData.eciIndicator || '05';
          vpcParams.vpc_3DSenrolled = 'Y';
          vpcParams.vpc_VerType = '3DS';
        }
        if (paymentData.onlinePaymentCryptogram || paymentData.cryptogram) {
          vpcParams.vpc_VerToken = paymentData.onlinePaymentCryptogram || paymentData.cryptogram;
        }
      } catch (e: any) {
        console.warn('[APPLE_PAY] Could not parse token data, proceeding with redirect flow:', e.message);
      }
    }

    if (bank.config.enforce3DSecure && request.amount > (bank.config.threeDSecureThreshold || 0)) {
      vpcParams.vpc_3DSecure = 'Y';
    }

    const secureHash = this.generateVpcHash(vpcParams, bank.credentials.secureHashSecret);
    vpcParams.vpc_SecureHash = secureHash;
    vpcParams.vpc_SecureHashType = 'SHA256';

    const endpoint = bank.credentials.apiEndpoint || bank.config.bankApiEndpointUrl;

    if (token && vpcParams.vpc_CardNum) {
      // Server-to-server POST with tokenized card data
      try {
        const body = Object.entries(vpcParams)
          .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
          .join('&');

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body,
          signal: AbortSignal.timeout(30_000),
        });

        const responseText = await response.text();
        const responseParams: Record<string, string> = {};
        for (const pair of responseText.split('&')) {
          const [key, ...rest] = pair.split('=');
          responseParams[decodeURIComponent(key)] = decodeURIComponent(rest.join('='));
        }

        if (responseParams.vpc_SecureHash) {
          const valid = this.verifyVpcHash(responseParams, responseParams.vpc_SecureHash, bank.credentials.secureHashSecret);
          if (!valid) {
            return { success: false, message: 'Bank response hash verification failed.', failureReason: 'hash_mismatch' };
          }
        }

        const responseCode = responseParams.vpc_TxnResponseCode;
        if (responseCode === '0') {
          return {
            success: true,
            message: 'Apple Pay payment processed via local bank.',
            transactionId: responseParams.vpc_TransactionNo || transactionId,
          };
        }

        return {
          success: false,
          message: `Bank declined: ${responseParams.vpc_Message || `Response code ${responseCode}`}`,
          failureReason: 'declined',
        };
      } catch (error: any) {
        console.error('[APPLE_PAY] MCPGS server-to-server error:', error.message);
        return { success: false, message: error.message, failureReason: 'system_error' };
      }
    }

    // No token — redirect to hosted checkout
    const queryString = Object.entries(vpcParams)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&');

    return {
      success: true,
      message: 'Redirecting to bank checkout for Apple Pay.',
      redirectUrl: `${endpoint}?${queryString}`,
      transactionId,
    };
  }

  private async initiateViaStripe(request: PaymentInitiationRequest, token?: string): Promise<PaymentInitiationResponse> {
    try {
      const { getUncachableStripeClient } = await import('../../stripeClient.js');
      const stripe = await getUncachableStripeClient();

      if (token) {
        // Create a PaymentMethod from the Apple Pay token, then confirm
        const paymentMethod = await stripe.paymentMethods.create({
          type: 'card',
          card: { token },
        });

        const paymentIntent = await stripe.paymentIntents.create({
          amount: request.amount,
          currency: (request.currency || 'vuv').toLowerCase(),
          payment_method: paymentMethod.id,
          confirm: true,
          return_url: request.successUrl,
          metadata: { bookingId: request.bookingId, gateway: 'apple-pay', ...request.metadata },
          description: `Booking ${request.bookingId}`,
          receipt_email: request.customerEmail,
        });

        return {
          success: paymentIntent.status === 'succeeded' || paymentIntent.status === 'requires_action',
          message: `Payment ${paymentIntent.status}.`,
          redirectUrl: paymentIntent.next_action?.redirect_to_url?.url ?? undefined,
          transactionId: paymentIntent.id,
        };
      }

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'payment',
        customer_email: request.customerEmail,
        line_items: [{
          price_data: {
            currency: (request.currency || 'vuv').toLowerCase(),
            product_data: {
              name: request.customerName ? `Booking for ${request.customerName}` : 'Tour Booking',
              description: `Booking ID: ${request.bookingId}`,
            },
            unit_amount: request.amount,
          },
          quantity: 1,
        }],
        metadata: { bookingId: request.bookingId, gateway: 'apple-pay', ...request.metadata },
        success_url: request.successUrl,
        cancel_url: request.cancelUrl,
      });

      return { success: true, redirectUrl: session.url ?? undefined, transactionId: session.id };
    } catch (error: any) {
      console.error('[APPLE_PAY] Stripe error:', error.message);
      return { success: false, message: error.message, failureReason: 'system_error' };
    }
  }

  // ── Webhook ──────────────────────────────────────────────────────────────

  async handleWebhook(event: WebhookEvent): Promise<WebhookResponse> {
    console.log(`[APPLE_PAY] Processing webhook`);

    if (this.isStripeProcessor) {
      return this.handleStripeWebhook(event);
    }

    return this.handleMcpgsWebhook(event);
  }

  private handleMcpgsWebhook(event: WebhookEvent): Promise<WebhookResponse> {
    const params = event.rawEvent;
    const bank = this.getBankCredentials();

    if (bank && params.vpc_SecureHash) {
      const valid = this.verifyVpcHash(params, params.vpc_SecureHash, bank.credentials.secureHashSecret);
      if (!valid) {
        return Promise.resolve({ success: false, message: 'VPC hash verification failed.' });
      }
    }

    const responseCode = params.vpc_TxnResponseCode;
    let newStatus: PaymentStatus;
    if (responseCode === '0') newStatus = PaymentStatus.Completed;
    else if (responseCode === '300' || responseCode === 'P') newStatus = PaymentStatus.Processing;
    else newStatus = PaymentStatus.Failed;

    return Promise.resolve({
      success: true,
      bookingId: params.vpc_OrderInfo,
      newPaymentStatus: newStatus,
      gatewayReference: params.vpc_TransactionNo || params.vpc_MerchTxnRef,
      message: `MCPGS response code: ${responseCode}`,
    });
  }

  private async handleStripeWebhook(event: WebhookEvent): Promise<WebhookResponse> {
    try {
      const { getStripeSync } = await import('../../stripeClient.js');
      const sync = await getStripeSync();
      if (!event.signature) throw new Error('Missing stripe-signature');

      const stripeEvent = await sync.processWebhook(event.rawEvent, event.signature);
      let newStatus: PaymentStatus | undefined;
      let bookingId: string | undefined;
      let gatewayReference: string | undefined;

      const obj = (stripeEvent.data.object as any);
      if (obj?.metadata?.gateway !== 'apple-pay') {
        return { success: true, message: 'Not an Apple Pay event.' };
      }

      if (stripeEvent.type === 'payment_intent.succeeded' || stripeEvent.type === 'checkout.session.completed') {
        newStatus = PaymentStatus.Completed;
        bookingId = obj.metadata?.bookingId;
        gatewayReference = obj.payment_intent || obj.id;
      } else if (stripeEvent.type === 'payment_intent.payment_failed') {
        newStatus = PaymentStatus.Failed;
        bookingId = obj.metadata?.bookingId;
      }

      return { success: true, bookingId, newPaymentStatus: newStatus, gatewayReference };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  // ── Status query ─────────────────────────────────────────────────────────

  async queryPaymentStatus(request: PaymentStatusRequest): Promise<PaymentStatusResponse> {
    const ref = request.gatewayReference;
    if (!ref) return { status: PaymentStatus.Pending, message: 'No reference available.' };

    console.log(`[APPLE_PAY] Querying status for ${ref}`);

    if (this.isStripeProcessor) {
      return this.queryStripeStatus(ref);
    }

    return this.queryMcpgsStatus(ref);
  }

  private async queryMcpgsStatus(txnRef: string): Promise<PaymentStatusResponse> {
    const bank = this.getBankCredentials();
    if (!bank) return { status: PaymentStatus.Pending, message: 'No bank processor configured.' };

    const endpoint = bank.credentials.apiEndpoint || bank.config.bankApiEndpointUrl;
    if (!endpoint) return { status: PaymentStatus.Pending, message: 'Bank API endpoint not configured.' };

    const vpcParams: Record<string, string> = {
      vpc_Command: 'queryDR',
      vpc_AccessCode: bank.credentials.accessCode,
      vpc_Merchant: bank.credentials.merchantId,
      vpc_MerchTxnRef: txnRef,
      vpc_Version: bank.credentials.version || '1',
    };

    const hash = this.generateVpcHash(vpcParams, bank.credentials.secureHashSecret);
    vpcParams.vpc_SecureHash = hash;
    vpcParams.vpc_SecureHashType = 'SHA256';

    try {
      const body = Object.entries(vpcParams).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        signal: AbortSignal.timeout(15_000),
      });

      const text = await response.text();
      const rp: Record<string, string> = {};
      for (const pair of text.split('&')) {
        const [k, ...rest] = pair.split('=');
        rp[decodeURIComponent(k)] = decodeURIComponent(rest.join('='));
      }

      const code = rp.vpc_TxnResponseCode;
      let status: PaymentStatus;
      if (rp.vpc_DRExists === 'N') status = PaymentStatus.Pending;
      else if (code === '0') status = PaymentStatus.Completed;
      else if (code === '300' || code === 'P') status = PaymentStatus.Processing;
      else status = PaymentStatus.Failed;

      return { status, gatewayReference: rp.vpc_TransactionNo || txnRef, message: `queryDR code: ${code}` };
    } catch (error: any) {
      return { status: PaymentStatus.Pending, message: `Query failed: ${error.message}` };
    }
  }

  private async queryStripeStatus(ref: string): Promise<PaymentStatusResponse> {
    try {
      const { getUncachableStripeClient } = await import('../../stripeClient.js');
      const stripe = await getUncachableStripeClient();

      if (ref.startsWith('cs_')) {
        const session = await stripe.checkout.sessions.retrieve(ref);
        let status = PaymentStatus.Processing;
        if (session.payment_status === 'paid') status = PaymentStatus.Completed;
        else if (session.status === 'expired') status = PaymentStatus.Expired;
        return { status, gatewayReference: session.id, amount: session.amount_total || 0, currency: session.currency?.toUpperCase() || 'VUV' };
      }

      const intent = await stripe.paymentIntents.retrieve(ref);
      let status = PaymentStatus.Processing;
      if (intent.status === 'succeeded') status = PaymentStatus.Completed;
      else if (intent.status === 'canceled') status = PaymentStatus.Cancelled;
      return { status, gatewayReference: intent.id, amount: intent.amount, currency: intent.currency?.toUpperCase() || 'VUV' };
    } catch (error: any) {
      return { status: PaymentStatus.Pending, message: error.message };
    }
  }

  // ── Refund ───────────────────────────────────────────────────────────────

  async refundPayment(payment: Payment, amount?: number, reason?: string): Promise<PaymentStatusResponse> {
    console.log(`[APPLE_PAY] Refunding payment ${payment.id}`);

    if (this.isStripeProcessor) {
      try {
        const { getUncachableStripeClient } = await import('../../stripeClient.js');
        const stripe = await getUncachableStripeClient();
        const refund = await stripe.refunds.create({
          payment_intent: payment.gatewayReference || undefined,
          amount: amount || undefined,
          reason: reason === 'duplicate' ? 'duplicate' : reason === 'fraudulent' ? 'fraudulent' : 'requested_by_customer',
        });
        return {
          status: refund.status === 'succeeded' ? PaymentStatus.Refunded : PaymentStatus.Processing,
          gatewayReference: refund.id,
          amount: refund.amount,
          currency: refund.currency?.toUpperCase() || payment.currency,
        };
      } catch (error: any) {
        return { status: PaymentStatus.Failed, message: error.message };
      }
    }

    // MCPGS refund
    const bank = this.getBankCredentials();
    if (!bank) return { status: PaymentStatus.Failed, message: 'No bank processor for refund.' };

    const endpoint = bank.credentials.apiEndpoint || bank.config.bankApiEndpointUrl;
    const txnRef = payment.gatewayReference;
    if (!endpoint || !txnRef) return { status: PaymentStatus.Failed, message: 'Missing endpoint or reference for refund.' };

    const vpcParams: Record<string, string> = {
      vpc_Command: 'refund',
      vpc_AccessCode: bank.credentials.accessCode,
      vpc_Merchant: bank.credentials.merchantId,
      vpc_MerchTxnRef: `refund-${txnRef}-${Date.now()}`,
      vpc_TransNo: txnRef,
      vpc_Amount: (amount || payment.amount).toString(),
      vpc_Version: bank.credentials.version || '1',
    };

    const hash = this.generateVpcHash(vpcParams, bank.credentials.secureHashSecret);
    vpcParams.vpc_SecureHash = hash;
    vpcParams.vpc_SecureHashType = 'SHA256';

    try {
      const body = Object.entries(vpcParams).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        signal: AbortSignal.timeout(15_000),
      });

      const text = await response.text();
      const rp: Record<string, string> = {};
      for (const pair of text.split('&')) {
        const [k, ...rest] = pair.split('=');
        rp[decodeURIComponent(k)] = decodeURIComponent(rest.join('='));
      }

      const code = rp.vpc_TxnResponseCode;
      return {
        status: code === '0' ? PaymentStatus.Refunded : PaymentStatus.Failed,
        gatewayReference: rp.vpc_TransactionNo || txnRef,
        amount: amount || payment.amount,
        currency: payment.currency,
        message: `Refund response code: ${code}`,
      };
    } catch (error: any) {
      return { status: PaymentStatus.Failed, message: error.message };
    }
  }
}
