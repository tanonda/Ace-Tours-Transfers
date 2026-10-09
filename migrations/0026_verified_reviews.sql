-- Migration 0026: verified customer reviews.
--
-- New reviews always start pending (the old default published them), a
-- verified flag marks reviews tied to a completed booking, and one review per
-- (booking, product) — that index is what makes an emailed invite link
-- single-use. Existing rows are unchanged. Safe to re-run.

ALTER TABLE reviews ALTER COLUMN status SET DEFAULT 'pending';
--> statement-breakpoint
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS verified boolean NOT NULL DEFAULT false;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS reviews_booking_product_uniq ON reviews (booking_id, tour_id) WHERE booking_id IS NOT NULL;
