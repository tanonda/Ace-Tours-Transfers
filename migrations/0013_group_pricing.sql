-- Migration: Add group/package pricing support to products table
-- Run after: 0012_seed_faq_and_settings.sql

-- 1. Pricing type: 'per_person' (default) or 'group'
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS pricing_type TEXT NOT NULL DEFAULT 'per_person'
  CHECK (pricing_type IN ('per_person', 'group'));

-- 2. Flat group/package price in VUV integer units
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS group_price_cents INTEGER NOT NULL DEFAULT 0;

-- 3. Optional display hint: "up to N guests included"
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS group_max_pax INTEGER;

-- 4. Default vehicles to group pricing (sensible default)
UPDATE products
  SET pricing_type = 'group'
  WHERE category = 'vehicle'
    AND pricing_type = 'per_person'
    AND group_price_cents = 0;

-- 5. For vehicles that already have adult_price_cents set, migrate that value to group_price_cents
UPDATE products
  SET group_price_cents = adult_price_cents,
      pricing_type      = 'group'
  WHERE category = 'vehicle'
    AND adult_price_cents > 0
    AND group_price_cents = 0;

-- 6. Update pricing_versions to include pricing_type column for versioned overrides
ALTER TABLE pricing_versions
  ADD COLUMN IF NOT EXISTS pricing_type TEXT NOT NULL DEFAULT 'per_person'
  CHECK (pricing_type IN ('per_person', 'group'));

ALTER TABLE pricing_versions
  ADD COLUMN IF NOT EXISTS group_price_cents INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN products.pricing_type IS
  'Controls checkout calculation: per_person=adultRate×adults+childRate×children; group=flat groupPriceCents';
COMMENT ON COLUMN products.group_price_cents IS
  'Flat rate for entire booking (VUV integer units). Only used when pricing_type=group.';
COMMENT ON COLUMN products.group_max_pax IS
  'Display hint only: "up to N guests included in group rate". Does not enforce a hard limit.';
