
-- Phase 1 Migration: Multi-Product & Numeric Pricing
-- Consolidated SQL script

-- 1. Schema Changes
ALTER TABLE tours ADD COLUMN IF NOT EXISTS adult_price_cents INTEGER;
ALTER TABLE tours ADD COLUMN IF NOT EXISTS child_price_cents INTEGER;

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS total_amount_cents INTEGER;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'VUV';
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS adult_pax_total INTEGER DEFAULT 1;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS child_pax_total INTEGER DEFAULT 0;

CREATE TABLE IF NOT EXISTS booking_items (
  id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id VARCHAR(255) NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  product_id VARCHAR(255) NOT NULL,
  product_type TEXT NOT NULL,
  product_name TEXT NOT NULL,
  unit_price_cents INTEGER NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  subtotal_cents INTEGER NOT NULL,
  adult_pax INTEGER NOT NULL DEFAULT 0,
  child_pax INTEGER NOT NULL DEFAULT 0,
  date TIMESTAMP,
  slot TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 2. Data Backfill: Tours
-- Logic: Parse text price (e.g. '$120') into cents. 
-- We'll use a regex replace in Postgres to skip non-digits.
UPDATE tours SET 
  adult_price_cents = ROUND(CAST(NULLIF(regexp_replace(price, '[^0-9.]', '', 'g'), '') AS NUMERIC) * 100),
  child_price_cents = ROUND(CAST(NULLIF(regexp_replace(COALESCE(child_price, '0'), '[^0-9.]', '', 'g'), '') AS NUMERIC) * 100)
WHERE adult_price_cents IS NULL;

-- 3. Data Backfill: Bookings
UPDATE bookings SET 
  total_amount_cents = ROUND(CAST(NULLIF(regexp_replace(amount, '[^0-9.]', '', 'g'), '') AS NUMERIC) * 100),
  adult_pax_total = guests,
  child_pax_total = 0
WHERE total_amount_cents IS NULL;

-- 4. Create BookingItems for historical bookings
INSERT INTO booking_items (id, booking_id, product_id, product_type, product_name, unit_price_cents, quantity, subtotal_cents, adult_pax, child_pax)
SELECT 
  'bi_mig_' || b.id,
  b.id,
  b.tour_id,
  'tour',
  b.tour_name,
  CASE WHEN b.guests > 0 THEN b.total_amount_cents / b.guests ELSE 0 END,
  b.guests,
  b.total_amount_cents,
  b.guests,
  0
FROM bookings b
WHERE NOT EXISTS (SELECT 1 FROM booking_items WHERE booking_id = b.id)
AND b.total_amount_cents IS NOT NULL;
