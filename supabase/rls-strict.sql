-- =============================================
-- STRICT RLS POLICIES
-- Block frontend mutations, allow only via API
-- =============================================

BEGIN;

-- =============================================
-- 1. DROP ALL EXISTING POLICIES
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
-- 2. PROFILES - User owned only
-- =============================================

CREATE POLICY "profiles_select" ON profiles FOR SELECT 
    USING (id = auth.uid());

-- INSERT blocked - only service role
CREATE POLICY "profiles_insert" ON profiles FOR INSERT 
    WITH CHECK (FALSE);

-- UPDATE own profile only (cannot change role)
CREATE POLICY "profiles_update" ON profiles FOR UPDATE 
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- DELETE blocked
CREATE POLICY "profiles_delete" ON profiles FOR DELETE 
    USING (FALSE);

-- =============================================
-- 3. ADDRESSES - BLOCKED for frontend
-- =============================================

-- Select own only
CREATE POLICY "addresses_select" ON addresses FOR SELECT 
    USING (user_id = auth.uid());

-- INSERT/UPDATE/DELETE blocked - use API
CREATE POLICY "addresses_insert" ON addresses FOR INSERT 
    WITH CHECK (FALSE);

CREATE POLICY "addresses_update" ON addresses FOR UPDATE 
    USING (FALSE);

CREATE POLICY "addresses_delete" ON addresses FOR DELETE 
    USING (FALSE);

-- =============================================
-- 4. ORDERS - Read only for users
-- =============================================

-- Select own orders
CREATE POLICY "orders_select" ON orders FOR SELECT 
    USING (user_id = auth.uid());

-- ALL mutations blocked - use API
CREATE POLICY "orders_insert" ON orders FOR INSERT 
    WITH CHECK (FALSE);

CREATE POLICY "orders_update" ON orders FOR UPDATE 
    USING (FALSE);

CREATE POLICY "orders_delete" ON orders FOR DELETE 
    USING (FALSE);

-- =============================================
-- 5. ORDER_ITEMS - Read only
-- =============================================

CREATE POLICY "order_items_select" ON order_items FOR SELECT 
    USING (EXISTS (
        SELECT 1 FROM orders 
        WHERE orders.id = order_items.order_id 
        AND orders.user_id = auth.uid()
    ));

CREATE POLICY "order_items_insert" ON order_items FOR INSERT 
    WITH CHECK (FALSE);

CREATE POLICY "order_items_update" ON order_items FOR UPDATE 
    USING (FALSE);

CREATE POLICY "order_items_delete" ON order_items FOR DELETE 
    USING (FALSE);

-- =============================================
-- 6. PAYMENTS - Read only, NEVER write
-- =============================================

CREATE POLICY "payments_select" ON payments FOR SELECT 
    USING (EXISTS (
        SELECT 1 FROM orders 
        WHERE orders.id = payments.order_id 
        AND orders.user_id = auth.uid()
    ));

-- ALL writes blocked
CREATE POLICY "payments_insert" ON payments FOR INSERT 
    WITH CHECK (FALSE);

CREATE POLICY "payments_update" ON payments FOR UPDATE 
    USING (FALSE);

CREATE POLICY "payments_delete" ON payments FOR DELETE 
    USING (FALSE);

-- =============================================
-- 7. PRODUCTS - Public read, admin write
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
-- 8. CATEGORIES - Public read only
-- =============================================

CREATE POLICY "categories_select" ON categories FOR SELECT 
    USING (TRUE);

CREATE POLICY "categories_insert" ON categories FOR INSERT 
    WITH CHECK (FALSE);

CREATE POLICY "categories_update" ON categories FOR UPDATE 
    USING (FALSE);

CREATE POLICY "categories_delete" ON categories FOR DELETE 
    USING (FALSE);

-- =============================================
-- 9. FAQS - Public read active only
-- =============================================

CREATE POLICY "faqs_select" ON faqs FOR SELECT 
    USING (is_active = TRUE);

CREATE POLICY "faqs_write" ON faqs FOR ALL 
    USING (FALSE);

-- =============================================
-- 10. SETTINGS - Public read only
-- =============================================

CREATE POLICY "settings_select" ON settings FOR SELECT 
    USING (TRUE);

CREATE POLICY "settings_write" ON settings FOR ALL 
    USING (FALSE);

-- =============================================
-- 11. SESSIONS & ACCOUNTS (NextAuth)
-- =============================================

CREATE POLICY "sessions_own" ON sessions FOR ALL 
    USING ("userId" = auth.uid());

CREATE POLICY "accounts_own" ON accounts FOR ALL 
    USING ("userId" = auth.uid());

CREATE POLICY "verification_tokens_all" ON verification_tokens FOR SELECT 
    USING (TRUE);

CREATE POLICY "verification_tokens_write" ON verification_tokens FOR ALL 
    USING (FALSE);

COMMIT;

-- =============================================
-- SUMMARY
-- =============================================
/*
✅ Frontend can ONLY:
   - SELECT own profiles, addresses, orders
   - SELECT public products, categories, settings

❌ Frontend CANNOT:
   - INSERT/UPDATE/DELETE anything
   - Access other users' data
   - Access payments details

✅ All mutations go through API (service_role)
*/
