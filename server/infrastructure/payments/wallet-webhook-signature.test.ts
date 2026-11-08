import { describe, it, expect } from "vitest";
import { GooglePayAdapter } from "./google-pay.adapter.js";
import { ApplePayAdapter } from "./apple-pay.adapter.js";
import { PayPalAdapter } from "./paypal.adapter.js";
import { makePaymentGateway } from "../../test-fixtures/payment.js";

describe("wallet and PayPal webhooks fail closed", () => {
  it("Google Pay rejects a forged VPC callback when no processor is configured", async () => {
    const adapter = new GooglePayAdapter(makePaymentGateway({
      slug: "google-pay",
      credentials: { merchantId: "m1", merchantName: "Ace", environment: "TEST" },
      config: {},
    }));
    const result = await adapter.handleWebhook({
      gatewaySlug: "google-pay",
      rawEvent: { vpc_TxnResponseCode: "0", vpc_OrderInfo: "book-1" },
      headers: {},
    });
    expect(result.success).toBe(false);
    expect(result.newPaymentStatus).toBeUndefined();
  });

  it("Apple Pay rejects a VPC callback with no secure hash even when a processor is configured", async () => {
    const adapter = new ApplePayAdapter(makePaymentGateway({
      slug: "apple-pay",
      credentials: { merchantId: "m1", merchantName: "Ace", domainName: "acetours.vu", environment: "sandbox" },
      config: {
        processorCredentials: {
          merchantId: "M1",
          accessCode: "A1",
          secureHashSecret: "secret",
          apiEndpoint: "https://bank.example/vpcpay",
        },
        processorConfig: {
          integrationType: "HOSTED_REDIRECT",
          bankApiEndpointUrl: "https://bank.example/vpcpay",
          settlementAccountId: "ACC1",
          supportedCurrencies: ["VUV"],
          defaultDisplayCurrency: "VUV",
          enforce3DSecure: true,
        },
      },
    }));
    const result = await adapter.handleWebhook({
      gatewaySlug: "apple-pay",
      rawEvent: { vpc_TxnResponseCode: "0", vpc_OrderInfo: "book-1" },
      headers: {},
    });
    expect(result.success).toBe(false);
    expect(result.newPaymentStatus).toBeUndefined();
  });

  it("PayPal rejects a callback when no webhook id is configured", async () => {
    const adapter = new PayPalAdapter(makePaymentGateway({
      slug: "paypal",
      credentials: { clientId: "id", clientSecret: "secret", mode: "sandbox" },
      config: {},
    }));
    const result = await adapter.handleWebhook({
      gatewaySlug: "paypal",
      rawEvent: { event_type: "CHECKOUT.ORDER.APPROVED", resource: { id: "order-1" } },
      headers: {},
    });
    expect(result.success).toBe(false);
  });

  it("PayPal rejects a callback without transmission headers", async () => {
    const adapter = new PayPalAdapter(makePaymentGateway({
      slug: "paypal",
      credentials: {
        clientId: "id",
        clientSecret: "secret",
        mode: "sandbox",
        ipnWebhookUrl: "https://www.paypal.com/webhook/1",
      },
      config: {},
    }));
    const result = await adapter.handleWebhook({
      gatewaySlug: "paypal",
      rawEvent: '{"event_type":"CHECKOUT.ORDER.APPROVED"}',
      headers: {},
    });
    expect(result.success).toBe(false);
  });
});
