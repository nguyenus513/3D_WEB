-- ============================================================================
-- MIGRATION: Upgrade existing schema to v6 (2-table structure)
-- ============================================================================
-- 
-- RUN THIS BEFORE PRODUCTION_SCHEMA_v6.sql if you have existing data
--
-- This script adds missing columns to existing tables to support the new
-- 2-table structure (carts → orders) while preserving existing data.
--
-- ============================================================================

-- ============================================================================
-- SECTION 1: ADD MISSING COLUMNS TO CARTS TABLE
-- ============================================================================

-- Add cart_code if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'carts' 
                   AND column_name = 'cart_code') THEN
        ALTER TABLE public.carts ADD COLUMN cart_code CHAR(8);
        -- Generate cart_code for existing records
        UPDATE public.carts SET cart_code = upper(encode(gen_random_bytes(4), 'hex')) WHERE cart_code IS NULL;
        -- Add NOT NULL constraint
        ALTER TABLE public.carts ALTER COLUMN cart_code SET NOT NULL;
        -- Add unique constraint
        ALTER TABLE public.carts ADD CONSTRAINT carts_cart_code_key UNIQUE (cart_code);
    END IF;
END $$;

-- Add deposit_paid if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'carts' 
                   AND column_name = 'deposit_paid') THEN
        ALTER TABLE public.carts ADD COLUMN deposit_paid BOOLEAN DEFAULT false;
    END IF;
END $$;

-- Add deposit_amount if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'carts' 
                   AND column_name = 'deposit_amount') THEN
        ALTER TABLE public.carts ADD COLUMN deposit_amount BIGINT DEFAULT 0;
    END IF;
END $$;

-- Add checked_out_at if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'carts' 
                   AND column_name = 'checked_out_at') THEN
        ALTER TABLE public.carts ADD COLUMN checked_out_at TIMESTAMPTZ;
    END IF;
END $$;

-- Add paid_at if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'carts' 
                   AND column_name = 'paid_at') THEN
        ALTER TABLE public.carts ADD COLUMN paid_at TIMESTAMPTZ;
    END IF;
END $$;

-- Add status if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'carts' 
                   AND column_name = 'status') THEN
        ALTER TABLE public.carts ADD COLUMN status TEXT DEFAULT 'active';
    END IF;
END $$;

-- Add payment_status if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'carts' 
                   AND column_name = 'payment_status') THEN
        ALTER TABLE public.carts ADD COLUMN payment_status TEXT DEFAULT 'pending';
    END IF;
END $$;

-- Add fulfillment_status if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'carts' 
                   AND column_name = 'fulfillment_status') THEN
        ALTER TABLE public.carts ADD COLUMN fulfillment_status TEXT DEFAULT 'pending';
    END IF;
END $$;

-- Add total_amount if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'carts' 
                   AND column_name = 'total_amount') THEN
        ALTER TABLE public.carts ADD COLUMN total_amount BIGINT DEFAULT 0;
    END IF;
END $$;

-- Add shipping_address if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'carts' 
                   AND column_name = 'shipping_address') THEN
        ALTER TABLE public.carts ADD COLUMN shipping_address JSONB;
    END IF;
END $$;

-- Add notes if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'carts' 
                   AND column_name = 'notes') THEN
        ALTER TABLE public.carts ADD COLUMN notes TEXT;
    END IF;
END $$;

-- ============================================================================
-- SECTION 2: ADD MISSING COLUMNS TO PRODUCTS TABLE
-- ============================================================================

-- Add category if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'products' 
                   AND column_name = 'category') THEN
        ALTER TABLE public.products ADD COLUMN category TEXT;
    END IF;
END $$;

-- Add type if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'products' 
                   AND column_name = 'type') THEN
        ALTER TABLE public.products ADD COLUMN type TEXT DEFAULT 'ready_made';
    END IF;
END $$;

-- Add sizes if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'products' 
                   AND column_name = 'sizes') THEN
        ALTER TABLE public.products ADD COLUMN sizes JSONB DEFAULT '[]';
    END IF;
END $$;

-- Add specs if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'products' 
                   AND column_name = 'specs') THEN
        ALTER TABLE public.products ADD COLUMN specs JSONB DEFAULT '{}';
    END IF;
END $$;

-- Add low_stock_alert if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'products' 
                   AND column_name = 'low_stock_alert') THEN
        ALTER TABLE public.products ADD COLUMN low_stock_alert INT DEFAULT 5;
    END IF;
END $$;

-- ============================================================================
-- SECTION 3: ADD MISSING COLUMNS TO ORDERS TABLE
-- ============================================================================

-- Add cart_id if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'orders' 
                   AND column_name = 'cart_id') THEN
        ALTER TABLE public.orders ADD COLUMN cart_id UUID;
    END IF;
END $$;

-- Add cart_code if not exists (8 HEX chars like carts)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'orders' 
                   AND column_name = 'cart_code') THEN
        ALTER TABLE public.orders ADD COLUMN cart_code CHAR(8);
        UPDATE public.orders SET cart_code = upper(encode(gen_random_bytes(4), 'hex')) WHERE cart_code IS NULL;
    END IF;
END $$;

-- Add deposit_amount if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'orders' 
                   AND column_name = 'deposit_amount') THEN
        ALTER TABLE public.orders ADD COLUMN deposit_amount BIGINT DEFAULT 0;
    END IF;
END $$;

-- Add discount if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'orders' 
                   AND column_name = 'discount') THEN
        ALTER TABLE public.orders ADD COLUMN discount BIGINT DEFAULT 0;
    END IF;
END $$;

-- Add shipping_address_snapshot if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'orders' 
                   AND column_name = 'shipping_address_snapshot') THEN
        ALTER TABLE public.orders ADD COLUMN shipping_address_snapshot JSONB;
    END IF;
END $$;

-- Add address_id if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'orders' 
                   AND column_name = 'address_id') THEN
        ALTER TABLE public.orders ADD COLUMN address_id UUID;
    END IF;
END $$;

-- Add cart_order_code if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'orders' 
                   AND column_name = 'cart_order_code') THEN
        ALTER TABLE public.orders ADD COLUMN cart_order_code CHAR(17);
        -- Generate cart_order_code for existing records (use cart_code + random 8 hex)
        UPDATE public.orders 
        SET cart_order_code = COALESCE(cart_code, upper(encode(gen_random_bytes(4), 'hex'))) || '_' || upper(encode(gen_random_bytes(4), 'hex'))
        WHERE cart_order_code IS NULL;
    END IF;
END $$;

-- Add name column if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'orders' 
                   AND column_name = 'name') THEN
        ALTER TABLE public.orders ADD COLUMN name TEXT;
        -- Set default name for existing records
        UPDATE public.orders SET name = COALESCE(order_type, 'Order') || ' - ' || COALESCE(order_code, id::text) WHERE name IS NULL;
        ALTER TABLE public.orders ALTER COLUMN name SET NOT NULL;
    END IF;
END $$;

-- Add quantity if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'orders' 
                   AND column_name = 'quantity') THEN
        ALTER TABLE public.orders ADD COLUMN quantity INT DEFAULT 1;
    END IF;
END $$;

-- Add unit_price if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'orders' 
                   AND column_name = 'unit_price') THEN
        ALTER TABLE public.orders ADD COLUMN unit_price BIGINT;
        UPDATE public.orders SET unit_price = COALESCE(total_amount, 0) WHERE unit_price IS NULL;
    END IF;
END $$;

-- Add total_price if not exists (different from total_amount)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'orders' 
                   AND column_name = 'total_price') THEN
        ALTER TABLE public.orders ADD COLUMN total_price BIGINT;
        UPDATE public.orders SET total_price = COALESCE(total_amount, 0) WHERE total_price IS NULL;
    END IF;
END $$;

-- Add item_type if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'orders' 
                   AND column_name = 'item_type') THEN
        ALTER TABLE public.orders ADD COLUMN item_type TEXT DEFAULT 'ready_made';
    END IF;
END $$;

-- Add custom_type if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'orders' 
                   AND column_name = 'custom_type') THEN
        ALTER TABLE public.orders ADD COLUMN custom_type TEXT;
    END IF;
END $$;

-- Add custom_size if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'orders' 
                   AND column_name = 'custom_size') THEN
        ALTER TABLE public.orders ADD COLUMN custom_size TEXT;
    END IF;
END $$;

-- Add configuration if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'orders' 
                   AND column_name = 'configuration') THEN
        ALTER TABLE public.orders ADD COLUMN configuration JSONB DEFAULT '{}';
    END IF;
END $$;

-- Add sku if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'orders' 
                   AND column_name = 'sku') THEN
        ALTER TABLE public.orders ADD COLUMN sku TEXT;
    END IF;
END $$;

-- Add product_id if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'orders' 
                   AND column_name = 'product_id') THEN
        ALTER TABLE public.orders ADD COLUMN product_id UUID;
    END IF;
END $$;

-- ============================================================================
-- SECTION 3.5: ADD MISSING COLUMNS TO ORDER_ITEMS TABLE
-- ============================================================================

-- Add cart_code if not exists (denormalized from order)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'order_items' 
                   AND column_name = 'cart_code') THEN
        ALTER TABLE public.order_items ADD COLUMN cart_code CHAR(8);
    END IF;
END $$;

-- Add item_order_code if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'order_items' 
                   AND column_name = 'item_order_code') THEN
        ALTER TABLE public.order_items ADD COLUMN item_order_code CHAR(8);
        UPDATE public.order_items SET item_order_code = upper(encode(gen_random_bytes(4), 'hex')) WHERE item_order_code IS NULL;
    END IF;
END $$;

-- Add full_code if not exists (cart_code_item_order_code)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'order_items' 
                   AND column_name = 'full_code') THEN
        ALTER TABLE public.order_items ADD COLUMN full_code TEXT;
    END IF;
END $$;

-- Add production_status if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'order_items' 
                   AND column_name = 'production_status') THEN
        ALTER TABLE public.order_items ADD COLUMN production_status TEXT DEFAULT 'waiting';
    END IF;
END $$;

-- Add configuration if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'order_items' 
                   AND column_name = 'configuration') THEN
        ALTER TABLE public.order_items ADD COLUMN configuration JSONB DEFAULT '{}';
    END IF;
END $$;

-- Add name if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'order_items' 
                   AND column_name = 'name') THEN
        ALTER TABLE public.order_items ADD COLUMN name TEXT;
        UPDATE public.order_items SET name = 'Item' WHERE name IS NULL;
    END IF;
END $$;

-- Add sku if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'order_items' 
                   AND column_name = 'sku') THEN
        ALTER TABLE public.order_items ADD COLUMN sku TEXT;
    END IF;
END $$;

-- ============================================================================
-- SECTION 4: CREATE INDEXES (conditionally)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_orders_cart_order_code ON public.orders(cart_order_code);
CREATE INDEX IF NOT EXISTS idx_orders_cart_id ON public.orders(cart_id);
CREATE INDEX IF NOT EXISTS idx_orders_cart_code ON public.orders(cart_code);
CREATE INDEX IF NOT EXISTS idx_carts_cart_code ON public.carts(cart_code);
CREATE INDEX IF NOT EXISTS idx_order_items_cart_code ON public.order_items(cart_code);
CREATE INDEX IF NOT EXISTS idx_order_items_production_status ON public.order_items(production_status);

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
-- 
-- After running this, you can now use the v6 APIs that expect:
-- - carts.cart_code (8 HEX)
-- - orders.cart_order_code (17 char: CARTCODE_ORDERCODE)
--
-- The old columns (order_code, cart_code in orders, etc.) are preserved
-- for backward compatibility.
--
-- ============================================================================
