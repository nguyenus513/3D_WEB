-- ============================================================================
-- Production hardening + schema alignment (safe, additive)
-- Date: 2026-02-05
-- Notes: Add missing columns, indexes, and security tables used by code.
-- ============================================================================

BEGIN;

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================
-- ENUM EXTENSIONS (safe)
-- =============================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status') THEN
        BEGIN
            ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'pending_confirmation';
            ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'expired';
            ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'payment_failed';
            ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'review';
            ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'revising';
            ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'approved';
            ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'production_pending';
        EXCEPTION WHEN duplicate_object THEN
            NULL;
        END;
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
        BEGIN
            ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'partial';
            ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'deposit_paid';
            ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'failed';
        EXCEPTION WHEN duplicate_object THEN
            NULL;
        END;
    END IF;
END $$;

-- =============================
-- ORDERS: missing columns
-- =============================
ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS parent_order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS items_config JSONB,
    ADD COLUMN IF NOT EXISTS deposit_paid BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS shipping_code TEXT,
    ADD COLUMN IF NOT EXISTS shipping_status TEXT,
    ADD COLUMN IF NOT EXISTS order_number TEXT,
    ADD COLUMN IF NOT EXISTS master_order_id UUID,
    ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS processing_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS designing_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS revising_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS review_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS producing_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS printing_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS custom_config JSONB,
    ADD COLUMN IF NOT EXISTS printing_config JSONB,
    ADD COLUMN IF NOT EXISTS demo_image_url TEXT,
    ADD COLUMN IF NOT EXISTS order_type TEXT DEFAULT 'ready_made',
    ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- =============================
-- ORDER_ITEMS: missing columns
-- =============================
ALTER TABLE public.order_items
    ADD COLUMN IF NOT EXISTS size TEXT;

-- =============================
-- PAYMENTS: missing columns
-- =============================
ALTER TABLE public.payments
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- =============================
-- SECURITY_LOGS: add severity
-- =============================
ALTER TABLE public.security_logs
    ADD COLUMN IF NOT EXISTS severity TEXT DEFAULT 'INFO';

-- =============================
-- REFRESH_TOKENS: add hash/rotation fields
-- =============================
ALTER TABLE public.refresh_tokens
    ADD COLUMN IF NOT EXISTS token_hash TEXT,
    ADD COLUMN IF NOT EXISTS session_id UUID,
    ADD COLUMN IF NOT EXISTS family_id UUID,
    ADD COLUMN IF NOT EXISTS is_revoked BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS revoked_reason TEXT;

-- =============================
-- USER_SESSIONS + FAILED_LOGIN_ATTEMPTS
-- =============================
CREATE TABLE IF NOT EXISTS public.user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    session_token TEXT UNIQUE NOT NULL,
    refresh_token TEXT UNIQUE,
    device_fingerprint TEXT,
    ip_address INET,
    user_agent TEXT,
    device_name TEXT,
    is_active BOOLEAN DEFAULT true,
    last_active_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.failed_login_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    ip_address INET NOT NULL,
    user_agent TEXT,
    attempt_count INTEGER DEFAULT 1,
    first_attempt_at TIMESTAMPTZ DEFAULT now(),
    last_attempt_at TIMESTAMPTZ DEFAULT now(),
    blocked_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================
-- ORDER FILES + FILE ACCESS LOGS
-- =============================
CREATE TABLE IF NOT EXISTS public.order_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    file_key TEXT,
    file_id TEXT,
    file_name TEXT,
    file_type TEXT,
    allowed_user_ids UUID[] DEFAULT '{}'::uuid[],
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.file_access_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id UUID REFERENCES public.order_files(id) ON DELETE SET NULL,
    file_key TEXT,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    ip_address INET,
    user_agent TEXT,
    success BOOLEAN DEFAULT false,
    denied_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================
-- CART_ITEMS: extended columns
-- =============================
ALTER TABLE public.cart_items
    ADD COLUMN IF NOT EXISTS item_type TEXT,
    ADD COLUMN IF NOT EXISTS name TEXT,
    ADD COLUMN IF NOT EXISTS price BIGINT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS image_url TEXT,
    ADD COLUMN IF NOT EXISTS product_sku TEXT,
    ADD COLUMN IF NOT EXISTS size TEXT,
    ADD COLUMN IF NOT EXISTS original_price BIGINT,
    ADD COLUMN IF NOT EXISTS print_options JSONB,
    ADD COLUMN IF NOT EXISTS print_files JSONB,
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS custom_files JSONB;

-- =============================
-- ADDRESS: normalize defaults (avoid duplicates)
-- =============================
WITH ranked AS (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) AS rn
    FROM public.addresses
    WHERE is_default = true
)
UPDATE public.addresses a
SET is_default = false
FROM ranked r
WHERE a.id = r.id AND r.rn > 1;

-- =============================
-- INDEXES
-- =============================
-- Orders
CREATE INDEX IF NOT EXISTS idx_orders_user_created ON public.orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status_created ON public.orders(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_type_created ON public.orders(order_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status_created ON public.orders(payment_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_parent ON public.orders(parent_order_id);

-- Order items
CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON public.order_items(product_id);

-- Payments
CREATE INDEX IF NOT EXISTS idx_payments_order ON public.payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_transaction_code ON public.payments(transaction_code);
CREATE INDEX IF NOT EXISTS idx_payments_reference_code ON public.payments ((gateway_response->>'reference_code'));
CREATE INDEX IF NOT EXISTS idx_payments_status_created ON public.payments(status, created_at DESC);

-- Carts + cart_items
CREATE INDEX IF NOT EXISTS idx_carts_user_id ON public.carts(user_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_cart_id ON public.cart_items(cart_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_product_id ON public.cart_items(product_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_cart_type_product ON public.cart_items(cart_id, item_type, product_id, size);

-- Addresses
CREATE INDEX IF NOT EXISTS idx_addresses_user_default ON public.addresses(user_id, is_default) WHERE is_default = true;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_addresses_default ON public.addresses(user_id) WHERE is_default = true;

-- Refresh tokens
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON public.refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON public.refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_family ON public.refresh_tokens(family_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_active ON public.refresh_tokens(is_revoked) WHERE is_revoked = false;

-- User sessions
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON public.user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON public.user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_refresh ON public.user_sessions(refresh_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON public.user_sessions(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON public.user_sessions(expires_at);

-- Security logs
CREATE INDEX IF NOT EXISTS idx_security_logs_event_type ON public.security_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_security_logs_user_id ON public.security_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_security_logs_created_at ON public.security_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_logs_severity ON public.security_logs(severity);

-- Payment configs
CREATE INDEX IF NOT EXISTS idx_payment_configs_order_type ON public.payment_configs(order_type);
CREATE INDEX IF NOT EXISTS idx_payment_configs_active ON public.payment_configs(is_active) WHERE is_active = true;

-- Order files
CREATE UNIQUE INDEX IF NOT EXISTS idx_order_files_key ON public.order_files(file_key) WHERE file_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_order_files_id ON public.order_files(file_id) WHERE file_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_order_files_order ON public.order_files(order_id);
CREATE INDEX IF NOT EXISTS idx_order_files_owner ON public.order_files(owner_id);

-- File access logs
CREATE INDEX IF NOT EXISTS idx_file_access_logs_key ON public.file_access_logs(file_key);
CREATE INDEX IF NOT EXISTS idx_file_access_logs_user ON public.file_access_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_file_access_logs_created ON public.file_access_logs(created_at DESC);

COMMIT;
