import { describe, it, expect, vi } from "vitest";
// @ts-ignore - jsdom ships no type declarations
import { JSDOM } from "jsdom";
import { submitHostedPaymentForm } from "./hosted-payment-form";

function setup() {
  const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", { url: "https://acetoursvanuatu.com/payment" });
  const submit = vi.spyOn(dom.window.HTMLFormElement.prototype, "submit").mockImplementation(() => {});
  return { doc: dom.window.document as Document, submit };
}

const FORM = {
  action: "https://secure.payzen.eu/vads-payment/",
  fields: { vads_amount: "12500", vads_cust_email: "o'brien@example.com", signature: "abc+/=" },
};

describe("submitHostedPaymentForm", () => {
  it("posts every field to the gateway as a hidden input", () => {
    const { doc, submit } = setup();
    submitHostedPaymentForm(FORM, doc);

    const form = doc.querySelector("form")!;
    expect(form.method).toBe("post");
    expect(form.action).toBe(FORM.action);
    const sent = Object.fromEntries(
      Array.from(form.querySelectorAll("input")).map((i) => [i.name, i.value]),
    );
    expect(sent).toEqual(FORM.fields);
    expect(Array.from(form.querySelectorAll("input")).every((i) => i.type === "hidden")).toBe(true);
    expect(submit).toHaveBeenCalledOnce();
  });
});
