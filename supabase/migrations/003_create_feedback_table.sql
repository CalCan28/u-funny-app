-- =============================================
-- 003: Create Feedback Table for Tips & Critiques
-- =============================================
-- Run this in Supabase SQL Editor
-- This creates the feedback table for comedian critiques

-- Create feedback table
CREATE TABLE IF NOT EXISTS public.feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who gave and received the feedback
  giver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Event details
  event_name TEXT,
  venue TEXT,
  event_date DATE,

  -- Feedback content
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  feedback_text TEXT,

  -- Privacy
  is_anonymous BOOLEAN DEFAULT false,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Prevent self-feedback
  CONSTRAINT no_self_feedback CHECK (giver_id != receiver_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_feedback_receiver ON public.feedback(receiver_id);
CREATE INDEX IF NOT EXISTS idx_feedback_giver ON public.feedback(giver_id);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON public.feedback(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS Policies for Feedback Table
-- =============================================

-- Policy: Users can view feedback they received
CREATE POLICY "Users can view received feedback"
  ON public.feedback
  FOR SELECT
  USING (receiver_id = auth.uid());

-- Policy: Users can view feedback they gave
CREATE POLICY "Users can view given feedback"
  ON public.feedback
  FOR SELECT
  USING (giver_id = auth.uid());

-- Policy: Authenticated users can give feedback to others
CREATE POLICY "Users can give feedback"
  ON public.feedback
  FOR INSERT
  WITH CHECK (
    auth.uid() = giver_id
    AND auth.uid() != receiver_id
  );

-- Policy: Users can update their own feedback within 24 hours
CREATE POLICY "Users can update own feedback within 24 hours"
  ON public.feedback
  FOR UPDATE
  USING (
    giver_id = auth.uid()
    AND created_at > NOW() - INTERVAL '24 hours'
  );

-- Policy: Users can delete their own feedback within 24 hours
CREATE POLICY "Users can delete own feedback within 24 hours"
  ON public.feedback
  FOR DELETE
  USING (
    giver_id = auth.uid()
    AND created_at > NOW() - INTERVAL '24 hours'
  );

-- =============================================
-- Function to update updated_at timestamp
-- =============================================
CREATE OR REPLACE FUNCTION update_feedback_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS feedback_updated_at ON public.feedback;
CREATE TRIGGER feedback_updated_at
  BEFORE UPDATE ON public.feedback
  FOR EACH ROW
  EXECUTE FUNCTION update_feedback_updated_at();

-- =============================================
-- View for feedback with giver profile info
-- (Only shows giver info if not anonymous)
-- =============================================
CREATE OR REPLACE VIEW public.feedback_with_profiles AS
SELECT
  f.id,
  f.giver_id,
  f.receiver_id,
  f.event_name,
  f.venue,
  f.event_date,
  f.rating,
  f.feedback_text,
  f.is_anonymous,
  f.created_at,
  f.updated_at,
  -- Giver info (hidden if anonymous, unless you're the giver)
  CASE
    WHEN f.is_anonymous AND f.giver_id != auth.uid() THEN NULL
    ELSE giver.display_name
  END as giver_display_name,
  CASE
    WHEN f.is_anonymous AND f.giver_id != auth.uid() THEN NULL
    ELSE giver.stage_name
  END as giver_stage_name,
  CASE
    WHEN f.is_anonymous AND f.giver_id != auth.uid() THEN NULL
    ELSE giver.avatar_url
  END as giver_avatar_url,
  -- Receiver info (always visible)
  receiver.display_name as receiver_display_name,
  receiver.stage_name as receiver_stage_name,
  receiver.avatar_url as receiver_avatar_url
FROM public.feedback f
LEFT JOIN public.profiles giver ON f.giver_id = giver.id
LEFT JOIN public.profiles receiver ON f.receiver_id = receiver.id;

-- Grant access to the view
GRANT SELECT ON public.feedback_with_profiles TO authenticated;
