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
      paymentId: event.rawEvent.ourPaymentId, // Assuming this was passed through metadata/ReturnURL
      bookingId: vpcResponseParams.vpc_OrderInfo, // Assuming we pass bookingId as vpc_OrderInfo
      newPaymentStatus: newStatus,
    };
  }

  /**
   * Queries the current status of a payment with the Mastercard Payment Gateway.
   */
  async queryPaymentStatus(request: PaymentStatusRequest): Promise<PaymentStatusResponse> {
    console.log(`Mastercard Gateway: Querying status for payment ${request.paymentId} / ${request.gatewayReference}`);

    // This would involve making a server-to-server query to the MCPGS
    // using the vpc_MerchTxnRef or other transaction identifiers.

    // Mock logic: assume completed if gatewayReference exists
    const mockStatus = request.gatewayReference ? PaymentStatus.Completed : PaymentStatus.Pending;

    return {
      status: mockStatus,
      gatewayReference: request.gatewayReference || `mock-vpc-ref-${Date.now()}`,
      amount: 10000, // Mock amount in cents
      currency: this.config.defaultDisplayCurrency || 'VUV', // Use configured currency
      message: 'Status retrieved (Mastercard Gateway mock).',
    };
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


