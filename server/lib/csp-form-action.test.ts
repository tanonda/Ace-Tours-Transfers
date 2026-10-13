import { describe, it, expect } from "vitest";
import { formActionSources } from "./csp-form-action.js";
import { DEFAULT_PAYMENT_URL } from "../infrastructure/payments/payzen.adapter.js";

describe("CSP form-action", () => {
  it("lets the browser post the PayZen form to the address the adapter uses", () => {
    expect(formActionSources).toContain(new URL(DEFAULT_PAYMENT_URL).origin);
  });

  it("still allows the site's own forms and nothing over plain http", () => {
    expect(formActionSources).toContain("'self'");
    expect(formActionSources.filter((s) => s.startsWith("http:"))).toEqual([]);
  });
});
