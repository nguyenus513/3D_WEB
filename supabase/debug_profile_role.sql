-- DEBUG: Check profile role
-- Run this in Supabase SQL Editor

-- 1. Check all profiles with role
SELECT id, email, role, full_name, customer_code, created_at 
FROM profiles 
ORDER BY created_at DESC 
LIMIT 10;

-- 2. Check your specific email (replace with your email)
-- SELECT * FROM profiles WHERE email = 'your-email@example.com';

-- 3. Check if role column has correct enum values
SELECT DISTINCT role FROM profiles;

-- 4. Fix: Update role to admin for your email (replace with your email)
-- UPDATE profiles SET role = 'admin' WHERE email = 'your-email@example.com';
