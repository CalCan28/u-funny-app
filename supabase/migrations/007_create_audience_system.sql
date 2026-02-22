-- Create audience system for "Join Audience" feature (like follow, but comedy-themed)
-- Run this in Supabase SQL Editor

-- Add audience_count to profiles if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'audience_count') THEN
    ALTER TABLE profiles ADD COLUMN audience_count INTEGER DEFAULT 0;
  END IF;
END $$;

-- Create audience_members table
CREATE TABLE IF NOT EXISTS audience_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  comedian_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  audience_member_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(comedian_id, audience_member_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_audience_members_comedian_id ON audience_members(comedian_id);
CREATE INDEX IF NOT EXISTS idx_audience_members_audience_member_id ON audience_members(audience_member_id);

-- Enable Row Level Security
ALTER TABLE audience_members ENABLE ROW LEVEL SECURITY;

-- RLS Policies for audience_members table

-- Anyone can view audience relationships
CREATE POLICY "Anyone can view audience members" ON audience_members
  FOR SELECT TO authenticated
  USING (true);

-- Users can join someone's audience (insert themselves as audience_member)
CREATE POLICY "Users can join audiences" ON audience_members
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = audience_member_id AND auth.uid() != comedian_id);

-- Users can leave an audience (delete their own membership)
CREATE POLICY "Users can leave audiences" ON audience_members
  FOR DELETE TO authenticated
  USING (auth.uid() = audience_member_id);

-- Function to increment audience count
CREATE OR REPLACE FUNCTION increment_audience_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE profiles
  SET audience_count = COALESCE(audience_count, 0) + 1
  WHERE id = NEW.comedian_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to decrement audience count
CREATE OR REPLACE FUNCTION decrement_audience_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE profiles
  SET audience_count = GREATEST(COALESCE(audience_count, 0) - 1, 0)
  WHERE id = OLD.comedian_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers to auto-update audience_count
DROP TRIGGER IF EXISTS on_audience_join ON audience_members;
CREATE TRIGGER on_audience_join
  AFTER INSERT ON audience_members
  FOR EACH ROW
  EXECUTE FUNCTION increment_audience_count();

DROP TRIGGER IF EXISTS on_audience_leave ON audience_members;
CREATE TRIGGER on_audience_leave
  AFTER DELETE ON audience_members
  FOR EACH ROW
  EXECUTE FUNCTION decrement_audience_count();
