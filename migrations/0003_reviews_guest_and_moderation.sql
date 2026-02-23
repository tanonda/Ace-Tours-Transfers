-- Migration: Add moderation status and guest review support to the reviews table
-- Allows:
--   1. Admin moderation: status column (pending | approved | rejected)
--   2. Guest reviews: nullable userId/bookingId, plus guestName/guestEmail/isGuest columns

--> statement-breakpoint
-- Make userId nullable so guests (no account) can submit reviews
ALTER TABLE "reviews"
ALTER COLUMN "user_id" DROP NOT NULL;

--> statement-breakpoint
-- Make bookingId nullable so guest reviews don't require a booking reference
ALTER TABLE "reviews"
ALTER COLUMN "booking_id" DROP NOT NULL;

--> statement-breakpoint
-- Add moderation status. Existing reviews default to 'approved' to preserve visibility.
ALTER TABLE "reviews"
ADD COLUMN IF NOT EXISTS "status" varchar(20) NOT NULL DEFAULT 'approved';

--> statement-breakpoint
-- Guest reviewer display name (populated when user_id is NULL)
ALTER TABLE "reviews"
ADD COLUMN IF NOT EXISTS "guest_name" varchar(200);

--> statement-breakpoint
-- Guest reviewer email (optional, for internal follow-up only — never exposed publicly)
ALTER TABLE "reviews"
ADD COLUMN IF NOT EXISTS "guest_email" varchar(300);

--> statement-breakpoint
-- Flag to distinguish guest-submitted reviews from registered-user reviews
ALTER TABLE "reviews"
ADD COLUMN IF NOT EXISTS "is_guest" boolean NOT NULL DEFAULT false;

--> statement-breakpoint
-- Index for efficient moderation queue queries (filter by status)
CREATE INDEX IF NOT EXISTS "idx_reviews_status" ON "reviews" USING btree ("status");

--> statement-breakpoint
-- Index for tour-level review lookups (used on product detail pages)
CREATE INDEX IF NOT EXISTS "idx_reviews_tour_id" ON "reviews" USING btree ("tour_id");
