import { describe, it, expect } from 'vitest';
import { PayzenAdapter, mapPayzenTransStatus } from './payzen.adapter.js';
import { computePayzenSignature, verifyPayzenSignature } from './payzen-signature.js';
import { PaymentStatus } from '../../domain/payments/interfaces.js';
import { makePaymentGateway } from '../../test-fixtures/payment.js';

const TEST_KEY = 'TestKeyAbc123';
const PROD_KEY = 'ProdKeyXyz789';
const FIXED_NOW = new Date('2026-10-05T02:03:04Z');

function makeGateway(credentials: Record<string, unknown> = {}) {
  return makePaymentGateway({
    credentials: { shopId: '12345678', mode: 'TEST', testKey: TEST_KEY, productionKey: PROD_KEY, ...credentials },
    config: null,
  });
}

function makeAdapter(credentials: Record<string, unknown> = {}) {
  return new PayzenAdapter(makeGateway(credentials), { now: () => FIXED_NOW });
}

const REQUEST = {
  bookingId: 'book-123',
  amount: 12500, // whole vatu
  currency: 'VUV',
  successUrl: 'https://acetoursvanuatu.com/payment/success?booking=book-123',
  cancelUrl: 'https://acetoursvanuatu.com/payment/cancel?booking=book-123',
  customerEmail: 'guest@example.com',
  customerName: 'Jo Guest',
  metadata: { paymentId: 'pay-0001' },
};

/** An IPN as PayZen would POST it, signed with the given key. */
function makeIpn(overrides: Record<string, string> = {}, key = TEST_KEY) {
  const fields: Record<string, string> = {
    vads_amount: '12500',
    vads_ctx_mode: 'TEST',
    vads_currency: '548',
    vads_operation_type: 'DEBIT',
    vads_order_id: 'pay-0001',
    vads_site_id: '12345678',
    vads_trans_id: 'a1b2c3',
    vads_trans_status: 'AUTHORISED',
    vads_trans_uuid: 'f2d9c1a07b2e4e0f9a3c5d6e7f8a9b0c',
    vads_url_check_src: 'PAY',
    vads_hash: 'abc',
    ...overrides,
  };
  return { ...fields, signature: computePayzenSignature(fields, key) };
}

describe('PayzenAdapter', () => {
  describe('constructor', () => {
    it('rejects a gateway with no credentials', () => {
      expect(() => new PayzenAdapter(makePaymentGateway({ credentials: null }))).toThrow(/credentials/i);
    });

    it('rejects a shop ID that is not 8 digits', () => {
      expect(() => makeAdapter({ shopId: '123' })).toThrow(/Shop ID/);
    });

    it('refuses PRODUCTION mode until a production key is entered', () => {
      expect(() => makeAdapter({ mode: 'PRODUCTION', productionKey: '' })).toThrow(/production key/i);
    });
  });

  describe('initiatePayment', () => {
    it('returns a form to POST to the PayZen payment page', async () => {
      const result = await makeAdapter().initiatePayment(REQUEST);
      expect(result.success).toBe(true);
      expect(result.formPost?.action).toBe('https://secure.payzen.eu/vads-payment/');
      expect(result.redirectUrl).toBeUndefined();
    });

    it('fills the required fields for an immediate single payment in vatu', async () => {
      const { formPost } = await makeAdapter().initiatePayment(REQUEST);
      expect(formPost!.fields).toMatchObject({
        vads_action_mode: 'INTERACTIVE',
        vads_amount: '12500',
        vads_capture_delay: '0',
        vads_ctx_mode: 'TEST',
        vads_currency: '548',
        vads_page_action: 'PAYMENT',
        vads_payment_config: 'SINGLE',
        vads_site_id: '12345678',
        vads_trans_date: '20261005020304',
        vads_validation_mode: '0',
        vads_version: 'V2',
      });
    });

    it('uses our payment ID as the order ID so the IPN can find the payment', async () => {
      const { formPost } = await makeAdapter().initiatePayment(REQUEST);
      expect(formPost!.fields.vads_order_id).toBe('pay-0001');
    });

    it('sends the buyer back to our success and cancel pages', async () => {
      const { formPost } = await makeAdapter().initiatePayment(REQUEST);
      expect(formPost!.fields.vads_url_success).toBe(REQUEST.successUrl);
      expect(formPost!.fields.vads_url_cancel).toBe(REQUEST.cancelUrl);
      expect(formPost!.fields.vads_url_refused).toBe(REQUEST.cancelUrl);
      expect(formPost!.fields.vads_url_return).toBe(REQUEST.cancelUrl);
    });

    it('generates a 6-character transaction number and reports it as the transaction ID', async () => {
      const result = await makeAdapter().initiatePayment(REQUEST);
      expect(result.formPost!.fields.vads_trans_id).toMatch(/^[a-z0-9]{6}$/);
      expect(result.transactionId).toBe(result.formPost!.fields.vads_trans_id);
    });

    it('signs the form with the test key in TEST mode', async () => {
      const { formPost } = await makeAdapter().initiatePayment(REQUEST);
      expect(verifyPayzenSignature(formPost!.fields, TEST_KEY)).toBe(true);
    });

    it('signs with the production key in PRODUCTION mode', async () => {
      const { formPost } = await makeAdapter({ mode: 'PRODUCTION' }).initiatePayment(REQUEST);
      expect(formPost!.fields.vads_ctx_mode).toBe('PRODUCTION');
      expect(verifyPayzenSignature(formPost!.fields, PROD_KEY)).toBe(true);
    });

    it('posts to the payment URL BRED supplies, when one is set', async () => {
      const { formPost } = await makeAdapter({ paymentUrl: 'https://pay.example-bred.vu/vads-payment/' }).initiatePayment(REQUEST);
      expect(formPost!.action).toBe('https://pay.example-bred.vu/vads-payment/');
    });

    it('fails without our payment ID to use as the order ID', async () => {
      const result = await makeAdapter().initiatePayment({ ...REQUEST, metadata: {} });
      expect(result.success).toBe(false);
    });

    it('fails for a currency it has no PayZen code for', async () => {
      const result = await makeAdapter().initiatePayment({ ...REQUEST, currency: 'XYZ' });
      expect(result.success).toBe(false);
      expect(result.message).toMatch(/XYZ/);
    });
  });

  describe('signature confusion (values are joined with "+", field names are not signed)', () => {
    it('rejects an IPN forged by re-splitting a signed checkout form whose email carries "+" tokens', async () => {
      const adapter = makeAdapter();
      // Attacker books a second time with an email that smuggles "<victim payment>+<shop>+AUTHORISED".
      const { formPost } = await adapter.initiatePayment({
        ...REQUEST,
        customerEmail: 'pay-victim+12345678+AUTHORISED+a@b.com',
        metadata: { paymentId: 'pay-attacker' },
      });
      // Re-split the same values under field names that sort into a "paid" IPN. Each
      // filler takes the previous name plus "~" so it sorts straight after it.
      const tokens = Object.keys(formPost!.fields).filter((k) => k.startsWith('vads_')).sort()
        .map((k) => formPost!.fields[k]).join('+').split('+');
      const wanted: [string, string][] = [
        ['vads_amount', '12500'], ['vads_ctx_mode', 'TEST'], ['vads_currency', '548'],
        ['vads_order_id', 'pay-victim'], ['vads_site_id', '12345678'], ['vads_trans_status', 'AUTHORISED'],
      ];
      const forged: Record<string, string> = {};
      let prev = 'vads_0';
      tokens.forEach((token, i) => {
        const next = wanted[0];
        if (next && token === next[1]) {
          forged[next[0]] = token;
          prev = next[0];
          wanted.shift();
        } else {
          forged[`${prev}~${String(i).padStart(3, '0')}`] = token;
        }
      });
      // Before the fix every "paid" field found its token and this IPN completed the victim's payment.
      forged.signature = formPost!.fields.signature;

      const result = await adapter.handleWebhook({ gatewaySlug: 'bred-bank', rawEvent: forged });
      expect(result.newPaymentStatus).not.toBe(PaymentStatus.Completed);
    });

    it('rejects the signed checkout form replayed as an IPN', async () => {
      const adapter = makeAdapter();
      const { formPost } = await adapter.initiatePayment(REQUEST);
      const result = await adapter.handleWebhook({ gatewaySlug: 'bred-bank', rawEvent: formPost!.fields });
      expect(result.success).toBe(false);
      expect(result.newPaymentStatus).toBeUndefined();
    });

    it('never signs a value containing "+"', async () => {
      const result = await makeAdapter().initiatePayment({ ...REQUEST, successUrl: 'https://acetoursvanuatu.com/x+y' });
      expect(result.success).toBe(false);
    });

    it('does not put the guest-typed email into the signed form', async () => {
      const { formPost } = await makeAdapter().initiatePayment(REQUEST);
      expect(formPost!.fields.vads_cust_email).toBeUndefined();
    });
  });

  describe('handleWebhook (IPN)', () => {
    const ipnEvent = (rawEvent: Record<string, string>) => ({ gatewaySlug: 'bred-bank', rawEvent });

    it('completes the payment for a signed AUTHORISED notification', async () => {
      const result = await makeAdapter().handleWebhook(ipnEvent(makeIpn()));
      expect(result).toMatchObject({
        success: true,
        paymentId: 'pay-0001',
        newPaymentStatus: PaymentStatus.Completed,
        amount: 12500,
        currency: 'VUV',
        gatewayReference: 'f2d9c1a07b2e4e0f9a3c5d6e7f8a9b0c',
      });
    });

    it('rejects a notification whose signature does not match', async () => {
      const ipn = { ...makeIpn(), vads_amount: '1' };
      const result = await makeAdapter().handleWebhook(ipnEvent(ipn));
      expect(result.success).toBe(false);
      expect(result.newPaymentStatus).toBeUndefined();
    });

    it('rejects a notification for another shop', async () => {
      const result = await makeAdapter().handleWebhook(ipnEvent(makeIpn({ vads_site_id: '87654321' })));
      expect(result.success).toBe(false);
    });

    it('rejects a TEST notification while the shop is in PRODUCTION mode', async () => {
      const result = await makeAdapter({ mode: 'PRODUCTION' }).handleWebhook(ipnEvent(makeIpn()));
      expect(result.success).toBe(false);
    });

    it('accepts a PRODUCTION notification signed with the production key', async () => {
      const ipn = makeIpn({ vads_ctx_mode: 'PRODUCTION' }, PROD_KEY);
      const result = await makeAdapter({ mode: 'PRODUCTION' }).handleWebhook(ipnEvent(ipn));
      expect(result.newPaymentStatus).toBe(PaymentStatus.Completed);
    });

    it('marks a refused card as failed', async () => {
      const result = await makeAdapter().handleWebhook(ipnEvent(makeIpn({ vads_trans_status: 'REFUSED' })));
      expect(result.newPaymentStatus).toBe(PaymentStatus.Failed);
      expect(result.failureReason).toBe('payzen_refused');
    });

    it('never treats a refund notification as a payment', async () => {
      const ipn = makeIpn({ vads_operation_type: 'CREDIT', vads_trans_status: 'CAPTURED', vads_url_check_src: 'MERCH_BO' });
      const result = await makeAdapter().handleWebhook(ipnEvent(ipn));
      expect(result.success).toBe(true);
      expect(result.newPaymentStatus).toBeUndefined();
    });
  });

  describe('queryPaymentStatus', () => {
    it('explains that PayZen results arrive by IPN', async () => {
      await expect(makeAdapter().queryPaymentStatus({ paymentId: 'pay-0001' })).rejects.toThrow(/IPN/);
    });
  });
});

describe('mapPayzenTransStatus', () => {
  it.each([
    ['AUTHORISED', PaymentStatus.Completed],
    ['CAPTURED', PaymentStatus.Completed],
    ['REFUSED', PaymentStatus.Failed],
    ['CAPTURE_FAILED', PaymentStatus.Failed],
    ['ABANDONED', PaymentStatus.Cancelled],
    ['CANCELLED', PaymentStatus.Cancelled],
    ['EXPIRED', PaymentStatus.Expired],
    ['AUTHORISED_TO_VALIDATE', PaymentStatus.ManualReviewRequired],
  ])('%s → %s', (payzenStatus, expected) => {
    expect(mapPayzenTransStatus(payzenStatus)).toBe(expected);
  });

  it.each(['UNDER_VERIFICATION', 'WAITING_AUTHORISATION', 'INITIAL', 'SUSPENDED'])(
    'leaves the payment unchanged while PayZen reports %s',
    (payzenStatus) => {
      expect(mapPayzenTransStatus(payzenStatus)).toBeUndefined();
    },
  );

  it('flags a status it does not recognise for manual review', () => {
    expect(mapPayzenTransStatus('SOMETHING_NEW')).toBe(PaymentStatus.ManualReviewRequired);
  });
});
