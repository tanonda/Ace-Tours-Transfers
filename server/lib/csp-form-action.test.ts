import { describe, it, expect, beforeEach } from "vitest";
import express from "express";
import helmet from "helmet";
import request from "supertest";
import {
  FORM_ACTION_PLACEHOLDER,
  HOSTED_PAYMENT_FORM_ORIGINS,
  applyFormActionSources,
  getConfiguredHostedPaymentUrl,
  getFormActionSources,
  setConfiguredHostedPaymentUrl,
} from "./csp-form-action.js";
import { DEFAULT_PAYMENT_URL } from "../infrastructure/payments/payzen.adapter.js";

const helmetHeader = () =>
  `default-src 'self'; form-action 'self' ${FORM_ACTION_PLACEHOLDER}; object-src 'none'`;

beforeEach(() => setConfiguredHostedPaymentUrl(null));

describe("CSP form-action", () => {
  it("allows the standard PayZen page the adapter uses by default", () => {
    expect(getFormActionSources()).toContain(new URL(DEFAULT_PAYMENT_URL).origin);
  });

  it("still allows the site's own forms and nothing over plain http", () => {
    const sources = getFormActionSources();
    expect(sources).toContain("'self'");
    expect(sources.filter((s) => s.startsWith("http:"))).toEqual([]);
  });

  it("follows a BRED-specific Payment URL without a code change", () => {
    setConfiguredHostedPaymentUrl("https://pay.bred.vu/vads-payment/");
    expect(getFormActionSources()).toContain("https://pay.bred.vu");
    expect(getConfiguredHostedPaymentUrl()).toBe("https://pay.bred.vu/vads-payment/");
  });

  it("replaces the helmet sentinel with 'self' plus every hosted payment page", () => {
    setConfiguredHostedPaymentUrl("https://pay.bred.vu/vads-payment/");
    const header = applyFormActionSources(helmetHeader());
    expect(header).not.toContain(FORM_ACTION_PLACEHOLDER);
    expect(header).toContain("form-action 'self' https://secure.payzen.eu https://pay.bred.vu;");
  });

  it("keeps the standard page when the Payment URL is blank", () => {
    expect(applyFormActionSources(helmetHeader())).toContain(
      `form-action 'self' ${HOSTED_PAYMENT_FORM_ORIGINS[0]};`,
    );
  });

  it("ignores malformed and plain-http Payment URLs instead of widening CSP", () => {
    for (const unsafe of ["http://pay.bred.vu/vads-payment/", "not a url", "javascript:alert(1)"]) {
      setConfiguredHostedPaymentUrl(unsafe);
      expect(getFormActionSources()).toEqual(["'self'", ...HOSTED_PAYMENT_FORM_ORIGINS]);
    }
  });

  it("leaves a header without the sentinel untouched", () => {
    const foreign = "default-src 'self'; form-action 'self';";
    expect(applyFormActionSources(foreign)).toBe(foreign);
  });
});

describe("helmet CSP wiring", () => {
  it("serves the live allowlist instead of the sentinel", async () => {
    setConfiguredHostedPaymentUrl("https://pay.bred.vu/vads-payment/");

    // Mirrors server/index.ts: helmet writes the CSP header with the sentinel,
    // then the next middleware swaps in the live hosted-payment origins.
    const app = express();
    app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          formAction: ["'self'", FORM_ACTION_PLACEHOLDER],
        } as any,
      },
    }));
    app.use((_req, res, next) => {
      const policy = res.getHeader("Content-Security-Policy");
      if (typeof policy === "string") {
        res.setHeader("Content-Security-Policy", applyFormActionSources(policy));
      }
      next();
    });
    app.get("/", (_req, res) => res.send("ok"));

    const res = await request(app).get("/");
    const csp = res.headers["content-security-policy"];

    expect(res.status).toBe(200);
    expect(csp).not.toContain(FORM_ACTION_PLACEHOLDER);
    expect(csp).toContain(`form-action 'self' ${HOSTED_PAYMENT_FORM_ORIGINS[0]} https://pay.bred.vu;`);
  });
});
