-- Create community_videos table for video sharing feature
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS community_videos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  youtube_url TEXT NOT NULL,
  youtube_video_id TEXT,
  title TEXT,
  venue_name TEXT,
  performance_date DATE,
  thumbnail_url TEXT,
  status TEXT DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_community_videos_user_id ON community_videos(user_id);
CREATE INDEX IF NOT EXISTS idx_community_videos_status ON community_videos(status);
CREATE INDEX IF NOT EXISTS idx_community_videos_created_at ON community_videos(created_at DESC);

-- Enable Row Level Security
ALTER TABLE community_videos ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Anyone can view approved videos
CREATE POLICY "Anyone can view approved videos" ON community_videos
  FOR SELECT TO authenticated
  USING (status = 'approved');

-- Users can view their own videos regardless of status
CREATE POLICY "Users can view their own videos" ON community_videos
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Users can insert their own videos
CREATE POLICY "Users can create videos" ON community_videos
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own videos
CREATE POLICY "Users can update their own videos" ON community_videos
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own videos
CREATE POLICY "Users can delete their own videos" ON community_videos
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_community_videos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_community_videos_updated_at ON community_videos;
CREATE TRIGGER update_community_videos_updated_at
  BEFORE UPDATE ON community_videos
  FOR EACH ROW
  EXECUTE FUNCTION update_community_videos_updated_at();
