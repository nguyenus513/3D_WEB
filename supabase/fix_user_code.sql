-- =============================================
-- Fix User Code Format: USR-XXXXXXXX
-- Run this in Supabase SQL Editor
-- =============================================

-- Step 1: Update handle_new_user function to use USR-XXXXXXXX format
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

-- Step 2: Update existing users with old format to new USR-XXXXXXXX format
UPDATE profiles 
SET customer_code = 'USR-' || UPPER(SUBSTR(REPLACE(gen_random_uuid()::TEXT, '-', ''), 1, 8)),
    updated_at = NOW()
WHERE customer_code IS NULL 
   OR customer_code NOT LIKE 'USR-%';

-- Step 3: Make sure trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Step 4: Verify updated data
SELECT id, email, customer_code, role, created_at FROM profiles ORDER BY created_at DESC LIMIT 10;

-- Done! All users now have USR-XXXXXXXX format
