-- ============================================================
-- SUPABASE LINTER FIXES - COMPLETE MIGRATION
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/mhycgniqnhiechiiveda/sql
-- ============================================================

-- ============================================================
-- PHASE 1: FIX RLS INITPLAN ISSUES (14 policies)
-- Replace auth.uid() with (select auth.uid()) for per-query evaluation
-- ============================================================

-- 1. profiles: Users can view own profile
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (id = (select auth.uid()));

-- 2. profiles: Users can update own profile
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (id = (select auth.uid()));

-- 3. orders: Users can view own orders
DROP POLICY IF EXISTS "Users can view own orders" ON orders;
CREATE POLICY "Users can view own orders" ON orders
    FOR SELECT USING (user_id = (select auth.uid()));

-- 4. orders: Users can create own orders
DROP POLICY IF EXISTS "Users can create own orders" ON orders;
CREATE POLICY "Users can create own orders" ON orders
    FOR INSERT WITH CHECK (user_id = (select auth.uid()));

-- 5. order_items: Users can view own order items
DROP POLICY IF EXISTS "Users can view own order items" ON order_items;
CREATE POLICY "Users can view own order items" ON order_items
    FOR SELECT USING (
        order_id IN (SELECT id FROM orders WHERE user_id = (select auth.uid()))
    );

-- 6. addresses: Users can manage own addresses
DROP POLICY IF EXISTS "Users can manage own addresses" ON addresses;
CREATE POLICY "Users can manage own addresses" ON addresses
    FOR ALL USING (user_id = (select auth.uid()));

-- 7. carts: Users can manage own cart
DROP POLICY IF EXISTS "Users can manage own cart" ON carts;
CREATE POLICY "Users can manage own cart" ON carts
    FOR ALL USING (user_id = (select auth.uid()));

-- 8. cart_items: Users can manage own cart items
DROP POLICY IF EXISTS "Users can manage own cart items" ON cart_items;
CREATE POLICY "Users can manage own cart items" ON cart_items
    FOR ALL USING (
        cart_id IN (SELECT id FROM carts WHERE user_id = (select auth.uid()))
    );

-- 9. payments: Users can view own payments
DROP POLICY IF EXISTS "Users can view own payments" ON payments;
CREATE POLICY "Users can view own payments" ON payments
    FOR SELECT USING (
        order_id IN (SELECT id FROM orders WHERE user_id = (select auth.uid()))
    );

-- 10. system_settings: Admins can view all settings
DROP POLICY IF EXISTS "Admins can view all settings" ON system_settings;
CREATE POLICY "Admins can view all settings" ON system_settings
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND role = 'admin')
    );

-- 11. system_settings: Admins can update settings
DROP POLICY IF EXISTS "Admins can update settings" ON system_settings;
CREATE POLICY "Admins can update settings" ON system_settings
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND role = 'admin')
    );

-- 12. security_logs: Admins can view security logs
DROP POLICY IF EXISTS "Admins can view security logs" ON security_logs;
CREATE POLICY "Admins can view security logs" ON security_logs
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND role = 'admin')
    );

-- ============================================================
-- PHASE 2: CONSOLIDATE DUPLICATE POLICIES (6 issues)
-- Remove redundant policies, keep single optimized version
-- ============================================================

-- products: Remove duplicate SELECT policies, keep single unified policy
DROP POLICY IF EXISTS "Public read products" ON products;
DROP POLICY IF EXISTS "Anyone can view active products" ON products;
DROP POLICY IF EXISTS "Admin full access products" ON products;

-- Single policy for public read (active products only)
CREATE POLICY "Anyone can view active products" ON products
    FOR SELECT USING (is_active = true);

-- Single policy for admin full access (all operations)
CREATE POLICY "Admin full access products" ON products
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND role = 'admin')
    );

-- security_logs: Remove "Users cannot retrieve logs" (contradicts admin policy)
DROP POLICY IF EXISTS "Users cannot retrieve logs" ON security_logs;

-- system_settings: Remove duplicate, keep merged policy
DROP POLICY IF EXISTS "Public configs are viewable by everyone" ON system_settings;
-- Keep the admin policy from Phase 1, add public config access
CREATE POLICY "Public configs are viewable" ON system_settings
    FOR SELECT USING (is_public = true OR EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND role = 'admin'));

-- ============================================================
-- PHASE 3: SECURE FUNCTION SEARCH PATHS (3 functions)
-- Add SET search_path = '' to prevent injection attacks
-- ============================================================

-- 1. update_order_status
CREATE OR REPLACE FUNCTION public.update_order_status(
    p_table_name TEXT,
    p_order_id UUID,
    p_status TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF p_table_name = 'orders' THEN
        UPDATE public.orders SET status = p_status WHERE id = p_order_id;
    ELSIF p_table_name = 'custom_orders' THEN
        UPDATE public.custom_orders SET status = p_status WHERE id = p_order_id;
    ELSIF p_table_name = 'print_orders' THEN
        UPDATE public.print_orders SET status = p_status WHERE id = p_order_id;
    ELSE
        RETURN FALSE;
    END IF;
    RETURN TRUE;
END;
$$;

-- 2. handle_new_user (recreate with search_path)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    INSERT INTO public.profiles (id, email, role, created_at, updated_at)
    VALUES (NEW.id, NEW.email, 'customer', NOW(), NOW())
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

-- 3. update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- ============================================================
-- PHASE 4: SCHEMA FIX (from previous session)
-- Add missing columns for demo approval flow
-- ============================================================

ALTER TABLE custom_orders 
ADD COLUMN IF NOT EXISTS demo_image_url text,
ADD COLUMN IF NOT EXISTS review_at timestamp with time zone;

ALTER TABLE print_orders 
ADD COLUMN IF NOT EXISTS demo_image_url text,
ADD COLUMN IF NOT EXISTS review_at timestamp with time zone;

-- ============================================================
-- FINAL: RELOAD SCHEMA CACHE
-- ============================================================

NOTIFY pgrst, 'reload schema';

-- ============================================================
-- DONE! Re-run Database Linter to verify 0 warnings.
-- ============================================================
