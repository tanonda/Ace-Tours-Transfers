import { describe, it, expect } from "vitest";
import { parseWebhookBody, webhookSignature, isSupportedWebhookGateway, wantsTextWebhookReply } from "./webhook-body.js";

describe("parseWebhookBody", () => {
  it("parses a PayZen IPN form body into fields", () => {
    const buf = Buffer.from("vads_site_id=12345678&vads_trans_status=AUTHORISED&signature=abc%2Bdef");
    expect(parseWebhookBody("bred-bank", buf)).toEqual({
      vads_site_id: "12345678",
      vads_trans_status: "AUTHORISED",
      signature: "abc+def",
    });
  });

  it("parses an MPGS notification JSON body", () => {
    const buf = Buffer.from(JSON.stringify({ order: { id: "pay-1" }, merchant: "M1" }));
    expect(parseWebhookBody("anz-egate", buf)).toEqual({ order: { id: "pay-1" }, merchant: "M1" });
  });

  it("keeps a mobile-money body as the exact raw string for HMAC verification", () => {
    const text = '{"status":"completed","amount":"100"}';
    expect(parseWebhookBody("kwikpay", Buffer.from(text))).toBe(text);
  });

  it("parses PayPal as JSON", () => {
    expect(parseWebhookBody("paypal", Buffer.from('{"event_type":"CHECKOUT.ORDER.APPROVED"}'))).toEqual({
      event_type: "CHECKOUT.ORDER.APPROVED",
    });
  });

  it("keeps Stripe's raw Buffer for signature verification", () => {
    const buf = Buffer.from('{"id":"evt_1"}');
    expect(parseWebhookBody("stripe", buf)).toBe(buf);
  });

  it("returns an empty object for an empty body and passes through parsed bodies", () => {
    expect(parseWebhookBody("bred-bank", Buffer.alloc(0))).toEqual({});
    expect(parseWebhookBody("paypal", { event_type: "x" })).toEqual({ event_type: "x" });
  });
});

describe("webhook gateway policy", () => {
  it("supports every implemented gateway and rejects manual ones", () => {
    for (const slug of ["stripe", "bred-bank", "anz-egate", "bsp-bank", "nbv-bank", "paypal", "wantok-money", "digicel-mobile-money", "kwikpay"]) {
      expect(isSupportedWebhookGateway(slug)).toBe(true);
    }
    expect(isSupportedWebhookGateway("manual")).toBe(false);
    expect(isSupportedWebhookGateway("cash")).toBe(false);
  });

  it("answers PayZen and MPGS in plain text, everyone else in JSON", () => {
    expect(wantsTextWebhookReply("bred-bank")).toBe(true);
    expect(wantsTextWebhookReply("anz-egate")).toBe(true);
    expect(wantsTextWebhookReply("stripe")).toBe(false);
    expect(wantsTextWebhookReply("kwikpay")).toBe(false);
  });
});

describe("webhookSignature", () => {
  it("reads the gateway's signature header", () => {
    expect(webhookSignature("stripe", { "stripe-signature": "t=1,v1=abc" })).toBe("t=1,v1=abc");
    expect(webhookSignature("kwikpay", { "x-kwikpay-signature": "abc" })).toBe("abc");
    expect(webhookSignature("wantok-money", { "x-wantok-signature": "abc" })).toBe("abc");
    expect(webhookSignature("paypal", {})).toBeUndefined();
  });
});
