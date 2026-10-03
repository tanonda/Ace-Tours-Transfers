import type { Express } from "express";
import { storage } from "../storage.js";
import { insertArticleSchema } from "../../shared/schema.js";
import { autoTranslateProduct, getProductTranslations, upsertProductTranslation } from "../lib/product-translation.service.js";
import { slugify, uniqueSlug } from "../lib/slugify.js";
import { sanitizeServerHtml } from "../lib/sanitize-server.js";

import { requireAdmin } from "./shared.js";

export function registerContentRoutes(app: Express) {
  // ── Product Translation Admin Endpoints ─────────────────────────────────────

  // POST: trigger Google-Translate auto-fill for fr, es, zh
  app.post("/api/admin/products/:id/auto-translate", requireAdmin, async (req, res) => {
    try {
      const product = await storage.getProduct(req.params.id);
      if (!product) return res.status(404).json({ error: "Product not found" });
      await autoTranslateProduct(product);
      res.json({ ok: true, message: "Auto-translation complete for fr, es, zh. Bislama must be entered manually." });
    } catch (error: any) {
      console.error("[ROUTE] POST /api/admin/products/:id/auto-translate failed:", error?.message);
      res.status(500).json({ error: "Auto-translation failed" });
    }
  });

  // GET: fetch all saved translation rows for a product
  app.get("/api/admin/products/:id/translations", requireAdmin, async (req, res) => {
    try {
      const rows = await getProductTranslations(req.params.id);
      res.json(rows);
    } catch (error: any) {
      console.error("[ROUTE] GET /api/admin/products/:id/translations failed:", error?.message);
      res.status(500).json({ error: "Failed to fetch translations" });
    }
  });

  // PUT: save or overwrite a single locale translation
  app.put("/api/admin/products/:id/translations/:locale", requireAdmin, async (req, res) => {
    try {
      const { id, locale } = req.params;
      const product = await storage.getProduct(id);
      if (!product) return res.status(404).json({ error: "Product not found" });
      await upsertProductTranslation({ productId: id, locale, fields: req.body });
      res.json({ ok: true });
    } catch (error: any) {
      console.error("[ROUTE] PUT /api/admin/products/:id/translations/:locale failed:", error?.message);
      res.status(500).json({ error: "Failed to save translation" });
    }
  });

  // ── Articles (blog) ─────────────────────────────────────────────────────────
  // Public: published only
  app.get("/api/articles", async (_req, res) => {
    try {
      res.json(await storage.getPublishedArticles());
    } catch (e) {
      console.error("[ROUTE] GET /api/articles", e);
      res.status(500).json({ error: "Failed to load articles" });
    }
  });

  app.get("/api/articles/:slug", async (req, res) => {
    try {
      const a = await storage.getArticleBySlug(req.params.slug);
      if (!a || a.status !== "published") return res.status(404).json({ error: "Not found" });
      res.json(a);
    } catch (e) {
      console.error("[ROUTE] GET /api/articles/:slug", e);
      res.status(500).json({ error: "Failed to load article" });
    }
  });

  // Admin: full CRUD
  app.get("/api/admin/articles", requireAdmin, async (_req, res) => {
    try {
      res.json(await storage.getAllArticles());
    } catch (e) {
      console.error("[ROUTE] GET /api/admin/articles", e);
      res.status(500).json({ error: "Failed to load articles" });
    }
  });

  app.post("/api/admin/articles", requireAdmin, async (req, res) => {
    try {
      const body = { ...req.body };
      if (!body.slug || String(body.slug).trim() === "") {
        const taken = new Set((await storage.getAllArticles()).map((a) => a.slug));
        body.slug = uniqueSlug(slugify(body.title || "article"), taken);
      } else {
        body.slug = slugify(body.slug);
      }
      if (typeof body.bodyHtml === "string") body.bodyHtml = sanitizeServerHtml(body.bodyHtml);
      if (body.status === "published" && !body.publishedAt) body.publishedAt = new Date();
      const data = insertArticleSchema.parse(body);
      // normalize array columns drizzle-zod leaves optional
      const payload = { ...data, tags: (data as any).tags ?? [], relatedProductIds: (data as any).relatedProductIds ?? [] };
      const created = await storage.createArticle(payload);
      res.status(201).json(created);
    } catch (e: any) {
      if (e?.code === "23505") return res.status(409).json({ error: "Slug already exists" });
      console.error("[ROUTE] POST /api/admin/articles", e);
      res.status(400).json({ error: "Invalid article data" });
    }
  });

  app.patch("/api/admin/articles/:id", requireAdmin, async (req, res) => {
    try {
      const existing = await storage.getArticleById(req.params.id);
      if (!existing) return res.status(404).json({ error: "Not found" });
      const body = { ...req.body };
      delete body.id; delete body.createdAt; delete body.updatedAt;
      if (typeof body.slug === "string") body.slug = slugify(body.slug);
      if (typeof body.bodyHtml === "string") body.bodyHtml = sanitizeServerHtml(body.bodyHtml);
      if (body.status === "published" && !existing.publishedAt && !body.publishedAt) {
        body.publishedAt = new Date();
      }
      const updated = await storage.updateArticle(req.params.id, body as any);
      res.json(updated);
    } catch (e: any) {
      if (e?.code === "23505") return res.status(409).json({ error: "Slug already exists" });
      console.error("[ROUTE] PATCH /api/admin/articles/:id", e);
      res.status(400).json({ error: "Invalid article data" });
    }
  });

  app.delete("/api/admin/articles/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteArticle(req.params.id);
      res.status(204).end();
    } catch (e) {
      console.error("[ROUTE] DELETE /api/admin/articles/:id", e);
      res.status(500).json({ error: "Failed to delete article" });
    }
  });

}
