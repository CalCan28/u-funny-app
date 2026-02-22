-- Create notifications table and trigger for audience joins
-- Run this in Supabase SQL Editor

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(user_id, is_read);

-- Enable Row Level Security
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for notifications table

-- Users can view their own notifications
CREATE POLICY "Users can view their own notifications" ON notifications
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update their own notifications" ON notifications
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- Users can delete their own notifications
CREATE POLICY "Users can delete their own notifications" ON notifications
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- System can insert notifications (via trigger)
CREATE POLICY "System can insert notifications" ON notifications
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Function to create notification when someone joins an audience
CREATE OR REPLACE FUNCTION notify_audience_join()
RETURNS TRIGGER AS $$
DECLARE
  actor_name TEXT;
  comedian_name TEXT;
BEGIN
  -- Get the name of the person joining
  SELECT COALESCE(stage_name, display_name, 'Someone') INTO actor_name
  FROM profiles
  WHERE id = NEW.audience_member_id;

  -- Create notification for the comedian
  INSERT INTO notifications (user_id, type, title, body, data)
  VALUES (
    NEW.comedian_id,
    'audience_join',
    'New Audience Member! 🎭',
    actor_name || ' has joined your audience',
    jsonb_build_object('actor_id', NEW.audience_member_id, 'audience_member_id', NEW.id)
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create notification on audience join
DROP TRIGGER IF EXISTS on_audience_join_notify ON audience_members;
CREATE TRIGGER on_audience_join_notify
  AFTER INSERT ON audience_members
  FOR EACH ROW
  EXECUTE FUNCTION notify_audience_join();

-- Enable realtime for notifications table
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
