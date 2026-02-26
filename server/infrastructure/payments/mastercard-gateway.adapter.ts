import { PaymentGateway, MastercardGatewayCredentialsSchema, LocalBankConfigSchema } from '../../../shared/schema.js';
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
import { z } from 'zod'; // Import z for Zod validation

// This would typically be a library like 'crypto' or a specific SDK for secure hash generation
// For mock, we'll simulate.
import crypto from 'crypto';

export type MastercardGatewayCredentials = z.infer<typeof MastercardGatewayCredentialsSchema>;
export type LocalBankConfig = z.infer<typeof LocalBankConfigSchema>;

/**
 * Mastercard Gateway Adapter.
 * This class implements the PaymentGatewayService interface for payment gateways
 * that utilize the Mastercard Payment Gateway System (MCPGS) network (e.g., ANZ eGate, Bred, BSP).
 * It simulates interactions with a generic MIGS-style API.
 */
export class MastercardGatewayAdapter implements PaymentGatewayService {
  private credentials: MastercardGatewayCredentials;
  private config: LocalBankConfig;
  private gatewayConfig: PaymentGateway; // The specific bank's gateway config

  constructor(gatewayConfig: PaymentGateway) {
    if (!gatewayConfig.credentials) {
      throw new Error(`Mastercard Gateway credentials are not provided for ${gatewayConfig.slug}.`);
    }
    if (!gatewayConfig.config) {
      throw new Error(`Mastercard Gateway configuration is not provided for ${gatewayConfig.slug}.`);
    }

    // Validate credentials and config using Zod schemas
    const parsedCredentials = MastercardGatewayCredentialsSchema.safeParse(gatewayConfig.credentials);
    if (!parsedCredentials.success) {
      throw new Error(`Invalid Mastercard Gateway credentials: ${parsedCredentials.error.errors.map((e: z.ZodIssue) => e.message).join(', ')}`);
    }
    this.credentials = parsedCredentials.data;

    const parsedConfig = LocalBankConfigSchema.safeParse(gatewayConfig.config);
    if (!parsedConfig.success) {
      throw new Error(`Invalid Mastercard Gateway configuration: ${parsedConfig.error.errors.map((e: z.ZodIssue) => e.message).join(', ')}`);
    }
    this.config = parsedConfig.data;
    this.gatewayConfig = gatewayConfig;

    // Additional validation/setup based on config
    if (!this.config.supportedCurrencies.includes(this.config.defaultDisplayCurrency)) {
      console.warn(`Default display currency ${this.config.defaultDisplayCurrency} is not in supported currencies for ${this.gatewayConfig.displayName}.`);
    }

    console.log(`Mastercard Gateway Adapter initialized for ${this.gatewayConfig.displayName} (${this.credentials.merchantId})`);
  }

  /**
   * Generates a secure hash for outgoing requests to MCPGS using HMAC-SHA256.
   * The vpc_SecureHashType parameter tells the gateway which algorithm was used;
   * both must agree or the gateway will reject the request.
   *
   * VPC hash algorithm: concatenate the values of all vpc_* params (sorted by key,
   * excluding vpc_SecureHash itself) then HMAC-SHA256 with the secureHashSecret.
   */
  private generateSecureHash(params: Record<string, string>): string {
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
      .createHmac('sha256', this.credentials.secureHashSecret)
      .update(hashData)
      .digest('hex')
      .toUpperCase(); // MCPGS typically expects upper-case hex
  }

  /**
   * Verifies an incoming secure hash from MCPGS callback/webhook using HMAC-SHA256.
   * Uses a timing-safe comparison to prevent timing attacks.
   */
  private verifySecureHash(params: Record<string, string>, receivedHash: string): boolean {
    const sortedKeys = Object.keys(params)
      .filter(k => k.startsWith('vpc_') && k !== 'vpc_SecureHash')
      .sort();
    let hashData = '';
    for (const key of sortedKeys) {
      if (params[key] !== null && params[key] !== undefined) {
        hashData += params[key];
      }
    }
    const expected = crypto
      .createHmac('sha256', this.credentials.secureHashSecret)
      .update(hashData)
      .digest('hex')
      .toUpperCase();

    // Timing-safe comparison to prevent timing attacks
    if (expected.length !== receivedHash.toUpperCase().length) return false;
    return crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(receivedHash.toUpperCase())
    );
  }

  /**
   * Initiates a payment process with the Mastercard Payment Gateway.
   * This typically involves constructing a URL and redirecting the user to the gateway.
   */
  async initiatePayment(request: PaymentInitiationRequest): Promise<PaymentInitiationResponse> {
    console.log(`Mastercard Gateway: Initiating payment for booking ${request.bookingId} via ${this.gatewayConfig.displayName}`);

    const transactionId = `${this.gatewayConfig.slug}-${Date.now()}-${request.bookingId.substring(0, 8)}`;

    // Ensure currency is supported by this gateway
    if (!this.config.supportedCurrencies.includes(request.currency)) {
      return { success: false, message: `Currency ${request.currency} not supported by ${this.gatewayConfig.displayName}.` };
    }

    // Construct common VPC payment parameters
    const vpcParams: Record<string, string> = {
      vpc_AccessCode: this.credentials.accessCode,
      vpc_Merchant: this.credentials.merchantId,
      vpc_Command: 'pay', // or 'purchase'
      vpc_Locale: 'en',
      vpc_Version: this.credentials.version || '1',
      vpc_ReturnURL: this.config.callbackWebhookUrl || request.successUrl, // Use configured callback URL if available
      vpc_Amount: request.amount.toString(), // Amount in smallest unit (e.g., cents)
      vpc_Currency: request.currency,
      vpc_MerchTxnRef: transactionId, // Our unique transaction reference
      vpc_OrderInfo: request.bookingId, // Additional order info
    };

    // Add 3D Secure parameters if enforced and conditions met (mock logic)
    if (this.config.enforce3DSecure && request.amount > (this.config.threeDSecureThreshold || 0)) {
      vpcParams.vpc_3DSecure = 'Y'; // Example parameter
    }


    // Generate Secure Hash
    const secureHash = this.generateSecureHash(vpcParams);
    vpcParams.vpc_SecureHash = secureHash;
    vpcParams.vpc_SecureHashType = 'SHA256'; // matches HMAC-SHA256 used in generateSecureHash

    // Construct redirect URL
    const queryString = Object.keys(vpcParams)
      .map(key => `${key}=${encodeURIComponent(vpcParams[key])}`)
      .join('&');

    const redirectUrl = `${this.credentials.apiEndpoint || this.config.bankApiEndpointUrl}?${queryString}`;

    return {
      success: true,
      message: 'Payment initiation successful (Mastercard Gateway).',
      redirectUrl: redirectUrl,
      transactionId: transactionId, // MCPGS uses MerchTxnRef as a primary reference
    };
  }

  /**
   * Handles webhook/callback events from the Mastercard Payment Gateway.
   * These usually come as URL parameters in a GET or POST request to the ReturnURL.
   */
  async handleWebhook(event: WebhookEvent): Promise<WebhookResponse> {
    console.log(`Mastercard Gateway: Handling webhook/callback event for ${event.gatewaySlug}.`);

    // In a real scenario, the rawEvent would be the query parameters (or body)
    // of the incoming request from the MCPGS ReturnURL.
    // For this mock, we'll assume event.rawEvent contains the VPC parameters.
    const vpcResponseParams = event.rawEvent; // e.g., { vpc_TxnResponseCode: '0', vpc_MerchTxnRef: '...', vpc_SecureHash: '...' }

    // Verify Secure Hash (Crucial for security!)
    const receivedSecureHash = vpcResponseParams.vpc_SecureHash;
    const isValidHash = this.verifySecureHash(vpcResponseParams, receivedSecureHash); // Simplified mock verification
    if (!isValidHash) {
      console.error(`Mastercard Gateway: Secure Hash verification failed for ${event.gatewaySlug}.`);
      return { success: false, message: 'Secure Hash verification failed.' };
    }

    const transactionReference = vpcResponseParams.vpc_MerchTxnRef;
    const responseCode = vpcResponseParams.vpc_TxnResponseCode; // '0' typically indicates success

    let newStatus: PaymentStatus = PaymentStatus.Failed;
    if (responseCode === '0') {
      newStatus = PaymentStatus.Completed;
    } else if (responseCode === 'D') { // Example: 'Declined' or similar for specific status
      newStatus = PaymentStatus.Failed;
    } else {
      // Handle other codes as per MCPGS documentation (e.g., pending, error)
      newStatus = PaymentStatus.Failed;
    }

    // This part requires mapping MCPGS transactionReference back to our internal payment ID.
    // Assuming our `transactionId` sent in initiatePayment is MCPGS `vpc_MerchTxnRef`.
    // The application service will handle fetching our payment based on this.

    return {
      success: true,
      message: `Callback processed. MCPGS Response Code: ${responseCode}`,
      // paymentId is resolved by the application service via bookingId lookup.
      // VPC params from the bank do not include our internal payment ID.
      bookingId: vpcResponseParams.vpc_OrderInfo, // We set vpc_OrderInfo = bookingId in initiatePayment
      newPaymentStatus: newStatus,
    };
  }

  /**
   * Queries the current status of a payment with the Mastercard Payment Gateway
   * using the standard MIGS vpc_Command=queryDR (Query Direct Response).
   *
   * If the API endpoint is not yet configured (no ANZ merchant agreement),
   * returns a clear "not configured" status instead of fake mock data.
   */
  async queryPaymentStatus(request: PaymentStatusRequest): Promise<PaymentStatusResponse> {
    const endpoint = this.credentials.apiEndpoint || this.config.bankApiEndpointUrl;

    // Guard: if no endpoint is configured, return honestly instead of faking it
    if (!endpoint) {
      console.warn(`Mastercard Gateway: queryPaymentStatus called but no API endpoint configured for ${this.gatewayConfig.displayName}. Configure the endpoint URL in Admin → Payments.`);
      return {
        status: PaymentStatus.Pending,
        message: `Payment status query unavailable: API endpoint not configured for ${this.gatewayConfig.displayName}. Configure in Admin → Payments.`,
      };
    }

    const txnRef = request.gatewayReference;
    if (!txnRef) {
      return {
        status: PaymentStatus.Pending,
        message: 'Cannot query status: no gateway transaction reference available.',
      };
    }

    console.log(`Mastercard Gateway: Querying status for payment ${request.paymentId} (ref: ${txnRef}) via ${this.gatewayConfig.displayName}`);

    // Build VPC queryDR parameters
    const vpcParams: Record<string, string> = {
      vpc_Command: 'queryDR',
      vpc_AccessCode: this.credentials.accessCode,
      vpc_Merchant: this.credentials.merchantId,
      vpc_MerchTxnRef: txnRef,
      vpc_Version: this.credentials.version || '1',
    };

    // Sign the request
    const secureHash = this.generateSecureHash(vpcParams);
    vpcParams.vpc_SecureHash = secureHash;
    vpcParams.vpc_SecureHashType = 'SHA256';

    try {
      // Server-to-server HTTPS POST to the MIGS gateway
      const body = Object.keys(vpcParams)
        .map(key => `${key}=${encodeURIComponent(vpcParams[key])}`)
        .join('&');

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        signal: AbortSignal.timeout(15_000), // 15s timeout
      });

      if (!response.ok) {
        console.error(`Mastercard Gateway: queryDR HTTP error ${response.status} from ${this.gatewayConfig.displayName}`);
        return {
          status: PaymentStatus.Pending,
          message: `Gateway returned HTTP ${response.status} during status query.`,
        };
      }

      // Parse url-encoded response from the gateway
      const responseText = await response.text();
      const responseParams: Record<string, string> = {};
      for (const pair of responseText.split('&')) {
        const [key, ...rest] = pair.split('=');
        responseParams[decodeURIComponent(key)] = decodeURIComponent(rest.join('='));
      }

      // Verify response hash if present
      if (responseParams.vpc_SecureHash) {
        const hashValid = this.verifySecureHash(responseParams, responseParams.vpc_SecureHash);
        if (!hashValid) {
          console.error(`Mastercard Gateway: queryDR response hash verification FAILED for ${this.gatewayConfig.displayName}`);
          return {
            status: PaymentStatus.Pending,
            message: 'Status query response failed hash verification — possible tampering.',
          };
        }
      }

      // Map VPC response code to internal PaymentStatus
      // vpc_TxnResponseCode: '0' = approved, '300' = pending/unknown,
      // anything else = declined/failed (codes vary by bank)
      const responseCode = responseParams.vpc_TxnResponseCode;
      const drExists = responseParams.vpc_DRExists; // 'Y' if original txn found

      let status: PaymentStatus;
      if (drExists === 'N') {
        // Transaction not found at the gateway
        status = PaymentStatus.Pending;
      } else if (responseCode === '0') {
        status = PaymentStatus.Completed;
      } else if (responseCode === '300' || responseCode === 'P') {
        status = PaymentStatus.Processing; // Still pending at gateway
      } else {
        status = PaymentStatus.Failed;
      }

      const amount = responseParams.vpc_Amount ? parseInt(responseParams.vpc_Amount, 10) : undefined;

      return {
        status,
        gatewayReference: responseParams.vpc_TransactionNo || txnRef,
        amount,
        currency: this.config.defaultDisplayCurrency || 'VUV',
        message: `queryDR response code: ${responseCode || 'N/A'} (${this.gatewayConfig.displayName})`,
        failureReason: status === PaymentStatus.Failed
          ? `VPC response code: ${responseCode} — ${responseParams.vpc_Message || 'Declined'}`
          : undefined,
      };
    } catch (error: any) {
      // Network error, timeout, DNS failure, etc.
      console.error(`Mastercard Gateway: queryDR network error for ${this.gatewayConfig.displayName}:`, error.message);
      return {
        status: PaymentStatus.Pending,
        message: `Status query failed: ${error.message}. Will retry later.`,
      };
    }
  }

  /**
   * Initiates a refund for a completed payment via Mastercard Payment Gateway.
   * This would typically be a server-to-server API call.
   */
  async refundPayment(payment: Payment, amount?: number, reason?: string): Promise<PaymentStatusResponse> {
    console.log(`Mastercard Gateway: Refunding payment ${payment.id} for amount ${amount || 'full'} with reason: ${reason}`);

    // This would involve another server-to-server API call to MCPGS for a refund.

    return {
      status: PaymentStatus.Refunded,
      gatewayReference: payment.gatewayReference || `mock-vpc-refund-ref-${Date.now()}`,
      amount: amount || payment.amount,
      currency: payment.currency,
      message: 'Payment refunded (mock).',
    };
  }
}


