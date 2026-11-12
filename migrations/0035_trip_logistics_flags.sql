-- Trip logistics check: staff flags read from a booking's free-text pickup/notes boxes,
-- and a per-product switch for "this service needs a flight number".
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "logistics_flags" jsonb;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "requires_flight_info" boolean NOT NULL DEFAULT false;
-- One-off starting point: airport transfers need a flight number. Editable per product in Admin → Products.
UPDATE "products" SET "requires_flight_info" = true WHERE "category" = 'transfer' AND "title" ILIKE '%airport%';
