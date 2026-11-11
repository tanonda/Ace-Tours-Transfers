import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PaymentApplicationService } from './payment.application-service.js';
import { PaymentReconciliationService } from './payment-reconciliation.service.js';
import { PaymentStatus } from '../domain/payments/interfaces.js';
import { makeBooking, makePaymentGateway } from '../test-fixtures/payment.js';

const sendAdminEmail = vi.fn().mockResolvedValue(true);
vi.mock('../lib/mail.js', () => ({
  sendEmail: vi.fn(), sendAdminEmail: (...args: unknown[]) => sendAdminEmail(...args), getPaymentConfirmationTemplate: vi.fn(),
  getBookingRequestTemplate: vi.fn(), getAdminNewBookingTemplate: vi.fn(), getBookingConfirmedTemplate: vi.fn(),
  shortBookingRef: (id: string) => id.slice(0, 8),
}));

const mockReceive = vi.fn();
const mockFail = vi.fn();
vi.mock('../domain/payments/PaymentIntent.js', () => ({
  PaymentIntent: class { receive = mockReceive; fail = mockFail; },
  PaymentIntentStatus: {},
}));

const adapter = { handleWebhook: vi.fn(), queryPaymentStatus: vi.fn() };
vi.mock('../infrastructure/payments/factory.js', () => ({
  PaymentFactory: { getPaymentGatewayService: () => adapter },
}));

const anz = makePaymentGateway({ id: 'gw-anz', slug: 'anz-egate', displayName: 'ANZ eGate' });

function makeStorage(payment: Record<string, unknown>) {
  return {
    getPaymentGatewayBySlug: vi.fn().mockResolvedValue(anz),
    getPaymentGateway: vi.fn().mockResolvedValue(anz),
    getPayment: vi.fn().mockResolvedValue(payment),
    getBooking: vi.fn().mockResolvedValue(makeBooking()),
    updatePayment: vi.fn().mockResolvedValue({}),
  } as any;
}

const PAYMENT = {
  id: 'pay-1', bookingId: 'book-123', gatewayId: 'gw-anz', amount: 25000, currency: 'VUV',
  status: PaymentStatus.Processing, metadata: {}, failureReason: null,
  // The card checkout window is already over, as it is when the overdue sweep runs.
  expiresAt: new Date(Date.now() - 60_000),
};

/** A review hold must outlive the overdue sweep (which expires payments past expiresAt) and tell an admin. */
function expectHeldForReview(storage: any, reason: string) {
  const update = storage.updatePayment.mock.calls.find(([, data]: any[]) => data.status === PaymentStatus.ManualReviewRequired)?.[1];
  expect(update).toBeDefined();
  expect(update.failureReason).toBe(reason);
  const hours = (update.expiresAt.getTime() - Date.now()) / 3_600_000;
  expect(hours).toBeGreaterThan(71.9);
  expect(sendAdminEmail).toHaveBeenCalledTimes(1);
  expect(mockReceive).not.toHaveBeenCalled();
  expect(mockFail).not.toHaveBeenCalled();
}

describe('a bank status that needs a person', () => {
  beforeEach(() => vi.clearAllMocks());

  it('callback: holds the payment for 72 hours and emails an admin', async () => {
    adapter.handleWebhook.mockResolvedValue({
      success: true, message: 'MPGS order status AUTHORIZED', paymentId: 'pay-1',
      gatewayReference: 'pay-1', newPaymentStatus: PaymentStatus.ManualReviewRequired, amount: 25000, currency: 'VUV',
    });
    const storage = makeStorage(PAYMENT);
    await new PaymentApplicationService(storage).handlePaymentWebhook({ gatewaySlug: 'anz-egate', rawEvent: {} });
    expectHeldForReview(storage, 'bank_status_needs_review');
  });

  it('callback: does not email again when the bank repeats the same status', async () => {
    adapter.handleWebhook.mockResolvedValue({
      success: true, message: 'MPGS order status AUTHORIZED', paymentId: 'pay-1',
      gatewayReference: 'pay-1', newPaymentStatus: PaymentStatus.ManualReviewRequired,
    });
    const storage = makeStorage({ ...PAYMENT, status: PaymentStatus.ManualReviewRequired, failureReason: 'bank_status_needs_review' });
    await new PaymentApplicationService(storage).handlePaymentWebhook({ gatewaySlug: 'anz-egate', rawEvent: {} });
    expect(sendAdminEmail).not.toHaveBeenCalled();
    expect(storage.updatePayment).not.toHaveBeenCalled();
  });

  it('callback: a later "paid" from the bank still confirms a payment held this way', async () => {
    adapter.handleWebhook.mockResolvedValue({
      success: true, message: 'MPGS order status CAPTURED', paymentId: 'pay-1',
      gatewayReference: 'pay-1', newPaymentStatus: PaymentStatus.Completed, amount: 25000, currency: 'VUV',
    });
    const storage = makeStorage({ ...PAYMENT, status: PaymentStatus.ManualReviewRequired, failureReason: 'bank_status_needs_review' });
    await new PaymentApplicationService(storage).handlePaymentWebhook({ gatewaySlug: 'anz-egate', rawEvent: {} });
    expect(mockReceive).toHaveBeenCalled();
  });

  it('reconciliation: holds the payment for 72 hours and emails an admin', async () => {
    adapter.queryPaymentStatus.mockResolvedValue({ status: PaymentStatus.ManualReviewRequired, message: 'MPGS order status AUTHORIZED' });
    const storage = makeStorage(PAYMENT);
    await new PaymentReconciliationService(storage).syncPaymentStatus('pay-1');
    expectHeldForReview(storage, 'bank_status_needs_review');
  });

  it('reconciliation: never confirms a payment the bank captured for a different amount', async () => {
    adapter.queryPaymentStatus.mockResolvedValue({ status: PaymentStatus.Completed, amount: 2500, currency: 'VUV', message: 'MPGS order status CAPTURED' });
    const storage = makeStorage(PAYMENT);
    await new PaymentReconciliationService(storage).syncPaymentStatus('pay-1');
    expectHeldForReview(storage, 'amount_currency_mismatch');
  });

  it('reconciliation: confirms a payment captured for the right amount', async () => {
    adapter.queryPaymentStatus.mockResolvedValue({ status: PaymentStatus.Completed, amount: 25000, currency: 'VUV', message: 'MPGS order status CAPTURED' });
    const storage = makeStorage(PAYMENT);
    await new PaymentReconciliationService(storage).syncPaymentStatus('pay-1');
    expect(mockReceive).toHaveBeenCalled();
    expect(sendAdminEmail).not.toHaveBeenCalled();
  });
});
