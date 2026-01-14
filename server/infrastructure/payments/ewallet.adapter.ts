// server/infrastructure/payments/ewallet.adapter.ts

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

/**
 * Interface for Local E-wallet specific credentials.
 * This will be stored in the `credentials` JSONB field of the PaymentGateway entity.
 */
export interface EWalletCredentials {
  walletProviderId: string; // e.g., 'VanuatuMobileMoney', 'LocalPay'
  apiKey: string;
  apiSecret: string;
  apiEndpoint: string; // e.g., 'https://api.mobilemoney.vu/payments'
}

/**
 * Local E-wallet Payment Gateway Adapter.
 * This class implements the PaymentGatewayService interface for various local e-wallets.
 * It serves as a generic adapter for wallets with similar API patterns.
 */
export class EWalletAdapter implements PaymentGatewayService {
  private credentials: EWalletCredentials;
  private gatewayConfig: PaymentGateway;

  constructor(gatewayConfig: PaymentGateway) {
    if (!gatewayConfig.credentials) {
      throw new Error('Local E-wallet credentials are not provided.');
    }
    // Type assertion for credentials
    this.credentials = gatewayConfig.credentials as EWalletCredentials;
    this.gatewayConfig = gatewayConfig;

    // Basic validation of credentials
    if (!this.credentials.walletProviderId || !this.credentials.apiKey || !this.credentials.apiSecret || !this.credentials.apiEndpoint) {
      throw new Error('Invalid or incomplete Local E-wallet credentials.');
    }

    console.log(`Local E-wallet Adapter initialized for ${this.credentials.walletProviderId}`);
  }

  /**
   * Initiates a payment process with a local e-wallet.
   * This typically involves sending a request to the e-wallet provider's API
   * to create a payment session or a QR code for the user to scan.
   * For now, this is a mock implementation.
   */
  async initiatePayment(request: PaymentInitiationRequest): Promise<PaymentInitiationResponse> {
    console.log(`Mock E-wallet: Initiating payment for booking ${request.bookingId} with amount ${request.amount} ${request.currency}`);

    // In a real scenario, you would make an API call to the e-wallet provider.
    // The response might include a deep link for a mobile app, a QR code image URL,
    // or a redirect URL to a web-based payment flow.

    const mockTransactionId = `EWALLET-${Date.now()}-${request.bookingId.substring(0, 8)}`;
    // Example for a QR code or deep link
    const mockRedirectUrl = `${this.credentials.apiEndpoint}/pay?transactionId=${mockTransactionId}&amount=${request.amount}&currency=${request.currency}&redirect=${encodeURIComponent(request.successUrl)}`;

    return {
      success: true,
      message: 'Payment initiation successful (mock E-wallet).',
      redirectUrl: mockRedirectUrl, // This could be a QR code URL or deep link
      transactionId: mockTransactionId,
    };
  }

  /**
   * Handles webhook events from the local e-wallet provider.
   * For now, this is a mock implementation.
   */
  async handleWebhook(event: WebhookEvent): Promise<WebhookResponse> {
    console.log('Mock E-wallet: Handling webhook event.', event.rawEvent);

    // In a real scenario, you would:
    // 1. Verify the authenticity of the webhook (e.g., using a signature and shared secret).
    // 2. Parse the event data to extract transaction status and reference.
    // 3. Find the corresponding payment record in your database.
    // 4. Update the payment and booking status based on the event.

    const rawEvent = event.rawEvent;
    const transactionReference = rawEvent.transactionId || 'unknown';
    const status = rawEvent.status; // e.g., 'paid', 'failed', 'pending'

    let newStatus: PaymentStatus = PaymentStatus.Failed;
    if (status === 'paid') {
      newStatus = PaymentStatus.Completed;
    } else if (status === 'pending') {
      newStatus = PaymentStatus.Pending;
    }

    const mockPaymentId = rawEvent.paymentId || 'mock-payment-id';
    const mockBookingId = rawEvent.bookingId || 'mock-booking-id';

    return {
      success: true,
      message: `Webhook processed for transaction ${transactionReference} with status ${newStatus}.`,
      paymentId: mockPaymentId,
      bookingId: mockBookingId,
      newPaymentStatus: newStatus,
    };
  }

  /**
   * Queries the current status of an e-wallet payment.
   * For now, this is a mock implementation.
   */
  async queryPaymentStatus(request: PaymentStatusRequest): Promise<PaymentStatusResponse> {
    console.log(`Mock E-wallet: Querying status for payment ${request.paymentId} / ${request.gatewayReference}`);

    // In a real scenario, you would make an API call to the e-wallet provider
    // with the transaction reference to get its current status.

    const mockStatus = request.gatewayReference ? PaymentStatus.Completed : PaymentStatus.Pending;

    return {
      status: mockStatus,
      gatewayReference: request.gatewayReference || `mock-ewallet-ref-${Date.now()}`,
      amount: 30000, // Mock amount in cents
      currency: 'VUV', // Mock currency
      message: 'Status retrieved (mock E-wallet).',
    };
  }

  /**
   * Initiates a refund for a completed e-wallet payment.
   * For now, this is a mock implementation.
   */
  async refundPayment(payment: Payment, amount?: number, reason?: string): Promise<PaymentStatusResponse> {
    console.log(`Mock E-wallet: Refunding payment ${payment.id} for amount ${amount || 'full'} with reason: ${reason}`);

    // In a real scenario, this would involve an API call to the e-wallet provider for refund.

    return {
      status: PaymentStatus.Refunded,
      gatewayReference: payment.gatewayReference || `mock-ewallet-refund-ref-${Date.now()}`,
      amount: amount || payment.amount,
      currency: payment.currency,
      message: 'Payment refunded (mock E-wallet).',
    };
  }
}
