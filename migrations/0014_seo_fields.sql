-- Migration: Add SEO fields to tours table
-- Run after: 0013_group_pricing.sql
-- Applies to: tours, transfers, and vehicle hire (all share the tours table)

-- Custom <title> tag. Falls back to the product title if null.
ALTER TABLE tours
  ADD COLUMN IF NOT EXISTS seo_title TEXT;

-- Custom meta description. Falls back to description[0] if null.
ALTER TABLE tours
  ADD COLUMN IF NOT EXISTS seo_description TEXT;

-- Comma-separated keywords appended to the auto-generated keyword list.
ALTER TABLE tours
  ADD COLUMN IF NOT EXISTS seo_keywords TEXT;

COMMENT ON COLUMN tours.seo_title IS
  'Custom <title> tag for SEO. Null = fall back to product title.';
COMMENT ON COLUMN tours.seo_description IS
  'Custom meta description (aim for 120-155 chars). Null = fall back to description[0].';
COMMENT ON COLUMN tours.seo_keywords IS
  'Comma-separated extra keywords appended to the auto-generated list.';
