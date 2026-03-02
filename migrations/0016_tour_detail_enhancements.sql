-- Migration 0016: Tour detail page enhancements
-- Adds: itinerary stop points, meeting/pickup info, cancellation policy,
--       additional info, traveler photos, opening hours, and review photos

ALTER TABLE tours
  -- Itinerary stop points: JSON array of { id, name, duration, description (HTML), admissionIncluded }
  ADD COLUMN IF NOT EXISTS itinerary_stops       jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS itinerary_intro        text,
  -- Meeting / pickup information
  ADD COLUMN IF NOT EXISTS meeting_point          text,
  ADD COLUMN IF NOT EXISTS meeting_point_map_url  text,
  ADD COLUMN IF NOT EXISTS pickup_instructions    text,
  ADD COLUMN IF NOT EXISTS operating_hours        text,
  -- What's included (structured) - replaces description[1] approach
  ADD COLUMN IF NOT EXISTS included_items         jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS excluded_items         jsonb DEFAULT '[]'::jsonb,
  -- Cancellation policy full text (HTML) and booking window cutoff
  ADD COLUMN IF NOT EXISTS cancellation_policy    text,
  ADD COLUMN IF NOT EXISTS booking_cutoff_hours   integer DEFAULT 24,
  -- Additional info requirements
  ADD COLUMN IF NOT EXISTS additional_info        jsonb DEFAULT '[]'::jsonb,
  -- Support/questions contact details
  ADD COLUMN IF NOT EXISTS support_email          text,
  ADD COLUMN IF NOT EXISTS support_phone          text,
  ADD COLUMN IF NOT EXISTS product_code           text,
  -- Traveler uploaded / admin-curated photos (array of Cloudinary URLs)
  ADD COLUMN IF NOT EXISTS traveler_photos        jsonb DEFAULT '[]'::jsonb;

-- Optional reviewer photo attached to a review submission
ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS photo_url text;
