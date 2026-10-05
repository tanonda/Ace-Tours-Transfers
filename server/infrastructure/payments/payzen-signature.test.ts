import { describe, it, expect } from 'vitest';
import { computePayzenSignature, verifyPayzenSignature } from './payzen-signature.js';

// Worked example from the PayZen Hosted Payment Page guide v3.39, chapter 13.
const GUIDE_FIELDS = {
  vads_action_mode: 'INTERACTIVE',
  vads_amount: '5124',
  vads_ctx_mode: 'TEST',
  vads_currency: '978',
  vads_page_action: 'PAYMENT',
  vads_payment_config: 'SINGLE',
  vads_site_id: '12345678',
  vads_trans_date: '20170129130025',
  vads_trans_id: '123456',
  vads_version: 'V2',
};
const GUIDE_KEY = '1122334455667788';
const GUIDE_SIGNATURE = 'ycA5Do5tNvsnKdc/eP1bj2xa19z9q3iWPy9/rpesfS0=';

describe('computePayzenSignature', () => {
  it('reproduces the HMAC-SHA-256 example from the PayZen guide', () => {
    expect(computePayzenSignature(GUIDE_FIELDS, GUIDE_KEY)).toBe(GUIDE_SIGNATURE);
  });

  it('sorts fields by name, whatever order they arrive in', () => {
    const reversed = Object.fromEntries(Object.entries(GUIDE_FIELDS).reverse());
    expect(computePayzenSignature(reversed, GUIDE_KEY)).toBe(GUIDE_SIGNATURE);
  });

  it('ignores fields that do not start with vads_', () => {
    const withExtras = { ...GUIDE_FIELDS, signature: 'old', pay: 'Pay' };
    expect(computePayzenSignature(withExtras, GUIDE_KEY)).toBe(GUIDE_SIGNATURE);
  });

  it('signs UTF-8 values such as accented names', () => {
    const a = computePayzenSignature({ ...GUIDE_FIELDS, vads_cust_last_name: 'Ménard' }, GUIDE_KEY);
    const b = computePayzenSignature({ ...GUIDE_FIELDS, vads_cust_last_name: 'Menard' }, GUIDE_KEY);
    expect(a).not.toBe(b);
  });
});

describe('verifyPayzenSignature', () => {
  it('accepts a notification carrying the correct signature', () => {
    expect(verifyPayzenSignature({ ...GUIDE_FIELDS, signature: GUIDE_SIGNATURE }, GUIDE_KEY)).toBe(true);
  });

  it('rejects a notification whose amount was altered', () => {
    const tampered = { ...GUIDE_FIELDS, vads_amount: '1', signature: GUIDE_SIGNATURE };
    expect(verifyPayzenSignature(tampered, GUIDE_KEY)).toBe(false);
  });

  it('rejects a notification signed with a different key', () => {
    expect(verifyPayzenSignature({ ...GUIDE_FIELDS, signature: GUIDE_SIGNATURE }, 'wrong-key')).toBe(false);
  });

  it('rejects a notification with no signature', () => {
    expect(verifyPayzenSignature({ ...GUIDE_FIELDS }, GUIDE_KEY)).toBe(false);
  });
});
