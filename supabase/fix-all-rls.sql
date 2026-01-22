-- =============================================
-- COMPREHENSIVE RLS FIX
-- Fix all Supabase warnings at once
-- =============================================

BEGIN;

-- =============================================
-- 1. FIX verification_tokens
-- Enable RLS or disable it completely
-- =============================================

-- Option A: Disable RLS (simpler, service_role bypasses anyway)
ALTER TABLE public.verification_tokens DISABLE ROW LEVEL SECURITY;

-- Drop policies since RLS is disabled
DROP POLICY IF EXISTS "verification_tokens_delete" ON public.verification_tokens;
DROP POLICY IF EXISTS "verification_tokens_insert" ON public.verification_tokens;
DROP POLICY IF EXISTS "verification_tokens_select" ON public.verification_tokens;

-- =============================================
-- 2. FIX profiles - Clean up policies
-- =============================================

-- Drop ALL existing policies first
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow read profile by email" ON public.profiles;
DROP POLICY IF EXISTS "profiles_read" ON public.profiles;
DROP POLICY IF EXISTS "profiles_write" ON public.profiles;

-- Create optimized policies with (select auth.uid())
-- Single SELECT policy (avoid duplicates)
CREATE POLICY "profiles_read" ON public.profiles
    FOR SELECT
    USING (true);  -- Allow all reads (password is hashed anyway)

-- UPDATE policy with optimized auth check
CREATE POLICY "profiles_update" ON public.profiles
    FOR UPDATE
    USING ((select auth.uid()) = id)
    WITH CHECK ((select auth.uid()) = id);

-- INSERT policy (allow service_role only)
CREATE POLICY "profiles_insert" ON public.profiles
    FOR INSERT
    WITH CHECK (false);  -- Only service_role can insert (bypasses RLS)

-- =============================================
-- 3. ENABLE LEAKED PASSWORD PROTECTION
-- This needs to be done in Supabase Dashboard:
-- Authentication > Providers > Email > 
-- Enable "Leaked password protection"
-- =============================================

COMMIT;

-- Verify
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE tablename IN ('profiles', 'verification_tokens')
ORDER BY tablename, policyname;
