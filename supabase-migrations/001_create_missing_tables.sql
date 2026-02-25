-- =============================================
-- Migration: Create missing tables for U Funny
-- Run this in your Supabase SQL editor
-- =============================================

-- 1. clip_feedback table (for Set Review Thread)
CREATE TABLE IF NOT EXISTS clip_feedback (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  clip_id UUID NOT NULL REFERENCES community_videos(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  what_worked TEXT NOT NULL DEFAULT '',
  what_to_improve TEXT NOT NULL DEFAULT '',
  next_rep TEXT NOT NULL DEFAULT '',
  punch_up_idea TEXT,
  tone_tag TEXT NOT NULL CHECK (tone_tag IN ('SUPPORTIVE', 'DIRECT', 'TECHNICAL')),
  intent_tag TEXT NOT NULL CHECK (intent_tag IN ('FUNNIER', 'CLEANER', 'CONFIDENT', 'TIGHTER')),
  rating_joke_craft SMALLINT NOT NULL CHECK (rating_joke_craft BETWEEN 1 AND 5),
  rating_timing_pacing SMALLINT NOT NULL CHECK (rating_timing_pacing BETWEEN 1 AND 5),
  rating_stage_presence SMALLINT NOT NULL CHECK (rating_stage_presence BETWEEN 1 AND 5),
  rating_originality SMALLINT NOT NULL CHECK (rating_originality BETWEEN 1 AND 5),
  rating_crowd_connection SMALLINT NOT NULL CHECK (rating_crowd_connection BETWEEN 1 AND 5),
  overall_score NUMERIC(3,2) GENERATED ALWAYS AS (
    (rating_joke_craft + rating_timing_pacing + rating_stage_presence + rating_originality + rating_crowd_connection)::NUMERIC / 5
  ) STORED,
  helpful_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(clip_id, author_id)
);

-- Indexes for clip_feedback
CREATE INDEX IF NOT EXISTS idx_clip_feedback_clip_id ON clip_feedback(clip_id);
CREATE INDEX IF NOT EXISTS idx_clip_feedback_author_id ON clip_feedback(author_id);
CREATE INDEX IF NOT EXISTS idx_clip_feedback_created_at ON clip_feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clip_feedback_helpful ON clip_feedback(helpful_count DESC, created_at DESC);

-- RLS for clip_feedback
ALTER TABLE clip_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read clip feedback"
  ON clip_feedback FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create feedback"
  ON clip_feedback FOR INSERT
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Authors can update their own feedback"
  ON clip_feedback FOR UPDATE
  USING (auth.uid() = author_id);

CREATE POLICY "Authors can delete their own feedback"
  ON clip_feedback FOR DELETE
  USING (auth.uid() = author_id);

-- 2. feedback_helpful_votes table
CREATE TABLE IF NOT EXISTS feedback_helpful_votes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  feedback_id UUID NOT NULL REFERENCES clip_feedback(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(feedback_id, user_id)
);

-- Indexes for feedback_helpful_votes
CREATE INDEX IF NOT EXISTS idx_helpful_votes_feedback ON feedback_helpful_votes(feedback_id);
CREATE INDEX IF NOT EXISTS idx_helpful_votes_user ON feedback_helpful_votes(user_id);

-- RLS for feedback_helpful_votes
ALTER TABLE feedback_helpful_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read helpful votes"
  ON feedback_helpful_votes FOR SELECT USING (true);

CREATE POLICY "Authenticated users can vote"
  ON feedback_helpful_votes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove their own votes"
  ON feedback_helpful_votes FOR DELETE
  USING (auth.uid() = user_id);

-- 3. Add 'reaction' column to feedback table if it doesn't exist
-- (used by CritiqueFeedbackScreen)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'feedback' AND column_name = 'reaction'
  ) THEN
    ALTER TABLE feedback ADD COLUMN reaction TEXT;
  END IF;
END $$;

-- 4. Add 'event_id' column to feedback table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'feedback' AND column_name = 'event_id'
  ) THEN
    ALTER TABLE feedback ADD COLUMN event_id UUID REFERENCES events(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 5. Trigger to auto-update helpful_count on clip_feedback
CREATE OR REPLACE FUNCTION update_helpful_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE clip_feedback SET helpful_count = helpful_count + 1 WHERE id = NEW.feedback_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE clip_feedback SET helpful_count = helpful_count - 1 WHERE id = OLD.feedback_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_helpful_count ON feedback_helpful_votes;
CREATE TRIGGER trigger_update_helpful_count
  AFTER INSERT OR DELETE ON feedback_helpful_votes
  FOR EACH ROW EXECUTE FUNCTION update_helpful_count();

-- 6. Updated_at trigger for clip_feedback
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_clip_feedback_updated ON clip_feedback;
CREATE TRIGGER trigger_clip_feedback_updated
  BEFORE UPDATE ON clip_feedback
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
