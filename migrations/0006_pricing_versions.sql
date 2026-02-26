ALTER TABLE "pricing_versions"
ADD COLUMN IF NOT EXISTS "infant_price_cents" integer NOT NULL DEFAULT 0,
	ADD COLUMN IF NOT EXISTS "pet_price_cents" integer NOT NULL DEFAULT 0;