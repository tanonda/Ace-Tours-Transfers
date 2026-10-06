import { describe, it, expect, afterEach } from 'vitest';
import { toPublicGateway, visibleGateways, isTestModeGateway } from './public-gateway.js';
import { makePaymentGateway, makeMastercardPaymentGateway } from '../test-fixtures/payment.js';
import { config, isGatewayEnabledByEnv } from '../config.js';

// BRED with its server switch on (PAYMENTS_BRED_ENABLED=true) unless a test says otherwise.
config.payments.bred.enabled = true;

const cash = makePaymentGateway({ id: 'g-cash', slug: 'cash', credentials: {} });
const bank = makePaymentGateway({ id: 'g-bank', slug: 'manual_transfer', credentials: {} });
const bredTest = makePaymentGateway({ id: 'g-bred', slug: 'bred-bank', credentials: { shopId: '12345678', mode: 'TEST', testKey: 'k' } });
const bredLive = makePaymentGateway({ id: 'g-bred', slug: 'bred-bank', credentials: { shopId: '12345678', mode: 'PRODUCTION', testKey: 'k', productionKey: 'p' } });
const slugs = (gs: { slug: string }[]) => gs.map((g) => g.slug);

describe('isTestModeGateway', () => {
  it('is true only for a gateway whose bank credentials are in TEST mode', () => {
    expect(isTestModeGateway(bredTest)).toBe(true);
    expect(isTestModeGateway(bredLive)).toBe(false);
    expect(isTestModeGateway(cash)).toBe(false);
  });
});

describe('visibleGateways', () => {
  it('hides a gateway in TEST mode from guests', () => {
    expect(slugs(visibleGateways([cash, bank, bredTest], [], { isAdmin: false }))).toEqual(['cash', 'manual_transfer']);
  });

  it('shows a gateway in TEST mode to an admin, so they can run the test payments', () => {
    expect(slugs(visibleGateways([cash, bank, bredTest], [], { isAdmin: true }))).toEqual(['cash', 'manual_transfer', 'bred-bank']);
  });

  it('shows a gateway in PRODUCTION mode to everyone', () => {
    expect(slugs(visibleGateways([cash, bredLive], [], { isAdmin: false }))).toEqual(['cash', 'bred-bank']);
  });

  it('hides inactive gateways', () => {
    expect(slugs(visibleGateways([{ ...bredLive, active: false }], [], { isAdmin: true }))).toEqual([]);
  });

  it('still honours the bank-transfer and cash feature flags', () => {
    const flags = [{ slug: 'payment-bank-transfer', enabled: false }, { slug: 'payment-cash-on-delivery', enabled: false }];
    expect(slugs(visibleGateways([cash, bank], flags, { isAdmin: false }))).toEqual([]);
  });
});

describe("toPublicGateway", () => {
  it("never exposes credentials or gateway config", () => {
    const gateway = makeMastercardPaymentGateway();
    const view = toPublicGateway(gateway);

    expect(view).not.toHaveProperty("credentials");
    expect(view).not.toHaveProperty("config");
    expect(JSON.stringify(view)).not.toContain(JSON.stringify(gateway.credentials).slice(1, 20));
  });

  it("keeps the fields the checkout UI reads", () => {
    const gateway = makeMastercardPaymentGateway();

    expect(toPublicGateway(gateway)).toEqual({
      id: gateway.id,
      slug: gateway.slug,
      displayName: gateway.displayName,
      description: gateway.description,
      active: gateway.active,
      isDefault: gateway.isDefault,
      supportedCurrencies: gateway.supportedCurrencies,
    });
  });
});

describe('server switches (PAYMENTS_<KEY>_ENABLED)', () => {
  afterEach(() => {
    config.payments.bred.enabled = true;
    config.payments.anz.enabled = false;
    config.payments.manual.enabled = true;
  });

  it('reads each bank gateway from its own switch', () => {
    config.payments.anz.enabled = true;
    expect(isGatewayEnabledByEnv('anz-egate')).toBe(true);
    expect(isGatewayEnabledByEnv('bsp-bank')).toBe(config.payments.bsp.enabled);
    config.payments.anz.enabled = false;
    expect(isGatewayEnabledByEnv('anz-egate')).toBe(false);
    expect(isGatewayEnabledByEnv('ANZ-EGATE')).toBe(false);
  });

  it('maps bank transfer and cash to the manual switch, and leaves gateways without a switch to the admin toggle', () => {
    config.payments.manual.enabled = false;
    expect(isGatewayEnabledByEnv('manual_transfer')).toBe(false);
    expect(isGatewayEnabledByEnv('cash')).toBe(false);
    expect(isGatewayEnabledByEnv('paypal')).toBe(true);
  });

  it('hides a gateway switched off on the server, even when active in admin', () => {
    config.payments.bred.enabled = false;
    expect(slugs(visibleGateways([cash, bredLive], [], { isAdmin: true }))).toEqual(['cash']);
  });
});
