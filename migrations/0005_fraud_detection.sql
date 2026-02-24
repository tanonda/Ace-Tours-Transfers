-- Migration 0005: Fraud Detection Layer
-- Adds dedicated, typed columns to the bookings table for fraud risk data.
-- This replaces the notes-field prefix approach with proper relational columns.

ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "fraud_score" integer;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "fraud_level" varchar(10);--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "fraud_signals" jsonb;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "fraud_reviewed_at" timestamp;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "fraud_reviewed_by" varchar REFERENCES "users"("id");--> statement-breakpoint

-- Index for efficient admin fraud queue queries
CREATE INDEX IF NOT EXISTS "idx_bookings_fraud_level" ON "bookings" ("fraud_level") WHERE "fraud_level" IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_bookings_fraud_pending" ON "bookings" ("fraud_level", "fraud_reviewed_at") WHERE "fraud_level" IS NOT NULL AND "fraud_reviewed_at" IS NULL;
