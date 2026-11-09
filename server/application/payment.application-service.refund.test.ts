import { describe, it, expect, vi, beforeEach, type Mocked } from 'vitest';
import { PaymentApplicationService } from './payment.application-service.js';
import { PaymentStatus } from '../domain/payments/interfaces.js';
import { IStorage } from '../storage.js';
import { Payment } from '../../shared/schema.js';
import { makeBooking, makePaymentGateway } from '../test-fixtures/payment.js';

const mocks = vi.hoisted(() => ({
  sendAdminEmail: vi.fn().mockResolvedValue(true),
  webhookResult: null as any,
}));

vi.mock('../lib/mail.js', () => ({
  sendEmail: vi.fn().mockResolvedValue(true),
  sendAdminEmail: (subject: string, html: string) => mocks.sendAdminEmail(subject, html),
  getPaymentConfirmationTemplate: vi.fn(),
  getBookingRequestTemplate: vi.fn(),
  getAdminNewBookingTemplate: vi.fn(),
  shortBookingRef: (id: string) => (id || '').slice(0, 8).toUpperCase(),
}));

vi.mock('../infrastructure/payments/factory.js', () => ({
  PaymentFactory: {
    getPaymentGatewayService: () => ({
      handleWebhook: async () => mocks.webhookResult,
    }),
  },
}));

const MOCK_GATEWAY = makePaymentGateway();

function makePayment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: 'pay-1',
    bookingId: 'book-123',
    gatewayId: MOCK_GATEWAY.id,
    amount: 25000,
    currency: 'VUV',
    status: PaymentStatus.Completed,
    gatewayReference: 'txn-123',
    gatewayResponse: {},
    metadata: {},
    refundedAmount: 0,
    refundedAt: null,
    refundReference: null,
    expiresAt: new Date(Date.now() + 60_000),
    failureReason: null,
    reconciledBy: null,
    reconciliationNote: null,
    lastReconciledAt: new Date(),
    reconciliationAttempts: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Payment;
}

describe('PaymentApplicationService — refund notifications', () => {
  let storageMock: Mocked<IStorage>;
  let service: PaymentApplicationService;
  let payment: Payment;

  beforeEach(() => {
    vi.clearAllMocks();
    payment = makePayment();
    mocks.webhookResult = {
      success: true,
      paymentId: payment.id,
      gatewayReference: 'refund-ref-1',
      amount: 25000,
      currency: 'VUV',
      refund: { amount: 25000, reference: 'refund-ref-1' },
    };

    storageMock = {
      getPaymentGatewayBySlug: vi.fn().mockResolvedValue(MOCK_GATEWAY),
      getPayment: vi.fn().mockImplementation(async () => payment),
      getPaymentByGatewayReference: vi.fn().mockResolvedValue(payment),
      getPaymentsByBooking: vi.fn().mockResolvedValue([payment]),
      getBooking: vi.fn().mockResolvedValue(makeBooking()),
      updatePayment: vi.fn().mockImplementation(async (id, data) => ({ ...payment, ...data })),
    } as any;

    service = new PaymentApplicationService(storageMock);
  });

  it('records a full refund and marks the payment refunded', async () => {
    const result = await service.handlePaymentWebhook({ gatewaySlug: 'bred-bank', rawEvent: {} });

    expect(result.success).toBe(true);
    expect(storageMock.updatePayment).toHaveBeenCalledWith(
      payment.id,
      expect.objectContaining({
        status: PaymentStatus.Refunded,
        refundedAmount: 25000,
        refundReference: 'refund-ref-1',
        refundedAt: expect.any(Date),
      }),
    );
    expect(mocks.sendAdminEmail).toHaveBeenCalledTimes(1);
  });

  it('records a partial refund and keeps the payment completed', async () => {
    mocks.webhookResult = {
      success: true,
      paymentId: payment.id,
      refund: { amount: 5000, reference: 'refund-ref-2' },
    };

    await service.handlePaymentWebhook({ gatewaySlug: 'bred-bank', rawEvent: {} });

    expect(storageMock.updatePayment).toHaveBeenCalledWith(
      payment.id,
      expect.objectContaining({
        status: PaymentStatus.Completed,
        refundedAmount: 5000,
      }),
    );
  });

  it('does not count the same refund notification twice', async () => {
    payment = makePayment({ refundedAmount: 5000, metadata: { refunds: [{ amount: 5000, reference: 'refund-ref-2' }] } });
    mocks.webhookResult = { success: true, paymentId: payment.id, refund: { amount: 5000, reference: 'refund-ref-2' } };

    await service.handlePaymentWebhook({ gatewaySlug: 'bred-bank', rawEvent: {} });

    expect(storageMock.updatePayment).not.toHaveBeenCalled();
  });

  it('does not resurrect a refunded payment when the original debit notification is replayed', async () => {
    payment = makePayment({ status: PaymentStatus.Refunded, refundedAmount: 25000, refundedAt: new Date() });
    mocks.webhookResult = {
      success: true,
      paymentId: payment.id,
      newPaymentStatus: PaymentStatus.Completed,
      amount: 25000,
      currency: 'VUV',
    };

    const result = await service.handlePaymentWebhook({ gatewaySlug: 'bred-bank', rawEvent: {} });

    expect(result.success).toBe(false);
    expect(result.newPaymentStatus).toBeUndefined();
    expect(storageMock.updatePayment).not.toHaveBeenCalled();
  });

  it('caps the recorded refund at the payment amount and marks it fully refunded', async () => {
    mocks.webhookResult = { success: true, paymentId: payment.id, refund: { amount: 40000, reference: 'refund-ref-3' } };

    await service.handlePaymentWebhook({ gatewaySlug: 'bred-bank', rawEvent: {} });

    expect(storageMock.updatePayment).toHaveBeenCalledWith(
      payment.id,
      expect.objectContaining({
        status: PaymentStatus.Refunded,
        refundedAmount: 25000,
      }),
    );
  });
});
