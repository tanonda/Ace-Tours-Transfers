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
import { z } from 'zod';
import { generate as vpcGenerate, verify as vpcVerify, HashFormat } from './vpc-secure-hash.js';
import { createLogger } from '../../lib/logger.js';

export type MastercardGatewayCredentials = z.infer<typeof MastercardGatewayCredentialsSchema>;
export type LocalBankConfig = z.infer<typeof LocalBankConfigSchema>;

const logger = createLogger('mastercard-gateway-adapter');

/**
 * Mastercard Gateway Adapter.
 * This class implements the PaymentGatewayService interface for payment gateways
 * that utilize the Mastercard Payment Gateway System (MCPGS) network (e.g., ANZ eGate, Bred, BSP).
 */
export class MastercardGatewayAdapter implements PaymentGatewayService {
  private credentials: MastercardGatewayCredentials;
  private config: LocalBankConfig;
  private gatewayConfig: PaymentGateway; // The specific bank's gateway config
  /**
   * Hash format used for all VPC requests and response verification.
   *
   * // CONFIRM-WITH-BRED: set to 'VALUE_CONCAT' if their gateway uses the
   * legacy values-only format. Resolved from gateway config, defaults to
   * 'KEY_VALUE' (standard HMAC-SHA256 over sorted key=value pairs).
   */
  private hashFormat: HashFormat;

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

    // Resolve hash format from config (default: KEY_VALUE).
    // // CONFIRM-WITH-BRED: flip to 'VALUE_CONCAT' if their docs specify legacy format.
    this.hashFormat = ((this.config as any).hashFormat as HashFormat | undefined) ?? 'KEY_VALUE';

    // Additional validation/setup based on config
    if (!this.config.supportedCurrencies.includes(this.config.defaultDisplayCurrency)) {
      logger.warn(`Default display currency ${this.config.defaultDisplayCurrency} is not in supported currencies for ${this.gatewayConfig.displayName}.`);
    }

    logger.info(`Mastercard Gateway Adapter initialized`, {
      displayName: this.gatewayConfig.displayName,
      merchantId: this.credentials.merchantId,
      hashFormat: this.hashFormat,
    });
  }

  /**
   * Generates a VPC/MIGS secure hash for outgoing requests.
   * Delegates to the isolated vpc-secure-hash module (see vpc-secure-hash.ts).
   */
  private generateSecureHash(params: Record<string, string>): string {
    return vpcGenerate(params, this.credentials.secureHashSecret, this.hashFormat);
  }

  /**
   * Verifies an incoming VPC/MIGS secure hash in a timing-safe manner.
   * Delegates to the isolated vpc-secure-hash module (see vpc-secure-hash.ts).
   */
  private verifySecureHash(params: Record<string, string>, receivedHash: string): boolean {
    return vpcVerify(params, receivedHash, this.credentials.secureHashSecret, this.hashFormat);
  }

  /**
   * Initiates a payment process with the Mastercard Payment Gateway.
   * This typically involves constructing a URL and redirecting the user to the gateway.
   */
  async initiatePayment(request: PaymentInitiationRequest): Promise<PaymentInitiationResponse> {
    logger.info(`Initiating payment via ${this.gatewayConfig.displayName}`, {
      bookingId: request.bookingId,
      amount: request.amount,
      currency: request.currency,
    });

    const transactionId = `${this.gatewayConfig.slug}-${Date.now()}-${request.bookingId.substring(0, 8)}`;

    // Ensure currency is supported by this gateway
    if (!this.config.supportedCurrencies.includes(request.currency)) {
      return { success: false, message: `Currency ${request.currency} not supported by ${this.gatewayConfig.displayName}.` };
    }

    // Currency Exponent Guard (Item 7):
    // MIGS/VPC expects amount in the currency's smallest unit (integer).
    // For VUV (zero-decimal currency), 1 VUV is passed directly as 1.
    // For USD/AUD (two-decimal currencies), $1.00 is passed as 100.
    // Since our application service currently only supports 'VUV' (zero decimals),
    // booking.totalAmountCents stores whole vatu, and passing request.amount directly
    // is correct. If we support two-decimal currencies in the future, we must scale
    // the amount accordingly (e.g., multiplying by 10^exponent).
    const amountStr = request.amount.toString();

    // Construct common VPC payment parameters
    const vpcParams: Record<string, string> = {
      vpc_AccessCode: this.credentials.accessCode,
      vpc_Merchant: this.credentials.merchantId,
      vpc_Command: 'pay', // or 'purchase'
      vpc_Locale: 'en',
      vpc_Version: this.credentials.version || '1',
      vpc_ReturnURL: this.config.callbackWebhookUrl || request.successUrl, // Use configured callback URL if available
      vpc_Amount: amountStr,
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
    logger.info(`Handling webhook/callback event`, { gatewaySlug: event.gatewaySlug });

    // In a real scenario, the rawEvent would be the query parameters (or body)
    // of the incoming request from the MCPGS ReturnURL.
    // For this mock, we'll assume event.rawEvent contains the VPC parameters.
    const vpcResponseParams = event.rawEvent; // e.g., { vpc_TxnResponseCode: '0', vpc_MerchTxnRef: '...', vpc_SecureHash: '...' }

    // Verify Secure Hash (Crucial for security!)
    const receivedSecureHash = vpcResponseParams.vpc_SecureHash;
    const isValidHash = this.verifySecureHash(vpcResponseParams, receivedSecureHash);
    if (!isValidHash) {
      logger.error(`Secure Hash verification failed`, { gatewaySlug: event.gatewaySlug });
      return { success: false, message: 'Secure Hash verification failed.' };
    }

    const transactionReference = vpcResponseParams.vpc_MerchTxnRef;
    const responseCode = vpcResponseParams.vpc_TxnResponseCode; // '0' typically indicates success

    let newStatus: PaymentStatus = PaymentStatus.Failed;
    if (responseCode === '0') {
      newStatus = PaymentStatus.Completed;
    } else {
      // Handle other codes (including 'D' for Declined, or other errors) as Failed
      newStatus = PaymentStatus.Failed;
    }

    // Parse bank reported amount & currency (Item 2)
    const amount = vpcResponseParams.vpc_Amount ? parseInt(vpcResponseParams.vpc_Amount, 10) : undefined;
    const currency = vpcResponseParams.vpc_Currency || undefined;

    return {
      success: true,
      message: `Callback processed. MCPGS Response Code: ${responseCode}`,
      bookingId: vpcResponseParams.vpc_OrderInfo, // We set vpc_OrderInfo = bookingId in initiatePayment
      newPaymentStatus: newStatus,
      gatewayReference: transactionReference, // Map MerchTxnRef (Item 3)
      amount,
      currency,
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
    // Separate pay vs. data-port endpoint (Item 6)
    // // CONFIRM-WITH-BRED: verify if queryDR uses dataPortEndpoint or apiEndpoint.
    const endpoint = (this.config as any).dataPortEndpoint || this.credentials.apiEndpoint || this.config.bankApiEndpointUrl;

    // Guard: if no endpoint is configured, return honestly instead of faking it
    if (!endpoint) {
      logger.warn(`queryPaymentStatus called but no API endpoint configured. Configure in Admin → Payments.`, {
        displayName: this.gatewayConfig.displayName
      });
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

    logger.info(`Querying status for payment`, {
      paymentId: request.paymentId,
      gateway: this.gatewayConfig.displayName,
      txnRef,
    });

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
        logger.error(`queryDR HTTP error from gateway`, {
          status: response.status,
          displayName: this.gatewayConfig.displayName
        });
        return {
          status: PaymentStatus.Pending,
          message: `Gateway returned HTTP ${response.status} during status query.`,
        };
      }

      // Parse url-encoded response from the gateway, decoding + as spaces
      const responseText = await response.text();
      const responseParams: Record<string, string> = {};
      for (const pair of responseText.split('&')) {
        const [key, ...rest] = pair.split('=');
        const k = decodeURIComponent(key.replace(/\+/g, '%20'));
        const v = decodeURIComponent(rest.join('=').replace(/\+/g, '%20'));
        responseParams[k] = v;
      }

      // Verify response hash if present
      if (responseParams.vpc_SecureHash) {
        const hashValid = this.verifySecureHash(responseParams, responseParams.vpc_SecureHash);
        if (!hashValid) {
          logger.error(`queryDR response hash verification FAILED`, {
            displayName: this.gatewayConfig.displayName
          });
          return {
            status: PaymentStatus.Pending,
            message: 'Status query response failed hash verification — possible tampering.',
          };
        }
      }

      // Map VPC response code to internal PaymentStatus
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
        currency: responseParams.vpc_Currency || this.config.defaultDisplayCurrency || 'VUV',
        message: `queryDR response code: ${responseCode || 'N/A'} (${this.gatewayConfig.displayName})`,
        failureReason: status === PaymentStatus.Failed
          ? `VPC response code: ${responseCode} — ${responseParams.vpc_Message || 'Declined'}`
          : undefined,
      };
    } catch (error: any) {
      logger.error(`queryDR network error`, {
        displayName: this.gatewayConfig.displayName,
        error: error.message
      });
      return {
        status: PaymentStatus.Pending,
        message: `Status query failed: ${error.message}. Will retry later.`,
      };
    }
  }

  /**
   * Initiates a refund for a completed payment via Mastercard Payment Gateway.
   * Replaces the mock with a signed vpc_Command=refund server-to-server POST.
   */
  async refundPayment(payment: Payment, amount?: number, reason?: string): Promise<PaymentStatusResponse> {
    const refundAmount = amount || payment.amount;

    logger.info(`Initiating refund for payment`, {
      paymentId: payment.id,
      amount: refundAmount,
      reason,
    });

    if (!payment.gatewayReference) {
      return {
        status: PaymentStatus.Failed,
        message: 'Cannot initiate refund: payment does not have a gateway reference.',
      };
    }

    // Separate pay vs. data-port endpoint (Item 6)
    // // CONFIRM-WITH-BRED: verify if refund uses dataPortEndpoint or apiEndpoint.
    const endpoint = (this.config as any).dataPortEndpoint || this.credentials.apiEndpoint || this.config.bankApiEndpointUrl;

    if (!endpoint) {
      return {
        status: PaymentStatus.Failed,
        message: `Refund failed: API endpoint not configured for ${this.gatewayConfig.displayName}.`,
      };
    }

    const refundTxnRef = `refund-${payment.gatewayReference}-${Date.now()}`;

    // Currency Exponent Guard (Item 7): Same as initiatePayment.
    const amountStr = refundAmount.toString();

    // Build VPC refund parameters
    const vpcParams: Record<string, string> = {
      vpc_Command: 'refund',
      vpc_AccessCode: this.credentials.accessCode,
      vpc_Merchant: this.credentials.merchantId,
      vpc_Version: this.credentials.version || '1',
      vpc_MerchTxnRef: refundTxnRef,
      vpc_TransNo: payment.gatewayReference, // original gateway transaction reference
      vpc_Amount: amountStr,
      vpc_Currency: payment.currency,
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
        logger.error(`refundPayment HTTP error from gateway`, {
          status: response.status,
          displayName: this.gatewayConfig.displayName
        });
        return {
          status: PaymentStatus.Failed,
          message: `Gateway returned HTTP ${response.status} during refund transaction.`,
        };
      }

      // Parse response parameters, decoding + as spaces
      const responseText = await response.text();
      const responseParams: Record<string, string> = {};
      for (const pair of responseText.split('&')) {
        const [key, ...rest] = pair.split('=');
        const k = decodeURIComponent(key.replace(/\+/g, '%20'));
        const v = decodeURIComponent(rest.join('=').replace(/\+/g, '%20'));
        responseParams[k] = v;
      }

      // Verify response hash if present
      if (responseParams.vpc_SecureHash) {
        const hashValid = this.verifySecureHash(responseParams, responseParams.vpc_SecureHash);
        if (!hashValid) {
          logger.error(`refundPayment response hash verification FAILED`, {
            displayName: this.gatewayConfig.displayName
          });
          return {
            status: PaymentStatus.Failed,
            message: 'Refund response failed hash verification — possible tampering.',
          };
        }
      }

      const responseCode = responseParams.vpc_TxnResponseCode;

      if (responseCode === '0') {
        logger.info(`Refund successful`, {
          paymentId: payment.id,
          gatewayReference: responseParams.vpc_TransactionNo
        });
        return {
          status: PaymentStatus.Refunded,
          gatewayReference: responseParams.vpc_TransactionNo || refundTxnRef,
          amount: responseParams.vpc_Amount ? parseInt(responseParams.vpc_Amount, 10) : refundAmount,
          currency: responseParams.vpc_Currency || payment.currency,
          message: 'Refund successful.',
        };
      } else {
        logger.warn(`Refund declined by gateway`, {
          paymentId: payment.id,
          responseCode,
          message: responseParams.vpc_Message
        });
        return {
          status: PaymentStatus.Failed,
          gatewayReference: responseParams.vpc_TransactionNo || refundTxnRef,
          message: `Refund declined: ${responseParams.vpc_Message || 'Unknown error'} (Code: ${responseCode})`,
        };
      }
    } catch (error: any) {
      logger.error(`refundPayment network error`, {
        displayName: this.gatewayConfig.displayName,
        error: error.message
      });
      return {
        status: PaymentStatus.Failed,
        message: `Refund transaction failed: ${error.message}`,
      };
    }
  }
}
