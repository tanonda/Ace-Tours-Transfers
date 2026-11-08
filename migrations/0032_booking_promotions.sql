-- ─────────────────────────────────────────────────────────────────────────────
-- Record the promotion applied to a booking. The server now validates the code,
-- reduces the booking total, and increments promotions.used_count in the same
-- transaction that creates the booking.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "promo_code" text;
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "discount_cents" integer DEFAULT 0 NOT NULL;
