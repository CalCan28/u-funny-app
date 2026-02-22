-- Add missing columns to profiles table for Edit Profile feature
-- Run this in Supabase SQL Editor

-- Add columns if they don't exist (using DO block for conditional adds)
DO $$
BEGIN
  -- Display name
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'display_name') THEN
    ALTER TABLE profiles ADD COLUMN display_name TEXT;
  END IF;

  -- Stage name (performer name)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'stage_name') THEN
    ALTER TABLE profiles ADD COLUMN stage_name TEXT;
  END IF;

  -- Bio
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'bio') THEN
    ALTER TABLE profiles ADD COLUMN bio TEXT;
  END IF;

  -- Years of experience
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'years_experience') THEN
    ALTER TABLE profiles ADD COLUMN years_experience TEXT;
  END IF;

  -- Home city
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'home_city') THEN
    ALTER TABLE profiles ADD COLUMN home_city TEXT;
  END IF;

  -- Instagram handle
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'instagram_handle') THEN
    ALTER TABLE profiles ADD COLUMN instagram_handle TEXT;
  END IF;

  -- TikTok handle
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'tiktok_handle') THEN
    ALTER TABLE profiles ADD COLUMN tiktok_handle TEXT;
  END IF;

  -- Avatar URL (for profile photo)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'avatar_url') THEN
    ALTER TABLE profiles ADD COLUMN avatar_url TEXT;
  END IF;

  -- Updated at timestamp
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'updated_at') THEN
    ALTER TABLE profiles ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- Add constraint for bio length (max 200 characters)
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS bio_length_check;
ALTER TABLE profiles ADD CONSTRAINT bio_length_check CHECK (char_length(bio) <= 200);

-- Create or update the updated_at trigger for profiles
CREATE OR REPLACE FUNCTION update_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_profiles_updated_at();

-- Create storage bucket for avatars if it doesn't exist
-- Note: This needs to be done via Supabase Dashboard or API, not SQL
-- Go to Storage > Create new bucket > Name: "avatars" > Public: true

-- Storage policies for avatars bucket (run after creating the bucket)
-- These allow authenticated users to upload/update their own avatar

-- Policy: Users can upload their own avatar
-- INSERT policy
CREATE POLICY "Users can upload their own avatar" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Policy: Users can update their own avatar
-- UPDATE policy
CREATE POLICY "Users can update their own avatar" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Policy: Users can delete their own avatar
-- DELETE policy
CREATE POLICY "Users can delete their own avatar" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Policy: Anyone can view avatars (public)
-- SELECT policy
CREATE POLICY "Anyone can view avatars" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'avatars');
