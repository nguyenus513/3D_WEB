-- =============================================
-- FIX RLS POLICIES FOR PROFILES TABLE
-- Allow users to read their own profile
-- =============================================

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "profiles_select" ON profiles;
DROP POLICY IF EXISTS "profiles_update" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- Create policies that allow users to read/update their own profile
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT
    USING (auth.uid() = id OR auth.role() = 'service_role');

CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Also allow anon to read profiles by email (for login lookup)
-- This is needed for the frontend to fetch user info
CREATE POLICY "Allow read profile by email" ON profiles
    FOR SELECT
    USING (true);

-- Verify
SELECT schemaname, tablename, policyname FROM pg_policies WHERE tablename = 'profiles';
