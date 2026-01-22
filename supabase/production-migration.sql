-- =============================================
-- PRODUCTION MIGRATION SQL (v2)
-- 3D Print Shop Database
-- =============================================
-- 
-- ⚠️ IMPORTANT: BACKUP YOUR DATABASE BEFORE RUNNING!
-- 
-- This script:
-- 1. Modifies profiles table to work standalone (no FK to auth.users)
-- 2. Migrates data from 'users' table to 'profiles' table  
-- 3. Standardizes customer_code format (USR-XXXXXXXX)
-- 4. Fixes RLS policies
-- 
-- Run in Supabase SQL Editor
-- =============================================

-- =============================================
-- STEP 1: DISABLE FOREIGN KEY TEMPORARILY
-- =============================================

-- Drop the foreign key constraint on profiles.id
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- =============================================
-- STEP 2: FIX PROFILES TABLE STRUCTURE
-- =============================================

-- Add missing columns to profiles if they don't exist
DO $$ 
BEGIN
    -- Add password column for credentials auth
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'profiles' AND column_name = 'password') THEN
        ALTER TABLE profiles ADD COLUMN password TEXT;
    END IF;

    -- Add name column (alias for full_name)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'profiles' AND column_name = 'name') THEN
        ALTER TABLE profiles ADD COLUMN name TEXT;
    END IF;

    -- Add emailVerified column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'profiles' AND column_name = 'emailVerified') THEN
        ALTER TABLE profiles ADD COLUMN "emailVerified" TIMESTAMPTZ;
    END IF;
END $$;

-- =============================================
-- STEP 3: MIGRATE DATA FROM USERS TO PROFILES
-- =============================================

-- Insert users data into profiles (skip if already exists by email)
INSERT INTO profiles (id, email, full_name, name, phone, customer_code, password, "emailVerified", role, created_at)
SELECT 
    u.id,
    u.email,
    COALESCE(u.name, u.email),
    u.name,
    u.phone,
    CASE 
        WHEN u.customer_code IS NOT NULL AND u.customer_code LIKE 'USR-%' THEN u.customer_code
        ELSE 'USR-' || UPPER(SUBSTR(REPLACE(gen_random_uuid()::TEXT, '-', ''), 1, 8))
    END,
    u.password,
    u."emailVerified",
    CASE 
        WHEN u.role = 'admin' THEN 'admin'
        ELSE 'customer'
    END,
    u.created_at
FROM users u
WHERE NOT EXISTS (
    SELECT 1 FROM profiles p WHERE p.email = u.email
)
ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    name = COALESCE(EXCLUDED.name, profiles.name),
    password = COALESCE(EXCLUDED.password, profiles.password),
    "emailVerified" = COALESCE(EXCLUDED."emailVerified", profiles."emailVerified"),
    updated_at = NOW();

-- =============================================
-- STEP 4: FIX CUSTOMER_CODE FORMAT
-- =============================================

-- Update all customer_codes to USR-XXXXXXXX format
UPDATE profiles 
SET customer_code = 'USR-' || UPPER(SUBSTR(REPLACE(gen_random_uuid()::TEXT, '-', ''), 1, 8)),
    updated_at = NOW()
WHERE customer_code IS NULL 
   OR customer_code NOT LIKE 'USR-%'
   OR LENGTH(customer_code) != 12;

-- =============================================
-- STEP 5: UPDATE HANDLE_NEW_USER TRIGGER
-- =============================================

-- Create improved function with USR-XXXXXXXX format
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO profiles (id, email, customer_code, role)
    VALUES (
        NEW.id, 
        NEW.email,
        'USR-' || UPPER(SUBSTR(REPLACE(gen_random_uuid()::TEXT, '-', ''), 1, 8)),
        'customer'
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger (only if using Supabase Auth)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =============================================
-- STEP 6: FIX RLS POLICIES
-- =============================================

-- Drop all existing problematic policies
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile or admin all" ON profiles;
DROP POLICY IF EXISTS "Admin full access profiles" ON profiles;
DROP POLICY IF EXISTS "Allow insert for auth" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
DROP POLICY IF EXISTS "profiles_select_admin" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_auth" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
DROP POLICY IF EXISTS "profiles_all_admin" ON profiles;

-- Create admin check function (SECURITY DEFINER to avoid recursion)
CREATE OR REPLACE FUNCTION is_admin_user()
RETURNS BOOLEAN AS $$
DECLARE
    user_role TEXT;
BEGIN
    SELECT role INTO user_role FROM profiles WHERE id = auth.uid();
    RETURN user_role = 'admin';
EXCEPTION
    WHEN OTHERS THEN
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Create clean policies
CREATE POLICY "profiles_select_own" ON profiles 
FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles_select_admin" ON profiles 
FOR SELECT USING (is_admin_user());

CREATE POLICY "profiles_insert_auth" ON profiles 
FOR INSERT WITH CHECK (true);

CREATE POLICY "profiles_update_own" ON profiles 
FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "profiles_all_admin" ON profiles 
FOR ALL USING (is_admin_user());

-- =============================================
-- STEP 7: CREATE INDEXES FOR PERFORMANCE
-- =============================================

CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_customer_code ON profiles(customer_code);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- =============================================
-- STEP 8: VERIFICATION
-- =============================================

-- Show updated profiles
SELECT id, email, full_name, customer_code, role, created_at 
FROM profiles 
ORDER BY created_at DESC 
LIMIT 10;

-- Show profile count by role
SELECT role, COUNT(*) as count FROM profiles GROUP BY role;

-- =============================================
-- DONE!
-- =============================================
