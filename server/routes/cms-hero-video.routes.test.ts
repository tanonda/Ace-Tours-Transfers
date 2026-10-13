import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import request from "supertest";
import express, { Express } from "express";
import session from "express-session";

const state = vi.hoisted(() => ({
  rows: {} as Record<string, any>,
  created: [] as any[],
  updated: [] as any[],
  upserts: [] as any[],
}));

vi.mock("../storage.js", () => ({
  storage: {
    getUser: async (id: string) => (id === "admin1" ? { id, role: "admin", isActive: true } : undefined),
    createCmsContent: async (data: any) => {
      state.created.push(data);
      return { id: "new", ...data };
    },
    getCmsContentItem: async (id: string) => state.rows[id],
    upsertCmsContentByLocale: async (blockSlug: string, contentKey: string, locale: string, value: string, contentType: string) => {
      const row = { blockSlug, contentKey, locale, value, contentType };
      state.upserts.push(row);
      return { id: "up", ...row };
    },
    updateCmsContent: async (id: string, data: any) => {
      state.updated.push({ id, data });
      return { ...state.rows[id], ...data };
    },
  },
}));
vi.mock("../infrastructure/audit/admin-audit-log.service.js", () => ({ adminAudit: { log: async () => undefined } }));
vi.mock("../lib/translate.js", () => ({ translateToAll: async (v: string) => ({ fr: v }) }));
vi.mock("../infrastructure/storage/cloudinary-service.js", () => ({
  cloudinaryService: { cloudName: () => "ours" },
}));

let app: Express;
beforeAll(async () => {
  const { registerSiteRoutes } = await import("./site.routes.js");
  app = express();
  app.use(express.json());
  app.use(session({ secret: "test", resave: false, saveUninitialized: true }));
  app.use((req, _res, next) => {
    (req.session as any).userId = "admin1";
    (req.session as any).userRole = "admin";
    next();
  });
  registerSiteRoutes(app);
}, 60_000);

beforeEach(() => {
  state.created = [];
  state.updated = [];
  state.upserts = [];
  state.rows = {
    v1: { id: "v1", blockSlug: "home-page", contentKey: "hero_video", locale: "en", value: "" },
    s1: { id: "s1", blockSlug: "home-page", contentKey: "hero_short_url", locale: "en", value: "https://youtu.be/dQw4w9WgXcQ" },
    t1: { id: "t1", blockSlug: "home-page", contentKey: "hero_title_part1", locale: "en", value: "Hi" },
  };
});

const create = (body: object) =>
  request(app).post("/api/admin/cms-content").send({ blockSlug: "home-page", contentType: "text", locale: "en", ...body });
const patch = (id: string, value: string) => request(app).patch(`/api/admin/cms-content/${id}`).send({ value });

describe("hero-video CMS validation", () => {
  it("saves a valid Short link as the single English row (upsert, never a duplicate)", async () => {
    const first = await create({ contentKey: "hero_short_url", value: "https://youtu.be/dQw4w9WgXcQ" });
    const second = await create({ contentKey: "hero_short_url", value: "" });
    expect([first.status, second.status]).toEqual([201, 201]);
    expect(state.created).toHaveLength(0);
    expect(state.upserts).toEqual([
      { blockSlug: "home-page", contentKey: "hero_short_url", locale: "en", value: "https://youtu.be/dQw4w9WgXcQ", contentType: "text" },
      { blockSlug: "home-page", contentKey: "hero_short_url", locale: "en", value: "", contentType: "text" },
    ]);
  });

  it("still creates other CMS rows normally", async () => {
    const res = await create({ contentKey: "hero_title_part1", value: "Hello" });
    expect(res.status).toBe(201);
    expect(state.created).toHaveLength(1);
    expect(state.upserts).toHaveLength(0);
  });

  it("rejects an invalid Short link with a readable message", async () => {
    const res = await create({ contentKey: "hero_short_url", value: "https://fb.watch/abc" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/YouTube, Instagram or Facebook/);
    expect(state.created).toHaveLength(0);
  });

  it("rejects hero-video rows in another language", async () => {
    const res = await create({ contentKey: "hero_short_url", value: "", locale: "fr" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/English/);
  });

  it("rejects a video from another Cloudinary account on update", async () => {
    const res = await patch("v1", "https://res.cloudinary.com/theirs/video/upload/v1/a.mp4");
    expect(res.status).toBe(400);
    expect(state.updated).toHaveLength(0);
  });

  it("accepts our own video and clearing it", async () => {
    expect((await patch("v1", "https://res.cloudinary.com/ours/video/upload/v1/a.mp4")).status).toBe(200);
    expect((await patch("v1", "")).status).toBe(200);
    expect(state.updated).toHaveLength(2);
  });

  it("won't move a hero setting to another language or key", async () => {
    expect((await request(app).patch("/api/admin/cms-content/v1").send({ locale: "fr" })).status).toBe(400);
    expect((await request(app).patch("/api/admin/cms-content/s1").send({ contentKey: "hero_title_part1", value: "x" })).status).toBe(400);
    expect(state.updated).toHaveLength(0);
  });

  it("won't turn another CMS row into a hero setting", async () => {
    expect((await request(app).patch("/api/admin/cms-content/t1").send({ contentKey: "hero_short_url", value: "https://youtu.be/dQw4w9WgXcQ" })).status).toBe(400);
    expect((await request(app).patch("/api/admin/cms-content/t1").send({ contentKey: "hero_video" })).status).toBe(400);
    expect(state.updated).toHaveLength(0);
  });

  it("saves only the value of a hero setting", async () => {
    const res = await request(app).patch("/api/admin/cms-content/s1").send({ value: "https://youtu.be/dQw4w9WgXcQ", sortOrder: 9 });
    expect(res.status).toBe(200);
    expect(state.updated).toEqual([{ id: "s1", data: { value: "https://youtu.be/dQw4w9WgXcQ" } }]);
  });

  it("leaves other CMS rows alone", async () => {
    expect((await patch("t1", "javascript:anything")).status).toBe(200);
  });

  it("refuses to auto-translate hero-video rows", async () => {
    const res = await request(app).post("/api/admin/cms-content/auto-translate").send({ id: "s1" });
    expect(res.status).toBe(400);
  });
});
