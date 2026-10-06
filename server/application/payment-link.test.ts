import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PaymentApplicationService } from './payment.application-service.js';
import { PaymentReconciliationService } from './payment-reconciliation.service.js';
import { PaymentStatus } from '../domain/payments/interfaces.js';
import { makeBooking, makePaymentGateway } from '../test-fixtures/payment.js';

vi.mock('../lib/mail.js', () => ({
  sendEmail: vi.fn(), sendAdminEmail: vi.fn(), getPaymentConfirmationTemplate: vi.fn(),
  getBookingRequestTemplate: vi.fn(), getAdminNewBookingTemplate: vi.fn(), getBookingConfirmedTemplate: vi.fn(),
  shortBookingRef: (id: string) => id.slice(0, 8),
}));

const mockFail = vi.fn();
vi.mock('../domain/payments/PaymentIntent.js', () => ({
  PaymentIntent: class { receive = vi.fn(); fail = mockFail; },
  PaymentIntentStatus: {},
}));

const adapter = {
  createPaymentLink: vi.fn(),
  queryPaymentStatus: vi.fn(),
};
vi.mock('../infrastructure/payments/factory.js', () => ({
  PaymentFactory: { getPaymentGatewayService: () => adapter },
}));

const anz = makePaymentGateway({ id: 'gw-anz', slug: 'anz-egate', displayName: 'ANZ eGate' });
const HOLD = { id: 'hold-1', status: 'ACTIVE', expiresAt: new Date(Date.now() + 10 * 60_000) };

function makeStorage(overrides: Record<string, unknown> = {}) {
  return {
    getBooking: vi.fn().mockResolvedValue(makeBooking({ holdId: 'hold-1', bookingSessionId: 'sess-1' })),
    getPaymentGatewayBySlug: vi.fn().mockResolvedValue(anz),
    getPaymentGateway: vi.fn().mockResolvedValue(anz),
    getPaymentsByBooking: vi.fn().mockResolvedValue([]),
    getHold: vi.fn().mockResolvedValue(HOLD),
    getHoldsBySession: vi.fn().mockResolvedValue([HOLD, { id: 'hold-2' }]),
    updateHold: vi.fn().mockResolvedValue({}),
    createPayment: vi.fn().mockResolvedValue({ id: 'pay-link-1' }),
    updatePayment: vi.fn().mockResolvedValue({}),
    ...overrides,
  } as any;
}

const OPTIONS = { bookingId: 'book-123', gatewaySlug: 'anz-egate', siteOrigin: 'https://acetoursvanuatu.com' };

describe('PaymentApplicationService.createPaymentLink', () => {
  beforeEach(() => vi.clearAllMocks());

  it('holds the seats and keeps the payment open for as long as the link works', async () => {
    adapter.createPaymentLink.mockResolvedValue({ success: true, url: 'https://anz.example/pbl/PAYLINK1', linkId: 'PAYLINK1' });
    const storage = makeStorage();
    const result = await new PaymentApplicationService(storage).createPaymentLink(OPTIONS);

    expect(result).toMatchObject({ success: true, url: 'https://anz.example/pbl/PAYLINK1', paymentId: 'pay-link-1' });
    const expiresAt: Date = (result as any).expiresAt;
    const hours = (expiresAt.getTime() - Date.now()) / 3_600_000;
    expect(hours).toBeGreaterThan(71.9);
    expect(hours).toBeLessThanOrEqual(72);

    // Every hold in the booking's session is kept until the link expires.
    expect(storage.updateHold).toHaveBeenCalledWith('hold-1', { expiresAt });
    expect(storage.updateHold).toHaveBeenCalledWith('hold-2', { expiresAt });
    expect(storage.createPayment).toHaveBeenCalledWith(expect.objectContaining({
      bookingId: 'book-123', gatewayId: 'gw-anz', amount: 25000, currency: 'VUV', expiresAt,
    }));
    expect(adapter.createPaymentLink).toHaveBeenCalledWith(expect.objectContaining({
      paymentId: 'pay-link-1', bookingId: 'book-123', amount: 25000, expiresAt, siteOrigin: 'https://acetoursvanuatu.com',
    }));
    // Processing is what reconciliation polls, so a paid link confirms even without a notification.
    expect(storage.updatePayment).toHaveBeenCalledWith('pay-link-1', expect.objectContaining({
      status: PaymentStatus.Processing, gatewayReference: 'pay-link-1',
    }));
  });

  it('refuses a booking that is not pending', async () => {
    const storage = makeStorage({ getBooking: vi.fn().mockResolvedValue(makeBooking({ status: 'confirmed' })) });
    const result = await new PaymentApplicationService(storage).createPaymentLink(OPTIONS);
    expect(result.success).toBe(false);
    expect(storage.createPayment).not.toHaveBeenCalled();
  });

  it('refuses a second link while a payment is in progress', async () => {
    const storage = makeStorage({ getPaymentsByBooking: vi.fn().mockResolvedValue([{ id: 'p0', status: PaymentStatus.Processing }]) });
    const result = await new PaymentApplicationService(storage).createPaymentLink(OPTIONS);
    expect(result.success).toBe(false);
    expect(adapter.createPaymentLink).not.toHaveBeenCalled();
  });

  it('refuses when the seat hold has already expired', async () => {
    const storage = makeStorage({ getHold: vi.fn().mockResolvedValue({ ...HOLD, status: 'EXPIRED' }) });
    const result = await new PaymentApplicationService(storage).createPaymentLink(OPTIONS);
    expect(result.success).toBe(false);
    expect(storage.updateHold).not.toHaveBeenCalled();
  });

  it('refuses a switched-off bank', async () => {
    const storage = makeStorage({ getPaymentGatewayBySlug: vi.fn().mockResolvedValue({ ...anz, active: false }) });
    expect((await new PaymentApplicationService(storage).createPaymentLink(OPTIONS)).success).toBe(false);
  });

  it('marks the payment failed when the bank will not create the link', async () => {
    adapter.createPaymentLink.mockResolvedValue({ success: false, message: 'Payment links not enabled' });
    const storage = makeStorage();
    const result = await new PaymentApplicationService(storage).createPaymentLink(OPTIONS);
    expect(result).toEqual({ success: false, message: 'Payment links not enabled' });
    expect(storage.updatePayment).toHaveBeenCalledWith('pay-link-1', { status: PaymentStatus.Failed, failureReason: 'payment_link_failed' });
  });
});

describe('PaymentReconciliationService — expiry', () => {
  beforeEach(() => vi.clearAllMocks());

  const payment = (expiresAt: Date) => ({
    id: 'pay-link-1', bookingId: 'book-123', gatewayId: 'gw-anz', amount: 25000, currency: 'VUV',
    status: PaymentStatus.Processing, expiresAt, reconciliationAttempts: 0, gatewayReference: 'pay-link-1',
  });

  it('expires an unpaid payment once its window has passed', async () => {
    adapter.queryPaymentStatus.mockResolvedValue({ status: PaymentStatus.Processing });
    const storage = makeStorage({ getPayment: vi.fn().mockResolvedValue(payment(new Date(Date.now() - 60_000))) });
    await new PaymentReconciliationService(storage).syncPaymentStatus('pay-link-1');

    expect(storage.updatePayment).toHaveBeenCalledWith('pay-link-1', { status: PaymentStatus.Expired, failureReason: 'expired_timeout' });
    expect(mockFail).toHaveBeenCalledWith('expired_timeout');
  });

  it('keeps polling an unpaid link that has not expired', async () => {
    adapter.queryPaymentStatus.mockResolvedValue({ status: PaymentStatus.Processing });
    const storage = makeStorage({ getPayment: vi.fn().mockResolvedValue(payment(new Date(Date.now() + 3_600_000))) });
    await new PaymentReconciliationService(storage).syncPaymentStatus('pay-link-1');

    expect(storage.updatePayment).not.toHaveBeenCalledWith('pay-link-1', expect.objectContaining({ status: PaymentStatus.Expired }));
    expect(mockFail).not.toHaveBeenCalled();
  });

  it('still confirms a link paid just before expiry', async () => {
    adapter.queryPaymentStatus.mockResolvedValue({ status: PaymentStatus.Completed, gatewayReference: 'pay-link-1' });
    const storage = makeStorage({ getPayment: vi.fn().mockResolvedValue(payment(new Date(Date.now() - 60_000))) });
    await new PaymentReconciliationService(storage).syncPaymentStatus('pay-link-1');

    expect(storage.updatePayment).toHaveBeenCalledWith('pay-link-1', expect.objectContaining({ status: PaymentStatus.Completed }));
  });
});
