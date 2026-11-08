-- ─────────────────────────────────────────────────────────────────────────────
-- Indexes for the predicates the app actually uses. FKs do not create indexes
-- in PostgreSQL, and bookings had none beyond hold_id/fraud.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_bookings_email_lower   ON bookings (LOWER(customer_email));
CREATE INDEX IF NOT EXISTS idx_bookings_status_created ON bookings (status, created_at);
CREATE INDEX IF NOT EXISTS idx_bookings_created_at    ON bookings (created_at);
CREATE INDEX IF NOT EXISTS idx_bookings_session       ON bookings (booking_session_id);
CREATE INDEX IF NOT EXISTS idx_bookings_user          ON bookings (user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_tour          ON bookings (tour_id);
CREATE INDEX IF NOT EXISTS idx_bookings_date          ON bookings (date);
CREATE INDEX IF NOT EXISTS idx_booking_items_booking  ON booking_items (booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_addons_booking ON booking_addons (booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_booking       ON payments (booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_gateway       ON payments (gateway_id);
CREATE INDEX IF NOT EXISTS idx_payments_gateway_reference ON payments (gateway_reference) WHERE gateway_reference IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_overdue       ON payments (expires_at) WHERE status IN ('pending', 'manual_review_required');
CREATE INDEX IF NOT EXISTS idx_availability_holds_session  ON availability_holds (booking_session_id);
CREATE INDEX IF NOT EXISTS idx_availability_holds_instance ON availability_holds (tour_instance_id);
CREATE INDEX IF NOT EXISTS idx_session_expire         ON session (expire);

-- A strict prefix of idx_bookings_fraud_pending; the wider partial index is enough.
DROP INDEX IF EXISTS idx_bookings_fraud_level;
