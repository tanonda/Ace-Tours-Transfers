-- Migration 0025: readable product URLs (/tours/mele-cascades-waterfall-tour).
--
-- Adds a nullable slug column with a unique index. Slugs are filled in by the
-- server at startup (backfillProductSlugs) using the same tested slug rules as
-- new products, and an existing slug is never rewritten. Old /tours/<uuid> URLs
-- are 301-redirected to the slug URL. Safe to re-run.

ALTER TABLE products ADD COLUMN IF NOT EXISTS slug text;

CREATE UNIQUE INDEX IF NOT EXISTS products_slug_unique ON products (slug);
