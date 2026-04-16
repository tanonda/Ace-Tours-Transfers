ALTER TABLE "feature_flags" ADD COLUMN IF NOT EXISTS "rollout_percentage" integer DEFAULT 0 NOT NULL;
ALTER TABLE "feature_flags" ADD COLUMN IF NOT EXISTS "updated_by" text DEFAULT 'system' NOT NULL;

INSERT INTO "feature_flags" ("slug", "enabled", "display_name", "description", "rollout_percentage", "updated_by")
VALUES ('USE_PRICING_ENGINE', false, 'Pricing Engine', 'Use unified PricingEngine for all pricing calculations (Phase 2E)', 0, 'system')
ON CONFLICT ("slug") DO NOTHING;
