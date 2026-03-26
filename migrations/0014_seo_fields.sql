-- Migration: Add SEO fields to products table
-- Run after: 0013_group_pricing.sql
-- Applies to: tours, transfers, and vehicle hire (all share the products table)

-- Custom <title> tag. Falls back to the product title if null.
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS seo_title TEXT;

-- Custom meta description. Falls back to description[0] if null.
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS seo_description TEXT;

-- Comma-separated keywords appended to the auto-generated keyword list.
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS seo_keywords TEXT;

-- Geo targeting text for local SEO
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS geo_targeting TEXT;

-- Listing order for catalog display priority
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS listing_order INTEGER DEFAULT 0;

COMMENT ON COLUMN products.seo_title IS
  'Custom <title> tag for SEO. Null = fall back to product title.';
COMMENT ON COLUMN products.seo_description IS
  'Custom meta description (aim for 120-155 chars). Null = fall back to description[0].';
COMMENT ON COLUMN products.seo_keywords IS
  'Comma-separated extra keywords appended to the auto-generated list.';
