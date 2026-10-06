import { describe, it, expect } from 'vitest';
import { MpgsHostedCheckoutAdapter, mapMpgsOrder, parseMpgsSessionId, renderMpgsLaunchPage } from './mpgs.adapter.js';
import { PaymentStatus } from '../../domain/payments/interfaces.js';
import { AnzEGateCredentialsSchema } from '../../../shared/schema.js';
import { makePaymentGateway } from '../../test-fixtures/payment.js';

const HOST = 'https://anzworldline.gateway.mastercard.com';
const SESSION_ID = 'SESSION0002776555072I3708178F27';

const CREDENTIALS = {
  mode: 'TEST',
  gatewayUrl: HOST,
  apiVersion: '100',
  testMerchantId: 'TESTACETOURS01',
  testApiPassword: 'test-api-pass',
  testNotificationSecret: 'test-notify-secret',
  productionMerchantId: 'ACETOURS01',
  productionApiPassword: 'prod-api-pass',
  productionNotificationSecret: 'prod-notify-secret',
};

type Call = { url: string; method: string; headers: Record<string, string>; body?: any };

/** A fake ANZ: records calls and answers with the given (status, json). */
function fakeAnz(reply: (call: Call) => { status: number; json: unknown }) {
  const calls: Call[] = [];
  const fetchFn = (async (url: string, init: any) => {
    const call: Call = { url, method: init.method, headers: init.headers, body: init.body ? JSON.parse(init.body) : undefined };
    calls.push(call);
    const { status, json } = reply(call);
    return new Response(JSON.stringify(json), { status, headers: { 'Content-Type': 'application/json' } });
  }) as unknown as typeof fetch;
  return { calls, fetchFn };
}

function makeAdapter(fetchFn: typeof fetch, credentials: Record<string, unknown> = {}, slug = 'anz-egate') {
  const gateway = makePaymentGateway({ slug, displayName: 'ANZ eGate', credentials: { ...CREDENTIALS, ...credentials }, config: null });
  return new MpgsHostedCheckoutAdapter(gateway, { fetch: fetchFn });
}

const REQUEST = {
  bookingId: 'b0a1c2d3-1111-2222-3333-444455556666',
  amount: 12500, // whole vatu
  currency: 'VUV',
  successUrl: 'https://acetoursvanuatu.com/payment/success?booking=b0a1c2d3-1111-2222-3333-444455556666',
  cancelUrl: 'https://acetoursvanuatu.com/payment/cancel?booking=b0a1c2d3-1111-2222-3333-444455556666',
  customerEmail: 'guest@example.com',
  customerName: 'Jo Guest',
  metadata: { paymentId: 'pay-0001' },
};

const capturedOrder = (overrides: Record<string, unknown> = {}) => ({
  result: 'SUCCESS', id: 'pay-0001', status: 'CAPTURED', amount: 12500, totalCapturedAmount: 12500,
  currency: 'VUV', reference: REQUEST.bookingId, ...overrides,
});

describe('AnzEGateCredentialsSchema', () => {
  it('accepts test-only credentials with blank production fields, as the admin form sends them', () => {
    const parsed = AnzEGateCredentialsSchema.safeParse({ ...CREDENTIALS, apiVersion: '', productionMerchantId: '', productionApiPassword: '' });
    expect(parsed.success).toBe(true);
  });

  it('rejects a non-https gateway URL and a merchant ID that could alter the API path', () => {
    expect(AnzEGateCredentialsSchema.safeParse({ ...CREDENTIALS, gatewayUrl: 'http://anz.example' }).success).toBe(false);
    expect(AnzEGateCredentialsSchema.safeParse({ ...CREDENTIALS, testMerchantId: 'TEST/../x' }).success).toBe(false);
  });
});

describe('MpgsHostedCheckoutAdapter constructor', () => {
  it('only serves MPGS gateways', () => {
    const { fetchFn } = fakeAnz(() => ({ status: 200, json: {} }));
    expect(() => makeAdapter(fetchFn, {}, 'bred-bank')).toThrow(/not an MPGS gateway/);
  });

  it('refuses PRODUCTION mode without production credentials', () => {
    const { fetchFn } = fakeAnz(() => ({ status: 200, json: {} }));
    expect(() => makeAdapter(fetchFn, { mode: 'PRODUCTION', productionApiPassword: '' })).toThrow(/production/i);
  });
});

describe('initiatePayment', () => {
  it('creates a PURCHASE checkout session for the test merchant and returns our launch URL', async () => {
    const { calls, fetchFn } = fakeAnz(() => ({ status: 201, json: { result: 'SUCCESS', session: { id: SESSION_ID }, successIndicator: 'abc' } }));
    const res = await makeAdapter(fetchFn).initiatePayment(REQUEST);

    expect(res.success).toBe(true);
    expect(res.redirectUrl).toBe(`https://acetoursvanuatu.com/api/payments/checkout/anz-egate?session=${SESSION_ID}`);
    expect(res.transactionId).toBe('pay-0001');

    const call = calls[0];
    expect(call.method).toBe('POST');
    expect(call.url).toBe(`${HOST}/api/rest/version/100/merchant/TESTACETOURS01/session`);
    expect(call.headers.Authorization).toBe(`Basic ${Buffer.from('merchant.TESTACETOURS01:test-api-pass').toString('base64')}`);
    expect(call.body.apiOperation).toBe('INITIATE_CHECKOUT');
    expect(call.body.interaction.operation).toBe('PURCHASE');
    expect(call.body.order).toMatchObject({ id: 'pay-0001', reference: REQUEST.bookingId, amount: '12500', currency: 'VUV' });
    expect(call.body.interaction.returnUrl).toBe(
      `https://acetoursvanuatu.com/api/payments/callback/anz-egate?order=pay-0001&booking=${REQUEST.bookingId}&outcome=return`,
    );
    expect(call.body.interaction.cancelUrl).toContain('outcome=cancel');
    expect(call.body.checkoutMode).toBe('WEBSITE');
    // After the last declined attempt the guest is sent back rather than stuck at the bank.
    expect(call.body.interaction.redirectMerchantUrl).toContain('outcome=failed');
    expect(call.body.interaction.retryAttemptCount).toBe(3);
  });

  it('sends BSP and NBV guests to their own bank\'s callback and launch paths', async () => {
    const { calls, fetchFn } = fakeAnz(() => ({ status: 201, json: { result: 'SUCCESS', session: { id: SESSION_ID } } }));
    const res = await makeAdapter(fetchFn, {}, 'nbv-bank').initiatePayment(REQUEST);
    expect(res.redirectUrl).toBe(`https://acetoursvanuatu.com/api/payments/checkout/nbv-bank?session=${SESSION_ID}`);
    expect(calls[0].body.interaction.returnUrl).toContain('/api/payments/callback/nbv-bank?order=pay-0001');
  });

  it('uses the production merchant and password in PRODUCTION mode', async () => {
    const { calls, fetchFn } = fakeAnz(() => ({ status: 201, json: { result: 'SUCCESS', session: { id: SESSION_ID } } }));
    await makeAdapter(fetchFn, { mode: 'PRODUCTION' }).initiatePayment(REQUEST);
    expect(calls[0].url).toContain('/merchant/ACETOURS01/session');
    expect(calls[0].headers.Authorization).toBe(`Basic ${Buffer.from('merchant.ACETOURS01:prod-api-pass').toString('base64')}`);
  });

  it('fails cleanly when ANZ rejects the session', async () => {
    const { fetchFn } = fakeAnz(() => ({ status: 400, json: { result: 'ERROR', error: { cause: 'INVALID_REQUEST', explanation: 'Invalid currency' } } }));
    const res = await makeAdapter(fetchFn).initiatePayment(REQUEST);
    expect(res.success).toBe(false);
    expect(res.message).toContain('Invalid currency');
  });

  it('rejects a currency with decimals rather than mis-scaling the amount', async () => {
    const { calls, fetchFn } = fakeAnz(() => ({ status: 201, json: {} }));
    const res = await makeAdapter(fetchFn).initiatePayment({ ...REQUEST, currency: 'AUD' });
    expect(res.success).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it('does not hand an odd session ID to the launch page', async () => {
    const { fetchFn } = fakeAnz(() => ({ status: 201, json: { result: 'SUCCESS', session: { id: '"><script>' } } }));
    expect((await makeAdapter(fetchFn).initiatePayment(REQUEST)).success).toBe(false);
  });
});

describe('handleWebhook — guest returns to the site', () => {
  it('confirms only after Retrieve Order says CAPTURED in full', async () => {
    const { calls, fetchFn } = fakeAnz(() => ({ status: 200, json: capturedOrder() }));
    const res = await makeAdapter(fetchFn).handleWebhook({ gatewaySlug: 'anz-egate', rawEvent: { order: 'pay-0001', outcome: 'return' } });

    expect(calls[0].method).toBe('GET');
    expect(calls[0].url).toBe(`${HOST}/api/rest/version/100/merchant/TESTACETOURS01/order/pay-0001`);
    expect(res).toMatchObject({
      success: true, paymentId: 'pay-0001', bookingId: REQUEST.bookingId,
      newPaymentStatus: PaymentStatus.Completed, amount: 12500, currency: 'VUV',
    });
  });

  it('marks a declined order failed', async () => {
    const { fetchFn } = fakeAnz(() => ({ status: 200, json: capturedOrder({ status: 'FAILED', totalCapturedAmount: 0 }) }));
    const res = await makeAdapter(fetchFn).handleWebhook({ gatewaySlug: 'anz-egate', rawEvent: { order: 'pay-0001', outcome: 'return' } });
    expect(res.newPaymentStatus).toBe(PaymentStatus.Failed);
  });

  it('cancels when the guest backs out before ANZ has any order', async () => {
    const { fetchFn } = fakeAnz(() => ({ status: 400, json: { result: 'ERROR', error: { cause: 'INVALID_REQUEST', explanation: 'Unable to find order = pay-0001' } } }));
    const res = await makeAdapter(fetchFn).handleWebhook({ gatewaySlug: 'anz-egate', rawEvent: { order: 'pay-0001', outcome: 'cancel' } });
    expect(res.newPaymentStatus).toBe(PaymentStatus.Cancelled);
  });

  it('leaves the payment alone when ANZ cannot be reached', async () => {
    const fetchFn = (async () => { throw new Error('ETIMEDOUT'); }) as unknown as typeof fetch;
    const res = await makeAdapter(fetchFn).handleWebhook({ gatewaySlug: 'anz-egate', rawEvent: { order: 'pay-0001', outcome: 'return' } });
    expect(res.success).toBe(true);
    expect(res.newPaymentStatus).toBeUndefined();
  });

  it('fails the payment when the bank sends the guest back after the last declined attempt', async () => {
    const { fetchFn } = fakeAnz(() => ({ status: 200, json: capturedOrder({ status: 'AUTHENTICATION_INITIATED', totalCapturedAmount: 0 }) }));
    const res = await makeAdapter(fetchFn).handleWebhook({ gatewaySlug: 'anz-egate', rawEvent: { order: 'pay-0001', outcome: 'failed' } });
    expect(res.newPaymentStatus).toBe(PaymentStatus.Failed);
  });

  it('ignores a forged "paid" query string: only the order lookup counts', async () => {
    const { fetchFn } = fakeAnz(() => ({ status: 200, json: capturedOrder({ status: 'FAILED', totalCapturedAmount: 0 }) }));
    const res = await makeAdapter(fetchFn).handleWebhook({
      gatewaySlug: 'anz-egate', rawEvent: { order: 'pay-0001', outcome: 'return', status: 'CAPTURED', result: 'SUCCESS' },
    });
    expect(res.newPaymentStatus).toBe(PaymentStatus.Failed);
  });
});

describe('handleWebhook — ANZ notification', () => {
  const notification = { merchant: 'TESTACETOURS01', order: { id: 'pay-0001', status: 'CAPTURED' }, result: 'SUCCESS' };

  it('rejects a notification with the wrong secret without calling ANZ', async () => {
    const { calls, fetchFn } = fakeAnz(() => ({ status: 200, json: capturedOrder() }));
    const res = await makeAdapter(fetchFn).handleWebhook({
      gatewaySlug: 'anz-egate', rawEvent: notification, headers: { 'x-notification-secret': 'wrong' },
    });
    expect(res.success).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it('rejects a notification for the other environment\'s merchant', async () => {
    const { fetchFn } = fakeAnz(() => ({ status: 200, json: capturedOrder() }));
    const res = await makeAdapter(fetchFn).handleWebhook({
      gatewaySlug: 'anz-egate', rawEvent: { ...notification, merchant: 'ACETOURS01' }, headers: { 'x-notification-secret': 'test-notify-secret' },
    });
    expect(res.success).toBe(false);
  });

  it('confirms from a genuine notification after re-reading the order', async () => {
    const { calls, fetchFn } = fakeAnz(() => ({ status: 200, json: capturedOrder() }));
    const res = await makeAdapter(fetchFn).handleWebhook({
      gatewaySlug: 'anz-egate', rawEvent: notification, headers: { 'x-notification-secret': 'test-notify-secret' },
    });
    expect(calls).toHaveLength(1);
    expect(res.newPaymentStatus).toBe(PaymentStatus.Completed);
  });

  it('never fails a payment from a notification: the guest may still retry the card', async () => {
    const { fetchFn } = fakeAnz(() => ({ status: 200, json: capturedOrder({ status: 'FAILED', totalCapturedAmount: 0 }) }));
    const res = await makeAdapter(fetchFn).handleWebhook({
      gatewaySlug: 'anz-egate', rawEvent: notification, headers: { 'x-notification-secret': 'test-notify-secret' },
    });
    expect(res.success).toBe(true);
    expect(res.newPaymentStatus).toBeUndefined();
  });
});

describe('mapMpgsOrder', () => {
  it('sends partial captures and held authorisations to a person', () => {
    expect(mapMpgsOrder({ status: 'CAPTURED', amount: 12500, totalCapturedAmount: 5000 })).toBe(PaymentStatus.ManualReviewRequired);
    expect(mapMpgsOrder({ status: 'AUTHORIZED', amount: 12500 })).toBe(PaymentStatus.ManualReviewRequired);
    expect(mapMpgsOrder({ status: 'SOMETHING_NEW' })).toBe(PaymentStatus.ManualReviewRequired);
  });

  it('leaves in-progress 3-D Secure orders alone', () => {
    expect(mapMpgsOrder({ status: 'AUTHENTICATION_INITIATED' })).toBeUndefined();
  });
});

describe('queryPaymentStatus (reconciliation)', () => {
  it('leaves an unpaid payment link open (no order at the bank yet)', async () => {
    const { fetchFn } = fakeAnz(() => ({ status: 400, json: { result: 'ERROR', error: { cause: 'INVALID_REQUEST', explanation: 'Unable to find order = pay-0001' } } }));
    const res = await makeAdapter(fetchFn).queryPaymentStatus({ paymentId: 'pay-0001' });
    expect(res.status).toBe(PaymentStatus.Processing);
  });

  it('reports a captured order as completed', async () => {
    const { fetchFn } = fakeAnz(() => ({ status: 200, json: capturedOrder() }));
    const res = await makeAdapter(fetchFn).queryPaymentStatus({ paymentId: 'pay-0001' });
    expect(res.status).toBe(PaymentStatus.Completed);
  });
});

describe('createPaymentLink', () => {
  const LINK = {
    paymentId: 'pay-0001', bookingId: REQUEST.bookingId, amount: 12500, currency: 'VUV',
    expiresAt: new Date('2026-10-09T08:00:00.000Z'), siteOrigin: 'https://acetoursvanuatu.com',
  };

  it('asks the bank for a PAYMENT_LINK checkout of the same order and returns its URL', async () => {
    const url = `${HOST}/pbl/PAYLINK0001060519617G19059484L2`;
    const { calls, fetchFn } = fakeAnz(() => ({ status: 201, json: { result: 'SUCCESS', checkoutMode: 'PAYMENT_LINK', paymentLink: { id: 'PAYLINK0001060519617G19059484L2', url } } }));
    const res = await makeAdapter(fetchFn).createPaymentLink(LINK);

    expect(res).toEqual({ success: true, url, linkId: 'PAYLINK0001060519617G19059484L2' });
    const body = calls[0].body;
    expect(calls[0].url).toBe(`${HOST}/api/rest/version/100/merchant/TESTACETOURS01/session`);
    expect(body.checkoutMode).toBe('PAYMENT_LINK');
    expect(body.interaction.operation).toBe('PURCHASE');
    expect(body.order).toMatchObject({ id: 'pay-0001', reference: REQUEST.bookingId, amount: '12500', currency: 'VUV' });
    expect(body.paymentLink).toMatchObject({ expiryDateTime: '2026-10-09T08:00:00.000Z', numberOfAllowedAttempts: 25 });
    expect(body.paymentLink.errorUrl).toContain('reason=link_unavailable');
  });

  it('refuses a link that does not point at the bank\'s own gateway', async () => {
    const { fetchFn } = fakeAnz(() => ({ status: 201, json: { result: 'SUCCESS', paymentLink: { id: 'x', url: 'https://evil.example/pbl/x' } } }));
    expect((await makeAdapter(fetchFn).createPaymentLink(LINK)).success).toBe(false);
  });

  it('passes on the bank\'s reason when it refuses', async () => {
    const { fetchFn } = fakeAnz(() => ({ status: 400, json: { result: 'ERROR', error: { explanation: 'Payment links not enabled for merchant' } } }));
    const res = await makeAdapter(fetchFn).createPaymentLink(LINK);
    expect(res.success).toBe(false);
    expect(!res.success && res.message).toContain('Payment links not enabled');
  });
});

describe('refundPayment', () => {
  it('PUTs a REFUND transaction on the order', async () => {
    const { calls, fetchFn } = fakeAnz(() => ({ status: 201, json: { result: 'SUCCESS' } }));
    const res = await makeAdapter(fetchFn).refundPayment({ id: 'pay-0001', amount: 12500, currency: 'VUV' } as any, 5000);
    expect(res.status).toBe(PaymentStatus.Refunded);
    expect(calls[0].method).toBe('PUT');
    expect(calls[0].url).toMatch(/\/order\/pay-0001\/transaction\/refund-[0-9a-f]{12}$/);
    expect(calls[0].body).toEqual({ apiOperation: 'REFUND', transaction: { amount: '5000', currency: 'VUV' } });
  });
});

describe('launch page', () => {
  it('accepts only plain session IDs', () => {
    expect(parseMpgsSessionId(SESSION_ID)).toBe(SESSION_ID);
    expect(parseMpgsSessionId('SESSION"</script>')).toBeUndefined();
    expect(parseMpgsSessionId(['a'])).toBeUndefined();
  });

  it('loads only ANZ\'s checkout.js and our nonce\'d script', () => {
    const { html, csp } = renderMpgsLaunchPage(`${HOST}/static/checkout/checkout.min.js`, SESSION_ID, '/payment/cancel');
    const nonce = /nonce-([^']+)'/.exec(csp)![1];
    expect(csp).toContain(`script-src 'nonce-${nonce}' ${HOST}`);
    expect(csp).toContain("default-src 'none'");
    expect(html).toContain(`<script src="${HOST}/static/checkout/checkout.min.js"`);
    expect(html).toContain(`Checkout.configure({ session: { id: "${SESSION_ID}" } })`);
    expect(html.match(new RegExp(`nonce="${nonce.replace(/[+/=]/g, '\\$&')}"`, 'g'))).toHaveLength(2);
  });
});
