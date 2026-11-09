import { describe, it, expect, beforeAll, vi } from "vitest";
import request from "supertest";
import express, { Express } from "express";

// No live DB: the sitemap handler only reads the product and article lists here.
// Everything else storage exposes is needed only by the detail-url routes.
vi.mock("../storage.js", () => ({
  storage: {
    getProducts: async () => [],
    getAllArticles: async () => [],
  },
}));

const POLICY_PATHS = ["/privacy-policy", "/terms-of-service", "/refund-policy"];
const SITE_URL = (process.env.APP_URL || "https://acetoursvanuatu.com").replace(/\/$/, "");

let app: Express;
beforeAll(async () => {
  const { registerSeoRoutes } = await import("./seo.routes.js");
  app = express();
  registerSeoRoutes(app);
});

// The prerenderer crawls /sitemap.xml and writes a snapshot for every URL it
// finds, so a legal page missing from the sitemap is never prerendered (and is
// invisible to the crawlers a payment provider's compliance review uses).
describe("/sitemap.xml legal pages", () => {
  it("lists the privacy, terms and refund policy pages", async () => {
    const res = await request(app).get("/sitemap.xml");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/application\/xml/);
    for (const path of POLICY_PATHS) {
      expect(res.text, path).toContain(`<loc>${SITE_URL}${path}</loc>`);
    }
  });

  it("lists each policy URL exactly once", async () => {
    const res = await request(app).get("/sitemap.xml");

    for (const path of POLICY_PATHS) {
      const occurrences = res.text.split(`<loc>${SITE_URL}${path}</loc>`).length - 1;
      expect(occurrences, path).toBe(1);
    }
  });
});
