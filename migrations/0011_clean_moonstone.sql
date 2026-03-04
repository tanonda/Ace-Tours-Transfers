ALTER TABLE "pricing_versions" ALTER COLUMN "adult_price_cents" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "pricing_versions" ADD COLUMN "infant_price_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "pricing_versions" ADD COLUMN "pet_price_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "pricing_versions" ADD COLUMN "pricing_type" text DEFAULT 'per_person' NOT NULL;--> statement-breakpoint
ALTER TABLE "pricing_versions" ADD COLUMN "group_price_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "photo_url" text;--> statement-breakpoint
ALTER TABLE "tours" ADD COLUMN "pricing_type" text DEFAULT 'per_person' NOT NULL;--> statement-breakpoint
ALTER TABLE "tours" ADD COLUMN "group_price_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "tours" ADD COLUMN "group_max_pax" integer;--> statement-breakpoint
ALTER TABLE "tours" ADD COLUMN "seo_title" text;--> statement-breakpoint
ALTER TABLE "tours" ADD COLUMN "seo_description" text;--> statement-breakpoint
ALTER TABLE "tours" ADD COLUMN "seo_keywords" text;--> statement-breakpoint
ALTER TABLE "tours" ADD COLUMN "image_alt" text;--> statement-breakpoint
ALTER TABLE "tours" ADD COLUMN "itinerary_stops" jsonb;--> statement-breakpoint
ALTER TABLE "tours" ADD COLUMN "itinerary_intro" text;--> statement-breakpoint
ALTER TABLE "tours" ADD COLUMN "contact_for_price" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tours" ADD COLUMN "meeting_point" text;--> statement-breakpoint
ALTER TABLE "tours" ADD COLUMN "meeting_point_map_url" text;--> statement-breakpoint
ALTER TABLE "tours" ADD COLUMN "pickup_instructions" text;--> statement-breakpoint
ALTER TABLE "tours" ADD COLUMN "operating_hours" text;--> statement-breakpoint
ALTER TABLE "tours" ADD COLUMN "included_items" jsonb;--> statement-breakpoint
ALTER TABLE "tours" ADD COLUMN "excluded_items" jsonb;--> statement-breakpoint
ALTER TABLE "tours" ADD COLUMN "cancellation_policy" text;--> statement-breakpoint
ALTER TABLE "tours" ADD COLUMN "booking_cutoff_hours" integer DEFAULT 24;--> statement-breakpoint
ALTER TABLE "tours" ADD COLUMN "additional_info" jsonb;--> statement-breakpoint
ALTER TABLE "tours" ADD COLUMN "support_email" text;--> statement-breakpoint
ALTER TABLE "tours" ADD COLUMN "support_phone" text;--> statement-breakpoint
ALTER TABLE "tours" ADD COLUMN "product_code" text;--> statement-breakpoint
ALTER TABLE "tours" ADD COLUMN "traveler_photos" jsonb;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;