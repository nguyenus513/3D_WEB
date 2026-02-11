-- =====================================================
-- PRODUCTION SCHEMA v5.0
-- Consolidated E-commerce Database Schema
-- Date: 2026-02-07
-- =====================================================
-- Features:
--   - Unified orders (no legacy tables)
--   - 8-HEX code format (cart_code, order_code, item_order_code)
--   - Proper constraints and indexes
--   - RLS security policies
--   - NextAuth integration
-- =====================================================

-- ============================================================================
-- SECTION 1: EXTENSIONS & ENUMS
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Drop and recreate ENUMs (for clean install)
DO $$ BEGIN
    DROP TYPE IF EXISTS user_role CASCADE;
    DROP TYPE IF EXISTS order_status CASCADE;
    DROP TYPE IF EXISTS payment_status CASCADE;
    DROP TYPE IF EXISTS product_type CASCADE;
    DROP TYPE IF EXISTS print_tech CASCADE;
    DROP TYPE IF EXISTS fulfillment_status CASCADE;
    DROP TYPE IF EXISTS production_status CASCADE;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE TYPE user_role AS ENUM ('customer', 'admin', 'staff');

CREATE TYPE order_status AS ENUM (
    'pending',          -- Chờ xác nhận
    'confirmed',        -- Đã xác nhận
    'paid',             -- Đã thanh toán
    'review',           -- Chờ duyệt demo (custom)
    'approved',         -- Demo đã duyệt
    'revising',         -- Đang chỉnh sửa
    'production_pending', -- Chờ sản xuất
    'processing',       -- Đang xử lý
    'designing',        -- Đang thiết kế
    'printing',         -- Đang in 3D
    'producing',        -- Đang sản xuất
    'shipping',         -- Đang giao
    'delivered',        -- Đã giao
    'completed',        -- Hoàn thành
    'cancelled',        -- Đã hủy
    'refunded'          -- Đã hoàn tiền
);

CREATE TYPE payment_status AS ENUM (
    'pending',       -- Chờ thanh toán
    'deposit_paid',  -- Đã đặt cọc
    'partial',       -- Thanh toán một phần
    'paid',          -- Đã thanh toán đủ
    'refunded',      -- Đã hoàn tiền
    'failed'         -- Thanh toán thất bại
);

CREATE TYPE product_type AS ENUM (
    'ready_made',        -- Sản phẩm có sẵn
    'custom_template',   -- Mẫu custom
    'service',           -- Dịch vụ
    'printing'           -- Dịch vụ in 3D
);

CREATE TYPE print_tech AS ENUM ('fdm', 'resin', 'sla');

CREATE TYPE fulfillment_status AS ENUM ('pending', 'processing', 'completed');

CREATE TYPE production_status AS ENUM ('waiting', 'printing', 'done', 'error');


-- ============================================================================
-- SECTION 2: AUTH (NextAuth)
-- ============================================================================

-- Users table (NextAuth compatible)
CREATE TABLE IF NOT EXISTS public.users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text,
    email text UNIQUE NOT NULL,
    "emailVerified" timestamptz,
    image text,
    password text,                               -- bcrypt hash
    phone varchar(20),
    customer_code varchar(12) UNIQUE,            -- KH-XXXXXXXX
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Add role column if not exists (for compatibility with existing tables)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS role text DEFAULT 'user';
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints
        WHERE constraint_name = 'users_role_check'
    ) THEN
        ALTER TABLE public.users ADD CONSTRAINT users_role_check CHECK (role IN ('user', 'admin', 'staff'));
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not add role check constraint: %', SQLERRM;
END $$;

COMMENT ON TABLE public.users IS 'NextAuth users table for authentication';
COMMENT ON COLUMN public.users.customer_code IS 'Customer code format: KH-XXXXXXXX';

-- OAuth accounts
CREATE TABLE IF NOT EXISTS public.accounts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    type text NOT NULL,
    provider text NOT NULL,
    "providerAccountId" text NOT NULL,
    refresh_token text,
    access_token text,
    expires_at bigint,
    token_type text,
    scope text,
    id_token text,
    session_state text,
    UNIQUE (provider, "providerAccountId")
);

-- Sessions
CREATE TABLE IF NOT EXISTS public.sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "sessionToken" text UNIQUE NOT NULL,
    "userId" uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    expires timestamptz NOT NULL
);

-- Verification tokens
CREATE TABLE IF NOT EXISTS public.verification_tokens (
    identifier text NOT NULL,
    token text NOT NULL,
    expires timestamptz NOT NULL,
    UNIQUE (identifier, token)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_customer_code ON public.users(customer_code);
CREATE INDEX IF NOT EXISTS idx_accounts_userId ON public.accounts("userId");
CREATE INDEX IF NOT EXISTS idx_sessions_userId ON public.sessions("userId");
CREATE INDEX IF NOT EXISTS idx_sessions_token ON public.sessions("sessionToken");


-- ============================================================================
-- SECTION 3: IDENTITY (Profiles & Addresses)
-- ============================================================================

-- Extended profile (linked to users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    email text UNIQUE NOT NULL,
    full_name text,
    phone varchar(20),
    customer_code varchar(12) UNIQUE,
    avatar_url text,
    instagram_username text,
    is_verified boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    deleted_at timestamptz                       -- Soft delete
);

-- Add role column to profiles if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'role'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN role text DEFAULT 'customer';
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not add role to profiles: %', SQLERRM;
END $$;

COMMENT ON TABLE public.profiles IS 'Extended user profile data';

-- Shipping addresses
CREATE TABLE IF NOT EXISTS public.addresses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    label varchar(50) DEFAULT 'Home',
    full_name text NOT NULL,
    phone varchar(20) NOT NULL,
    province text NOT NULL,
    district text NOT NULL,
    ward text,
    address_line text NOT NULL,
    is_default boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.addresses IS 'User shipping addresses';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
-- Create role index only if column exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'role'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
    END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS idx_profiles_customer_code ON public.profiles(customer_code);
CREATE INDEX IF NOT EXISTS idx_addresses_user_id ON public.addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_addresses_default ON public.addresses(user_id, is_default) WHERE is_default = true;


-- ============================================================================
-- SECTION 4: CATALOG (Categories & Products)
-- ============================================================================

-- Product categories (hierarchical)
CREATE TABLE IF NOT EXISTS public.categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    slug text NOT NULL UNIQUE,
    parent_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
    sort_order smallint DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.categories IS 'Hierarchical product categories';

-- Products (core columns only for compatibility)
CREATE TABLE IF NOT EXISTS public.products (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
    sku varchar(50) UNIQUE,
    name text NOT NULL,
    slug text NOT NULL UNIQUE,
    description text,
    base_price numeric(15, 0) NOT NULL DEFAULT 0,
    sale_price numeric(15, 0),
    stock integer DEFAULT 0,
    images jsonb DEFAULT '[]'::jsonb,
    tags text[] DEFAULT '{}',
    is_active boolean DEFAULT false,
    is_featured boolean DEFAULT false,
    view_count integer DEFAULT 0,
    sold_count integer DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    deleted_at timestamptz
);

-- Add columns that may not exist in legacy tables
DO $$
BEGIN
    -- Type column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='products' AND column_name='type') THEN
        ALTER TABLE public.products ADD COLUMN type text DEFAULT 'ready_made';
    END IF;
    -- Short description
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='products' AND column_name='short_description') THEN
        ALTER TABLE public.products ADD COLUMN short_description text;
    END IF;
    -- Low stock alert
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='products' AND column_name='low_stock_alert') THEN
        ALTER TABLE public.products ADD COLUMN low_stock_alert integer DEFAULT 5;
    END IF;
    -- Specs
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='products' AND column_name='specs') THEN
        ALTER TABLE public.products ADD COLUMN specs jsonb DEFAULT '{}'::jsonb;
    END IF;
    -- Sizes
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='products' AND column_name='sizes') THEN
        ALTER TABLE public.products ADD COLUMN sizes jsonb DEFAULT '[]'::jsonb;
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not add columns to products: %', SQLERRM;
END $$;

COMMENT ON TABLE public.products IS 'Product catalog';
COMMENT ON COLUMN public.products.images IS 'Array of image URLs: ["url1", "url2"]';
-- Only add column comments if columns exist
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='products' AND column_name='specs') THEN
        EXECUTE 'COMMENT ON COLUMN public.products.specs IS ''Product specifications as JSON''';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='products' AND column_name='sizes') THEN
        EXECUTE 'COMMENT ON COLUMN public.products.sizes IS ''Available sizes with variants''';
    END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON public.categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_slug ON public.categories(slug);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_slug ON public.products(slug);
CREATE INDEX IF NOT EXISTS idx_products_sku ON public.products(sku);
CREATE INDEX IF NOT EXISTS idx_products_active ON public.products(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_products_featured ON public.products(is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_products_tags ON public.products USING GIN (tags);


-- ============================================================================
-- SECTION 5: SHOPPING (Carts & Cart Items)
-- ============================================================================

-- Shopping carts (core columns only for compatibility)
CREATE TABLE IF NOT EXISTS public.carts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Add columns that may not exist in legacy tables
DO $$
BEGIN
    ALTER TABLE public.carts ADD COLUMN IF NOT EXISTS cart_code varchar(8);
    ALTER TABLE public.carts ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';
    ALTER TABLE public.carts ADD COLUMN IF NOT EXISTS shipping_address jsonb;
    ALTER TABLE public.carts ADD COLUMN IF NOT EXISTS subtotal numeric(15, 0) DEFAULT 0;
    ALTER TABLE public.carts ADD COLUMN IF NOT EXISTS shipping_fee numeric(15, 0) DEFAULT 0;
    ALTER TABLE public.carts ADD COLUMN IF NOT EXISTS discount numeric(15, 0) DEFAULT 0;
    ALTER TABLE public.carts ADD COLUMN IF NOT EXISTS total_amount numeric(15, 0) DEFAULT 0;
    ALTER TABLE public.carts ADD COLUMN IF NOT EXISTS checked_out_at timestamptz;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not add columns to carts: %', SQLERRM;
END $$;

COMMENT ON TABLE public.carts IS 'Shopping cart per user';
DO $$ BEGIN EXECUTE 'COMMENT ON COLUMN public.carts.cart_code IS ''8-character HEX code (e.g., A1B2C3D4)'''; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Cart items
CREATE TABLE IF NOT EXISTS public.cart_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    cart_id uuid NOT NULL REFERENCES public.carts(id) ON DELETE CASCADE,
    product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
    
    -- Codes
    cart_code varchar(8),
    item_order_code varchar(8),
    full_code varchar(17),                       -- cart_code + '_' + item_order_code
    
    -- Item data
    name text NOT NULL,
    sku varchar(50),
    item_type text DEFAULT 'ready_made' CHECK (item_type IN ('ready_made', 'custom', 'printing')),
    quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
    unit_price numeric(15, 0) NOT NULL DEFAULT 0,
    total_price numeric(15, 0) NOT NULL DEFAULT 0,
    
    -- Production data
    production_status production_status DEFAULT 'waiting',
    print_tech print_tech,
    infill text,
    layer_height text,
    color text,
    material text,
    
    -- Custom/configuration
    custom_type text,
    custom_size text,
    notes text,
    configuration jsonb DEFAULT '{}'::jsonb,
    
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    
    CONSTRAINT chk_cart_items_cart_code CHECK (cart_code IS NULL OR cart_code ~ '^[0-9A-F]{8}$'),
    CONSTRAINT chk_cart_items_item_order_code CHECK (item_order_code IS NULL OR item_order_code ~ '^[0-9A-F]{8}$'),
    CONSTRAINT chk_cart_items_full_code CHECK (full_code IS NULL OR full_code ~ '^[0-9A-F]{8}_[0-9A-F]{8}$')
);

COMMENT ON TABLE public.cart_items IS 'Items in shopping cart';
COMMENT ON COLUMN public.cart_items.full_code IS 'Combined code: cart_code_item_order_code';

-- Indexes (conditional for columns that may not exist)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='carts' AND column_name='status') THEN
        EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS idx_carts_user_active ON public.carts(user_id) WHERE status = ''active''';
    END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS idx_carts_cart_code ON public.carts(cart_code) WHERE cart_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cart_items_cart_id ON public.cart_items(cart_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_cart_code ON public.cart_items(cart_code);
CREATE INDEX IF NOT EXISTS idx_cart_items_full_code ON public.cart_items(full_code) WHERE full_code IS NOT NULL;


-- ============================================================================
-- SECTION 6: ORDERS (Orders, Items, Files, Payments)
-- ============================================================================

-- Orders (core columns only for compatibility)
CREATE TABLE IF NOT EXISTS public.orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    total_amount numeric(15, 0) DEFAULT 0,
    notes text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Add columns that may not exist in legacy tables
DO $$
BEGIN
    -- Codes
    ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS order_code varchar(20);
    ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cart_code varchar(8);
    ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS legacy_order_code varchar(20);
    -- Shipping
    ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS address_id uuid;
    ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipping_address jsonb;
    -- Type & amounts
    ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS order_type text;
    ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS subtotal numeric(15, 0) DEFAULT 0;
    ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipping_fee numeric(15, 0) DEFAULT 0;
    ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS discount numeric(15, 0) DEFAULT 0;
    ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS deposit_amount numeric(15, 0) DEFAULT 0;
    -- Status (as text for compatibility)
    ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';
    ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'pending';
    ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS fulfillment_status text DEFAULT 'pending';
    ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS deposit_paid boolean DEFAULT false;
    -- Notes
    ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS admin_notes text;
    -- Demo
    ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS demo_image_url text;
    ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS demo_reviewed_at timestamptz;
    -- Timestamps
    ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS confirmed_at timestamptz;
    ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS paid_at timestamptz;
    ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS completed_at timestamptz;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not add columns to orders: %', SQLERRM;
END $$;

COMMENT ON TABLE public.orders IS 'Unified orders table (all order types)';
DO $$ BEGIN EXECUTE 'COMMENT ON COLUMN public.orders.order_code IS ''8-character HEX code'''; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'COMMENT ON COLUMN public.orders.order_type IS ''ready_made, custom, printing, or mixed'''; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Order items
CREATE TABLE IF NOT EXISTS public.order_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
    
    -- Codes
    item_order_code varchar(8),
    cart_code varchar(8),
    full_code varchar(17),
    
    -- Item data
    name text NOT NULL,
    sku varchar(50),
    item_type text DEFAULT 'ready_made' CHECK (item_type IN ('ready_made', 'custom', 'printing')),
    quantity integer NOT NULL CHECK (quantity > 0),
    unit_price numeric(15, 0) NOT NULL,
    total_price numeric(15, 0) NOT NULL,
    
    -- Production data
    production_status production_status DEFAULT 'waiting',
    file_path text,
    print_tech print_tech,
    infill text,
    layer_height text,
    color text,
    material text,
    
    -- Custom/configuration
    custom_type text,
    custom_size text,
    notes text,
    configuration jsonb DEFAULT '{}'::jsonb,
    
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    
    CONSTRAINT chk_order_items_item_order_code CHECK (item_order_code IS NULL OR item_order_code ~ '^[0-9A-F]{8}$'),
    CONSTRAINT chk_order_items_cart_code CHECK (cart_code IS NULL OR cart_code ~ '^[0-9A-F]{8}$'),
    CONSTRAINT chk_order_items_full_code CHECK (full_code IS NULL OR full_code ~ '^[0-9A-F]{8}_[0-9A-F]{8}$')
);

COMMENT ON TABLE public.order_items IS 'Order line items with production details';

-- Order files
CREATE TABLE IF NOT EXISTS public.order_files (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- References
    order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
    order_item_id uuid REFERENCES public.order_items(id) ON DELETE SET NULL,
    cart_id uuid REFERENCES public.carts(id) ON DELETE SET NULL,
    cart_item_id uuid REFERENCES public.cart_items(id) ON DELETE SET NULL,
    owner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    
    -- Codes
    cart_code varchar(8),
    order_code varchar(8),
    full_code varchar(17),
    
    -- Storage
    storage_provider text DEFAULT 'r2' CHECK (storage_provider IN ('r2', 'drive', 'local')),
    file_key text,                               -- R2 key
    drive_file_id text,
    drive_path text,
    drive_url text,
    
    -- Metadata
    file_name text NOT NULL,
    mime_type text,
    size_bytes bigint,
    category text CHECK (category IN ('models', 'images', 'review', 'docs', 'reference')),
    
    -- Access control
    is_public boolean DEFAULT false,
    allowed_user_ids uuid[] DEFAULT '{}'::uuid[],
    
    -- Lifecycle
    archived_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    
    CONSTRAINT chk_order_files_cart_code CHECK (cart_code IS NULL OR cart_code ~ '^[0-9A-F]{8}$'),
    CONSTRAINT chk_order_files_order_code CHECK (order_code IS NULL OR order_code ~ '^[0-9A-F]{8}$'),
    CONSTRAINT chk_order_files_full_code CHECK (full_code IS NULL OR full_code ~ '^[0-9A-F]{8}_[0-9A-F]{8}$')
);

COMMENT ON TABLE public.order_files IS 'Files associated with orders (R2 and/or Drive)';

-- Payments (core columns only for compatibility)
CREATE TABLE IF NOT EXISTS public.payments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    amount numeric(15, 0) NOT NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Add columns that may not exist
DO $$
BEGIN
    ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS transaction_code varchar(100);
    ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS method varchar(50) DEFAULT 'QR';
    ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';
    ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS gateway_response jsonb;
    ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS confirmed_at timestamptz;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not add columns to payments: %', SQLERRM;
END $$;

COMMENT ON TABLE public.payments IS 'Payment transactions for orders';

-- Indexes (wrapped in DO blocks for column safety)
DO $$
BEGIN
    -- Orders indexes
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='orders' AND column_name='cart_code') THEN
        EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_cart_code ON public.orders(cart_code) WHERE cart_code IS NOT NULL';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='orders' AND column_name='user_id') THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id)';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='orders' AND column_name='status') THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status)';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='orders' AND column_name='created_at') THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC)';
    END IF;
    
    -- Order items indexes
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='order_items' AND column_name='full_code') THEN
        EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS idx_order_items_full_code ON public.order_items(full_code) WHERE full_code IS NOT NULL';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='order_items' AND column_name='order_id') THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id)';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='order_items' AND column_name='product_id') THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON public.order_items(product_id)';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='order_items' AND column_name='cart_code') THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_order_items_cart_code ON public.order_items(cart_code)';
    END IF;
    
    -- Order files indexes
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='order_files' AND column_name='order_id') THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_order_files_order_id ON public.order_files(order_id)';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='order_files' AND column_name='cart_code') THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_order_files_cart_code ON public.order_files(cart_code)';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='order_files' AND column_name='full_code') THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_order_files_full_code ON public.order_files(full_code)';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='order_files' AND column_name='order_code') THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_order_files_order_code ON public.order_files(order_code)';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='order_files' AND column_name='owner_id') THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_order_files_owner_id ON public.order_files(owner_id)';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='order_files' AND column_name='file_key') THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_order_files_file_key ON public.order_files(file_key)';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='order_files' AND column_name='is_public') THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_order_files_public ON public.order_files(is_public) WHERE is_public = true';
    END IF;
    
    -- Payments indexes
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='payments' AND column_name='order_id') THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_payments_order_id ON public.payments(order_id)';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='payments' AND column_name='status') THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status)';
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not create some indexes: %', SQLERRM;
END $$;


-- ============================================================================
-- SECTION 7: CONFIG (Payment & Settings)
-- ============================================================================

-- Payment configs (bank accounts)
CREATE TABLE IF NOT EXISTS public.payment_configs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_type text NOT NULL UNIQUE CHECK (order_type IN ('ready_made', 'custom', 'printing')),
    bank_code text NOT NULL,
    account_no text NOT NULL,
    account_name text NOT NULL,
    is_active boolean DEFAULT true,
    notes text,
    updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.payment_configs IS 'Bank account settings per order type';
COMMENT ON COLUMN public.payment_configs.bank_code IS 'VietQR bank code (TCB, STB, VCB, etc.)';

-- System settings (dynamic config)
CREATE TABLE IF NOT EXISTS public.system_settings (
    key text PRIMARY KEY,
    value jsonb NOT NULL,
    label text,
    description text,
    group_name text DEFAULT 'general',
    is_public boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.system_settings IS 'Dynamic system configuration (replaces hardcoded values)';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_payment_configs_order_type ON public.payment_configs(order_type);
CREATE INDEX IF NOT EXISTS idx_payment_configs_active ON public.payment_configs(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_system_settings_group ON public.system_settings(group_name);
CREATE INDEX IF NOT EXISTS idx_system_settings_public ON public.system_settings(is_public) WHERE is_public = true;


-- ============================================================================
-- SECTION 8: SECURITY (Logs & Tokens)
-- ============================================================================

-- Security logs (immutable audit trail)
CREATE TABLE IF NOT EXISTS public.security_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    event_type varchar(50) NOT NULL,
    ip_address inet,
    user_agent text,
    details jsonb,
    created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.security_logs IS 'Immutable security audit log';

-- Refresh tokens
CREATE TABLE IF NOT EXISTS public.refresh_tokens (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    token text NOT NULL UNIQUE,
    device_info jsonb,
    expires_at timestamptz NOT NULL,
    revoked boolean DEFAULT false,
    revoked_at timestamptz,
    created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.refresh_tokens IS 'Auth refresh tokens with device tracking';

-- Wishlists (optional)
CREATE TABLE IF NOT EXISTS public.wishlists (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now(),
    UNIQUE (user_id, product_id)
);

COMMENT ON TABLE public.wishlists IS 'User product wishlists';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_security_logs_user ON public.security_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_security_logs_created ON public.security_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_logs_event ON public.security_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON public.refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON public.refresh_tokens(expires_at) WHERE NOT revoked;
CREATE INDEX IF NOT EXISTS idx_wishlists_user ON public.wishlists(user_id);


-- ============================================================================
-- SECTION 9: FUNCTIONS & TRIGGERS
-- ============================================================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN SELECT tablename FROM pg_tables 
             WHERE schemaname = 'public' 
             AND tablename IN ('users', 'profiles', 'addresses', 'categories', 'products', 
                               'carts', 'cart_items', 'orders', 'order_items', 'order_files',
                               'payments', 'payment_configs', 'system_settings', 'refresh_tokens')
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS update_%s_modtime ON public.%I', t, t);
        EXECUTE format('CREATE TRIGGER update_%s_modtime BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()', t, t);
    END LOOP;
END $$;

-- Auto-generate customer code
CREATE OR REPLACE FUNCTION generate_customer_code()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.customer_code IS NULL THEN
        NEW.customer_code := 'KH-' || upper(encode(gen_random_bytes(4), 'hex'));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_generate_customer_code ON public.users;
CREATE TRIGGER trigger_generate_customer_code
    BEFORE INSERT ON public.users
    FOR EACH ROW EXECUTE FUNCTION generate_customer_code();

-- Sync profiles from users
CREATE OR REPLACE FUNCTION sync_profile_from_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, avatar_url, customer_code)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.name, split_part(NEW.email, '@', 1)),
        NEW.image,
        NEW.customer_code
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = COALESCE(profiles.full_name, EXCLUDED.full_name),
        avatar_url = COALESCE(profiles.avatar_url, EXCLUDED.avatar_url),
        customer_code = COALESCE(profiles.customer_code, EXCLUDED.customer_code);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_profile ON public.users;
CREATE TRIGGER trigger_sync_profile
    AFTER INSERT OR UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION sync_profile_from_user();


-- ============================================================================
-- SECTION 10: RLS POLICIES
-- ============================================================================

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refresh_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wishlists ENABLE ROW LEVEL SECURITY;

-- Service role bypass (for API server)
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Service role full access" ON public.%I', t);
        EXECUTE format('CREATE POLICY "Service role full access" ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)', t);
    END LOOP;
END $$;

-- Public read policies
CREATE POLICY "Public read active categories" ON public.categories FOR SELECT USING (is_active = true);
CREATE POLICY "Public read active products" ON public.products FOR SELECT USING (is_active = true);
CREATE POLICY "Public read public settings" ON public.system_settings FOR SELECT USING (is_public = true);

-- User self-access policies
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users manage own addresses" ON public.addresses FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users manage own cart" ON public.carts FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own cart items" ON public.cart_items FOR ALL
    USING (EXISTS (SELECT 1 FROM public.carts WHERE carts.id = cart_items.cart_id AND carts.user_id = auth.uid()));

CREATE POLICY "Users view own orders" ON public.orders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users create own orders" ON public.orders FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users view own order items" ON public.order_items FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid()));

CREATE POLICY "Users view own order files" ON public.order_files FOR SELECT
    USING (
        is_public = true
        OR owner_id = auth.uid()
        OR auth.uid() = ANY(allowed_user_ids)
        OR EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_files.order_id AND orders.user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.carts WHERE carts.id = order_files.cart_id AND carts.user_id = auth.uid())
    );

CREATE POLICY "Users view own payments" ON public.payments FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.orders WHERE orders.id = payments.order_id AND orders.user_id = auth.uid()));

CREATE POLICY "Users manage own refresh tokens" ON public.refresh_tokens FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users manage own wishlists" ON public.wishlists FOR ALL USING (auth.uid() = user_id);

-- Admin policies (wrapped in DO block to check if role column exists)
DO $$
BEGIN
    -- Only create admin policies if users.role column exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'role'
    ) THEN
        -- Drop existing policies first
        DROP POLICY IF EXISTS "Admin view all profiles" ON public.profiles;
        DROP POLICY IF EXISTS "Admin manage all products" ON public.products;
        DROP POLICY IF EXISTS "Admin manage all categories" ON public.categories;
        DROP POLICY IF EXISTS "Admin manage all orders" ON public.orders;
        DROP POLICY IF EXISTS "Admin view payment configs" ON public.payment_configs;
        DROP POLICY IF EXISTS "Admin manage payment configs" ON public.payment_configs;
        DROP POLICY IF EXISTS "Admin view all settings" ON public.system_settings;
        DROP POLICY IF EXISTS "Admin update settings" ON public.system_settings;
        DROP POLICY IF EXISTS "Admin view security logs" ON public.security_logs;
        
        -- Create policies
        EXECUTE 'CREATE POLICY "Admin view all profiles" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() IN (SELECT id FROM public.users WHERE role = ''admin''))';
        EXECUTE 'CREATE POLICY "Admin manage all products" ON public.products FOR ALL TO authenticated USING (auth.uid() IN (SELECT id FROM public.users WHERE role = ''admin''))';
        EXECUTE 'CREATE POLICY "Admin manage all categories" ON public.categories FOR ALL TO authenticated USING (auth.uid() IN (SELECT id FROM public.users WHERE role = ''admin''))';
        EXECUTE 'CREATE POLICY "Admin manage all orders" ON public.orders FOR ALL TO authenticated USING (auth.uid() IN (SELECT id FROM public.users WHERE role = ''admin''))';
        EXECUTE 'CREATE POLICY "Admin view payment configs" ON public.payment_configs FOR SELECT TO authenticated USING (auth.uid() IN (SELECT id FROM public.users WHERE role = ''admin''))';
        EXECUTE 'CREATE POLICY "Admin manage payment configs" ON public.payment_configs FOR ALL TO authenticated USING (auth.uid() IN (SELECT id FROM public.users WHERE role = ''admin''))';
        EXECUTE 'CREATE POLICY "Admin view all settings" ON public.system_settings FOR SELECT TO authenticated USING (auth.uid() IN (SELECT id FROM public.users WHERE role = ''admin''))';
        EXECUTE 'CREATE POLICY "Admin update settings" ON public.system_settings FOR UPDATE TO authenticated USING (auth.uid() IN (SELECT id FROM public.users WHERE role = ''admin''))';
        EXECUTE 'CREATE POLICY "Admin view security logs" ON public.security_logs FOR SELECT TO authenticated USING (auth.uid() IN (SELECT id FROM public.users WHERE role = ''admin''))';
        
        RAISE NOTICE 'Admin policies created successfully';
    ELSE
        RAISE NOTICE 'Skipping admin policies: users.role column does not exist';
    END IF;
END $$;

-- Immutability policies (drop first to allow re-running)
DROP POLICY IF EXISTS "Settings cannot be deleted" ON public.system_settings;
DROP POLICY IF EXISTS "Security logs cannot be modified" ON public.security_logs;
DROP POLICY IF EXISTS "Security logs cannot be deleted" ON public.security_logs;
CREATE POLICY "Settings cannot be deleted" ON public.system_settings FOR DELETE USING (false);
CREATE POLICY "Security logs cannot be modified" ON public.security_logs FOR UPDATE USING (false);
CREATE POLICY "Security logs cannot be deleted" ON public.security_logs FOR DELETE USING (false);


-- ============================================================================
-- SECTION 11: SEED DATA
-- ============================================================================

-- System settings defaults
INSERT INTO public.system_settings (key, value, label, group_name, is_public) VALUES
    ('site_name', '"3D Web Store"', 'Website Name', 'general', true),
    ('contact_phone', '"0912345678"', 'Hotline', 'contact', true),
    ('contact_email', '"support@3dweb.com"', 'Contact Email', 'contact', true),
    ('shipping_fee_standard', '30000', 'Standard Shipping Fee', 'payment', true),
    ('free_ship_threshold', '1000000', 'Free Shipping Threshold', 'payment', true),
    ('maintenance_mode', 'false', 'Maintenance Mode', 'system', true)
ON CONFLICT (key) DO NOTHING;


-- ============================================================================
-- SCHEMA COMPLETE
-- ============================================================================
-- Total tables: 17
-- - Auth: users, accounts, sessions, verification_tokens
-- - Identity: profiles, addresses
-- - Catalog: categories, products
-- - Shopping: carts, cart_items
-- - Orders: orders, order_items, order_files, payments
-- - Config: payment_configs, system_settings
-- - Security: security_logs, refresh_tokens, wishlists
-- ============================================================================
