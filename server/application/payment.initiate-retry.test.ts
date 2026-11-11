import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PaymentApplicationService } from './payment.application-service.js';
import { PaymentStatus } from '../domain/payments/interfaces.js';
import { makeBooking, makePaymentGateway } from '../test-fixtures/payment.js';

vi.mock('../lib/mail.js', () => ({
  sendEmail: vi.fn(), sendAdminEmail: vi.fn(), getPaymentConfirmationTemplate: vi.fn(),
  getBookingRequestTemplate: vi.fn(), getAdminNewBookingTemplate: vi.fn(),
  shortBookingRef: (id: string) => id.slice(0, 8),
}));

const mockFail = vi.fn();
vi.mock('../domain/payments/PaymentIntent.js', () => ({
  PaymentIntent: class { static initiate = vi.fn(); receive = vi.fn(); fail = mockFail; },
  PaymentIntentStatus: {},
}));

const adapter = { initiatePayment: vi.fn() };
vi.mock('../infrastructure/payments/factory.js', () => ({
  PaymentFactory: { getPaymentGatewayService: () => adapter },
}));

const bred = makePaymentGateway({ id: 'gw-bred', slug: 'bred-bank', credentials: { mode: 'PRODUCTION' } });
const HOLD = { id: 'hold-1', status: 'ACTIVE', expiresAt: new Date(Date.now() + 10 * 60_000) };

function makeStorage(openPayment: Record<string, unknown>) {
  return {
    getBooking: vi.fn().mockResolvedValue(makeBooking({ userId: null, holdId: 'hold-1', bookingSessionId: 'book-123' })),
    getPaymentGatewayBySlug: vi.fn().mockResolvedValue(bred),
    getPaymentsByBooking: vi.fn().mockResolvedValue([openPayment]),
    getHold: vi.fn().mockResolvedValue(HOLD),
    createPayment: vi.fn().mockResolvedValue({ id: 'pay-new' }),
    updatePayment: vi.fn().mockResolvedValue({}),
  } as any;
}

const OPTIONS = {
  bookingId: 'book-123',
  sessionId: 'sess-guest',
  recentBookingIds: ['book-123'],
  provider: 'bred-bank',
  successUrl: 'https://acetoursvanuatu.com/payment/success?booking=book-123',
  cancelUrl: 'https://acetoursvanuatu.com/payment/cancel?booking=book-123',
};

describe('PaymentApplicationService.initiateBookingPayment — retry after leaving the bank page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adapter.initiatePayment.mockResolvedValue({
      success: true, message: 'ok', transactionId: 'abc123',
      formPost: { action: 'https://secure.payzen.eu/vads-payment/', fields: {} },
    });
  });

  it('replaces an unfinished bank-page attempt so the guest can pay the same booking', async () => {
    const storage = makeStorage({ id: 'pay-old', status: PaymentStatus.Processing, metadata: {} });
    const result = await new PaymentApplicationService(storage).initiateBookingPayment(OPTIONS);

    expect(result).toMatchObject({ success: true, paymentId: 'pay-new' });
    expect(storage.updatePayment).toHaveBeenCalledWith('pay-old', {
      status: PaymentStatus.Cancelled, failureReason: 'superseded_by_retry',
    });
    // The old attempt is closed before the new one is opened (one open payment per booking).
    expect(storage.updatePayment.mock.invocationCallOrder[0]).toBeLessThan(storage.createPayment.mock.invocationCallOrder[0]);
    // Closing the old attempt must not fail the booking or release its seats.
    expect(mockFail).not.toHaveBeenCalled();
  });

  it('still refuses while another request is starting a payment (double click)', async () => {
    const storage = makeStorage({ id: 'pay-old', status: PaymentStatus.Pending, metadata: {} });
    const result = await new PaymentApplicationService(storage).initiateBookingPayment(OPTIONS);

    expect(result.success).toBe(false);
    expect(storage.createPayment).not.toHaveBeenCalled();
    expect(storage.updatePayment).not.toHaveBeenCalled();
  });

  it('never replaces an admin payment link, which the guest may still pay', async () => {
    const storage = makeStorage({
      id: 'pay-link', status: PaymentStatus.Processing,
      metadata: { paymentLink: { url: 'https://anz.example/pbl/X' } },
    });
    const result = await new PaymentApplicationService(storage).initiateBookingPayment(OPTIONS);

    expect(result.success).toBe(false);
    expect(storage.createPayment).not.toHaveBeenCalled();
    expect(storage.updatePayment).not.toHaveBeenCalled();
  });

  it('keeps the old attempt when the chosen gateway is refused', async () => {
    const storage = makeStorage({ id: 'pay-old', status: PaymentStatus.Processing, metadata: {} });
    storage.getPaymentGatewayBySlug.mockResolvedValue({ ...bred, active: false });
    const result = await new PaymentApplicationService(storage).initiateBookingPayment(OPTIONS);

    expect(result.success).toBe(false);
    expect(storage.updatePayment).not.toHaveBeenCalled();
  });
});
