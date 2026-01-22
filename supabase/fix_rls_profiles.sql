-- Fix RLS Infinite Recursion for profiles table
-- Run this in Supabase SQL Editor

-- Step 1: Drop the problematic policy
DROP POLICY IF EXISTS "Users can view own profile or admin all" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Admin full access profiles" ON profiles;

-- Step 2: Create a SECURITY DEFINER function that doesn't cause recursion
-- This function checks admin status using auth.users metadata instead of profiles table
CREATE OR REPLACE FUNCTION is_admin_user()
RETURNS BOOLEAN AS $$
DECLARE
  user_role TEXT;
BEGIN
  -- Get role directly from profiles table with SECURITY DEFINER to bypass RLS
  SELECT role INTO user_role FROM profiles WHERE id = auth.uid();
  RETURN user_role = 'admin';
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Step 3: Create clean policies that don't reference profiles in subqueries
-- Policy 1: Everyone can view their own profile (no subquery needed)
CREATE POLICY "Users can view own profile" ON profiles 
FOR SELECT USING (auth.uid() = id);

-- Policy 2: Admin full access using the SECURITY DEFINER function
CREATE POLICY "Admin full access profiles" ON profiles 
FOR ALL USING (is_admin_user());

-- Policy 3: Allow insert for auth trigger
DROP POLICY IF EXISTS "Allow insert for auth" ON profiles;
CREATE POLICY "Allow insert for auth" ON profiles 
FOR INSERT WITH CHECK (true);

-- Policy 4: Users can update own profile
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles 
FOR UPDATE USING (auth.uid() = id);

-- Verify policies
SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'profiles';
