-- Add vehicle_details column to tours table for Vehicle Hire feature
-- This column stores vehicle-specific metadata as JSONB: { make, model, seats, transmission, features[] }

ALTER TABLE tours
ADD COLUMN IF NOT EXISTS vehicle_details JSONB;

-- Add comment for documentation
COMMENT ON COLUMN tours.vehicle_details IS 'JSON object with vehicle metadata: make, model, seats, transmission, features[]';
