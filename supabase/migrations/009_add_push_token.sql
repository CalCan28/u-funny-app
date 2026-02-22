-- Add push_token column to profiles for push notifications
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS push_token TEXT;
