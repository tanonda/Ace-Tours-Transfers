# SEO Blog / Content Engine — Design (Phase 5)

## Context

Phases 1–4 made acetoursvanuatu.com crawlable and added commercial landing pages. The
site still has **no informational content** — nothing targeting the high-volume
"tourist information Vanuatu", "things to do in Port Vila", "Vanuatu travel guide" style
queries that bring top-of-funnel visitors. Phase 5 adds a **database-backed blog/guides
engine** with an admin authoring UI, so the owner/staff can publish SEO articles that rank
for informational searches and funnel readers to tour/transfer bookings.

The engine reuses everything already proven: the `products` table pattern (which already
prerenders + carries SEO), the in-repo **TipTap** rich-text editor (`@tiptap/react`, used
in `admin/cms.tsx`), **DOMPurify** `sanitizeHtml` (`shared-detail-components.tsx`), the
Phase 4 **TourCard** + product-matching pattern, the **SEO** component's `extraJsonLd`
hook, and the **sitemap → auto-prerender** lever (prerender reads routes from
`/sitemap.xml` and waits for the JSON-LD `<script>`).

## Decisions (from brainstorming)

- **Storage:** new `articles` DB table + admin authoring UI (not Markdown files, not the
  key/value CMS).
- **Editor:** rich-text WYSIWYG via the **existing TipTap** setup (no new dependency).
- **URLs:** `/blog` index + `/blog/:slug` articles (human-readable slugs).
- **Article fields:** featured image + excerpt, author + publish date, tags/categories,
  related tours/products links — all four.
- **Schema type:** `BlogPosting` JSON-LD.

## Data model

New Drizzle table in `shared/schema.ts` (mirrors the `products` SEO-friendly shape):

```
articles
  id                uuid pk default gen_random_uuid()
  slug              text unique notnull          -- "things-to-do-in-port-vila"
  title             text notnull
  excerpt           text                          -- listing cards + meta-desc fallback
  bodyHtml          text notnull                  -- sanitized TipTap HTML
  coverImage        text                          -- Cloudinary URL (hero + OG + card)
  imageAlt          text
  author            text                          -- author display name
  tags              text[]  default '{}'          -- ["Travel tips","Things to do"]
  relatedProductIds text[]  default '{}'          -- product UUIDs → TourCard CTAs
  status            text notnull default 'draft'  -- 'draft' | 'published'
  publishedAt       timestamp                     -- stamped on first publish; ordering + JSON-LD
  seoTitle          text                          -- falls back to title
  seoDescription    text                          -- falls back to excerpt
  seoKeywords       text                          -- comma-separated
  createdAt         timestamp notnull default now
  updatedAt         timestamp notnull default now
```

Plus a drizzle-zod `insertArticleSchema` and `Article` / `InsertArticle` types, following
the existing products pattern. A Drizzle migration adds the table.

## Architecture & files

```
shared/schema.ts                              (MOD) articles table + zod schema + types
server/storage.ts (+ interface)               (MOD) article storage methods
server/routes.ts                              (MOD) public + admin article routes; sitemap inclusion
server/lib/slugify.ts                         (NEW) slugify(title) + uniqueness helper
client/src/lib/blog-jsonld.ts                 (NEW) buildBlogPostingJsonLd(article, url)
client/src/pages/blog.tsx                     (NEW) /blog listing
client/src/pages/blog-article.tsx             (NEW) /blog/:slug article
client/src/components/blog/article-card.tsx    (NEW) listing card
client/src/pages/admin/blog.tsx               (NEW) admin list + create/edit
client/src/components/admin/article-editor-dialog.tsx (NEW) TipTap-based editor dialog
client/src/App.tsx                            (MOD) /blog, /blog/:slug, /admin/blog routes
migrations/<n>_articles.sql                   (NEW) create table
```

Reuse (no new deps): TipTap editor (pattern from `client/src/pages/admin/cms.tsx`),
`sanitizeHtml` from `client/src/components/shared-detail-components.tsx`, `TourCard`,
`SEO` (`extraJsonLd`), `cleanProductList` (Phase 4, `client/src/lib/product-filters.ts`)
for resolving related products, the admin auth route guard.

## Public pages

### `/blog` — listing (`client/src/pages/blog.tsx`)
- `<Layout>` + `<SEO title="Vanuatu Travel Blog & Guides | …" description=…>`.
- `GET /api/articles` (react-query) → published only, newest-first by `publishedAt`.
- Exactly one `<h1>` (e.g. "Vanuatu Travel Guides").
- Responsive grid of `ArticleCard` (cover image, title, excerpt, author + formatted date,
  tags); each links to `/blog/<slug>`.
- Loading + empty states (no published articles → friendly message, page still renders).

### `/blog/:slug` — article (`client/src/pages/blog-article.tsx`)
- Reads `:slug`, `GET /api/articles/:slug` (published only).
- `<SEO>`: `title=seoTitle||title`, `description=seoDescription||excerpt`,
  `image=coverImage`, `imageAlt`, `keywords` from tags, and
  `extraJsonLd={buildBlogPostingJsonLd(article, canonicalUrl)}`:
  ```
  { "@context":"https://schema.org", "@type":"BlogPosting",
    headline, image: coverImage, datePublished: publishedAt, dateModified: updatedAt,
    author: { "@type":"Person", name: author },
    publisher: { "@type":"Organization", name:"Ace Tours & Transfers Vanuatu", logo:{…} },
    mainEntityOfPage: { "@type":"WebPage", "@id": canonicalUrl },
    description: seoDescription||excerpt, keywords: tags.join(", ") }
  ```
- Render order: hero (coverImage + H1 title + author/date/tags) → body via
  `dangerouslySetInnerHTML={{ __html: sanitizeHtml(bodyHtml) }}` → related products
  (resolve `relatedProductIds` against the live products list via `cleanProductList`,
  render as `TourCard`s; omit section if none) → CTA band (links to `/blog`, `/tours`,
  `/contact`).
- Unknown or unpublished slug → `<NotFound />`.

### SEO / prerender wiring
- Sitemap handler (`server/routes.ts`): add `/blog` (priority 0.7, weekly) and each
  **published** article `/blog/<slug>` (priority 0.7, `lastmod` from `updatedAt`),
  mirroring the existing `productPages` block. Draft articles are excluded.
- Prerender already reads routes from the sitemap and waits for the `<SEO>` JSON-LD
  `<script>`, so every published article auto-prerenders to static HTML with BlogPosting
  schema — **no new prerender code**.
- Internal linking: link `/blog` from the site footer/nav; articles link to related tour
  pages — spreads link equity and funnels content → bookings.

## Admin authoring

### `client/src/pages/admin/blog.tsx`
- Admin page-per-feature pattern (like `admin/products.tsx`), behind the existing admin
  auth/route guard; linked from admin nav.
- Table of ALL articles (title, status badge, author, publishedAt, updatedAt) with
  New / Edit / Delete + Publish/Unpublish toggle.

### `client/src/components/admin/article-editor-dialog.tsx`
- Reuses the TipTap editor config from `admin/cms.tsx` (StarterKit + Link + TextAlign).
- Fields: title (auto-suggests slug via `slugify`, slug editable), excerpt, coverImage URL
  + imageAlt, author, tags (chip/comma input), relatedProductIds (multi-select from live
  products), TipTap body, collapsible SEO overrides (seoTitle/seoDescription/seoKeywords),
  status (Draft/Published).
- On save, the **server** sanitizes `bodyHtml` with DOMPurify before persisting (not only
  on render). First transition to `published` stamps `publishedAt`.

## API surface (`server/routes.ts` + `server/storage.ts`)

Public:
- `GET /api/articles` → published, newest-first.
- `GET /api/articles/:slug` → published single (404 if missing/draft).

Admin (existing auth guard, mirrors product admin routes):
- `GET /api/admin/articles` → all.
- `POST /api/admin/articles` → validate (Zod) + sanitize body + enforce unique slug.
- `PATCH /api/admin/articles/:id` → partial update + re-sanitize body if present.
- `DELETE /api/admin/articles/:id`.

Storage methods (on the existing `storage` object/interface): `getPublishedArticles()`,
`getArticleBySlug(slug)`, `getAllArticles()`, `createArticle(data)`,
`updateArticle(id, data)`, `deleteArticle(id)`.

## Error handling
- Duplicate slug on create/update → 409 with a clear message; admin form surfaces it.
- Unknown/unpublished public slug → `NotFound`.
- Article fetch failure on a page → graceful error state; whatever loaded still renders.
- Sitemap generation stays in its existing try/catch — an articles query failure can't
  break sitemap output.
- Server sanitizes all stored HTML; client also sanitizes on render (defence in depth).

## Testing (Vitest)
- `insertArticleSchema`: valid passes; missing title/slug/body fails; status enum enforced.
- `slugify(title)`: lowercase, hyphenated, strips punctuation, trims; collision suffixing
  (`-2`) via the uniqueness helper.
- Sanitization: a body containing `<script>` / `onclick=` is stripped by the save-time
  sanitizer.
- Sitemap inclusion (pure helper): given published + draft articles, only published slugs
  are emitted (unit-tested like Phase 4 landing slugs).
- Published filter: `getPublishedArticles` / the filter excludes drafts.
- `buildBlogPostingJsonLd`: returns `@type:"BlogPosting"` with headline, datePublished,
  author, mainEntityOfPage = canonical URL.
- Post-deploy manual: `curl -A Googlebot /blog` and `/blog/<slug>` show unique title +
  BlogPosting `application/ld+json` + body; Google Rich Results Test passes.

## Out of scope (YAGNI / future)
- Comments; per-language article translation (English-first; SEO meta already locale-aware);
  scheduled/timed publishing; `/blog` pagination (fine until dozens of posts); an in-app
  image-upload widget (use Cloudinary URLs like products); tag archive pages
  (`/blog/tag/:tag`) — tags display/filter only at launch.

## Verification of done
- `/blog` lists published articles (newest-first), each linking to `/blog/<slug>`.
- An article renders hero + sanitized body + related TourCards + BlogPosting JSON-LD; draft
  slugs 404 publicly and are absent from the sitemap.
- Admin can create/edit/publish/unpublish/delete; stored HTML is sanitized; duplicate slug
  rejected.
- Sitemap lists `/blog` + published slugs; after deploy each prerenders with BlogPosting
  schema (curl + Rich Results Test). All new unit tests pass; existing suite unaffected.
