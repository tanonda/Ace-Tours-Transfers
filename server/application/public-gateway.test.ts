import { describe, expect, it } from "vitest";
import { toPublicGateway } from "./public-gateway.js";
import { makeMastercardPaymentGateway } from "../test-fixtures/payment.js";

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
