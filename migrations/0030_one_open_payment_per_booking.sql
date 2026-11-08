-- ─────────────────────────────────────────────────────────────────────────────
-- At most one open payment per booking.
--
-- `initiateBookingPayment` checks for an open payment and then inserts; two
-- concurrent checkout requests can both pass the check and create two chargeable
-- attempts. The partial unique index makes the database the arbiter.
--
-- Existing duplicate open payments are cancelled (the newest is kept) before the
-- index is created. They are stale attempts, not settled money.
-- ─────────────────────────────────────────────────────────────────────────────
WITH ranked AS (
  SELECT id,
         row_number() OVER (PARTITION BY booking_id ORDER BY created_at DESC, id DESC) AS rn
  FROM payments
  WHERE status IN ('pending', 'processing', 'manual_review_required')
)
UPDATE payments p
SET status = 'cancelled',
    failure_reason = 'superseded_open_payment',
    updated_at = NOW()
FROM ranked r
WHERE p.id = r.id AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_one_open_per_booking
  ON payments (booking_id)
  WHERE status IN ('pending', 'processing', 'manual_review_required');
