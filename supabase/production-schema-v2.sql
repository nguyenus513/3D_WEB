-- =============================================
-- 3D Print Shop - Production Database Migration
-- Version: 2.0 (Consolidated Schema)
-- Date: 2026-01-18
-- 
-- ⚠️ BACKUP DATABASE BEFORE RUNNING!
-- Run: pg_dump your_database > backup_$(date +%Y%m%d).sql
-- =============================================

BEGIN;

-- =============================================
-- PHASE 1: PREPARATION
-- =============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================
-- PHASE 2: CONSOLIDATE USER TABLES
-- Merge 'users' into 'profiles' (single source of truth)
-- =============================================

-- 2.1 Add missing columns to profiles (from users table)
ALTER TABLE profiles 
    ADD COLUMN IF NOT EXISTS name TEXT,
    ADD COLUMN IF NOT EXISTS "emailVerified" TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS image TEXT,
    ADD COLUMN IF NOT EXISTS password TEXT,
    ADD COLUMN IF NOT EXISTS instagram_username TEXT,
    ADD COLUMN IF NOT EXISTS shipping_address JSONB,
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ; -- Soft delete

-- 2.2 Migrate data from users to profiles (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users' AND table_schema = 'public') THEN
        -- Update existing profiles with users data
        UPDATE profiles p
        SET 
            name = COALESCE(p.name, u.name),
            "emailVerified" = COALESCE(p."emailVerified", u."emailVerified"),
            image = COALESCE(p.image, u.image),
            password = COALESCE(p.password, u.password),
            phone = COALESCE(p.phone, u.phone),
            customer_code = COALESCE(p.customer_code, u.customer_code)
        FROM users u
        WHERE p.email = u.email;

        -- Insert users that don't exist in profiles
        INSERT INTO profiles (id, full_name, name, email, "emailVerified", image, password, phone, customer_code, role, created_at, updated_at)
        SELECT 
            u.id,
            u.name,
            u.name,
            u.email,
            u."emailVerified",
            u.image,
            u.password,
            u.phone,
            u.customer_code,
            CASE WHEN u.role = 'admin' THEN 'admin' ELSE 'customer' END,
            u.created_at,
            u.updated_at
        FROM users u
        WHERE u.email NOT IN (SELECT email FROM profiles WHERE email IS NOT NULL)
        ON CONFLICT (id) DO NOTHING;
    END IF;
END $$;

-- 2.3 Update accounts table to reference profiles
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'accounts' AND table_schema = 'public') THEN
        -- Rename userId to user_id for consistency
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'userId') THEN
            ALTER TABLE accounts RENAME COLUMN "userId" TO user_id;
        END IF;
        
        -- Drop old FK and add new one to profiles
        ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_userId_fkey;
        ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_user_id_fkey;
        ALTER TABLE accounts 
            ADD CONSTRAINT accounts_user_id_fkey 
            FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 2.4 Update sessions table to reference profiles
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sessions' AND table_schema = 'public') THEN
        -- Rename userId to user_id
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sessions' AND column_name = 'userId') THEN
            ALTER TABLE sessions RENAME COLUMN "userId" TO user_id;
        END IF;
        
        -- Rename sessionToken to session_token
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sessions' AND column_name = 'sessionToken') THEN
            ALTER TABLE sessions RENAME COLUMN "sessionToken" TO session_token;
        END IF;
        
        -- Drop old FK and add new one
        ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_userId_fkey;
        ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_user_id_fkey;
        ALTER TABLE sessions 
            ADD CONSTRAINT sessions_user_id_fkey 
            FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 2.5 Drop users table (now redundant)
DROP TABLE IF EXISTS users CASCADE;

-- =============================================
-- PHASE 3: ENHANCE profiles TABLE
-- =============================================

-- 3.1 Add constraints
ALTER TABLE profiles
    DROP CONSTRAINT IF EXISTS profiles_email_check,
    DROP CONSTRAINT IF EXISTS profiles_phone_check;

ALTER TABLE profiles
    ADD CONSTRAINT profiles_email_check 
        CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    ADD CONSTRAINT profiles_phone_check 
        CHECK (phone IS NULL OR phone ~ '^[0-9+\-\s]{9,15}$');

-- 3.2 Create unique index on email (if not exists)
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email) WHERE email IS NOT NULL;

-- =============================================
-- PHASE 4: ENHANCE orders TABLE
-- =============================================

-- 4.1 Add missing timestamp columns
ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS processing_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS designing_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS review_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS printing_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS custom_config JSONB,
    ADD COLUMN IF NOT EXISTS printing_config JSONB,
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 4.2 Add FK constraint with ON DELETE
ALTER TABLE orders 
    DROP CONSTRAINT IF EXISTS orders_user_id_fkey;
ALTER TABLE orders 
    ADD CONSTRAINT orders_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- 4.3 Add CHECK constraints
ALTER TABLE orders
    DROP CONSTRAINT IF EXISTS orders_total_check,
    DROP CONSTRAINT IF EXISTS orders_deposit_check;

ALTER TABLE orders
    ADD CONSTRAINT orders_total_check CHECK (total >= 0),
    ADD CONSTRAINT orders_deposit_check CHECK (deposit_amount >= 0);

-- =============================================
-- PHASE 5: ENHANCE order_items TABLE  
-- =============================================

-- 5.1 Ensure FK constraint exists
ALTER TABLE order_items
    DROP CONSTRAINT IF EXISTS order_items_order_id_fkey;
ALTER TABLE order_items
    ADD CONSTRAINT order_items_order_id_fkey
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;

-- 5.2 Add size column if missing
ALTER TABLE order_items
    ADD COLUMN IF NOT EXISTS size TEXT;

-- 5.3 Add constraints
ALTER TABLE order_items
    DROP CONSTRAINT IF EXISTS order_items_quantity_check,
    DROP CONSTRAINT IF EXISTS order_items_price_check;

ALTER TABLE order_items
    ADD CONSTRAINT order_items_quantity_check CHECK (quantity > 0),
    ADD CONSTRAINT order_items_price_check CHECK (unit_price >= 0);

-- =============================================
-- PHASE 6: ENHANCE payments TABLE
-- =============================================

-- 6.1 Ensure FK constraint
ALTER TABLE payments
    DROP CONSTRAINT IF EXISTS payments_order_id_fkey;
ALTER TABLE payments
    ADD CONSTRAINT payments_order_id_fkey
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;

-- 6.2 Add constraints
ALTER TABLE payments
    DROP CONSTRAINT IF EXISTS payments_amount_check;
ALTER TABLE payments
    ADD CONSTRAINT payments_amount_check CHECK (amount > 0);

-- =============================================
-- PHASE 7: CREATE INDEXES
-- =============================================

-- Profiles indexes
CREATE INDEX IF NOT EXISTS idx_profiles_customer_code ON profiles(customer_code);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON profiles(created_at DESC);

-- Products indexes  
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_is_featured ON products(is_featured) WHERE is_featured = TRUE;
CREATE INDEX IF NOT EXISTS idx_products_type ON products(type);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at DESC);

-- Orders indexes
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_code ON orders(order_code);
CREATE INDEX IF NOT EXISTS idx_orders_type ON orders(order_type);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_paid_at ON orders(paid_at) WHERE paid_at IS NOT NULL;

-- Order items indexes
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);

-- Payments indexes
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at DESC);

-- Addresses indexes
CREATE INDEX IF NOT EXISTS idx_addresses_user ON addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_addresses_default ON addresses(user_id, is_default) WHERE is_default = TRUE;

-- Sessions indexes (NextAuth)
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires);

-- Accounts indexes (NextAuth)
CREATE INDEX IF NOT EXISTS idx_accounts_user ON accounts(user_id);

-- =============================================
-- PHASE 8: UPDATE TRIGGERS
-- =============================================

-- 8.1 Auto-generate customer code
CREATE OR REPLACE FUNCTION generate_customer_code()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.customer_code IS NULL THEN
        NEW.customer_code := 'KH-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', ''), 1, 8));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_generate_customer_code ON profiles;
CREATE TRIGGER trigger_generate_customer_code
    BEFORE INSERT ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION generate_customer_code();

-- 8.2 Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_profiles_updated ON profiles;
CREATE TRIGGER trigger_profiles_updated
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_orders_updated ON orders;
CREATE TRIGGER trigger_orders_updated
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_products_updated ON products;
CREATE TRIGGER trigger_products_updated
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- =============================================
-- PHASE 9: UPDATE RLS POLICIES
-- =============================================

-- Drop all old policies and recreate
DO $$ 
BEGIN
    -- Profiles
    DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
    DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
    DROP POLICY IF EXISTS "Admin full access profiles" ON profiles;
    DROP POLICY IF EXISTS "Allow insert for auth" ON profiles;
    DROP POLICY IF EXISTS "Service role access" ON profiles;
END $$;

-- Recreate policies for profiles
CREATE POLICY "profiles_select_own" ON profiles 
    FOR SELECT USING (auth.uid() = id OR is_admin());
CREATE POLICY "profiles_update_own" ON profiles 
    FOR UPDATE USING (auth.uid() = id OR is_admin());
CREATE POLICY "profiles_insert" ON profiles 
    FOR INSERT WITH CHECK (true);
CREATE POLICY "profiles_delete_admin" ON profiles 
    FOR DELETE USING (is_admin());

COMMIT;

-- =============================================
-- VERIFICATION QUERIES
-- =============================================

-- Run these after migration to verify:
/*
-- Check profiles count
SELECT COUNT(*) as total_profiles FROM profiles;

-- Check for duplicate emails
SELECT email, COUNT(*) FROM profiles GROUP BY email HAVING COUNT(*) > 1;

-- Check FK constraints
SELECT
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
WHERE constraint_type = 'FOREIGN KEY';

-- Check indexes
SELECT indexname, tablename FROM pg_indexes WHERE schemaname = 'public' ORDER BY tablename;
*/
