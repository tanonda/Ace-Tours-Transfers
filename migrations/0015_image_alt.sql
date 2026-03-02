-- Migration: Add image alt text to tours table
-- Run after: 0014_seo_fields.sql
-- Applies to: tours, transfers, and vehicle hire (all share the tours table)

-- Alt text for the product hero/listing image.
-- Used in <img alt="..."> on detail pages for accessibility and SEO.
-- Falls back to the product title if null.
ALTER TABLE tours
  ADD COLUMN IF NOT EXISTS image_alt TEXT;

COMMENT ON COLUMN tours.image_alt IS
  'Alt text for the product image. Null = fall back to product title. Used for accessibility and SEO.';
