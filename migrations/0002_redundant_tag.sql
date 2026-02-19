DROP INDEX "idx_tour_instances_unique";
--> statement-breakpoint
ALTER TABLE "bookings"
ADD COLUMN IF NOT EXISTS "pickup_location" text;
--> statement-breakpoint
ALTER TABLE "bookings"
ADD COLUMN IF NOT EXISTS "confirmed_at" timestamp;
--> statement-breakpoint
ALTER TABLE "bookings"
ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "bookings"
ADD COLUMN IF NOT EXISTS "notes" text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_availability_holds_expiry" ON "availability_holds" USING btree ("status", "expires_at");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_bookings_hold_unique" ON "bookings" USING btree ("hold_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_tour_instances_unique" ON "tour_instances" USING btree (
    "tour_id",
    "service_date",
    "time_slot",
    "start_time",
    "end_time"
);