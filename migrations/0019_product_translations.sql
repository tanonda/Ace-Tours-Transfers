-- Migration 0019: Product translations
-- Adds a product_translations table so that title, description, and other
-- text-heavy fields can be stored per-locale. English stays in the products
-- table (source of truth); all other locales live here.

CREATE TABLE IF NOT EXISTS product_translations (
  id                  varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id          varchar NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  locale              text    NOT NULL,                          -- e.g. 'fr', 'es', 'zh', 'bi'

  -- Core display fields
  title               text,
  description         text[],                                    -- mirrors products.description (array)

  -- Detail-page fields (mirrors migration 0016 columns)
  itinerary_intro     text,
  pickup_instructions text,
  meeting_point       text,
  operating_hours     text,
  cancellation_policy text,
  included_items      jsonb,                                     -- string[]
  excluded_items      jsonb,                                     -- string[]
  additional_info     jsonb,                                     -- string[]

  updated_at          timestamp NOT NULL DEFAULT now(),

  CONSTRAINT uq_product_translations_product_locale
    UNIQUE (product_id, locale)
);

-- Index for the most common lookup pattern: fetch all translations for a
-- set of product IDs filtered by locale.
CREATE INDEX IF NOT EXISTS idx_product_translations_locale
  ON product_translations (locale, product_id);
