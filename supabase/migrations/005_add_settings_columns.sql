-- Add settings columns to profiles table for Settings & Privacy feature
-- Run this in Supabase SQL Editor

-- Add notification settings columns
DO $$
BEGIN
  -- Push notifications toggle
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'push_notifications') THEN
    ALTER TABLE profiles ADD COLUMN push_notifications BOOLEAN DEFAULT true;
  END IF;

  -- Email notifications toggle
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'email_notifications') THEN
    ALTER TABLE profiles ADD COLUMN email_notifications BOOLEAN DEFAULT true;
  END IF;

  -- Event reminders toggle
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'event_reminders') THEN
    ALTER TABLE profiles ADD COLUMN event_reminders BOOLEAN DEFAULT true;
  END IF;

  -- Critique privacy setting (everyone, same_event, none)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'critique_privacy') THEN
    ALTER TABLE profiles ADD COLUMN critique_privacy TEXT DEFAULT 'everyone';
  END IF;

  -- Show check-in activity toggle
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'show_checkin_activity') THEN
    ALTER TABLE profiles ADD COLUMN show_checkin_activity BOOLEAN DEFAULT true;
  END IF;
END $$;

-- Add constraint for critique_privacy valid values
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS critique_privacy_check;
ALTER TABLE profiles ADD CONSTRAINT critique_privacy_check
  CHECK (critique_privacy IN ('everyone', 'same_event', 'none'));
