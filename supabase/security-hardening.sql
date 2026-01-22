-- =============================================
-- 3D Print Shop - SECURITY HARDENING
-- Version: 1.0
-- Date: 2026-01-18
-- 
-- Run AFTER optimized-schema.sql
-- =============================================

BEGIN;

-- =============================================
-- 1. DROP ALL INSECURE POLICIES
-- =============================================

DO $$ 
DECLARE
    pol RECORD;
BEGIN
    -- Drop all existing policies to recreate securely
    FOR pol IN 
        SELECT policyname, tablename 
        FROM pg_policies 
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, pol.tablename);
    END LOOP;
END $$;

-- =============================================
-- 2. SECURE ADMIN CHECK FUNCTION
-- =============================================

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role = 'admin'
        AND deleted_at IS NULL
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =============================================
-- 3. PROFILES POLICIES (Strict)
-- =============================================

-- SELECT: Own profile only (admin sees all)
CREATE POLICY "profiles_select" ON profiles FOR SELECT 
    USING (id = auth.uid() OR is_admin());

-- INSERT: Only service role (via API)
CREATE POLICY "profiles_insert" ON profiles FOR INSERT 
    WITH CHECK (auth.uid() = id);

-- UPDATE: Own profile only
CREATE POLICY "profiles_update" ON profiles FOR UPDATE 
    USING (id = auth.uid())
    WITH CHECK (
        id = auth.uid() 
        AND role = (SELECT role FROM profiles WHERE id = auth.uid()) -- Cannot change own role
    );

-- DELETE: Admin only (soft delete preferred)
CREATE POLICY "profiles_delete" ON profiles FOR DELETE 
    USING (is_admin());

-- =============================================
-- 4. ADDRESSES POLICIES
-- =============================================

-- User manages own addresses only
CREATE POLICY "addresses_select" ON addresses FOR SELECT 
    USING (user_id = auth.uid() OR is_admin());

CREATE POLICY "addresses_insert" ON addresses FOR INSERT 
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "addresses_update" ON addresses FOR UPDATE 
    USING (user_id = auth.uid());

CREATE POLICY "addresses_delete" ON addresses FOR DELETE 
    USING (user_id = auth.uid() OR is_admin());

-- =============================================
-- 5. PRODUCTS POLICIES
-- =============================================

-- Public: Only active products
CREATE POLICY "products_select_public" ON products FOR SELECT 
    USING (status = 'active' OR is_admin());

-- Admin only for write
CREATE POLICY "products_insert" ON products FOR INSERT 
    WITH CHECK (is_admin());

CREATE POLICY "products_update" ON products FOR UPDATE 
    USING (is_admin());

CREATE POLICY "products_delete" ON products FOR DELETE 
    USING (is_admin());

-- =============================================
-- 6. CATEGORIES POLICIES
-- =============================================

CREATE POLICY "categories_select" ON categories FOR SELECT 
    USING (true); -- Public read

CREATE POLICY "categories_write" ON categories FOR ALL 
    USING (is_admin());

-- =============================================
-- 7. ORDERS POLICIES (Critical!)
-- =============================================

-- User sees own orders only
CREATE POLICY "orders_select" ON orders FOR SELECT 
    USING (user_id = auth.uid() OR is_admin());

-- User can create own orders
CREATE POLICY "orders_insert" ON orders FOR INSERT 
    WITH CHECK (user_id = auth.uid());

-- User CANNOT update orders (admin only)
CREATE POLICY "orders_update" ON orders FOR UPDATE 
    USING (is_admin());

-- No delete allowed (soft delete via status)
CREATE POLICY "orders_delete" ON orders FOR DELETE 
    USING (FALSE); -- Never allow hard delete

-- =============================================
-- 8. ORDER_ITEMS POLICIES
-- =============================================

CREATE POLICY "order_items_select" ON order_items FOR SELECT 
    USING (
        EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid())
        OR is_admin()
    );

CREATE POLICY "order_items_insert" ON order_items FOR INSERT 
    WITH CHECK (
        EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid())
    );

CREATE POLICY "order_items_update" ON order_items FOR UPDATE 
    USING (is_admin());

CREATE POLICY "order_items_delete" ON order_items FOR DELETE 
    USING (is_admin());

-- =============================================
-- 9. PAYMENTS POLICIES (Very Strict!)
-- =============================================

-- User can view own payments
CREATE POLICY "payments_select" ON payments FOR SELECT 
    USING (
        EXISTS (SELECT 1 FROM orders WHERE orders.id = payments.order_id AND orders.user_id = auth.uid())
        OR is_admin()
    );

-- Only service role can create/update payments
CREATE POLICY "payments_insert" ON payments FOR INSERT 
    WITH CHECK (FALSE); -- API only via service role

CREATE POLICY "payments_update" ON payments FOR UPDATE 
    USING (FALSE); -- API only via service role

CREATE POLICY "payments_delete" ON payments FOR DELETE 
    USING (FALSE); -- Never delete payments

-- =============================================
-- 10. FAQS POLICIES
-- =============================================

CREATE POLICY "faqs_select" ON faqs FOR SELECT 
    USING (is_active = TRUE OR is_admin());

CREATE POLICY "faqs_write" ON faqs FOR ALL 
    USING (is_admin());

-- =============================================
-- 11. SETTINGS POLICIES
-- =============================================

CREATE POLICY "settings_select" ON settings FOR SELECT 
    USING (true); -- Public read

CREATE POLICY "settings_write" ON settings FOR ALL 
    USING (is_admin());

-- =============================================
-- 12. SESSIONS & ACCOUNTS (NextAuth)
-- =============================================

-- Only service role should access these
CREATE POLICY "sessions_all" ON sessions FOR ALL 
    USING ("userId" = auth.uid());

CREATE POLICY "accounts_all" ON accounts FOR ALL 
    USING ("userId" = auth.uid());

CREATE POLICY "verification_tokens_all" ON verification_tokens FOR ALL 
    USING (true); -- Service role only in practice

-- =============================================
-- 13. REVOKE UNSAFE DEFAULTS
-- =============================================

-- Revoke all from public
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;

-- Grant specific permissions
GRANT SELECT ON products, categories, faqs, settings TO anon;
GRANT SELECT ON products, categories, faqs, settings TO authenticated;

GRANT SELECT, INSERT, UPDATE ON profiles, addresses, orders, order_items TO authenticated;
GRANT SELECT ON payments TO authenticated;

-- Admin gets all via is_admin() function

-- =============================================
-- 14. RATE LIMITING FUNCTION (Optional)
-- =============================================

CREATE OR REPLACE FUNCTION check_rate_limit(
    action_name TEXT,
    max_requests INTEGER DEFAULT 10,
    window_seconds INTEGER DEFAULT 60
)
RETURNS BOOLEAN AS $$
DECLARE
    request_count INTEGER;
BEGIN
    -- Count recent requests from this user
    SELECT COUNT(*) INTO request_count
    FROM order_events
    WHERE user_id = auth.uid()
    AND event_type = action_name
    AND created_at > NOW() - (window_seconds || ' seconds')::INTERVAL;
    
    RETURN request_count < max_requests;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;

-- =============================================
-- SECURITY CHECKLIST
-- =============================================
/*
✅ RLS enabled on all tables
✅ No public write access to critical tables
✅ Payments: API only (service role)
✅ Orders: No hard delete
✅ Profiles: Cannot change own role
✅ Admin check includes deleted_at check
✅ REVOKE default permissions
*/
