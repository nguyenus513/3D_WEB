-- ============================================================================
-- SCHEMA COMPATIBILITY MIGRATION
-- Date: 2026-02-07
-- Purpose: Add missing columns to existing tables for production schema v5
-- ============================================================================
-- This migration safely adds columns - skips if table doesn't exist
-- ============================================================================

DO $$
BEGIN
    -- =========================================
    -- USERS TABLE
    -- =========================================
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='users') THEN
        ALTER TABLE public.users ADD COLUMN IF NOT EXISTS role text DEFAULT 'user';
        RAISE NOTICE 'Updated users table';
    END IF;

    -- =========================================
    -- PROFILES TABLE
    -- =========================================
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='profiles') THEN
        ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role text DEFAULT 'customer';
        ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS instagram_username text;
        ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_verified boolean DEFAULT false;
        ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
        RAISE NOTICE 'Updated profiles table';
    END IF;

    -- =========================================
    -- PRODUCTS TABLE
    -- =========================================
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='products') THEN
        ALTER TABLE public.products ADD COLUMN IF NOT EXISTS type text DEFAULT 'ready_made';
        ALTER TABLE public.products ADD COLUMN IF NOT EXISTS short_description text;
        ALTER TABLE public.products ADD COLUMN IF NOT EXISTS low_stock_alert integer DEFAULT 5;
        ALTER TABLE public.products ADD COLUMN IF NOT EXISTS specs jsonb DEFAULT '{}'::jsonb;
        ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sizes jsonb DEFAULT '[]'::jsonb;
        ALTER TABLE public.products ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
        RAISE NOTICE 'Updated products table';
    END IF;

    -- =========================================
    -- CARTS TABLE
    -- =========================================
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='carts') THEN
        ALTER TABLE public.carts ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';
        ALTER TABLE public.carts ADD COLUMN IF NOT EXISTS cart_code varchar(8);
        ALTER TABLE public.carts ADD COLUMN IF NOT EXISTS shipping_address jsonb;
        ALTER TABLE public.carts ADD COLUMN IF NOT EXISTS subtotal numeric(15, 0) DEFAULT 0;
        ALTER TABLE public.carts ADD COLUMN IF NOT EXISTS shipping_fee numeric(15, 0) DEFAULT 0;
        ALTER TABLE public.carts ADD COLUMN IF NOT EXISTS discount numeric(15, 0) DEFAULT 0;
        ALTER TABLE public.carts ADD COLUMN IF NOT EXISTS total_amount numeric(15, 0) DEFAULT 0;
        ALTER TABLE public.carts ADD COLUMN IF NOT EXISTS checked_out_at timestamptz;
        RAISE NOTICE 'Updated carts table';
    END IF;

    -- =========================================
    -- CART_ITEMS TABLE
    -- =========================================
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='cart_items') THEN
        ALTER TABLE public.cart_items ADD COLUMN IF NOT EXISTS cart_code varchar(8);
        ALTER TABLE public.cart_items ADD COLUMN IF NOT EXISTS item_order_code varchar(8);
        ALTER TABLE public.cart_items ADD COLUMN IF NOT EXISTS full_code varchar(17);
        ALTER TABLE public.cart_items ADD COLUMN IF NOT EXISTS item_type text DEFAULT 'ready_made';
        ALTER TABLE public.cart_items ADD COLUMN IF NOT EXISTS production_status text DEFAULT 'waiting';
        ALTER TABLE public.cart_items ADD COLUMN IF NOT EXISTS print_tech text;
        ALTER TABLE public.cart_items ADD COLUMN IF NOT EXISTS infill text;
        ALTER TABLE public.cart_items ADD COLUMN IF NOT EXISTS layer_height text;
        ALTER TABLE public.cart_items ADD COLUMN IF NOT EXISTS color text;
        ALTER TABLE public.cart_items ADD COLUMN IF NOT EXISTS material text;
        ALTER TABLE public.cart_items ADD COLUMN IF NOT EXISTS custom_type text;
        ALTER TABLE public.cart_items ADD COLUMN IF NOT EXISTS custom_size text;
        ALTER TABLE public.cart_items ADD COLUMN IF NOT EXISTS notes text;
        ALTER TABLE public.cart_items ADD COLUMN IF NOT EXISTS configuration jsonb DEFAULT '{}'::jsonb;
        RAISE NOTICE 'Updated cart_items table';
    END IF;

    -- =========================================
    -- ORDERS TABLE
    -- =========================================
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='orders') THEN
        ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS order_code varchar(20);
        ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cart_code varchar(8);
        ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS legacy_order_code varchar(20);
        ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS address_id uuid;
        ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipping_address jsonb;
        ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS order_type text;
        ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS subtotal numeric(15, 0) DEFAULT 0;
        ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipping_fee numeric(15, 0) DEFAULT 0;
        ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS discount numeric(15, 0) DEFAULT 0;
        ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS deposit_amount numeric(15, 0) DEFAULT 0;
        ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';
        ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'pending';
        ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS fulfillment_status text DEFAULT 'pending';
        ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS deposit_paid boolean DEFAULT false;
        ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS admin_notes text;
        ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS demo_image_url text;
        ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS demo_reviewed_at timestamptz;
        ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS confirmed_at timestamptz;
        ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS paid_at timestamptz;
        ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS completed_at timestamptz;
        RAISE NOTICE 'Updated orders table';
    END IF;

    -- =========================================
    -- ORDER_ITEMS TABLE
    -- =========================================
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='order_items') THEN
        ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS item_order_code varchar(8);
        ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS cart_code varchar(8);
        ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS full_code varchar(17);
        ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS item_type text DEFAULT 'ready_made';
        ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS production_status text DEFAULT 'waiting';
        ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS file_path text;
        ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS print_tech text;
        ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS infill text;
        ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS layer_height text;
        ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS color text;
        ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS material text;
        ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS custom_type text;
        ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS custom_size text;
        ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS notes text;
        ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS configuration jsonb DEFAULT '{}'::jsonb;
        RAISE NOTICE 'Updated order_items table';
    END IF;

    -- =========================================
    -- PAYMENTS TABLE
    -- =========================================
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='payments') THEN
        ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';
        ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS method varchar(50) DEFAULT 'QR';
        ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS gateway_response jsonb;
        ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS confirmed_at timestamptz;
        RAISE NOTICE 'Updated payments table';
    END IF;

    RAISE NOTICE 'Schema compatibility migration completed at %', now();
END $$;
