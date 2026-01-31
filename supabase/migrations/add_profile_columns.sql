-- ============================================
-- MIGRATION: Add missing columns to profiles
-- Run this in Supabase SQL Editor
-- ============================================

-- Add email_verified column (matches code expectation)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS email_verified boolean DEFAULT false;

-- Add instagram column
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS instagram varchar(100);

-- Add password column (for credentials auth)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS password text;

-- Migrate existing is_verified data to email_verified
UPDATE public.profiles 
SET email_verified = COALESCE(is_verified, false) 
WHERE email_verified IS NULL;

-- Optional: Keep is_verified for backward compatibility or drop it
-- DROP COLUMN is_verified; -- Uncomment if you want to remove

-- Create index for email_verified (useful for cleanup queries)
CREATE INDEX IF NOT EXISTS idx_profiles_email_verified 
ON public.profiles(email_verified);

-- Verification: Check columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles' AND table_schema = 'public'
ORDER BY ordinal_position;
