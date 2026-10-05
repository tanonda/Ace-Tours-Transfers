import { describe, it, expect } from 'vitest';
import { toPublicGateway, visibleGateways, isTestModeGateway } from './public-gateway.js';
import { makePaymentGateway, makeMastercardPaymentGateway } from '../test-fixtures/payment.js';

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
