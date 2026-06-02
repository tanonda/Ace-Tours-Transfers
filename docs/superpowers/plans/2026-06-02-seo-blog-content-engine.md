# SEO Blog / Content Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a database-backed blog/guides engine (admin authoring UI + public `/blog` pages) that publishes SEO articles with BlogPosting JSON-LD, auto-prerendered via the sitemap, funneling readers to bookings.

**Architecture:** A new `articles` table mirrors the existing `products` SEO-friendly pattern. Public read + admin CRUD routes follow the existing product/`requireAdmin` conventions. Public `/blog` listing + `/blog/:slug` article pages reuse `Layout`, `SEO` (`extraJsonLd` → BlogPosting), `sanitizeHtml` (DOMPurify), and `TourCard`. The admin authoring page reuses the in-repo TipTap editor. Published article URLs are added to the dynamic sitemap, so the existing prerender pipeline snapshots them automatically.

**Tech Stack:** TypeScript, Drizzle ORM + drizzle-zod (Postgres), Express, React 19 + wouter + @tanstack/react-query, TipTap (already a dep), DOMPurify (already a dep), Vitest.

---

## Background the engineer needs

- **Spec:** `docs/superpowers/specs/2026-06-02-seo-blog-content-engine-design.md` — read it.
- **Schema** lives in `shared/schema.ts`. Imports at top:
  `import { pgTable, text, varchar, integer, timestamp, decimal, boolean, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";` and `createInsertSchema` from `"drizzle-zod"`. Products use `varchar("id").primaryKey().default(sql\`gen_random_uuid()\`)`; arrays use `text("x").array()`. Insert schemas: `export const insertProductSchema = createInsertSchema(products).omit({ id: true });`.
- **Storage:** `server/storage.ts` has `export interface IStorage { ... }` (line ~76), `export class DatabaseStorage implements IStorage { ... }` (~253), and `export const storage = new DatabaseStorage()` (~1698). Product methods use `this.withRetry(() => db.select()...)` and `db.insert(products).values(x as any).returning()`. Import `eq` from drizzle-orm (already imported in the file).
- **Routes:** `server/routes.ts`. Pattern: `const validatedData = insertProductSchema.parse(body); const product = await storage.createProduct(validatedData); res.status(201).json(product);` wrapped in try/catch → `res.status(400).json({ error: ... })`. Admin routes use `requireAdmin` middleware (defined ~line 276): `app.post("/api/admin/x", requireAdmin, async (req,res) => {...})`. The sitemap handler is `app.get("/sitemap.xml", ...)` (~line 344) with a `staticPages` array, a `SEO_LANDING_SLUGS` loop, and a `productPages = products.filter(...).map(...)`; `const allPages = [...staticPages, ...productPages];`.
- **Migrations:** `migrations/00NN_name.sql`, applied by `server/migrate.ts` (`runIdempotentMigrations`) which reads each `.sql` and splits on statement boundaries. Use idempotent DDL (`CREATE TABLE IF NOT EXISTS`). Latest is `0021_*`; the new one is `0022_articles.sql`.
- **Sanitizer:** `client/src/components/shared-detail-components.tsx` exports `sanitizeHtml(html)` (DOMPurify). For **server-side** sanitize, the server bundles `dompurify` + needs a DOM; use `isomorphic-dompurify` ONLY if already present — CHECK FIRST. If not present, sanitize via a small server util using `dompurify` with `jsdom` IF available; otherwise fall back to a conservative regex strip AND keep client-side `sanitizeHtml` on render (defence-in-depth). Task 4 resolves this concretely.
- **TipTap editor:** pattern in `client/src/pages/admin/cms.tsx` — `import { useEditor, EditorContent } from '@tiptap/react'; import StarterKit from '@tiptap/starter-kit'; import Link from '@tiptap/extension-link'; import TextAlign from '@tiptap/extension-text-align';`.
- **Admin page pattern:** `client/src/pages/admin/products.tsx` — `useQuery`/`useMutation`/`useQueryClient`, `apiRequest("DELETE", url)` from `@/lib/queryClient`, a dialog component in `client/src/components/admin/`.
- **Public product page pattern:** `client/src/pages/tour-detail.tsx` and `client/src/pages/tours.tsx` (listing). `SEO` component: `client/src/components/seo.tsx` — accepts `title`, `description`, `image`, `imageAlt`, `keywords: string[]`, `extraJsonLd: Record<string,unknown>`.
- **Related-product matcher:** `client/src/lib/product-filters.ts` `cleanProductList(items)`; products fetched via `useLocalizedProducts()` (`client/src/hooks/useLocalizedProducts.ts`).
- **Routes file:** `client/src/App.tsx` — lazy imports `const X = lazy(() => import("@/pages/x"))`; public routes in the second `<Switch>` ending `<Route component={NotFound} />`; admin routes are `<Route path="/admin/x"><ProtectedRoute><X/></ProtectedRoute></Route>` (check exact guard wrapper in that file).
- **Test commands:** single file `npx vitest run <path>`; full suite `npm test`. Vitest `include` covers `server/**`, `shared/**`, and `client/src/lib/**` (added in Phase 4). Put pure-logic tests under `server/` or `client/src/lib/` so they're picked up.

## File structure

```
shared/schema.ts                                   (MOD) articles table + insertArticleSchema + types
migrations/0022_articles.sql                        (NEW) create table
server/lib/slugify.ts                               (NEW) slugify() + uniqueSlug()
server/lib/slugify.test.ts                          (NEW)
server/lib/sanitize-server.ts                       (NEW) sanitizeServerHtml()
server/lib/sanitize-server.test.ts                  (NEW)
server/lib/article-sitemap.ts                       (NEW) publishedArticleSitemapEntries()
server/lib/article-sitemap.test.ts                  (NEW)
server/storage.ts                                   (MOD) IStorage + DatabaseStorage article methods
server/routes.ts                                    (MOD) public + admin article routes; sitemap inclusion
client/src/lib/blog-jsonld.ts                       (NEW) buildBlogPostingJsonLd()
client/src/lib/blog-jsonld.test.ts                  (NEW)
client/src/lib/api-blog.ts                          (NEW) fetchArticles/fetchArticle client helpers
client/src/components/blog/article-card.tsx          (NEW) listing card
client/src/pages/blog.tsx                            (NEW) /blog listing
client/src/pages/blog-article.tsx                    (NEW) /blog/:slug
client/src/components/admin/article-editor-dialog.tsx (NEW) TipTap editor dialog
client/src/pages/admin/blog.tsx                       (NEW) admin list + CRUD
client/src/App.tsx                                   (MOD) /blog, /blog/:slug, /admin/blog routes
```

---

## Task 1: `articles` table + schema + types

**Files:**
- Modify: `shared/schema.ts`
- Test: `shared/schema.articles.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// shared/schema.articles.test.ts
import { describe, it, expect } from 'vitest';
import { insertArticleSchema } from './schema';

const valid = {
  slug: 'things-to-do-in-port-vila',
  title: 'Things to do in Port Vila',
  bodyHtml: '<p>Lots to do.</p>',
  status: 'draft' as const,
};

describe('insertArticleSchema', () => {
  it('accepts a minimal valid article', () => {
    const parsed = insertArticleSchema.parse(valid);
    expect(parsed.slug).toBe('things-to-do-in-port-vila');
    expect(parsed.title).toBe('Things to do in Port Vila');
  });

  it('rejects missing title', () => {
    const { title, ...rest } = valid;
    expect(() => insertArticleSchema.parse(rest)).toThrow();
  });

  it('rejects missing slug', () => {
    const { slug, ...rest } = valid;
    expect(() => insertArticleSchema.parse(rest)).toThrow();
  });

  it('rejects missing bodyHtml', () => {
    const { bodyHtml, ...rest } = valid;
    expect(() => insertArticleSchema.parse(rest)).toThrow();
  });

  it('rejects an invalid status', () => {
    expect(() => insertArticleSchema.parse({ ...valid, status: 'archived' })).toThrow();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run shared/schema.articles.test.ts`
Expected: FAIL — `insertArticleSchema` is not exported.

- [ ] **Step 3: Add the table + schema + types**

In `shared/schema.ts`, add near the other tables (e.g. after the `contentBlocks`/`cmsContent` block). `sql` is already imported in this file (used by other tables); `z` is imported (used by other insert schemas).

```ts
export const articles = pgTable("articles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  excerpt: text("excerpt"),
  bodyHtml: text("body_html").notNull(),
  coverImage: text("cover_image"),
  imageAlt: text("image_alt"),
  author: text("author"),
  tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
  relatedProductIds: text("related_product_ids").array().notNull().default(sql`'{}'::text[]`),
  status: text("status").notNull().default("draft"), // 'draft' | 'published'
  publishedAt: timestamp("published_at"),
  seoTitle: text("seo_title"),
  seoDescription: text("seo_description"),
  seoKeywords: text("seo_keywords"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertArticleSchema = createInsertSchema(articles, {
  status: z.enum(["draft", "published"]).default("draft"),
}).omit({ id: true, createdAt: true, updatedAt: true });

export type Article = typeof articles.$inferSelect;
export type InsertArticle = z.infer<typeof insertArticleSchema>;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run shared/schema.articles.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add shared/schema.ts shared/schema.articles.test.ts
git commit -m "feat(blog): add articles table, insert schema, and types"
```

---

## Task 2: Database migration

**Files:**
- Create: `migrations/0022_articles.sql`

- [ ] **Step 1: Write the migration (idempotent DDL)**

```sql
-- Migration 0022: Articles (blog / content engine)
-- A standalone table for SEO blog posts. Mirrors the products SEO pattern.
CREATE TABLE IF NOT EXISTS articles (
  id                   varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                 text NOT NULL UNIQUE,
  title                text NOT NULL,
  excerpt              text,
  body_html            text NOT NULL,
  cover_image          text,
  image_alt            text,
  author               text,
  tags                 text[] NOT NULL DEFAULT '{}'::text[],
  related_product_ids  text[] NOT NULL DEFAULT '{}'::text[],
  status               text NOT NULL DEFAULT 'draft',
  published_at         timestamp,
  seo_title            text,
  seo_description      text,
  seo_keywords         text,
  created_at           timestamp NOT NULL DEFAULT now(),
  updated_at           timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_articles_status_published_at
  ON articles (status, published_at DESC);
```

- [ ] **Step 2: Apply locally to verify it runs (if a dev DB is available)**

Run: `npx tsx server/migrate.ts` (or the project's migrate entry — check `package.json` `db:migrate`).
Expected: it applies `0022_articles.sql` with no error (or "already applied" on re-run). If no dev DB is reachable in this environment, skip and rely on the Task 9 / deploy run; note that it was deferred.

- [ ] **Step 3: Commit**

```bash
git add migrations/0022_articles.sql
git commit -m "feat(blog): add 0022_articles migration"
```

---

## Task 3: Slug utility

**Files:**
- Create: `server/lib/slugify.ts`
- Test: `server/lib/slugify.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// server/lib/slugify.test.ts
import { describe, it, expect } from 'vitest';
import { slugify, uniqueSlug } from './slugify';

describe('slugify', () => {
  it('lowercases, hyphenates, strips punctuation', () => {
    expect(slugify('Things To Do in Port Vila!')).toBe('things-to-do-in-port-vila');
  });
  it('collapses whitespace and trims hyphens', () => {
    expect(slugify('  Blue   Lagoon & Turtle Bay  ')).toBe('blue-lagoon-turtle-bay');
  });
  it('handles accents/diacritics', () => {
    expect(slugify('Café Efaté')).toBe('cafe-efate');
  });
  it('returns a fallback for empty/punctuation-only input', () => {
    expect(slugify('!!!')).toBe('article');
    expect(slugify('')).toBe('article');
  });
});

describe('uniqueSlug', () => {
  it('returns the base slug when unused', () => {
    expect(uniqueSlug('blue-lagoon', new Set())).toBe('blue-lagoon');
  });
  it('suffixes -2, -3 when taken', () => {
    expect(uniqueSlug('blue-lagoon', new Set(['blue-lagoon']))).toBe('blue-lagoon-2');
    expect(uniqueSlug('blue-lagoon', new Set(['blue-lagoon', 'blue-lagoon-2']))).toBe('blue-lagoon-3');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run server/lib/slugify.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// server/lib/slugify.ts

/** Turn a title into a URL-safe slug. Falls back to "article" if nothing usable. */
export function slugify(input: string): string {
  const s = (input ?? "")
    .normalize("NFKD")               // split accents from letters
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")     // non-alphanumerics → hyphen
    .replace(/^-+|-+$/g, "")         // trim leading/trailing hyphens
    .replace(/-{2,}/g, "-");         // collapse repeats
  return s || "article";
}

/** Ensure a slug is unique against a set of taken slugs, suffixing -2, -3, ... */
export function uniqueSlug(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run server/lib/slugify.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add server/lib/slugify.ts server/lib/slugify.test.ts
git commit -m "feat(blog): add slugify + uniqueSlug utility"
```

---

## Task 4: Server-side HTML sanitizer

**Files:**
- Create: `server/lib/sanitize-server.ts`
- Test: `server/lib/sanitize-server.test.ts`

**First, check available deps:** run
`node -e "console.log(require('./package.json').dependencies)" | tr ',' '\n' | grep -iE "dompurify|jsdom|sanitize-html|isomorphic"`.
- If `isomorphic-dompurify` is present → use it (works without a manual JSDOM window).
- Else if `dompurify` + `jsdom` are present → construct a JSDOM window and `createDOMPurify(window)`.
- Else → implement the conservative tag/attr stripper below (and rely on client `sanitizeHtml` for display defence-in-depth). The tests below must pass regardless of which path is chosen.

- [ ] **Step 1: Write the failing test**

```ts
// server/lib/sanitize-server.test.ts
import { describe, it, expect } from 'vitest';
import { sanitizeServerHtml } from './sanitize-server';

describe('sanitizeServerHtml', () => {
  it('removes <script> tags and their content', () => {
    const out = sanitizeServerHtml('<p>ok</p><script>alert(1)</script>');
    expect(out).toContain('<p>ok</p>');
    expect(out.toLowerCase()).not.toContain('<script');
    expect(out).not.toContain('alert(1)');
  });
  it('strips inline event handlers', () => {
    const out = sanitizeServerHtml('<a href="/x" onclick="steal()">link</a>');
    expect(out.toLowerCase()).not.toContain('onclick');
    expect(out).toContain('link');
  });
  it('removes javascript: URLs', () => {
    const out = sanitizeServerHtml('<a href="javascript:alert(1)">x</a>');
    expect(out.toLowerCase()).not.toContain('javascript:');
  });
  it('keeps ordinary formatting tags', () => {
    const out = sanitizeServerHtml('<h2>Title</h2><p><strong>bold</strong> and <em>em</em></p><ul><li>one</li></ul>');
    expect(out).toContain('<h2>Title</h2>');
    expect(out).toContain('<strong>bold</strong>');
    expect(out).toContain('<li>one</li>');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run server/lib/sanitize-server.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement (choose the branch matching available deps)**

**Preferred (if `isomorphic-dompurify` is available):**

```ts
// server/lib/sanitize-server.ts
import DOMPurify from "isomorphic-dompurify";

const ALLOWED_TAGS = [
  "p","br","strong","em","u","s","h1","h2","h3","h4","ul","ol","li",
  "blockquote","a","img","figure","figcaption","hr","code","pre","span",
];
const ALLOWED_ATTR = ["href","src","alt","title","target","rel","class"];

/** Sanitize article HTML before persisting. Strips scripts, event handlers, js: URLs. */
export function sanitizeServerHtml(html: string): string {
  return DOMPurify.sanitize(html ?? "", {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|tel:|\/|#)/i,
  });
}
```

**Fallback (NO DOMPurify/JSDOM on the server) — conservative stripper:**

```ts
// server/lib/sanitize-server.ts
// Minimal server-side HTML sanitizer used when DOMPurify isn't available server-side.
// Removes <script>/<style> blocks, inline event handlers, and javascript: URLs.
// The client also sanitizes on render (DOMPurify) as defence-in-depth.
export function sanitizeServerHtml(html: string): string {
  let s = html ?? "";
  // drop script/style elements entirely (with content)
  s = s.replace(/<\s*(script|style)[\s\S]*?<\s*\/\s*\1\s*>/gi, "");
  // drop any remaining lone script/style open tags
  s = s.replace(/<\s*\/?\s*(script|style)[^>]*>/gi, "");
  // strip on*="..." / on*='...' / on*=word event-handler attributes
  s = s.replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  // neutralize javascript: in href/src
  s = s.replace(/(href|src)\s*=\s*("|')\s*javascript:[^"']*\2/gi, '$1=$2#$2');
  return s;
}
```

(Install note: if neither DOMPurify-server nor JSDOM is present and you prefer the robust
path, `npm install isomorphic-dompurify` and use the preferred branch. Decide during
implementation; the fallback keeps the feature shippable without a new dependency.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run server/lib/sanitize-server.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add server/lib/sanitize-server.ts server/lib/sanitize-server.test.ts package.json package-lock.json
git commit -m "feat(blog): add server-side HTML sanitizer for article bodies"
```

---

## Task 5: Article storage methods

**Files:**
- Modify: `server/storage.ts`

- [ ] **Step 1: Add methods to the `IStorage` interface**

In `server/storage.ts`, inside `export interface IStorage { ... }`, add (near the Product operations):

```ts
  // Article (blog) operations
  getPublishedArticles(): Promise<Article[]>;
  getAllArticles(): Promise<Article[]>;
  getArticleBySlug(slug: string): Promise<Article | undefined>;
  getArticleById(id: string): Promise<Article | undefined>;
  createArticle(data: InsertArticle): Promise<Article>;
  updateArticle(id: string, data: Partial<InsertArticle>): Promise<Article>;
  deleteArticle(id: string): Promise<void>;
```

- [ ] **Step 2: Import `articles` + types**

Ensure the schema import in `server/storage.ts` includes `articles`, and the type import includes `Article, InsertArticle`. (The file already imports many tables/types from `@shared/schema` / `../shared/schema.js` — add to that existing import list. `eq`, `desc` from `drizzle-orm`: `eq` is already imported; add `desc` if not present.)

- [ ] **Step 3: Implement methods in `DatabaseStorage`**

Add inside `export class DatabaseStorage implements IStorage { ... }`, near the Product methods:

```ts
  // Article (blog) operations
  async getPublishedArticles(): Promise<Article[]> {
    return this.withRetry(() =>
      db.select().from(articles)
        .where(eq(articles.status, "published"))
        .orderBy(desc(articles.publishedAt))
    );
  }

  async getAllArticles(): Promise<Article[]> {
    return this.withRetry(() =>
      db.select().from(articles).orderBy(desc(articles.updatedAt))
    );
  }

  async getArticleBySlug(slug: string): Promise<Article | undefined> {
    return this.withRetry(async () => {
      const [a] = await db.select().from(articles).where(eq(articles.slug, slug));
      return a || undefined;
    });
  }

  async getArticleById(id: string): Promise<Article | undefined> {
    return this.withRetry(async () => {
      const [a] = await db.select().from(articles).where(eq(articles.id, id));
      return a || undefined;
    });
  }

  async createArticle(data: InsertArticle): Promise<Article> {
    const [a] = await db.insert(articles).values(data as any).returning();
    return a;
  }

  async updateArticle(id: string, data: Partial<InsertArticle>): Promise<Article> {
    const [a] = await db
      .update(articles)
      .set({ ...(data as any), updatedAt: new Date() })
      .where(eq(articles.id, id))
      .returning();
    return a;
  }

  async deleteArticle(id: string): Promise<void> {
    await db.delete(articles).where(eq(articles.id, id));
  }
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --project tsconfig.json --noEmit 2>&1 | grep -i "storage.ts" || echo "clean"`
Expected: `clean`. (If `desc` is undefined, add it to the `drizzle-orm` import.)

- [ ] **Step 5: Commit**

```bash
git add server/storage.ts
git commit -m "feat(blog): add article storage methods"
```

---

## Task 6: Public + admin article API routes

**Files:**
- Modify: `server/routes.ts`

- [ ] **Step 1: Import the schema + utils**

At the top of `server/routes.ts`, add to the existing `@shared/schema` import: `insertArticleSchema`. Add:
`import { slugify, uniqueSlug } from "./lib/slugify.js";` and
`import { sanitizeServerHtml } from "./lib/sanitize-server.js";`.

- [ ] **Step 2: Add the routes**

Inside `registerRoutes`, near the other public/admin resource routes, add:

```ts
  // ── Articles (blog) ─────────────────────────────────────────────────────────
  // Public: published only
  app.get("/api/articles", async (_req, res) => {
    try {
      const list = await storage.getPublishedArticles();
      res.json(list);
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
      // derive a unique slug if none supplied
      if (!body.slug || String(body.slug).trim() === "") {
        const taken = new Set((await storage.getAllArticles()).map((a) => a.slug));
        body.slug = uniqueSlug(slugify(body.title || "article"), taken);
      } else {
        body.slug = slugify(body.slug);
      }
      if (typeof body.bodyHtml === "string") body.bodyHtml = sanitizeServerHtml(body.bodyHtml);
      // stamp publishedAt on first publish
      if (body.status === "published" && !body.publishedAt) body.publishedAt = new Date();
      const data = insertArticleSchema.parse(body);
      const created = await storage.createArticle(data);
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
      // stamp publishedAt when transitioning into published the first time
      if (body.status === "published" && !existing.publishedAt && !body.publishedAt) {
        body.publishedAt = new Date();
      }
      const updated = await storage.updateArticle(req.params.id, body);
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
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --project tsconfig.json --noEmit 2>&1 | grep -i "routes.ts" || echo "clean"`
Expected: `clean`.

- [ ] **Step 4: Commit**

```bash
git add server/routes.ts
git commit -m "feat(blog): add public + admin article API routes"
```

---

## Task 7: Sitemap inclusion (auto-prerender)

**Files:**
- Create: `server/lib/article-sitemap.ts`
- Test: `server/lib/article-sitemap.test.ts`
- Modify: `server/routes.ts`

- [ ] **Step 1: Write the failing test**

```ts
// server/lib/article-sitemap.test.ts
import { describe, it, expect } from 'vitest';
import { publishedArticleSitemapEntries } from './article-sitemap';

const now = '2026-06-02';
const rows = [
  { slug: 'a', status: 'published', updatedAt: new Date('2026-06-01T00:00:00Z') },
  { slug: 'b', status: 'draft',     updatedAt: new Date('2026-06-01T00:00:00Z') },
  { slug: 'c', status: 'published', updatedAt: null },
] as any[];

describe('publishedArticleSitemapEntries', () => {
  it('emits only published articles as /blog/<slug> with priority 0.7', () => {
    const out = publishedArticleSitemapEntries(rows, now);
    expect(out.map(e => e.loc)).toEqual(['/blog/a', '/blog/c']);
    expect(out.every(e => e.priority === '0.7')).toBe(true);
    expect(out.every(e => e.changefreq === 'monthly')).toBe(true);
  });
  it('uses updatedAt date for lastmod, falling back to now', () => {
    const out = publishedArticleSitemapEntries(rows, now);
    expect(out[0].lastmod).toBe('2026-06-01'); // article a
    expect(out[1].lastmod).toBe(now);          // article c (null updatedAt)
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run server/lib/article-sitemap.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// server/lib/article-sitemap.ts
export interface SitemapEntry {
  loc: string;
  priority: string;
  changefreq: string;
  lastmod: string;
}

interface ArticleRow {
  slug: string;
  status: string;
  updatedAt: Date | null;
}

/** Sitemap entries for published articles: /blog/<slug>, priority 0.7. */
export function publishedArticleSitemapEntries(
  rows: ArticleRow[],
  now: string,
): SitemapEntry[] {
  return rows
    .filter((a) => a.status === "published")
    .map((a) => ({
      loc: `/blog/${a.slug}`,
      priority: "0.7",
      changefreq: "monthly",
      lastmod: a.updatedAt ? new Date(a.updatedAt).toISOString().split("T")[0] : now,
    }));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run server/lib/article-sitemap.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Wire into the sitemap handler**

In `server/routes.ts`, add the import: `import { publishedArticleSitemapEntries } from "./lib/article-sitemap.js";`.

In the `app.get("/sitemap.xml", ...)` handler: add `/blog` to the `staticPages` array (after `/contact`):

```ts
        { loc: "/blog", priority: "0.7", changefreq: "weekly", lastmod: now },
```

Then, after `productPages` is built and before `const allPages = [...]`, add:

```ts
      const articleRows = await storage.getAllArticles();
      const articlePages = publishedArticleSitemapEntries(articleRows, now);
```

and include them: change `const allPages = [...staticPages, ...productPages];` to
`const allPages = [...staticPages, ...productPages, ...articlePages];`.

- [ ] **Step 6: Type-check + commit**

Run: `npx tsc --project tsconfig.json --noEmit 2>&1 | grep -i "routes.ts\|article-sitemap" || echo "clean"`
Expected: `clean`.

```bash
git add server/lib/article-sitemap.ts server/lib/article-sitemap.test.ts server/routes.ts
git commit -m "feat(blog): include published articles + /blog in sitemap (auto-prerender)"
```

---

## Task 8: BlogPosting JSON-LD + client API helpers

**Files:**
- Create: `client/src/lib/blog-jsonld.ts`
- Test: `client/src/lib/blog-jsonld.test.ts`
- Create: `client/src/lib/api-blog.ts`

- [ ] **Step 1: Write the failing test**

```ts
// client/src/lib/blog-jsonld.test.ts
import { describe, it, expect } from 'vitest';
import { buildBlogPostingJsonLd } from './blog-jsonld';

const article = {
  title: 'Things to do in Port Vila',
  excerpt: 'A guide.',
  coverImage: 'https://img/x.jpg',
  author: 'Jane',
  tags: ['Travel tips', 'Things to do'],
  publishedAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-06-02T00:00:00.000Z',
  seoDescription: null,
} as any;

describe('buildBlogPostingJsonLd', () => {
  it('builds a BlogPosting object with the key fields', () => {
    const ld = buildBlogPostingJsonLd(article, 'https://acetoursvanuatu.com/blog/things-to-do-in-port-vila');
    expect(ld['@type']).toBe('BlogPosting');
    expect(ld.headline).toBe('Things to do in Port Vila');
    expect(ld.image).toBe('https://img/x.jpg');
    expect(ld.datePublished).toBe('2026-06-01T00:00:00.000Z');
    expect(ld.dateModified).toBe('2026-06-02T00:00:00.000Z');
    expect((ld.author as any).name).toBe('Jane');
    expect((ld.mainEntityOfPage as any)['@id']).toBe('https://acetoursvanuatu.com/blog/things-to-do-in-port-vila');
    expect(ld.keywords).toBe('Travel tips, Things to do');
  });
  it('falls back to excerpt for description and omits author when absent', () => {
    const ld = buildBlogPostingJsonLd({ ...article, author: null, seoDescription: null }, 'https://x/y');
    expect(ld.description).toBe('A guide.');
    expect('author' in ld).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run client/src/lib/blog-jsonld.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the JSON-LD builder**

```ts
// client/src/lib/blog-jsonld.ts
export interface ArticleLike {
  title: string;
  excerpt?: string | null;
  coverImage?: string | null;
  imageAlt?: string | null;
  author?: string | null;
  tags?: string[] | null;
  publishedAt?: string | null;
  updatedAt?: string | null;
  seoDescription?: string | null;
}

/** Build schema.org BlogPosting JSON-LD for an article page. */
export function buildBlogPostingJsonLd(a: ArticleLike, canonicalUrl: string): Record<string, unknown> {
  const ld: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: a.title,
    description: a.seoDescription || a.excerpt || a.title,
    mainEntityOfPage: { "@type": "WebPage", "@id": canonicalUrl },
    publisher: {
      "@type": "Organization",
      name: "Ace Tours & Transfers Vanuatu",
    },
  };
  if (a.coverImage) ld.image = a.coverImage;
  if (a.publishedAt) ld.datePublished = a.publishedAt;
  if (a.updatedAt) ld.dateModified = a.updatedAt;
  if (a.author) ld.author = { "@type": "Person", name: a.author };
  if (a.tags && a.tags.length) ld.keywords = a.tags.join(", ");
  return ld;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run client/src/lib/blog-jsonld.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Add client API helpers (no test; thin fetch wrappers)**

```ts
// client/src/lib/api-blog.ts
import type { Article } from "@shared/schema";

export async function fetchArticles(): Promise<Article[]> {
  const res = await fetch("/api/articles", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load articles");
  return res.json();
}

export async function fetchArticle(slug: string): Promise<Article> {
  const res = await fetch(`/api/articles/${encodeURIComponent(slug)}`, { credentials: "include" });
  if (!res.ok) throw new Error("Article not found");
  return res.json();
}
```

- [ ] **Step 6: Commit**

```bash
git add client/src/lib/blog-jsonld.ts client/src/lib/blog-jsonld.test.ts client/src/lib/api-blog.ts
git commit -m "feat(blog): add BlogPosting JSON-LD builder + client API helpers"
```

---

## Task 9: Public pages — listing, card, article

**Files:**
- Create: `client/src/components/blog/article-card.tsx`
- Create: `client/src/pages/blog.tsx`
- Create: `client/src/pages/blog-article.tsx`
- Modify: `client/src/App.tsx`

- [ ] **Step 1: Article card**

```tsx
// client/src/components/blog/article-card.tsx
import { Link } from "wouter";
import type { Article } from "@shared/schema";

export function ArticleCard({ article }: { article: Article }) {
  const date = article.publishedAt
    ? new Date(article.publishedAt as unknown as string).toLocaleDateString("en-AU", { year: "numeric", month: "short", day: "numeric" })
    : "";
  return (
    <Link href={`/blog/${article.slug}`} className="group block overflow-hidden rounded-2xl border bg-card shadow-sm transition hover:shadow-md">
      {article.coverImage ? (
        <img src={article.coverImage} alt={article.imageAlt || article.title} className="h-48 w-full object-cover" loading="lazy" />
      ) : null}
      <div className="p-5">
        {article.tags?.length ? (
          <div className="mb-2 flex flex-wrap gap-2">
            {article.tags.slice(0, 3).map((t) => (
              <span key={t} className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{t}</span>
            ))}
          </div>
        ) : null}
        <h2 className="mb-2 font-serif text-xl font-bold group-hover:text-primary">{article.title}</h2>
        {article.excerpt ? <p className="mb-3 text-sm text-muted-foreground line-clamp-3">{article.excerpt}</p> : null}
        <p className="text-xs text-muted-foreground">{[article.author, date].filter(Boolean).join(" · ")}</p>
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: Listing page**

```tsx
// client/src/pages/blog.tsx
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { SEO } from "@/components/seo";
import { ArticleCard } from "@/components/blog/article-card";
import { fetchArticles } from "@/lib/api-blog";

export default function Blog() {
  const { data: articles = [], isLoading } = useQuery({ queryKey: ["articles"], queryFn: fetchArticles });

  return (
    <Layout>
      <SEO
        title="Vanuatu Travel Blog & Guides"
        description="Travel tips, things to do, and local guides for Port Vila and Efate Island, Vanuatu — from the Ace Tours & Transfers team."
        keywords={["Vanuatu travel guide", "things to do Port Vila", "Vanuatu travel tips", "Efate Island guide"]}
      />
      <div className="bg-muted/30 pt-40 pb-20">
        <div className="container mx-auto px-4">
          <h1 className="mb-4 text-center font-serif text-5xl font-bold">Vanuatu Travel Guides</h1>
          <p className="mx-auto mb-12 max-w-2xl text-center text-lg text-muted-foreground">
            Tips, itineraries, and local knowledge to help you make the most of Port Vila and Efate Island.
          </p>
          {isLoading ? (
            <div className="py-12 text-center text-muted-foreground">Loading…</div>
          ) : articles.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">New guides are coming soon — check back shortly.</div>
          ) : (
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
              {articles.map((a) => <ArticleCard key={a.id} article={a} />)}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
```

- [ ] **Step 3: Article page**

```tsx
// client/src/pages/blog-article.tsx
import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { SEO } from "@/components/seo";
import { TourCard } from "@/components/tour-card";
import NotFound from "@/pages/not-found";
import { fetchArticle } from "@/lib/api-blog";
import { buildBlogPostingJsonLd } from "@/lib/blog-jsonld";
import { sanitizeHtml } from "@/components/shared-detail-components";
import { cleanProductList } from "@/lib/product-filters";
import { useLocalizedProducts } from "@/hooks/useLocalizedProducts";

const SITE_URL = (import.meta.env.VITE_APP_URL as string | undefined)?.replace(/\/$/, "") || "https://acetoursvanuatu.com";

export default function BlogArticle() {
  const params = useParams();
  const slug = params.slug as string;
  const { data: article, isLoading, isError } = useQuery({
    queryKey: ["article", slug],
    queryFn: () => fetchArticle(slug),
    retry: false,
  });
  const productsQuery = useLocalizedProducts();

  if (isLoading) {
    return <Layout><div className="container mx-auto px-4 py-40 text-center text-muted-foreground">Loading…</div></Layout>;
  }
  if (isError || !article) return <NotFound />;

  const canonical = `${SITE_URL}/blog/${article.slug}`;
  const related = cleanProductList(productsQuery.data ?? [])
    .filter((p) => (article.relatedProductIds ?? []).includes(p.id));
  const date = article.publishedAt
    ? new Date(article.publishedAt as unknown as string).toLocaleDateString("en-AU", { year: "numeric", month: "long", day: "numeric" })
    : "";

  return (
    <Layout>
      <SEO
        title={article.seoTitle || article.title}
        description={article.seoDescription || article.excerpt || article.title}
        image={article.coverImage || undefined}
        imageAlt={article.imageAlt || article.title}
        keywords={article.tags ?? []}
        extraJsonLd={buildBlogPostingJsonLd(article as any, canonical)}
      />
      <article className="bg-background">
        <header className="bg-muted/30 pt-40 pb-12">
          <div className="container mx-auto max-w-3xl px-4">
            {article.tags?.length ? (
              <div className="mb-3 flex flex-wrap gap-2">
                {article.tags.map((t) => <span key={t} className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{t}</span>)}
              </div>
            ) : null}
            <h1 className="mb-4 font-serif text-4xl font-bold leading-tight md:text-5xl">{article.title}</h1>
            <p className="text-sm text-muted-foreground">{[article.author, date].filter(Boolean).join(" · ")}</p>
          </div>
        </header>

        {article.coverImage ? (
          <div className="container mx-auto max-w-4xl px-4 -mt-4">
            <img src={article.coverImage} alt={article.imageAlt || article.title} className="w-full rounded-2xl object-cover" />
          </div>
        ) : null}

        <div
          className="prose prose-lg mx-auto max-w-3xl px-4 py-12"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(article.bodyHtml) }}
        />

        {related.length > 0 ? (
          <div className="container mx-auto max-w-5xl px-4 py-8">
            <h2 className="mb-6 font-serif text-2xl font-bold">Book a related experience</h2>
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
              {related.map((p, i) => <TourCard key={p.id} tour={{ ...p, category: p.category as any }} index={i} />)}
            </div>
          </div>
        ) : null}

        <div className="container mx-auto max-w-3xl px-4 py-10 text-center">
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/blog" className="rounded-lg border border-primary px-6 py-3 font-semibold text-primary">More guides</Link>
            <Link href="/tours" className="rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground">Browse tours</Link>
            <Link href="/contact" className="rounded-lg border border-primary px-6 py-3 font-semibold text-primary">Contact us</Link>
          </div>
        </div>
      </article>
    </Layout>
  );
}
```

- [ ] **Step 4: Wire routes in `App.tsx`**

Add lazy imports with the others:

```ts
const Blog = lazy(() => import("@/pages/blog"));
const BlogArticle = lazy(() => import("@/pages/blog-article"));
```

In the public `<Switch>`, after `<Route path="/faq" component={FAQ} />` (and near the Phase-4 landing routes), add:

```tsx
        <Route path="/blog" component={Blog} />
        <Route path="/blog/:slug" component={BlogArticle} />
```

- [ ] **Step 5: Type-check + test**

Run: `npx tsc --project tsconfig.json --noEmit 2>&1 | grep -iE "blog|article-card|App.tsx" || echo "clean"`
Expected: `clean`.
Run: `npx vitest run client/src/lib/blog-jsonld.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add client/src/components/blog/article-card.tsx client/src/pages/blog.tsx client/src/pages/blog-article.tsx client/src/App.tsx
git commit -m "feat(blog): add public /blog listing + /blog/:slug article pages"
```

---

## Task 10: Admin authoring UI

**Files:**
- Create: `client/src/components/admin/article-editor-dialog.tsx`
- Create: `client/src/pages/admin/blog.tsx`
- Modify: `client/src/App.tsx`

**Note:** This task has no unit tests (UI/integration); it's validated by type-check + the build in Task 11 and manual use. Reuse the TipTap config from `client/src/pages/admin/cms.tsx` (open it and copy the `useEditor({ extensions: [StarterKit, Link, TextAlign...], ... })` setup and toolbar). Reuse the products admin page structure from `client/src/pages/admin/products.tsx` (react-query list + mutations + dialog + AlertDialog delete).

- [ ] **Step 1: Build the editor dialog**

Create `client/src/components/admin/article-editor-dialog.tsx`. It is a controlled dialog that creates or edits one article. Requirements (implement following the cms.tsx TipTap pattern and the project's existing `Dialog`, `Input`, `Label`, `Button`, `Textarea` UI components under `@/components/ui/*`):

- Props: `{ open: boolean; onOpenChange: (o: boolean) => void; article: Article | null; onSaved: () => void }`.
- Local form state for: `title, slug, excerpt, coverImage, imageAlt, author, tags (string[]), relatedProductIds (string[]), status ('draft'|'published'), seoTitle, seoDescription, seoKeywords`, and a TipTap editor for `bodyHtml`.
- `title` onChange auto-fills `slug` via a client copy of slugify ONLY while creating and while the user hasn't manually edited slug (a simple `slugTouched` boolean). Import is server-side only, so add a tiny inline `toSlug` in this file: `const toSlug = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");`
- Tags input: comma-separated text → `tags` array on blur/change.
- Related products: fetch products via `useLocalizedProducts()` and present a multi-select (checkbox list is fine) of `{id,title}`; store selected ids in `relatedProductIds`.
- Save: `useMutation` calling `apiRequest(article ? "PATCH" : "POST", article ? \`/api/admin/articles/${article.id}\` : "/api/admin/articles", payload)` where `payload` includes `bodyHtml: editor?.getHTML() ?? ""`. On success: `onSaved()` + close. On 409, show "Slug already exists" inline.
- Seed editor + form fields from `article` when editing (use `editor.commands.setContent(article.bodyHtml)` in an effect when the dialog opens).

- [ ] **Step 2: Build the admin page**

Create `client/src/pages/admin/blog.tsx` mirroring `products.tsx`:

- Default export `AdminBlog`.
- `useQuery({ queryKey: ["admin-articles"], queryFn: () => apiRequest("GET", "/api/admin/articles").then(r => r.json()) })` (match how products.tsx calls apiRequest/fetch — use the same helper it uses).
- Table rows: title, status badge (draft/published), author, publishedAt, updatedAt, with Edit (opens dialog), a Publish/Unpublish quick toggle (`PATCH` `{ status }`), and Delete (AlertDialog → `apiRequest("DELETE", \`/api/admin/articles/${id}\`)`).
- "New article" button opens the dialog with `article={null}`.
- On dialog `onSaved`, `queryClient.invalidateQueries({ queryKey: ["admin-articles"] })` and also invalidate `["articles"]`.

- [ ] **Step 3: Wire the admin route in `App.tsx`**

Add lazy import: `const AdminBlog = lazy(() => import("@/pages/admin/blog"));`. Add a route alongside the other `/admin/*` routes, using the SAME protection wrapper they use (open `App.tsx` and match exactly, e.g.):

```tsx
        <Route path="/admin/blog">
          <ProtectedRoute><AdminBlog /></ProtectedRoute>
        </Route>
```

(If admin routes use a different guard/layout wrapper in this file, match that instead.)

- [ ] **Step 4: Add a nav link to the admin blog**

Find the admin navigation/menu (search: `grep -rn "admin/products" client/src/components client/src/pages/admin/dashboard.tsx`) and add a "Blog" entry pointing to `/admin/blog`, matching the existing items' style.

- [ ] **Step 5: Type-check**

Run: `npx tsc --project tsconfig.json --noEmit 2>&1 | grep -iE "blog|article-editor|App.tsx" || echo "clean"`
Expected: `clean`.

- [ ] **Step 6: Commit**

```bash
git add client/src/components/admin/article-editor-dialog.tsx client/src/pages/admin/blog.tsx client/src/App.tsx
git commit -m "feat(blog): add admin authoring UI (list + TipTap editor dialog)"
```

---

## Task 11: End-to-end verification

**Files:** none (verification only).

- [ ] **Step 1: Full test suite**

Run: `npm test`
Expected: all pass — new tests (`schema.articles`, `slugify`, `sanitize-server`, `article-sitemap`, `blog-jsonld`) plus the existing suite, no regressions.

- [ ] **Step 2: Type-check the whole project**

Run: `npx tsc --project tsconfig.json --noEmit 2>&1 | tail -20`
Expected: no errors in the new/modified files (`schema.ts`, `storage.ts`, `routes.ts`, `blog*.tsx`, `article-*`, `slugify`, `sanitize-server`, `App.tsx`). If `npm run check` references a missing `server/tsconfig.json` (pre-existing), use the `tsc --project tsconfig.json` form.

- [ ] **Step 3: Production build (skip prerender)**

Run: `PRERENDER=0 npm run build 2>&1 | tail -15`
Expected: client + server build succeed; `dist/public` and `dist/index.cjs` produced. Confirms routes/lazy imports/JSX compile.

- [ ] **Step 4: Migration applies (if dev DB reachable)**

Run: `npm run db:migrate` (or `npx tsx server/migrate.ts`).
Expected: `0022_articles.sql` applies cleanly; re-running is a no-op. If no DB in this environment, defer to deploy and note it.

- [ ] **Step 5: Manual smoke (post-deploy or local server with DB)**

After deploy (Render runs the migration on boot, then prerender), verify:
```bash
# /blog renders (will be the "coming soon" empty state until an article is published)
curl -s -A "Googlebot" https://acetoursvanuatu.com/blog | grep -oE '<title>[^<]*</title>' | head -1
# create+publish an article in /admin/blog, then:
curl -s -A "Googlebot" https://acetoursvanuatu.com/blog/<slug> | grep -c 'application/ld+json'   # >=1 (BlogPosting)
curl -s https://acetoursvanuatu.com/sitemap.xml | grep -c '/blog/'                                # published slugs present
```
Expected: `/blog` has a unique title; a published article page has BlogPosting JSON-LD; sitemap lists `/blog` + published article slugs (which then auto-prerender). Run the Google Rich Results Test on one article URL.

- [ ] **Step 6: Final commit (if any verification fixes were needed)**

```bash
git add -A
git commit -m "test(blog): verify content engine end-to-end"
```

---

## Post-merge (operational, not code)
- In `/admin/blog`, publish 2–3 launch articles (e.g. "Things to do in Port Vila", "Getting from the airport to your resort", "Best time to visit Vanuatu") with related-product links.
- In Google Search Console, resubmit the sitemap and Request Indexing for `/blog` + the new article URLs.
- Add a "Blog"/"Guides" link to the public site header/footer nav (small follow-up) so readers and crawlers discover `/blog`.

## Self-review notes
- **Spec coverage:** articles table + zod + types (T1); migration (T2); slug util (T3); server sanitize (T4); storage methods (T5); public+admin API incl. 409 + publishedAt stamping + draft filtering (T6); sitemap inclusion/auto-prerender (T7); BlogPosting JSON-LD + client API (T8); public listing/card/article with SEO, sanitized body, related TourCards, NotFound on draft/missing (T9); admin TipTap authoring UI (T10); verification incl. curl JSON-LD checks (T11). Out-of-scope items (comments, pagination, tag pages, scheduled publish, image upload, translations) intentionally excluded.
- **Type consistency:** `Article`/`InsertArticle` (T1) used across storage (T5), routes (T6), client (T8/T9/T10). `insertArticleSchema`, `slugify`/`uniqueSlug`, `sanitizeServerHtml`, `publishedArticleSitemapEntries`, `buildBlogPostingJsonLd`, `fetchArticles`/`fetchArticle` named identically at definition and call sites. Field names match the schema (`bodyHtml`, `coverImage`, `relatedProductIds`, `publishedAt`, `seoTitle/Description/Keywords`) everywhere.
- **Known decision points flagged for the implementer:** server sanitizer dependency (T4 — pick isomorphic-dompurify vs fallback), exact admin route-guard wrapper (T10 — match App.tsx), and the admin nav location (T10).
