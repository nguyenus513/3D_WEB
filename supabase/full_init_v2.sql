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
-- =====================================================
-- SECURITY TABLES FOR 3D WEB
-- Run this SQL in Supabase SQL Editor AFTER main schema
-- =====================================================

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. SECURITY LOGS TABLE
-- =====================================================
-- Stores all security-related events for audit trail
CREATE TABLE IF NOT EXISTS security_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type TEXT NOT NULL CHECK (event_type IN (
        'LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGIN_BLOCKED',
        'LOGOUT', 'REGISTER', 'PASSWORD_RESET_REQUEST',
        'PASSWORD_RESET_SUCCESS', 'EMAIL_VERIFIED',
        'ADMIN_ACCESS', 'ADMIN_ACTION', 'API_RATE_LIMITED',
        'SUSPICIOUS_ACTIVITY', 'FILE_UPLOAD', 'FILE_REJECTED',
        'PERMISSION_DENIED', 'SESSION_EXPIRED', 'CSRF_VIOLATION'
    )),
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    ip_address INET,
    user_agent TEXT,
    details JSONB DEFAULT '{}',
    severity TEXT NOT NULL CHECK (severity IN ('INFO', 'WARNING', 'CRITICAL')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for security logs
CREATE INDEX IF NOT EXISTS idx_security_logs_event_type ON security_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_security_logs_user_id ON security_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_security_logs_severity ON security_logs(severity);
CREATE INDEX IF NOT EXISTS idx_security_logs_created_at ON security_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_logs_ip ON security_logs(ip_address);
CREATE INDEX IF NOT EXISTS idx_security_logs_composite ON security_logs(event_type, created_at DESC);

-- RLS for security logs (admin only for viewing, system for insert)
ALTER TABLE security_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Only admins can view security logs" ON security_logs;
CREATE POLICY "Only admins can view security logs" ON security_logs FOR SELECT
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "System can insert security logs" ON security_logs;
CREATE POLICY "System can insert security logs" ON security_logs FOR INSERT
    WITH CHECK (true); -- Inserted via service role

-- =====================================================
-- 2. FAILED LOGIN ATTEMPTS TABLE
-- =====================================================
-- Tracks failed login attempts for brute force protection
CREATE TABLE IF NOT EXISTS failed_login_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT NOT NULL,
    ip_address INET NOT NULL,
    attempt_count INTEGER DEFAULT 1,
    first_attempt_at TIMESTAMPTZ DEFAULT NOW(),
    last_attempt_at TIMESTAMPTZ DEFAULT NOW(),
    blocked_until TIMESTAMPTZ,
    user_agent TEXT,
    UNIQUE(email, ip_address)
);

-- Indexes for failed login attempts
CREATE INDEX IF NOT EXISTS idx_failed_login_email ON failed_login_attempts(email);
CREATE INDEX IF NOT EXISTS idx_failed_login_ip ON failed_login_attempts(ip_address);
CREATE INDEX IF NOT EXISTS idx_failed_login_blocked ON failed_login_attempts(blocked_until)
    WHERE blocked_until IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_failed_login_last_attempt ON failed_login_attempts(last_attempt_at DESC);

-- RLS for failed login attempts (admin only for viewing)
ALTER TABLE failed_login_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view failed attempts" ON failed_login_attempts;
CREATE POLICY "Admins can view failed attempts" ON failed_login_attempts FOR SELECT
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "System can manage failed attempts" ON failed_login_attempts;
CREATE POLICY "System can manage failed attempts" ON failed_login_attempts FOR ALL
    WITH CHECK (true); -- Managed via service role

-- =====================================================
-- 3. USER SESSIONS TABLE (for session management)
-- =====================================================
-- Tracks active user sessions for security monitoring
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    session_token TEXT UNIQUE NOT NULL,
    ip_address INET,
    user_agent TEXT,
    device_fingerprint TEXT,
    last_activity_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    is_revoked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for user sessions
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_active ON user_sessions(user_id, is_revoked, expires_at)
    WHERE is_revoked = FALSE;

-- RLS for user sessions
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own sessions" ON user_sessions;
CREATE POLICY "Users can view own sessions" ON user_sessions FOR SELECT
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can revoke own sessions" ON user_sessions;
CREATE POLICY "Users can revoke own sessions" ON user_sessions FOR UPDATE
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can view all sessions" ON user_sessions;
CREATE POLICY "Admins can view all sessions" ON user_sessions FOR SELECT
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "System can manage sessions" ON user_sessions;
CREATE POLICY "System can manage sessions" ON user_sessions FOR ALL
    WITH CHECK (true); -- Managed via service role

-- =====================================================
-- 4. RATE LIMIT LOGS TABLE (for audit)
-- =====================================================
-- Tracks when rate limits are hit for monitoring
CREATE TABLE IF NOT EXISTS rate_limit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    endpoint TEXT NOT NULL,
    ip_address INET NOT NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    hit_count INTEGER DEFAULT 1,
    blocked_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for rate limit logs
CREATE INDEX IF NOT EXISTS idx_rate_limit_endpoint ON rate_limit_logs(endpoint);
CREATE INDEX IF NOT EXISTS idx_rate_limit_ip ON rate_limit_logs(ip_address);
CREATE INDEX IF NOT EXISTS idx_rate_limit_blocked_at ON rate_limit_logs(blocked_at DESC);

-- RLS for rate limit logs (admin only)
ALTER TABLE rate_limit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view rate limit logs" ON rate_limit_logs;
CREATE POLICY "Admins can view rate limit logs" ON rate_limit_logs FOR SELECT
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "System can insert rate limit logs" ON rate_limit_logs;
CREATE POLICY "System can insert rate limit logs" ON rate_limit_logs FOR INSERT
    WITH CHECK (true); -- Inserted via service role

-- =====================================================
-- 5. CSRF TOKENS TABLE (optional, for stateful CSRF)
-- =====================================================
-- For double-submit cookie pattern with database validation
CREATE TABLE IF NOT EXISTS csrf_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    token TEXT UNIQUE NOT NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    session_id TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_csrf_token ON csrf_tokens(token);
CREATE INDEX IF NOT EXISTS idx_csrf_expires ON csrf_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_csrf_user ON csrf_tokens(user_id);

-- RLS
ALTER TABLE csrf_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "System can manage CSRF tokens" ON csrf_tokens;
CREATE POLICY "System can manage CSRF tokens" ON csrf_tokens FOR ALL
    WITH CHECK (true); -- Managed via service role

-- =====================================================
-- CLEANUP FUNCTIONS
-- =====================================================

-- Cleanup old security logs (keep 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_security_logs()
RETURNS void AS $$
BEGIN
    DELETE FROM security_logs WHERE created_at < NOW() - INTERVAL '90 days';
    DELETE FROM failed_login_attempts 
        WHERE last_attempt_at < NOW() - INTERVAL '7 days' 
        AND blocked_until IS NULL;
    DELETE FROM rate_limit_logs WHERE blocked_at < NOW() - INTERVAL '30 days';
    DELETE FROM csrf_tokens WHERE expires_at < NOW();
    DELETE FROM user_sessions 
        WHERE (expires_at < NOW() AND is_revoked = FALSE)
        OR (is_revoked = TRUE AND created_at < NOW() - INTERVAL '7 days');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cleanup expired sessions (run periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
    UPDATE user_sessions 
    SET is_revoked = TRUE 
    WHERE expires_at < NOW() AND is_revoked = FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Unblock IP function (for admin use)
CREATE OR REPLACE FUNCTION unblock_login_ip(target_email TEXT, target_ip INET)
RETURNS void AS $$
BEGIN
    DELETE FROM failed_login_attempts 
    WHERE email = target_email AND ip_address = target_ip;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get blocked IPs function (for admin dashboard)
CREATE OR REPLACE FUNCTION get_blocked_ips()
RETURNS TABLE (
    email TEXT,
    ip_address INET,
    attempt_count INTEGER,
    blocked_until TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        f.email,
        f.ip_address,
        f.attempt_count,
        f.blocked_until
    FROM failed_login_attempts f
    WHERE f.blocked_until IS NOT NULL AND f.blocked_until > NOW()
    ORDER BY f.blocked_until DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- SECURITY DASHBOARD VIEWS
-- =====================================================

-- Recent security events view (for admin dashboard)
CREATE OR REPLACE VIEW recent_security_events AS
SELECT 
    id,
    event_type,
    user_id,
    ip_address::TEXT,
    severity,
    details,
    created_at
FROM security_logs
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 100;

-- Security summary view
CREATE OR REPLACE VIEW security_summary AS
SELECT
    (SELECT COUNT(*) FROM security_logs WHERE event_type = 'LOGIN_FAILED' AND created_at > NOW() - INTERVAL '24 hours') as failed_logins_24h,
    (SELECT COUNT(*) FROM security_logs WHERE event_type = 'LOGIN_BLOCKED' AND created_at > NOW() - INTERVAL '24 hours') as blocked_logins_24h,
    (SELECT COUNT(*) FROM security_logs WHERE event_type = 'API_RATE_LIMITED' AND created_at > NOW() - INTERVAL '24 hours') as rate_limited_24h,
    (SELECT COUNT(*) FROM security_logs WHERE severity = 'CRITICAL' AND created_at > NOW() - INTERVAL '24 hours') as critical_events_24h,
    (SELECT COUNT(*) FROM failed_login_attempts WHERE blocked_until IS NOT NULL AND blocked_until > NOW()) as currently_blocked_ips,
    (SELECT COUNT(*) FROM user_sessions WHERE is_revoked = FALSE AND expires_at > NOW()) as active_sessions;

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================
SELECT 'Security tables created successfully!' AS message;
-- =====================================================
-- UNIFIED ORDER SYSTEM: Parent/Child Orders with QR Payment
-- Migration: 20260129_create_order_parent_child
-- =====================================================
-- IMPORTANT: This version uses profiles.id instead of auth.users
-- to maintain consistency with the rest of the application
-- =====================================================

-- 1. ORDER PARENT TABLE (Master order when checkout from cart)
CREATE TABLE IF NOT EXISTS order_parent (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code_parent CHAR(12) NOT NULL UNIQUE,               -- 12 hex characters
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,  -- FIXED: Reference profiles
    total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    currency VARCHAR(5) NOT NULL DEFAULT 'VND',
    status VARCHAR(20) NOT NULL DEFAULT 'pending',       -- pending, processing, paid, completed, cancelled
    shipping_address JSONB,
    shipping_fee NUMERIC(12,2) DEFAULT 0,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. ORDER CHILD TABLE (Individual product orders)
CREATE TABLE IF NOT EXISTS order_child (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID REFERENCES order_parent(id) ON DELETE SET NULL,
    code_child CHAR(12) NOT NULL UNIQUE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,  -- FIXED: Reference profiles
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    product_type VARCHAR(20) NOT NULL DEFAULT 'product',
    product_name VARCHAR(255),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(12,2) NOT NULL,
    total_price NUMERIC(12,2) NOT NULL,
    currency VARCHAR(5) NOT NULL DEFAULT 'VND',
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    payment_qr_url TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. PAYMENT TABLE
CREATE TABLE IF NOT EXISTS payment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_type VARCHAR(15) NOT NULL CHECK (order_type IN ('parent', 'child', 'direct_child')),
    order_id UUID NOT NULL,
    reference_code CHAR(12) NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    currency VARCHAR(5) NOT NULL DEFAULT 'VND',
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    method VARCHAR(20) NOT NULL DEFAULT 'QR',
    qr_url TEXT NOT NULL,
    bank_code VARCHAR(10) DEFAULT 'MB',
    account_no VARCHAR(20) DEFAULT '0336668386',
    account_name VARCHAR(100) DEFAULT 'NGUYEN MINH NHAT',
    expires_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    idempotency_key TEXT UNIQUE,    -- NEW: For duplicate prevention
    correlation_id TEXT,             -- NEW: For request tracing
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (order_type, order_id)
);

-- 4. INDEXES
CREATE INDEX IF NOT EXISTS idx_order_parent_user_id ON order_parent(user_id);
CREATE INDEX IF NOT EXISTS idx_order_parent_code ON order_parent(code_parent);
CREATE INDEX IF NOT EXISTS idx_order_child_parent_id ON order_child(parent_id);
CREATE INDEX IF NOT EXISTS idx_order_child_user_id ON order_child(user_id);
CREATE INDEX IF NOT EXISTS idx_order_child_code ON order_child(code_child);
CREATE INDEX IF NOT EXISTS idx_payment_reference ON payment(reference_code);
CREATE INDEX IF NOT EXISTS idx_payment_idempotency ON payment(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_payment_correlation ON payment(correlation_id);

-- 5. RLS POLICIES
ALTER TABLE order_parent ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_child ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment ENABLE ROW LEVEL SECURITY;

-- RLS for order_parent (using subquery to avoid recursion)
CREATE POLICY "Users can view own parent orders" ON order_parent 
  FOR SELECT USING (user_id IN (SELECT id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Users can insert own parent orders" ON order_parent 
  FOR INSERT WITH CHECK (user_id IN (SELECT id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Users can update own parent orders" ON order_parent 
  FOR UPDATE USING (user_id IN (SELECT id FROM profiles WHERE id = auth.uid()));

-- RLS for order_child
CREATE POLICY "Users can view own child orders" ON order_child 
  FOR SELECT USING (user_id IN (SELECT id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Users can insert own child orders" ON order_child 
  FOR INSERT WITH CHECK (user_id IN (SELECT id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Users can update own child orders" ON order_child 
  FOR UPDATE USING (user_id IN (SELECT id FROM profiles WHERE id = auth.uid()));

-- RLS for payment
CREATE POLICY "Users can view own payments" ON payment FOR SELECT
USING (
    EXISTS (SELECT 1 FROM order_parent WHERE order_parent.id = payment.order_id AND order_parent.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM order_child WHERE order_child.id = payment.order_id AND order_child.user_id = auth.uid())
);

-- 6. TRIGGERS
CREATE OR REPLACE FUNCTION update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_order_parent_updated_at ON order_parent;
DROP TRIGGER IF EXISTS update_order_child_updated_at ON order_child;
DROP TRIGGER IF EXISTS update_payment_updated_at ON payment;

CREATE TRIGGER update_order_parent_updated_at BEFORE UPDATE ON order_parent FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_order_child_updated_at BEFORE UPDATE ON order_child FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payment_updated_at BEFORE UPDATE ON payment FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 7. ADMIN BYPASS POLICIES (for service role operations)
CREATE POLICY "Service role bypass for order_parent" ON order_parent
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');
CREATE POLICY "Service role bypass for order_child" ON order_child
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');
CREATE POLICY "Service role bypass for payment" ON payment
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');
-- =====================================================
-- CART TABLES FOR SERVER-SIDE CART SYNC
-- Run this SQL in Supabase SQL Editor
-- =====================================================

-- 1. CARTS - One cart per user
-- =====================================================
CREATE TABLE IF NOT EXISTS carts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- 2. CART ITEMS - Items in each cart
-- =====================================================
CREATE TABLE IF NOT EXISTS cart_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cart_id UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
    
    -- Item type: 'product', 'print', 'custom'
    item_type TEXT NOT NULL CHECK (item_type IN ('product', 'print', 'custom')),
    
    -- Common fields
    name TEXT NOT NULL,
    price BIGINT NOT NULL DEFAULT 0,
    quantity INT NOT NULL DEFAULT 1,
    image_url TEXT,
    
    -- Product-specific (nullable)
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    product_sku TEXT,
    size TEXT,
    original_price BIGINT,
    
    -- Print-specific (nullable) - stored as JSONB
    print_options JSONB,
    print_files JSONB,
    
    -- Custom-specific (nullable)
    description TEXT,
    custom_files JSONB,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;

-- Carts: Users can only access their own cart
CREATE POLICY "Users can manage own cart" ON carts
    FOR ALL USING (auth.uid() = user_id);

-- Cart Items: Users can manage items in their own cart
CREATE POLICY "Users can manage own cart items" ON cart_items
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM carts 
            WHERE carts.id = cart_items.cart_id 
            AND carts.user_id = auth.uid()
        )
    );

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_carts_user_id ON carts(user_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_cart_id ON cart_items(cart_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_product_id ON cart_items(product_id);

-- =====================================================
-- TRIGGER: Update cart timestamp when items change
-- =====================================================
CREATE OR REPLACE FUNCTION update_cart_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE carts SET updated_at = NOW() WHERE id = NEW.cart_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_cart_item_change
    AFTER INSERT OR UPDATE ON cart_items
    FOR EACH ROW EXECUTE FUNCTION update_cart_timestamp();

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================
SELECT 'Cart tables created successfully!' AS message;
-- Migration: Pure Hex Order Codes
-- Description: Ensure order tables have proper columns for hex codes
-- Date: 2026-01-30

-- 1. Check and add metadata column to order_parent if not exists
ALTER TABLE order_parent ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- 2. Check product_sku column in order_child
ALTER TABLE order_child ADD COLUMN IF NOT EXISTS product_sku VARCHAR(50);

-- 3. Create/update indexes for hex code lookups
CREATE INDEX IF NOT EXISTS idx_order_parent_code ON order_parent(code_parent);
CREATE INDEX IF NOT EXISTS idx_order_child_code ON order_child(code_child);
CREATE INDEX IF NOT EXISTS idx_order_child_parent ON order_child(parent_id);
CREATE INDEX IF NOT EXISTS idx_order_child_product_sku ON order_child(product_sku);

-- 4. Add comments
COMMENT ON COLUMN order_parent.code_parent IS '8-character hex code for cart/parent order';
COMMENT ON COLUMN order_child.code_child IS '12-character hex code (parent 8 + random 4)';
COMMENT ON COLUMN order_child.product_sku IS 'Product SKU for ready-made products';

-- 5. Drop unused columns if they exist (code_formatted was planned but not needed with pure hex)
-- Note: Only run these if columns exist and are not in use
-- ALTER TABLE order_parent DROP COLUMN IF EXISTS code_formatted;
-- ALTER TABLE order_child DROP COLUMN IF EXISTS code_formatted;
-- Migration: Create place_order_with_stock_check RPC function
-- Purpose: Atomic stock deduction with race condition protection
-- Uses FOR UPDATE lock to prevent concurrent overselling

-- Drop existing function if exists
DROP FUNCTION IF EXISTS place_order_with_stock_check(UUID, UUID, VARCHAR, TEXT, TEXT, INT, NUMERIC, JSONB);

-- Create the RPC function
CREATE OR REPLACE FUNCTION place_order_with_stock_check(
    p_user_id UUID,
    p_product_id UUID,
    p_product_sku VARCHAR(50),
    p_product_name TEXT,
    p_product_type TEXT DEFAULT 'product',
    p_quantity INT DEFAULT 1,
    p_unit_price NUMERIC DEFAULT 0,
    p_metadata JSONB DEFAULT '{}'::JSONB
) RETURNS JSONB AS $$
DECLARE
    v_current_stock INT;
    v_order_id UUID;
    v_code_child VARCHAR(12);
    v_customer_code VARCHAR(20);
    v_transfer_content TEXT;
    v_total_price NUMERIC;
    v_bank_config RECORD;
    v_qr_url TEXT;
BEGIN
    -- Calculate total price
    v_total_price := p_quantity * p_unit_price;
    
    -- Lock and check stock (FOR UPDATE prevents race condition)
    SELECT stock INTO v_current_stock 
    FROM products 
    WHERE id = p_product_id 
    FOR UPDATE;
    
    -- Check if product exists
    IF v_current_stock IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'PRODUCT_NOT_FOUND',
            'message', 'Sản phẩm không tồn tại'
        );
    END IF;
    
    -- Check if enough stock
    IF v_current_stock < p_quantity THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'INSUFFICIENT_STOCK',
            'message', 'Sản phẩm không đủ số lượng trong kho',
            'available', v_current_stock,
            'requested', p_quantity
        );
    END IF;
    
    -- Deduct stock
    UPDATE products 
    SET stock = stock - p_quantity,
        updated_at = NOW()
    WHERE id = p_product_id;
    
    -- Generate order code (12 char hex)
    v_code_child := UPPER(SUBSTRING(MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT) FOR 12));
    
    -- Get customer code from profiles
    SELECT COALESCE(customer_code, 'USR-' || UPPER(SUBSTRING(p_user_id::TEXT FOR 8))) 
    INTO v_customer_code
    FROM profiles 
    WHERE id = p_user_id;
    
    -- Fallback if no profile
    IF v_customer_code IS NULL THEN
        v_customer_code := 'USR-' || UPPER(SUBSTRING(REPLACE(p_user_id::TEXT, '-', '') FOR 8));
    END IF;
    
    -- Generate transfer content
    v_transfer_content := v_customer_code || '-' || v_code_child;
    
    -- Get bank config
    SELECT bank_code, account_no, account_name 
    INTO v_bank_config
    FROM payment_configs 
    WHERE order_type = 'ready_made' AND is_active = true
    LIMIT 1;
    
    -- Fallback bank config
    IF v_bank_config IS NULL THEN
        v_bank_config := ROW('MB', '0336668386', 'NGUYEN MINH NHAT');
    END IF;
    
    -- Generate QR URL
    v_qr_url := 'https://img.vietqr.io/image/' 
        || v_bank_config.bank_code || '-' 
        || v_bank_config.account_no 
        || '-compact2.png?amount=' || v_total_price::TEXT
        || '&addInfo=' || v_transfer_content
        || '&accountName=' || REPLACE(v_bank_config.account_name, ' ', '+');
    
    -- Create order_child record
    INSERT INTO order_child (
        code_child,
        user_id,
        product_id,
        product_type,
        product_name,
        quantity,
        unit_price,
        total_price,
        status,
        payment_qr_url,
        metadata
    ) VALUES (
        v_code_child,
        p_user_id,
        p_product_id,
        p_product_type,
        p_product_name,
        p_quantity,
        p_unit_price,
        v_total_price,
        'pending',
        v_qr_url,
        p_metadata || jsonb_build_object(
            'sku', p_product_sku,
            'customer_code', v_customer_code,
            'transfer_content', v_transfer_content,
            'bank_code', v_bank_config.bank_code,
            'account_no', v_bank_config.account_no,
            'account_name', v_bank_config.account_name,
            'stock_before', v_current_stock,
            'stock_after', v_current_stock - p_quantity
        )
    ) RETURNING id INTO v_order_id;
    
    -- Create payment record
    INSERT INTO payment (
        order_type,
        order_id,
        reference_code,
        amount,
        status,
        method,
        qr_url,
        bank_code,
        account_no,
        account_name,
        expires_at
    ) VALUES (
        'direct_child',
        v_order_id,
        v_code_child,
        v_total_price,
        'pending',
        'QR',
        v_qr_url,
        v_bank_config.bank_code,
        v_bank_config.account_no,
        v_bank_config.account_name,
        NOW() + INTERVAL '30 minutes'
    );
    
    -- Return success with all order details
    RETURN jsonb_build_object(
        'success', true,
        'order_id', v_order_id,
        'code_child', v_code_child,
        'customer_code', v_customer_code,
        'transfer_content', v_transfer_content,
        'amount', v_total_price,
        'qr_url', v_qr_url,
        'stock_before', v_current_stock,
        'stock_after', v_current_stock - p_quantity,
        'bank_info', jsonb_build_object(
            'bank_code', v_bank_config.bank_code,
            'account_no', v_bank_config.account_no,
            'account_name', v_bank_config.account_name
        )
    );

EXCEPTION
    WHEN OTHERS THEN
        -- Rollback happens automatically, return error
        RETURN jsonb_build_object(
            'success', false,
            'error', 'DATABASE_ERROR',
            'message', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION place_order_with_stock_check TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION place_order_with_stock_check IS 
'Atomically creates an order while checking and deducting stock. 
Uses FOR UPDATE lock to prevent race conditions and overselling.
Returns JSONB with success status and order details or error info.';
