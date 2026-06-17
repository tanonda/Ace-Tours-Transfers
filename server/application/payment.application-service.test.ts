import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PaymentApplicationService } from './payment.application-service.js';
import { PaymentStatus, WebhookEvent } from '../domain/payments/interfaces.js';
import { IStorage } from '../storage.js';
import { PaymentGateway, Payment, Booking } from '../../shared/schema.js';
import { PaymentIntent } from '../domain/payments/PaymentIntent.js';

// Mock mail helpers
const sendAdminEmailMock = vi.fn().mockResolvedValue(true);
vi.mock('../lib/mail.js', () => {
  return {
    sendEmail: vi.fn().mockResolvedValue(true),
    sendAdminEmail: (subject: string, html: string) => sendAdminEmailMock(subject, html),
    getPaymentConfirmationTemplate: vi.fn(),
    getBookingRequestTemplate: vi.fn(),
    getAdminNewBookingTemplate: vi.fn(),
    shortBookingRef: (id: string) => (id || '').slice(0, 8).toUpperCase(),
  };
});

// Mock PaymentIntent receive/fail methods to inspect domain events
const mockReceive = vi.fn();
const mockFail = vi.fn();
vi.mock('../domain/payments/PaymentIntent.js', () => {
  return {
    PaymentIntent: class {
      receive = mockReceive;
      fail = mockFail;
      constructor() {}
    },
    PaymentIntentStatus: {
      Initiated: 'initiated',
      Received: 'received',
      Failed: 'failed',
    },
  };
});

// Setup mock data
const MOCK_GATEWAY: PaymentGateway = {
  id: 'gw-123',
  slug: 'bred-bank',
  displayName: 'BRED Bank',
  active: true,
  isDefault: true,
  priority: 1,
  credentials: {},
  config: {
    supportedCurrencies: ['VUV'],
    defaultDisplayCurrency: 'VUV',
  },
  createdAt: new Date(),
  updatedAt: new Date(),
};

const MOCK_PAYMENT: Payment = {
  id: 'pay-1',
  bookingId: 'book-123',
  gatewayId: 'gw-123',
  amount: 25000,
  currency: 'VUV',
  status: PaymentStatus.Processing,
  gatewayReference: 'txn-123',
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

const MOCK_BOOKING: Booking = {
  id: 'book-123',
  userId: 'usr-1',
  bookingSessionId: 'sess-1',
  status: 'pending',
  customerName: 'Alice',
  customerEmail: 'alice@example.com',
  customerPhone: '12345',
  tourId: 'tour-1',
  tourName: 'Blue Hole Tour',
  date: '2026-06-20',
  guests: 2,
  totalAmountCents: 25000,
  archivedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('PaymentApplicationService — handlePaymentWebhook', () => {
  let storageMock: vi.Mocked<IStorage>;
  let service: PaymentApplicationService;

  beforeEach(() => {
    vi.clearAllMocks();

    storageMock = {
      getPaymentGatewayBySlug: vi.fn().mockResolvedValue(MOCK_GATEWAY),
      getPaymentGateway: vi.fn().mockResolvedValue(MOCK_GATEWAY),
      getPayment: vi.fn().mockResolvedValue(MOCK_PAYMENT),
      getPaymentByGatewayReference: vi.fn().mockResolvedValue(MOCK_PAYMENT),
      getPaymentsByBooking: vi.fn().mockResolvedValue([MOCK_PAYMENT]),
      getBooking: vi.fn().mockResolvedValue(MOCK_BOOKING),
      updatePayment: vi.fn().mockResolvedValue({ ...MOCK_PAYMENT, status: PaymentStatus.Completed }),
    } as any;

    service = new PaymentApplicationService(storageMock);
  });

  it('completes payment successfully when hash is valid and amount/currency matches', async () => {
    const event: WebhookEvent = {
      gatewaySlug: 'bred-bank',
      rawEvent: {
        vpc_TxnResponseCode: '0',
        vpc_MerchTxnRef: 'txn-123',
        vpc_OrderInfo: 'book-123',
        vpc_Amount: '25000',
        vpc_Currency: 'VUV',
        vpc_SecureHash: 'VALIDHASH',
      },
    };

    // Mock adapter handleWebhook response (as we verified in adapter tests)
    vi.mock('../infrastructure/payments/factory.js', () => {
      return {
        PaymentFactory: {
          getPaymentGatewayService: () => ({
            handleWebhook: async () => ({
              success: true,
              newPaymentStatus: PaymentStatus.Completed,
              gatewayReference: 'txn-123',
              bookingId: 'book-123',
              amount: 25000,
              currency: 'VUV',
            }),
          }),
        },
      };
    });

    const result = await service.handlePaymentWebhook(event);

    expect(result.success).toBe(true);
    expect(result.newPaymentStatus).toBe(PaymentStatus.Completed);

    // Verify storage calls
    expect(storageMock.getPaymentByGatewayReference).toHaveBeenCalledWith('txn-123');
    expect(storageMock.updatePayment).toHaveBeenCalledWith('pay-1', {
      status: PaymentStatus.Completed,
      gatewayReference: 'txn-123',
      failureReason: undefined,
    });

    // Emits PaymentConfirmed event in domain model
    expect(mockReceive).toHaveBeenCalled();
    expect(sendAdminEmailMock).not.toHaveBeenCalled();
  });

  it('places payment in manual_review_required on amount mismatch and emails admin', async () => {
    const event: WebhookEvent = {
      gatewaySlug: 'bred-bank',
      rawEvent: {
        vpc_TxnResponseCode: '0',
        vpc_MerchTxnRef: 'txn-123',
        vpc_OrderInfo: 'book-123',
        vpc_Amount: '10000', // expected 25000
        vpc_Currency: 'VUV',
        vpc_SecureHash: 'VALIDHASH',
      },
    };

    // Mock webhook result representing tampered amount
    const mismatchWebhookResult = {
      success: true,
      newPaymentStatus: PaymentStatus.Completed,
      gatewayReference: 'txn-123',
      bookingId: 'book-123',
      amount: 10000, // mismatch
      currency: 'VUV',
    };

    // Temporarily mock adapter to return mismatch
    const getGatewayServiceSpy = vi.spyOn(
      await import('../infrastructure/payments/factory.js').then(m => m.PaymentFactory),
      'getPaymentGatewayService'
    ).mockReturnValue({
      handleWebhook: async () => mismatchWebhookResult,
    } as any);

    const result = await service.handlePaymentWebhook(event);

    // The payment status should be overridden to manual_review_required
    expect(result.newPaymentStatus).toBe(PaymentStatus.ManualReviewRequired);
    expect(result.success).toBe(false);

    // Verify storage status updated to manual_review_required
    expect(storageMock.updatePayment).toHaveBeenCalledWith('pay-1', {
      status: PaymentStatus.ManualReviewRequired,
      gatewayReference: 'txn-123',
      failureReason: 'amount_currency_mismatch',
      metadata: {
        bankReportedAmount: 10000,
        bankReportedCurrency: 'VUV',
      },
    });

    // Admin alert triggered
    expect(sendAdminEmailMock).toHaveBeenCalled();
    const alertSubject = sendAdminEmailMock.mock.calls[0][0];
    expect(alertSubject).toContain('Payment Discrepancy Alert');

    // Mismatched payments DO NOT receive/confirm booking automatically
    expect(mockReceive).not.toHaveBeenCalled();
  });

  it('places payment in manual_review_required on currency mismatch and emails admin', async () => {
    const event: WebhookEvent = {
      gatewaySlug: 'bred-bank',
      rawEvent: {
        vpc_TxnResponseCode: '0',
        vpc_MerchTxnRef: 'txn-123',
        vpc_OrderInfo: 'book-123',
        vpc_Amount: '25000',
        vpc_Currency: 'USD', // expected VUV
        vpc_SecureHash: 'VALIDHASH',
      },
    };

    const mismatchWebhookResult = {
      success: true,
      newPaymentStatus: PaymentStatus.Completed,
      gatewayReference: 'txn-123',
      bookingId: 'book-123',
      amount: 25000,
      currency: 'USD', // mismatch
    };

    vi.spyOn(
      await import('../infrastructure/payments/factory.js').then(m => m.PaymentFactory),
      'getPaymentGatewayService'
    ).mockReturnValue({
      handleWebhook: async () => mismatchWebhookResult,
    } as any);

    const result = await service.handlePaymentWebhook(event);

    expect(result.newPaymentStatus).toBe(PaymentStatus.ManualReviewRequired);
    expect(storageMock.updatePayment).toHaveBeenCalledWith('pay-1', {
      status: PaymentStatus.ManualReviewRequired,
      gatewayReference: 'txn-123',
      failureReason: 'amount_currency_mismatch',
      metadata: {
        bankReportedAmount: 25000,
        bankReportedCurrency: 'USD',
      },
    });
    expect(sendAdminEmailMock).toHaveBeenCalled();
    expect(mockReceive).not.toHaveBeenCalled();
  });

  it('falls back to bookingId lookup if getPaymentByGatewayReference finds nothing', async () => {
    storageMock.getPaymentByGatewayReference.mockResolvedValueOnce(undefined);

    const event: WebhookEvent = {
      gatewaySlug: 'bred-bank',
      rawEvent: {
        vpc_TxnResponseCode: '0',
        vpc_MerchTxnRef: 'txn-123',
        vpc_OrderInfo: 'book-123',
        vpc_Amount: '25000',
        vpc_Currency: 'VUV',
      },
    };

    const webhookResult = {
      success: true,
      newPaymentStatus: PaymentStatus.Completed,
      gatewayReference: 'txn-123',
      bookingId: 'book-123',
      amount: 25000,
      currency: 'VUV',
    };

    vi.spyOn(
      await import('../infrastructure/payments/factory.js').then(m => m.PaymentFactory),
      'getPaymentGatewayService'
    ).mockReturnValue({
      handleWebhook: async () => webhookResult,
    } as any);

    await service.handlePaymentWebhook(event);

    expect(storageMock.getPaymentByGatewayReference).toHaveBeenCalledWith('txn-123');
    expect(storageMock.getPaymentsByBooking).toHaveBeenCalledWith('book-123');
    expect(storageMock.updatePayment).toHaveBeenCalledWith('pay-1', expect.any(Object));
  });

  it('is idempotent and returns early if payment is already in terminal Completed state', async () => {
    storageMock.getPayment.mockResolvedValueOnce({
      ...MOCK_PAYMENT,
      status: PaymentStatus.Completed, // already completed
    });

    const event: WebhookEvent = {
      gatewaySlug: 'bred-bank',
      rawEvent: {
        vpc_TxnResponseCode: '0',
        vpc_MerchTxnRef: 'txn-123',
        vpc_OrderInfo: 'book-123',
        vpc_Amount: '25000',
        vpc_Currency: 'VUV',
      },
    };

    const webhookResult = {
      success: true,
      newPaymentStatus: PaymentStatus.Completed,
      gatewayReference: 'txn-123',
      bookingId: 'book-123',
      amount: 25000,
      currency: 'VUV',
    };

    vi.spyOn(
      await import('../infrastructure/payments/factory.js').then(m => m.PaymentFactory),
      'getPaymentGatewayService'
    ).mockReturnValue({
      handleWebhook: async () => webhookResult,
    } as any);

    const result = await service.handlePaymentWebhook(event);

    expect(storageMock.updatePayment).not.toHaveBeenCalled();
    expect(mockReceive).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
  });
});
