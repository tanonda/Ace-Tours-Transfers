import { describe, it, expect, afterEach } from 'vitest';
import { PaymentFactory } from './factory.js';
import { MpgsHostedCheckoutAdapter } from './mpgs.adapter.js';
import { config } from '../../config.js';
import { makePaymentGateway } from '../../test-fixtures/payment.js';

const anz = makePaymentGateway({
  slug: 'anz-egate',
  displayName: 'ANZ eGate',
  credentials: { mode: 'TEST', gatewayUrl: 'https://anzworldline.gateway.mastercard.com', testMerchantId: 'TESTACE01', testApiPassword: 'pw' },
  config: null,
});

describe('PaymentFactory server switches', () => {
  afterEach(() => {
    config.payments.anz.enabled = false;
    config.payments.nbv.enabled = false;
    config.killSwitches.paymentsPaused = false;
  });

  it('refuses ANZ unless PAYMENTS_ANZ_ENABLED is on', () => {
    config.payments.anz.enabled = false;
    expect(() => PaymentFactory.getPaymentGatewayService(anz)).toThrow(/currently unavailable/);
  });

  it('resolves ANZ when PAYMENTS_ANZ_ENABLED is on', () => {
    config.payments.anz.enabled = true;
    expect(PaymentFactory.getPaymentGatewayService(anz)).toBeInstanceOf(MpgsHostedCheckoutAdapter);
  });

  it('gives NBV its own switch', () => {
    const nbv = { ...anz, slug: 'nbv-bank', displayName: 'National Bank of Vanuatu' };
    config.payments.anz.enabled = true;
    expect(() => PaymentFactory.getPaymentGatewayService(nbv)).toThrow(/currently unavailable/);
    config.payments.nbv.enabled = true;
    expect(PaymentFactory.getPaymentGatewayService(nbv)).toBeInstanceOf(MpgsHostedCheckoutAdapter);
  });

  it('still settles a payment already in progress when the switch is off', () => {
    config.payments.anz.enabled = false;
    expect(PaymentFactory.getPaymentGatewayService(anz, 'existing')).toBeInstanceOf(MpgsHostedCheckoutAdapter);
  });

  it('stops settling too under the global payments pause', () => {
    config.payments.anz.enabled = true;
    config.killSwitches.paymentsPaused = true;
    expect(() => PaymentFactory.getPaymentGatewayService(anz, 'existing')).toThrow(/currently unavailable/);
  });
});
