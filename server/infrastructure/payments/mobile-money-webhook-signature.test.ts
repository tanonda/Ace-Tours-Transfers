import crypto from "crypto";
import { describe, expect, it } from "vitest";
import { WanTokMoneyAdapter } from "./wantok-money.adapter.js";
import { DigicelMobileMoneyAdapter } from "./digicel-mobile-money.adapter.js";
import { KwikPayAdapter } from "./kwikpay.adapter.js";
import { PaymentStatus } from "../../domain/payments/interfaces.js";
import { makePaymentGateway } from "../../test-fixtures/payment.js";

const API_SECRET = "test-api-secret";

const adapters = [
  ["wantok-money", WanTokMoneyAdapter],
  ["digicel-mobile-money", DigicelMobileMoneyAdapter],
  ["kwikpay", KwikPayAdapter],
] as const;

// Configured with credentials but NO signatureVerificationKey — the
// realistic state right after an admin pastes in API keys.
function makeAdapter(slug: string, Adapter: (typeof adapters)[number][1]) {
  return new Adapter(
    makePaymentGateway({
      slug,
      credentials: { merchantId: "M1", apiKey: "k", apiSecret: API_SECRET, integrationType: "API" },
      config: {},
    }),
  );
}

const forgedEvent = { status: "completed", bookingId: "book-123", metadata: { ourPaymentId: "pay-1" } };

describe.each(adapters)("%s webhook signature", (slug, Adapter) => {
  it("rejects an unsigned callback", async () => {
    const result = await makeAdapter(slug, Adapter).handleWebhook({
      gatewaySlug: slug,
      rawEvent: forgedEvent,
      signature: "",
    });

    expect(result.success).toBe(false);
    expect(result.newPaymentStatus).not.toBe(PaymentStatus.Completed);
  });

  it("rejects a callback with the wrong signature", async () => {
    const result = await makeAdapter(slug, Adapter).handleWebhook({
      gatewaySlug: slug,
      rawEvent: forgedEvent,
      signature: "0".repeat(64),
    });

    expect(result.success).toBe(false);
  });

  it("accepts a callback signed with the API secret", async () => {
    const signature = crypto.createHmac("sha256", API_SECRET).update(JSON.stringify(forgedEvent)).digest("hex");
    const result = await makeAdapter(slug, Adapter).handleWebhook({
      gatewaySlug: slug,
      rawEvent: forgedEvent,
      signature,
    });

    expect(result.success).toBe(true);
    expect(result.newPaymentStatus).toBe(PaymentStatus.Completed);
  });
});
