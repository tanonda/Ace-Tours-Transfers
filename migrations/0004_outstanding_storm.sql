ALTER TABLE "reviews" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "reviews" ALTER COLUMN "booking_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "booking_items" ADD COLUMN "infant_pax" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "booking_items" ADD COLUMN "pet_pax" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "infant_pax_total" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "pet_pax_total" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "status" varchar(20) DEFAULT 'approved' NOT NULL;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "guest_name" varchar(200);--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "guest_email" varchar(300);--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "is_guest" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tours" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;