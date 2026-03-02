-- Migration 0016: Tour detail page enhancements
-- Adds: itinerary stop points, meeting/pickup info, cancellation policy,
--       additional info, traveler photos, and opening hours

ALTER TABLE tours
  -- Itinerary stop points: JSON array of { id, name, duration, description (HTML), admissionIncluded }
  ADD COLUMN IF NOT EXISTS itinerary_stops jsonb DEFAULT '[]'::jsonb,
  -- Meeting / pickup information
  ADD COLUMN IF NOT EXISTS meeting_point text,
  ADD COLUMN IF NOT EXISTS meeting_point_map_url text,
  ADD COLUMN IF NOT EXISTS pickup_instructions text,
  ADD COLUMN IF NOT EXISTS operating_hours text,
  -- What's included (structured) - replaces description[1] approach
  -- included_items: string[] of included items
  -- excluded_items: string[] of NOT included items
  ADD COLUMN IF NOT EXISTS included_items jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS excluded_items jsonb DEFAULT '[]'::jsonb,
  -- Cancellation policy full text (HTML)
  ADD COLUMN IF NOT EXISTS cancellation_policy text,
  -- Additional info requirements
  ADD COLUMN IF NOT EXISTS additional_info jsonb DEFAULT '[]'::jsonb,
  -- Support/questions contact details
  ADD COLUMN IF NOT EXISTS support_email text,
  ADD COLUMN IF NOT EXISTS support_phone text,
  ADD COLUMN IF NOT EXISTS product_code text,
  -- Traveler uploaded photos (curated array of URLs)
  ADD COLUMN IF NOT EXISTS traveler_photos jsonb DEFAULT '[]'::jsonb;

-- Booking window hours: how many hours before tour start booking closes
ALTER TABLE tours
  ADD COLUMN IF NOT EXISTS booking_cutoff_hours integer DEFAULT 24;
