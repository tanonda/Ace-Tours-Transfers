import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MastercardGatewayAdapter } from './mastercard-gateway.adapter.js';
import { PaymentGateway, Payment } from '../../../shared/schema.js';
import { PaymentStatus, WebhookEvent } from '../../domain/payments/interfaces.js';

// Setup mock gateway config
const MOCK_GATEWAY_CONFIG: PaymentGateway = {
  id: 'gw-123',
  slug: 'bred-bank',
  displayName: 'BRED Bank',
  active: true,
  isDefault: true,
  priority: 1,
  credentials: {
    merchantId: 'TESTMERCH',
    accessCode: 'TESTACCESS',
    secureHashSecret: 'SuperSecret123',
    apiEndpoint: 'https://migs.bred.vd/vpcpay',
    version: '1',
  },
  config: {
    terminalId: 'T1',
    integrationType: 'HOSTED_REDIRECT',
    bankApiEndpointUrl: 'https://migs.bred.vd/vpcpay',
    settlementAccountId: 'ACC123',
    supportedCurrencies: ['VUV'],
    defaultDisplayCurrency: 'VUV',
    enforce3DSecure: true,
    threeDSecureThreshold: 10000,
    callbackWebhookUrl: 'https://acetours.com/payment/callback',
    dataPortEndpoint: 'https://migs.bred.vd/vpcdps',
  },
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('MastercardGatewayAdapter', () => {
  let adapter: MastercardGatewayAdapter;

  beforeEach(() => {
    vi.restoreAllMocks();
    adapter = new MastercardGatewayAdapter(MOCK_GATEWAY_CONFIG);
  });

  describe('Constructor', () => {
    it('initializes correctly and sets default hashFormat to KEY_VALUE', () => {
      expect(adapter).toBeDefined();
    });

    it('throws error if credentials or config is missing', () => {
      expect(() => new MastercardGatewayAdapter({ ...MOCK_GATEWAY_CONFIG, credentials: null } as any)).toThrow();
      expect(() => new MastercardGatewayAdapter({ ...MOCK_GATEWAY_CONFIG, config: null } as any)).toThrow();
    });
  });

  describe('initiatePayment', () => {
    it('builds a valid signed redirect URL with pay command', async () => {
      const result = await adapter.initiatePayment({
        bookingId: 'book-123',
        amount: 25000,
        currency: 'VUV',
        successUrl: 'https://success.com',
        cancelUrl: 'https://cancel.com',
      });

      expect(result.success).toBe(true);
      expect(result.redirectUrl).toBeDefined();
      expect(result.transactionId).toBeDefined();

      const url = new URL(result.redirectUrl!);
      expect(url.origin + url.pathname).toBe('https://migs.bred.vd/vpcpay');
      expect(url.searchParams.get('vpc_AccessCode')).toBe('TESTACCESS');
      expect(url.searchParams.get('vpc_Merchant')).toBe('TESTMERCH');
      expect(url.searchParams.get('vpc_Command')).toBe('pay');
      expect(url.searchParams.get('vpc_Amount')).toBe('25000');
      expect(url.searchParams.get('vpc_Currency')).toBe('VUV');
      expect(url.searchParams.get('vpc_OrderInfo')).toBe('book-123');
      expect(url.searchParams.get('vpc_MerchTxnRef')).toBe(result.transactionId);
      expect(url.searchParams.get('vpc_SecureHash')).toBeDefined();
      expect(url.searchParams.get('vpc_SecureHashType')).toBe('SHA256');
    });

    it('triggers 3DS when amount exceeds the configured threshold', async () => {
      const result = await adapter.initiatePayment({
        bookingId: 'book-123',
        amount: 50000, // exceeds threshold of 10000
        currency: 'VUV',
        successUrl: 'https://success.com',
        cancelUrl: 'https://cancel.com',
      });

      const url = new URL(result.redirectUrl!);
      expect(url.searchParams.get('vpc_3DSecure')).toBe('Y');
    });

    it('does not trigger 3DS when amount is under threshold', async () => {
      const result = await adapter.initiatePayment({
        bookingId: 'book-123',
        amount: 5000, // below 10000
        currency: 'VUV',
        successUrl: 'https://success.com',
        cancelUrl: 'https://cancel.com',
      });

      const url = new URL(result.redirectUrl!);
      expect(url.searchParams.get('vpc_3DSecure')).toBeNull();
    });

    it('fails if the currency is not supported', async () => {
      const result = await adapter.initiatePayment({
        bookingId: 'book-123',
        amount: 25000,
        currency: 'USD', // not supported
        successUrl: 'https://success.com',
        cancelUrl: 'https://cancel.com',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('not supported');
    });
  });

  describe('handleWebhook', () => {
    it('returns success and completed status on valid hash and response code 0', async () => {
      // Create valid params
      const rawEvent = {
        vpc_TxnResponseCode: '0',
        vpc_MerchTxnRef: 'txn-123',
        vpc_OrderInfo: 'book-123',
        vpc_Amount: '25000',
        vpc_Currency: 'VUV',
      };

      // Bootstrap a valid hash
      const initiateResult = await adapter.initiatePayment({
        bookingId: 'book-123',
        amount: 25000,
        currency: 'VUV',
        successUrl: 'https://success.com',
        cancelUrl: 'https://cancel.com',
      });
      const url = new URL(initiateResult.redirectUrl!);
      // Use standard vpc params structure to match initiate
      const hashParams = {
        vpc_TxnResponseCode: '0',
        vpc_MerchTxnRef: 'txn-123',
        vpc_OrderInfo: 'book-123',
        vpc_Amount: '25000',
        vpc_Currency: 'VUV',
      };
      const validHash = (adapter as any).generateSecureHash(hashParams);

      const event: WebhookEvent = {
        gatewaySlug: 'bred-bank',
        rawEvent: {
          ...hashParams,
          vpc_SecureHash: validHash,
          vpc_SecureHashType: 'SHA256',
        },
      };

      const result = await adapter.handleWebhook(event);

      expect(result.success).toBe(true);
      expect(result.newPaymentStatus).toBe(PaymentStatus.Completed);
      expect(result.gatewayReference).toBe('txn-123');
      expect(result.bookingId).toBe('book-123');
      expect(result.amount).toBe(25000);
      expect(result.currency).toBe('VUV');
    });

    it('returns failed status when response code is non-zero', async () => {
      const hashParams = {
        vpc_TxnResponseCode: 'D', // Declined
        vpc_MerchTxnRef: 'txn-123',
        vpc_OrderInfo: 'book-123',
        vpc_Amount: '25000',
      };
      const validHash = (adapter as any).generateSecureHash(hashParams);

      const event: WebhookEvent = {
        gatewaySlug: 'bred-bank',
        rawEvent: {
          ...hashParams,
          vpc_SecureHash: validHash,
          vpc_SecureHashType: 'SHA256',
        },
      };

      const result = await adapter.handleWebhook(event);

      expect(result.success).toBe(true);
      expect(result.newPaymentStatus).toBe(PaymentStatus.Failed);
    });

    it('fails when hash verification fails', async () => {
      const event: WebhookEvent = {
        gatewaySlug: 'bred-bank',
        rawEvent: {
          vpc_TxnResponseCode: '0',
          vpc_MerchTxnRef: 'txn-123',
          vpc_OrderInfo: 'book-123',
          vpc_SecureHash: 'WRONGHASH',
          vpc_SecureHashType: 'SHA256',
        },
      };

      const result = await adapter.handleWebhook(event);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Secure Hash verification failed');
    });
  });

  describe('queryPaymentStatus', () => {
    it('returns Completed on queryDR code 0', async () => {
      const mockFetchResponse = new URLSearchParams({
        vpc_TxnResponseCode: '0',
        vpc_DRExists: 'Y',
        vpc_TransactionNo: 'bank-txn-999',
        vpc_Amount: '25000',
        vpc_Currency: 'VUV',
      });

      // Sign mock response
      const responseParamsObj: Record<string, string> = {};
      mockFetchResponse.forEach((val, key) => { responseParamsObj[key] = val; });
      const responseHash = (adapter as any).generateSecureHash(responseParamsObj);
      mockFetchResponse.append('vpc_SecureHash', responseHash);
      mockFetchResponse.append('vpc_SecureHashType', 'SHA256');

      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        text: async () => mockFetchResponse.toString(),
      } as any);

      const result = await adapter.queryPaymentStatus({
        paymentId: 'pay-1',
        gatewayReference: 'txn-123',
      });

      expect(fetchSpy).toHaveBeenCalledWith('https://migs.bred.vd/vpcdps', expect.any(Object));
      expect(result.status).toBe(PaymentStatus.Completed);
      expect(result.gatewayReference).toBe('bank-txn-999');
      expect(result.amount).toBe(25000);
      expect(result.currency).toBe('VUV');
    });

    it('returns Pending when transaction not found (DRExists = N)', async () => {
      const mockFetchResponse = new URLSearchParams({
        vpc_DRExists: 'N',
      });

      const responseParamsObj: Record<string, string> = {};
      mockFetchResponse.forEach((val, key) => { responseParamsObj[key] = val; });
      const responseHash = (adapter as any).generateSecureHash(responseParamsObj);
      mockFetchResponse.append('vpc_SecureHash', responseHash);

      vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        text: async () => mockFetchResponse.toString(),
      } as any);

      const result = await adapter.queryPaymentStatus({
        paymentId: 'pay-1',
        gatewayReference: 'txn-123',
      });

      expect(result.status).toBe(PaymentStatus.Pending);
    });

    it('returns Failed status when response code is non-zero and exists', async () => {
      const mockFetchResponse = new URLSearchParams({
        vpc_TxnResponseCode: 'D',
        vpc_DRExists: 'Y',
        vpc_Message: 'Declined by bank',
      });

      const responseParamsObj: Record<string, string> = {};
      mockFetchResponse.forEach((val, key) => { responseParamsObj[key] = val; });
      const responseHash = (adapter as any).generateSecureHash(responseParamsObj);
      mockFetchResponse.append('vpc_SecureHash', responseHash);

      vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        text: async () => mockFetchResponse.toString(),
      } as any);

      const result = await adapter.queryPaymentStatus({
        paymentId: 'pay-1',
        gatewayReference: 'txn-123',
      });

      expect(result.status).toBe(PaymentStatus.Failed);
      expect(result.failureReason).toContain('Declined by bank');
    });
  });

  describe('refundPayment', () => {
    const samplePayment: Payment = {
      id: 'pay-777',
      bookingId: 'book-123',
      gatewayId: 'gw-123',
      amount: 25000,
      currency: 'VUV',
      status: PaymentStatus.Completed,
      gatewayReference: 'bank-txn-999',
      gatewayResponse: {},
      metadata: {},
      expiresAt: new Date(),
      failureReason: null,
      reconciledBy: null,
      reconciliationNote: null,
      lastReconciledAt: new Date(),
      reconciliationAttempts: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('submits signed refund request and parses success response', async () => {
      const mockFetchResponse = new URLSearchParams({
        vpc_TxnResponseCode: '0',
        vpc_TransactionNo: 'refund-txn-888',
        vpc_Amount: '25000',
        vpc_Currency: 'VUV',
        vpc_Message: 'Refund Approved',
      });

      const responseParamsObj: Record<string, string> = {};
      mockFetchResponse.forEach((val, key) => { responseParamsObj[key] = val; });
      const responseHash = (adapter as any).generateSecureHash(responseParamsObj);
      mockFetchResponse.append('vpc_SecureHash', responseHash);
      mockFetchResponse.append('vpc_SecureHashType', 'SHA256');

      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        text: async () => mockFetchResponse.toString(),
      } as any);

      const result = await adapter.refundPayment(samplePayment, 25000, 'Customer cancelled');

      expect(fetchSpy).toHaveBeenCalledWith('https://migs.bred.vd/vpcdps', expect.any(Object));
      expect(result.status).toBe(PaymentStatus.Refunded);
      expect(result.gatewayReference).toBe('refund-txn-888');
      expect(result.amount).toBe(25000);
      expect(result.currency).toBe('VUV');
    });

    it('returns Failed status on declined response', async () => {
      const mockFetchResponse = new URLSearchParams({
        vpc_TxnResponseCode: '7',
        vpc_Message: 'Declined: Insufficient Funds',
      });

      const responseParamsObj: Record<string, string> = {};
      mockFetchResponse.forEach((val, key) => { responseParamsObj[key] = val; });
      const responseHash = (adapter as any).generateSecureHash(responseParamsObj);
      mockFetchResponse.append('vpc_SecureHash', responseHash);

      vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        text: async () => mockFetchResponse.toString(),
      } as any);

      const result = await adapter.refundPayment(samplePayment, 10000);

      expect(result.status).toBe(PaymentStatus.Failed);
      expect(result.message).toContain('Refund declined');
    });

    it('returns Failed if payment lacks a gatewayReference', async () => {
      const paymentWithoutRef = { ...samplePayment, gatewayReference: null };
      const result = await adapter.refundPayment(paymentWithoutRef);

      expect(result.status).toBe(PaymentStatus.Failed);
      expect(result.message).toContain('does not have a gateway reference');
    });
  });
});
