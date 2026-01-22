-- Add Instagram username column to profiles table
-- Run this in Supabase SQL Editor

-- Add column if not exists
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS instagram_username TEXT;

-- Optional: Add comment for documentation
COMMENT ON COLUMN profiles.instagram_username IS 'Instagram username of the customer (without @)';

-- Verify
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles' AND column_name = 'instagram_username';
