-- =============================================
-- Fix RLS Performance Issues
-- Version: 2.0
-- Date: 2026-01-27
-- 
-- This migration:
-- 1. Fixes policies that call auth functions directly (slow)
-- 2. Consolidates multiple permissive policies on same table/role/action
-- =============================================

BEGIN;

-- =============================================
-- PHASE 1: Fix auth function calls in policies
-- Pattern: auth.uid() -> (select auth.uid())
-- Most policies already use this pattern, fixing remaining ones
-- =============================================

-- Fix order_items policies if needed
DROP POLICY IF EXISTS "order_items_insert_own" ON order_items;
CREATE POLICY "order_items_insert_own" ON order_items
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM orders 
            WHERE orders.id = order_id 
            AND orders.user_id = (SELECT auth.uid())
        )
    );

-- =============================================
-- PHASE 2: Consolidate multiple permissive policies
-- Combine overlapping policies for same role+action
-- =============================================

-- Fix payment_configs - consolidate admin SELECT policies
DROP POLICY IF EXISTS "Admin view payment configs" ON payment_configs;
DROP POLICY IF EXISTS "payment_configs_admin_select" ON payment_configs;

CREATE POLICY "payment_configs_admin_read" ON payment_configs
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = (SELECT auth.uid())
            AND profiles.role = 'admin'
        )
    );

-- Fix print_orders - consolidate user access policies
DROP POLICY IF EXISTS "print_orders_admin_manage" ON print_orders;
DROP POLICY IF EXISTS "print_orders_user_access" ON print_orders;
DROP POLICY IF EXISTS "print_orders_user_insert" ON print_orders;

-- Combined select policy for print_orders
CREATE POLICY "print_orders_access" ON print_orders
    FOR SELECT
    TO authenticated
    USING (
        user_id = (SELECT auth.uid())
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = (SELECT auth.uid())
            AND profiles.role = 'admin'
        )
    );

-- Combined insert policy for print_orders
CREATE POLICY "print_orders_insert" ON print_orders
    FOR INSERT
    TO authenticated
    WITH CHECK (
        user_id = (SELECT auth.uid())
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = (SELECT auth.uid())
            AND profiles.role = 'admin'
        )
    );

-- Combined update policy for print_orders
CREATE POLICY "print_orders_update" ON print_orders
    FOR UPDATE
    TO authenticated
    USING (
        user_id = (SELECT auth.uid())
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = (SELECT auth.uid())
            AND profiles.role = 'admin'
        )
    );

-- Fix custom_orders - consolidate policies
DROP POLICY IF EXISTS "Admins manage all custom orders" ON custom_orders;
DROP POLICY IF EXISTS "custom_orders_admin_manage" ON custom_orders;
DROP POLICY IF EXISTS "custom_orders_user_access" ON custom_orders;
DROP POLICY IF EXISTS "custom_orders_user_insert" ON custom_orders;

-- Combined access policy for custom_orders
CREATE POLICY "custom_orders_access" ON custom_orders
    FOR SELECT
    TO authenticated
    USING (
        user_id = (SELECT auth.uid())
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = (SELECT auth.uid())
            AND profiles.role = 'admin'
        )
    );

CREATE POLICY "custom_orders_insert" ON custom_orders
    FOR INSERT
    TO authenticated
    WITH CHECK (
        user_id = (SELECT auth.uid())
    );

CREATE POLICY "custom_orders_update" ON custom_orders
    FOR UPDATE
    TO authenticated
    USING (
        user_id = (SELECT auth.uid())
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = (SELECT auth.uid())
            AND profiles.role = 'admin'
        )
    );

CREATE POLICY "custom_orders_delete" ON custom_orders
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = (SELECT auth.uid())
            AND profiles.role = 'admin'
        )
    );

-- Fix master_orders - consolidate policies
DROP POLICY IF EXISTS "master_orders_admin_manage" ON master_orders;
DROP POLICY IF EXISTS "master_orders_user_access" ON master_orders;
DROP POLICY IF EXISTS "master_orders_user_insert" ON master_orders;

CREATE POLICY "master_orders_access" ON master_orders
    FOR SELECT
    TO authenticated
    USING (
        user_id = (SELECT auth.uid())
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = (SELECT auth.uid())
            AND profiles.role = 'admin'
        )
    );

CREATE POLICY "master_orders_insert" ON master_orders
    FOR INSERT
    TO authenticated
    WITH CHECK (
        user_id = (SELECT auth.uid())
    );

CREATE POLICY "master_orders_update" ON master_orders
    FOR UPDATE
    TO authenticated
    USING (
        user_id = (SELECT auth.uid())
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = (SELECT auth.uid())
            AND profiles.role = 'admin'
        )
    );

-- Fix wishlists - consolidate policies
DROP POLICY IF EXISTS "wishlists_admin_read" ON wishlists;
DROP POLICY IF EXISTS "wishlists_user_read" ON wishlists;

CREATE POLICY "wishlists_read" ON wishlists
    FOR SELECT
    TO authenticated
    USING (
        user_id = (SELECT auth.uid())
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = (SELECT auth.uid())
            AND profiles.role = 'admin'
        )
    );

-- Fix order_status_history - consolidate policies
DROP POLICY IF EXISTS "order_status_history_admin_access" ON order_status_history;
DROP POLICY IF EXISTS "order_status_history_user_access" ON order_status_history;

CREATE POLICY "order_status_history_access" ON order_status_history
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM master_orders
            WHERE master_orders.id = order_status_history.order_id
            AND (
                master_orders.user_id = (SELECT auth.uid())
                OR EXISTS (
                    SELECT 1 FROM profiles
                    WHERE profiles.id = (SELECT auth.uid())
                    AND profiles.role = 'admin'
                )
            )
        )
    );

-- Fix product_items - consolidate policies
DROP POLICY IF EXISTS "product_items_admin_access" ON product_items;
DROP POLICY IF EXISTS "product_items_user_read" ON product_items;

CREATE POLICY "product_items_read" ON product_items
    FOR ALL
    TO public
    USING (true);

-- Fix payments - consolidate policies
DROP POLICY IF EXISTS "payments_admin_access" ON payments;
DROP POLICY IF EXISTS "payments_user_read" ON payments;

CREATE POLICY "payments_access" ON payments
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM master_orders
            WHERE master_orders.id = payments.order_id
            AND (
                master_orders.user_id = (SELECT auth.uid())
                OR EXISTS (
                    SELECT 1 FROM profiles
                    WHERE profiles.id = (SELECT auth.uid())
                    AND profiles.role = 'admin'
                )
            )
        )
    );

COMMIT;

-- =============================================
-- VERIFICATION QUERIES
-- =============================================
-- Check policies after migration:
-- SELECT tablename, policyname, cmd FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename;
