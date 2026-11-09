import { describe, it, expect, vi, beforeEach, type Mocked } from 'vitest';
import { PaymentReconciliationService } from './payment-reconciliation.service.js';
import { PaymentStatus } from '../domain/payments/interfaces.js';
import { IStorage } from '../storage.js';
import type { Payment } from '../../shared/schema.js';
import { makeBooking, makePaymentGateway } from '../test-fixtures/payment.js';

const mocks = vi.hoisted(() => ({
  sendAdminEmail: vi.fn().mockResolvedValue(true),
}));

vi.mock('../lib/mail.js', () => ({
  sendEmail: vi.fn().mockResolvedValue(true),
  sendAdminEmail: (subject: string, html: string) => mocks.sendAdminEmail(subject, html),
  getPaymentConfirmationTemplate: vi.fn(),
  getBookingConfirmedTemplate: vi.fn(),
  shortBookingRef: (id: string) => (id || '').slice(0, 8).toUpperCase(),
}));

vi.mock('../infrastructure/payments/factory.js', () => ({
  PaymentFactory: {
    getPaymentGatewayService: () => ({
      supportsStatusQuery: () => false,
      queryPaymentStatus: async () => {
        throw new Error('PayZen results arrive by IPN');
      },
    }),
  },
}));

const GATEWAY = makePaymentGateway({ slug: 'bred-bank', displayName: 'BRED Bank (PayZen)' });

function makePayment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: 'pay-1',
    bookingId: 'book-123',
    gatewayId: GATEWAY.id,
    amount: 25000,
    currency: 'VUV',
    status: PaymentStatus.Processing,
    gatewayReference: 'payzen-txn-1',
    gatewayResponse: {},
    metadata: {},
    refundedAmount: 0,
    refundedAt: null,
    refundReference: null,
    expiresAt: new Date(Date.now() - 60_000),
    failureReason: null,
    reconciledBy: null,
    reconciliationNote: null,
    lastReconciledAt: null,
    reconciliationAttempts: 0,
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    updatedAt: new Date(),
    ...overrides,
  } as Payment;
}

describe('PaymentReconciliationService — notification-only gateways', () => {
  let storageMock: Mocked<IStorage>;
  let service: PaymentReconciliationService;
  let payment: Payment;

  beforeEach(() => {
    vi.clearAllMocks();
    payment = makePayment();

    storageMock = {
      getPayment: vi.fn().mockImplementation(async () => payment),
      getPaymentGateway: vi.fn().mockResolvedValue(GATEWAY),
      getBooking: vi.fn().mockResolvedValue(makeBooking()),
      updatePayment: vi.fn().mockImplementation(async (id, data) => ({ ...payment, ...data })),
    } as any;

    service = new PaymentReconciliationService(storageMock);
  });

  it('holds a stale notification-only payment for manual review', async () => {
    await service.syncPaymentStatus(payment.id);

    expect(storageMock.updatePayment).toHaveBeenCalledWith(
      payment.id,
      expect.objectContaining({
        status: PaymentStatus.ManualReviewRequired,
        failureReason: 'ipn_not_received',
        expiresAt: expect.any(Date),
      }),
    );
    expect(mocks.sendAdminEmail).toHaveBeenCalledTimes(1);
  });

  it('only records the attempt while the payment window is still open', async () => {
    payment = makePayment({ expiresAt: new Date(Date.now() + 60_000) });

    await service.syncPaymentStatus(payment.id);

    expect(storageMock.updatePayment).toHaveBeenCalledWith(
      payment.id,
      expect.objectContaining({ lastReconciledAt: expect.any(Date) }),
    );
    expect(storageMock.updatePayment).not.toHaveBeenCalledWith(
      payment.id,
      expect.objectContaining({ status: PaymentStatus.ManualReviewRequired }),
    );
    expect(mocks.sendAdminEmail).not.toHaveBeenCalled();
  });

  it('never moves a completed payment back to review when an admin syncs it', async () => {
    payment = makePayment({ status: PaymentStatus.Completed });

    await service.syncPaymentStatus(payment.id);

    expect(storageMock.updatePayment).toHaveBeenCalledWith(
      payment.id,
      expect.objectContaining({ lastReconciledAt: expect.any(Date) }),
    );
    expect(storageMock.updatePayment).not.toHaveBeenCalledWith(
      payment.id,
      expect.objectContaining({ status: PaymentStatus.ManualReviewRequired }),
    );
    expect(mocks.sendAdminEmail).not.toHaveBeenCalled();
  });

  it('records a refund made in the bank portal as a full refund', async () => {
    payment = makePayment({ status: PaymentStatus.Completed });

    await service.reconcileManually(payment.id, 'admin-1', 'Refunded in PayZen Back Office', PaymentStatus.Refunded);

    expect(storageMock.updatePayment).toHaveBeenCalledWith(
      payment.id,
      expect.objectContaining({
        status: PaymentStatus.Refunded,
        refundedAmount: 25000,
        refundReference: 'Refunded in PayZen Back Office',
        refundedAt: expect.any(Date),
      }),
    );
  });
});
