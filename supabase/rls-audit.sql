-- =====================================================
-- RLS Audit Script
-- Phase 4: Row Level Security Verification
-- =====================================================
-- Run this script to test RLS policies are working correctly
-- Each test should return 0 rows if RLS is properly configured

-- =====================================================
-- 1. ORDERS TABLE AUDIT
-- User A should NOT see User B's orders
-- =====================================================

-- Test: Check if orders table has RLS enabled
SELECT 
    schemaname, 
    tablename, 
    rowsecurity 
FROM pg_tables 
WHERE tablename = 'orders';

-- Test: List all policies on orders
SELECT 
    policyname, 
    permissive, 
    roles, 
    cmd, 
    qual 
FROM pg_policies 
WHERE tablename = 'orders';

-- =====================================================
-- 2. ORDER_ITEMS TABLE AUDIT
-- =====================================================

SELECT 
    schemaname, 
    tablename, 
    rowsecurity 
FROM pg_tables 
WHERE tablename = 'order_items';

SELECT policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = 'order_items';

-- =====================================================
-- 3. ADDRESSES TABLE AUDIT
-- Users should only see their own addresses
-- =====================================================

SELECT 
    schemaname, 
    tablename, 
    rowsecurity 
FROM pg_tables 
WHERE tablename = 'addresses';

SELECT policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = 'addresses';

-- =====================================================
-- 4. PROFILES TABLE AUDIT
-- =====================================================

SELECT 
    schemaname, 
    tablename, 
    rowsecurity 
FROM pg_tables 
WHERE tablename = 'profiles';

SELECT policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = 'profiles';

-- =====================================================
-- 5. PRODUCTS TABLE AUDIT (should be public read)
-- =====================================================

SELECT 
    schemaname, 
    tablename, 
    rowsecurity 
FROM pg_tables 
WHERE tablename = 'products';

SELECT policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = 'products';

-- =====================================================
-- 6. SECURITY LOGS TABLE AUDIT (admin only)
-- =====================================================

SELECT 
    schemaname, 
    tablename, 
    rowsecurity 
FROM pg_tables 
WHERE tablename = 'security_logs';

SELECT policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = 'security_logs';

-- =====================================================
-- 7. PAYMENT CONFIGS TABLE AUDIT (admin only)
-- =====================================================

SELECT 
    schemaname, 
    tablename, 
    rowsecurity 
FROM pg_tables 
WHERE tablename = 'payment_configs';

SELECT policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = 'payment_configs';

-- =====================================================
-- EXPECTED RESULTS:
-- - rowsecurity = true for all sensitive tables
-- - orders: policy should check user_id = auth.uid()
-- - addresses: policy should check user_id = auth.uid()
-- - profiles: policy should allow read own profile
-- - security_logs: admin only for SELECT
-- - payment_configs: admin only
-- =====================================================

-- =====================================================
-- FIX: If orders doesn't have proper RLS
-- =====================================================
-- UNCOMMENT BELOW IF NEEDED:

/*
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own orders" ON orders;
CREATE POLICY "Users view own orders" ON orders
    FOR SELECT
    USING (
        auth.uid() = user_id OR
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

DROP POLICY IF EXISTS "Users insert own orders" ON orders;
CREATE POLICY "Users insert own orders" ON orders
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);
*/

-- =====================================================
-- FIX: If addresses doesn't have proper RLS
-- =====================================================
-- UNCOMMENT BELOW IF NEEDED:

/*
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own addresses" ON addresses;
CREATE POLICY "Users manage own addresses" ON addresses
    FOR ALL
    USING (auth.uid() = user_id);
*/
