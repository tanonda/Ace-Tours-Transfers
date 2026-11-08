-- ─────────────────────────────────────────────────────────────────────────────
-- bookings.locale has been in shared/schema.ts and written by the app, but no
-- migration ever created it. A database rebuilt from ./migrations would fail
-- every SELECT that asks for the column. Add it explicitly.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "locale" text DEFAULT 'en' NOT NULL;
