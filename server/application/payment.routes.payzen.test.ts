import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express, { Express } from 'express';
import session from 'express-session';
import { registerPaymentRoutes } from './payment.routes.js';
import { computePayzenSignature } from '../infrastructure/payments/payzen-signature.js';
import { PaymentStatus } from '../domain/payments/interfaces.js';
import { makeBooking, makePaymentGateway } from '../test-fixtures/payment.js';

// Don't let PaymentConfirmed/PaymentFailed handlers reach the DB or mailer.
vi.mock('../infrastructure/events/event-dispatcher.js', () => ({
  eventDispatcher: { dispatch: vi.fn(), subscribe: vi.fn() },
}));
vi.mock('../lib/mail.js', () => ({
  sendEmail: vi.fn(), sendAdminEmail: vi.fn(),
  getPaymentConfirmationTemplate: vi.fn(), getBookingRequestTemplate: vi.fn(),
  getAdminNewBookingTemplate: vi.fn(), shortBookingRef: (id: string) => id.slice(0, 6),
}));

const TEST_KEY = 'TestKeyAbc123';
const bredGateway = makePaymentGateway({
  id: 'gw-bred',
  slug: 'bred-bank',
  credentials: { shopId: '12345678', mode: 'TEST', testKey: TEST_KEY },
  config: null,
});

function signedIpn(overrides: Record<string, string> = {}) {
  const fields: Record<string, string> = {
    vads_amount: '12500',
    vads_ctx_mode: 'TEST',
    vads_currency: '548',
    vads_operation_type: 'DEBIT',
    vads_order_id: 'pay-0001',
    vads_site_id: '12345678',
    vads_trans_id: 'a1b2c3',
    vads_trans_status: 'AUTHORISED',
    vads_trans_uuid: 'uuid-1',
    vads_url_check_src: 'PAY',
    vads_hash: 'notification-hash',
    ...overrides,
  };
  return { ...fields, signature: computePayzenSignature(fields, TEST_KEY) };
}

let app: Express;
let storage: Record<string, ReturnType<typeof vi.fn>>;

beforeEach(() => {
  storage = {
    getFeatureFlags: vi.fn().mockResolvedValue([]),
    getPaymentGatewayBySlug: vi.fn().mockResolvedValue(bredGateway),
    getPayment: vi.fn().mockResolvedValue({
      id: 'pay-0001', bookingId: 'book-123', amount: 12500, currency: 'VUV',
      status: PaymentStatus.Processing, metadata: null,
    }),
    updatePayment: vi.fn().mockResolvedValue({}),
    getBooking: vi.fn().mockResolvedValue(makeBooking({
      id: 'book-123', status: 'pending', bookingSessionId: 'sess-x', totalAmountCents: 12500,
      customerEmail: 'guest@example.com', customerName: 'Jo Guest',
    })),
    getPaymentsByBooking: vi.fn().mockResolvedValue([]),
    createPayment: vi.fn().mockResolvedValue({ id: 'pay-0001' }),
  };
  app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  app.use(session({ secret: 'test', resave: false, saveUninitialized: true }));
  app.use((req, _res, next) => { (req.session as any).recentBookingIds = ['book-123']; next(); });
  registerPaymentRoutes(app, storage as any);
});

describe('PayZen IPN — POST /api/payments/webhook/bred-bank', () => {
  it('answers 200 and completes the payment for a signed AUTHORISED notification', async () => {
    const res = await request(app).post('/api/payments/webhook/bred-bank').type('form').send(signedIpn());
    expect(res.status).toBe(200);
    expect(storage.updatePayment).toHaveBeenCalledWith('pay-0001', expect.objectContaining({
      status: PaymentStatus.Completed,
      gatewayReference: 'uuid-1',
    }));
  });

  it('answers 400 and changes nothing when the signature is wrong', async () => {
    const res = await request(app).post('/api/payments/webhook/bred-bank').type('form')
      .send({ ...signedIpn(), vads_amount: '1' });
    expect(res.status).toBe(400);
    expect(storage.updatePayment).not.toHaveBeenCalled();
  });

  it('answers 200 for a refund notification without touching the payment', async () => {
    const res = await request(app).post('/api/payments/webhook/bred-bank').type('form')
      .send(signedIpn({ vads_operation_type: 'CREDIT', vads_trans_status: 'CAPTURED' }));
    expect(res.status).toBe(200);
    expect(storage.updatePayment).not.toHaveBeenCalled();
  });

  it('replies in plain text, which PayZen stores in its Back Office log', async () => {
    const res = await request(app).post('/api/payments/webhook/bred-bank').type('form')
      .send(signedIpn({ vads_operation_type: 'CREDIT' }));
    expect(res.type).toBe('text/plain');
  });
});

describe('POST /api/payments/checkout with BRED Bank', () => {
  it('returns the signed PayZen form for the browser to post', async () => {
    const res = await request(app).post('/api/payments/checkout').send({ bookingId: 'book-123', provider: 'bred-bank' });
    expect(res.status).toBe(200);
    expect(res.body.checkoutForm.action).toBe('https://secure.payzen.eu/vads-payment/');
    expect(res.body.checkoutForm.fields).toMatchObject({ vads_amount: '12500', vads_order_id: 'pay-0001' });
    expect(res.body.checkoutForm.fields.signature).toBeTruthy();
  });
});
