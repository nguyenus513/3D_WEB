-- =============================================
-- FIX ADMIN ACCOUNT (v3)
-- Run in Supabase SQL Editor
-- =============================================

-- Step 1: Add unique constraint on email if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'profiles_email_key'
    ) THEN
        ALTER TABLE profiles ADD CONSTRAINT profiles_email_key UNIQUE (email);
    END IF;
END $$;

-- Step 2: Delete old admin if exists
DELETE FROM profiles WHERE email = 'admin@3dprint.vn';

-- Step 3: Create admin account with CORRECT bcrypt hash
-- Password: admin123
INSERT INTO profiles (id, email, full_name, name, password, role, customer_code, "emailVerified", created_at)
VALUES (
    gen_random_uuid(),
    'admin@3dprint.vn',
    'Admin',
    'Admin',
    '$2b$12$gonzAlk0WIaDbMy.gu.t.OwCwoCJBAP4upYQkZi9o6D4JMIG5QEEm', -- CORRECT hash for 'admin123'
    'admin',
    'ADM-' || UPPER(SUBSTR(REPLACE(gen_random_uuid()::TEXT, '-', ''), 1, 8)),
    NOW(),
    NOW()
);

-- Step 4: Verify - should show admin with password
SELECT id, email, full_name, role, 
       password IS NOT NULL as has_password, 
       LENGTH(password) as password_length,
       "emailVerified"
FROM profiles
WHERE email = 'admin@3dprint.vn';
