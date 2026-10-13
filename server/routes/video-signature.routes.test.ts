import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import session from "express-session";

const state = vi.hoisted(() => ({ sign: vi.fn() }));

vi.mock("../storage.js", () => ({
  storage: {
    getUser: async (id: string) =>
      id === "admin1" ? { id, role: "admin", isActive: true } : id === "cust1" ? { id, role: "customer", isActive: true } : undefined,
  },
}));
vi.mock("../lib/product-translation.service.js", () => ({ withProductTranslations: async (p: unknown) => p }));
vi.mock("../infrastructure/storage/cloudinary-service.js", () => ({
  cloudinaryService: { signVideoUpload: state.sign, uploadImage: vi.fn(), cloudName: () => "demo-cloud" },
}));

let registerCatalogRoutes: (app: express.Express) => void;
// Import once: the cold import of the routes module can take several seconds here.
beforeAll(async () => {
  ({ registerCatalogRoutes } = await import("./catalog.routes.js"));
}, 60_000);

function makeApp(userId?: string, role?: string) {
  const app = express();
  app.use(express.json());
  app.use(session({ secret: "test", resave: false, saveUninitialized: true }));
  app.use((req, _res, next) => {
    if (userId) {
      (req.session as any).userId = userId;
      (req.session as any).userRole = role;
    }
    next();
  });
  registerCatalogRoutes(app);
  return app;
}

const SIG = { cloudName: "demo-cloud", apiKey: "123", timestamp: 1, folder: "ace-tours/hero-video", signature: "abc" };

beforeEach(() => {
  state.sign.mockReset();
  state.sign.mockReturnValue(SIG);
});

describe("POST /api/admin/uploads/video-signature", () => {
  it("signs an upload into the hero-video folder for an admin", async () => {
    const res = await request(makeApp("admin1", "admin")).post("/api/admin/uploads/video-signature");
    expect(res.status).toBe(200);
    expect(res.body).toEqual(SIG);
    expect(state.sign).toHaveBeenCalledWith("ace-tours/hero-video");
  });

  it("refuses visitors", async () => {
    const res = await request(makeApp()).post("/api/admin/uploads/video-signature");
    expect([401, 403]).toContain(res.status);
    expect(state.sign).not.toHaveBeenCalled();
  });

  it("refuses customers", async () => {
    const res = await request(makeApp("cust1", "customer")).post("/api/admin/uploads/video-signature");
    expect([401, 403]).toContain(res.status);
  });

  it("returns 503 when Cloudinary isn't configured", async () => {
    state.sign.mockImplementation(() => {
      throw new Error("Cloudinary service is not enabled. Please set CLOUDINARY_URL.");
    });
    const res = await request(makeApp("admin1", "admin")).post("/api/admin/uploads/video-signature");
    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/isn't set up/);
  });
});
