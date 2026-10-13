import { describe, it, expect, beforeAll, vi } from "vitest";
import request from "supertest";
import express, { Express } from "express";

const UUID = "90b13e31-6e1b-44e9-942c-667203409126";
const products: Record<string, { id: string; slug: string | null; category: string }> = {
  [UUID]: { id: UUID, slug: "blue-lagoon-turtle-bay-combo", category: "tour" },
  "blue-lagoon-turtle-bay-combo": { id: UUID, slug: "blue-lagoon-turtle-bay-combo", category: "tour" },
  "airport-transfer": { id: "t1", slug: "airport-transfer", category: "transfer" },
};

const articles: Record<string, { slug: string; status: string }> = {
  "live-post": { slug: "live-post", status: "published" },
  "draft-post": { slug: "draft-post", status: "draft" },
};

vi.mock("../storage.js", () => ({
  storage: {
    getProductByIdOrSlug: async (key: string) => products[key],
    getArticleBySlug: async (slug: string) => articles[slug],
  },
}));

let app: Express;
beforeAll(async () => {
  const { registerSeoRoutes } = await import("./seo.routes.js");
  app = express();
  registerSeoRoutes(app);
  app.use((_req, res) => res.status(200).send(res.locals.pageNotFound ? "not-found" : "spa"));
});

describe("product URL redirects", () => {
  it("301s an old /tours/<uuid> URL to the slug URL, keeping the query", async () => {
    const res = await request(app).get(`/tours/${UUID}?date=2026-11-01`);
    expect(res.status).toBe(301);
    expect(res.headers.location).toBe("/tours/blue-lagoon-turtle-bay-combo?date=2026-11-01");
  });

  it("301s a product filed under the wrong section", async () => {
    const res = await request(app).get("/tours/airport-transfer");
    expect(res.status).toBe(301);
    expect(res.headers.location).toBe("/transfers/airport-transfer");
  });

  it("serves the canonical slug URL", async () => {
    const res = await request(app).get("/tours/blue-lagoon-turtle-bay-combo");
    expect(res.status).toBe(200);
    expect(res.text).toBe("spa");
  });

  it("marks unknown products as not found for the static server", async () => {
    const res = await request(app).get("/tours/no-such-tour");
    expect(res.text).toBe("not-found");
  });
});

describe("blog article lookup", () => {
  it("leaves a published article alone", async () => {
    expect((await request(app).get("/blog/live-post")).text).toBe("spa");
  });

  it("marks unknown and unpublished articles as not found", async () => {
    expect((await request(app).get("/blog/no-such-post")).text).toBe("not-found");
    expect((await request(app).get("/blog/draft-post")).text).toBe("not-found");
  });
});
