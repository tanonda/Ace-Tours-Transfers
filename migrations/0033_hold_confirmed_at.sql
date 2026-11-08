-- Both confirmation services write availability_holds.confirmed_at, but the
-- column never existed; Drizzle silently dropped the field. Persist it.
ALTER TABLE "availability_holds" ADD COLUMN IF NOT EXISTS "confirmed_at" timestamp;
