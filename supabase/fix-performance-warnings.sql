-- =============================================
-- FIX PERFORMANCE WARNINGS
-- 1. Wrap auth.uid() in (SELECT ...)
-- 2. Remove duplicate policies
-- =============================================

BEGIN;

-- =============================================
-- 1. DROP ALL EXISTING POLICIES (clean slate)
-- =============================================

DO $$ 
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname, tablename 
        FROM pg_policies 
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, pol.tablename);
    END LOOP;
END $$;

-- =============================================
-- 2. PROFILES - Optimized policies
-- =============================================

CREATE POLICY "profiles_select" ON profiles FOR SELECT 
    USING (id = (SELECT auth.uid()));

CREATE POLICY "profiles_update" ON profiles FOR UPDATE 
    USING (id = (SELECT auth.uid()))
    WITH CHECK (id = (SELECT auth.uid()));

-- INSERT/DELETE blocked for frontend
CREATE POLICY "profiles_insert" ON profiles FOR INSERT 
    WITH CHECK (FALSE);

CREATE POLICY "profiles_delete" ON profiles FOR DELETE 
    USING (FALSE);

-- =============================================
-- 3. ADDRESSES - Optimized policies
-- =============================================

CREATE POLICY "addresses_select" ON addresses FOR SELECT 
    USING (user_id = (SELECT auth.uid()));

-- All mutations blocked
CREATE POLICY "addresses_insert" ON addresses FOR INSERT 
    WITH CHECK (FALSE);

CREATE POLICY "addresses_update" ON addresses FOR UPDATE 
    USING (FALSE);

CREATE POLICY "addresses_delete" ON addresses FOR DELETE 
    USING (FALSE);

-- =============================================
-- 4. ORDERS - Optimized policies
-- =============================================

CREATE POLICY "orders_select" ON orders FOR SELECT 
    USING (user_id = (SELECT auth.uid()));

CREATE POLICY "orders_insert" ON orders FOR INSERT 
    WITH CHECK (FALSE);

CREATE POLICY "orders_update" ON orders FOR UPDATE 
    USING (FALSE);

CREATE POLICY "orders_delete" ON orders FOR DELETE 
    USING (FALSE);

-- =============================================
-- 5. ORDER_ITEMS - Optimized policies
-- =============================================

CREATE POLICY "order_items_select" ON order_items FOR SELECT 
    USING (EXISTS (
        SELECT 1 FROM orders 
        WHERE orders.id = order_items.order_id 
        AND orders.user_id = (SELECT auth.uid())
    ));

CREATE POLICY "order_items_insert" ON order_items FOR INSERT 
    WITH CHECK (FALSE);

CREATE POLICY "order_items_update" ON order_items FOR UPDATE 
    USING (FALSE);

CREATE POLICY "order_items_delete" ON order_items FOR DELETE 
    USING (FALSE);

-- =============================================
-- 6. PAYMENTS - Optimized policies
-- =============================================

CREATE POLICY "payments_select" ON payments FOR SELECT 
    USING (EXISTS (
        SELECT 1 FROM orders 
        WHERE orders.id = payments.order_id 
        AND orders.user_id = (SELECT auth.uid())
    ));

CREATE POLICY "payments_insert" ON payments FOR INSERT 
    WITH CHECK (FALSE);

CREATE POLICY "payments_update" ON payments FOR UPDATE 
    USING (FALSE);

CREATE POLICY "payments_delete" ON payments FOR DELETE 
    USING (FALSE);

-- =============================================
-- 7. PRODUCTS - Public read only
-- =============================================

CREATE POLICY "products_select" ON products FOR SELECT 
    USING (status = 'active');

CREATE POLICY "products_insert" ON products FOR INSERT 
    WITH CHECK (FALSE);

CREATE POLICY "products_update" ON products FOR UPDATE 
    USING (FALSE);

CREATE POLICY "products_delete" ON products FOR DELETE 
    USING (FALSE);

-- =============================================
-- 8. CATEGORIES - Single policy (fix duplicate)
-- =============================================

CREATE POLICY "categories_select" ON categories FOR SELECT 
    USING (TRUE);

-- No separate write policy - use service role

-- =============================================
-- 9. FAQS - Single policy (fix duplicate)
-- =============================================

CREATE POLICY "faqs_select" ON faqs FOR SELECT 
    USING (is_active = TRUE);

-- No separate write policy - use service role

-- =============================================
-- 10. SETTINGS - Single policy (fix duplicate)
-- =============================================

CREATE POLICY "settings_select" ON settings FOR SELECT 
    USING (TRUE);

-- No separate write policy - use service role

-- =============================================
-- 11. SESSIONS & ACCOUNTS - Optimized
-- =============================================

CREATE POLICY "sessions_select" ON sessions FOR SELECT 
    USING ("userId" = (SELECT auth.uid()));

CREATE POLICY "accounts_select" ON accounts FOR SELECT 
    USING ("userId" = (SELECT auth.uid()));

-- =============================================
-- 12. VERIFICATION TOKENS
-- =============================================

CREATE POLICY "verification_tokens_select" ON verification_tokens FOR SELECT 
    USING (TRUE);

-- =============================================
-- 13. NEW TABLES (order_configs, order_files, product_images)
-- =============================================

-- Product images: public read
CREATE POLICY "product_images_select" ON product_images FOR SELECT 
    USING (TRUE);

-- Order files: owner only
CREATE POLICY "order_files_select" ON order_files FOR SELECT 
    USING (EXISTS (
        SELECT 1 FROM orders 
        WHERE orders.id = order_files.order_id 
        AND orders.user_id = (SELECT auth.uid())
    ));

-- Order configs: owner only
CREATE POLICY "order_configs_select" ON order_configs FOR SELECT 
    USING (EXISTS (
        SELECT 1 FROM orders 
        WHERE orders.id = order_configs.order_id 
        AND orders.user_id = (SELECT auth.uid())
    ));

COMMIT;

-- =============================================
-- SUMMARY:
-- ✅ auth.uid() wrapped in (SELECT ...)
-- ✅ Removed duplicate policies  
-- ✅ All mutations blocked for frontend
-- =============================================
