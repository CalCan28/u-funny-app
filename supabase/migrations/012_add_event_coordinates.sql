-- Add latitude and longitude columns to events table
-- so host-created events can appear on the Open Mic Finder map
ALTER TABLE events ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE events ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
