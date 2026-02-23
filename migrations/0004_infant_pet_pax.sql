-- Migration: 0004_infant_pet_pax.sql
-- Adds infantPax / petPax columns to bookings and booking_items tables.
-- Infants (under 2) and Pets are tracked for manifesting purposes but
-- do NOT affect pricing (price is always 0 for both categories).

-- ── bookings (top-level aggregate display fields) ────────────────────────────
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS infant_pax_total INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pet_pax_total     INTEGER NOT NULL DEFAULT 0;

-- ── booking_items (authoritative per-item detail) ────────────────────────────
ALTER TABLE booking_items
  ADD COLUMN IF NOT EXISTS infant_pax INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pet_pax     INTEGER NOT NULL DEFAULT 0;

-- ── Comments ─────────────────────────────────────────────────────────────────
COMMENT ON COLUMN bookings.infant_pax_total IS 'Total infants (under 2) across all items — display only, no pricing impact';
COMMENT ON COLUMN bookings.pet_pax_total    IS 'Total pets across all items — display only, no pricing impact';
COMMENT ON COLUMN booking_items.infant_pax  IS 'Infants for this item — no pricing impact, manifesting only';
COMMENT ON COLUMN booking_items.pet_pax     IS 'Pets for this item — no pricing impact, manifesting only';
