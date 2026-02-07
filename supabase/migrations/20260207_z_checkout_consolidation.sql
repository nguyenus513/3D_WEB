-- Checkout/Order/Storage Consolidation
-- Date: 2026-02-07


-- ============================================================================
-- 1. ENUM UPDATES
-- ============================================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fulfillment_status') THEN
        CREATE TYPE fulfillment_status AS ENUM ('pending', 'processing', 'completed');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'production_status') THEN
        CREATE TYPE production_status AS ENUM ('waiting', 'printing', 'done', 'error');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'print_tech') THEN
        CREATE TYPE print_tech AS ENUM ('fdm', 'resin', 'sla');
    END IF;
END $$;

DO $$
BEGIN
    ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'review';
    ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'approved';
    ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'production_pending';
    ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'revising';
    ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'printing';
EXCEPTION WHEN undefined_object THEN
    RAISE NOTICE 'order_status enum missing, skipping enum updates';
WHEN others THEN
    RAISE NOTICE 'order_status enum update skipped: %', SQLERRM;
END $$;

DO $$
BEGIN
    ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'deposit_paid';
EXCEPTION WHEN undefined_object THEN
    RAISE NOTICE 'payment_status enum missing, skipping enum updates';
WHEN others THEN
    RAISE NOTICE 'payment_status enum update skipped: %', SQLERRM;
END $$;

-- ============================================================================
-- 2. ORDERS TABLE
-- ============================================================================
ALTER TABLE IF EXISTS public.orders
    ADD COLUMN IF NOT EXISTS cart_code VARCHAR(8),
    ADD COLUMN IF NOT EXISTS order_type TEXT,
    ADD COLUMN IF NOT EXISTS legacy_order_code VARCHAR(20),
    ADD COLUMN IF NOT EXISTS shipping_address JSONB,
    ADD COLUMN IF NOT EXISTS notes TEXT,
    ADD COLUMN IF NOT EXISTS admin_notes TEXT,
    ADD COLUMN IF NOT EXISTS fulfillment_status fulfillment_status DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS deposit_paid BOOLEAN DEFAULT false;

-- Migrate legacy columns -> new columns
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'admin_note'
    ) THEN
        UPDATE public.orders
        SET admin_notes = COALESCE(admin_notes, admin_note)
        WHERE admin_notes IS NULL AND admin_note IS NOT NULL;

        ALTER TABLE public.orders DROP COLUMN IF EXISTS admin_note;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'shipping_address_snapshot'
    ) THEN
        UPDATE public.orders
        SET shipping_address = COALESCE(shipping_address, shipping_address_snapshot)
        WHERE shipping_address IS NULL AND shipping_address_snapshot IS NOT NULL;

        ALTER TABLE public.orders DROP COLUMN IF EXISTS shipping_address_snapshot;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'customer_note'
    ) THEN
        UPDATE public.orders
        SET notes = COALESCE(notes, customer_note)
        WHERE notes IS NULL AND customer_note IS NOT NULL;
    END IF;
END $$;

-- Constraints for orders
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints
        WHERE constraint_name = 'chk_orders_cart_code'
    ) THEN
        ALTER TABLE public.orders
            ADD CONSTRAINT chk_orders_cart_code
            CHECK (cart_code IS NULL OR cart_code ~ '^[0-9A-F]{8}$');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints
        WHERE constraint_name = 'chk_orders_order_code'
    ) THEN
        ALTER TABLE public.orders
            ADD CONSTRAINT chk_orders_order_code
            CHECK (order_code ~ '^[0-9A-F]{8}$');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints
        WHERE constraint_name = 'chk_orders_order_type'
    ) THEN
        ALTER TABLE public.orders
            ADD CONSTRAINT chk_orders_order_type
            CHECK (order_type IS NULL OR order_type IN ('ready_made', 'custom', 'printing', 'mixed'));
    END IF;
END $$;

-- ============================================================================
-- 3. CARTS TABLE
-- ============================================================================
ALTER TABLE IF EXISTS public.carts
    ADD COLUMN IF NOT EXISTS cart_code VARCHAR(8),
    ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
    ADD COLUMN IF NOT EXISTS shipping_address JSONB,
    ADD COLUMN IF NOT EXISTS subtotal NUMERIC(15, 0) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS shipping_fee NUMERIC(15, 0) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS discount NUMERIC(15, 0) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_amount NUMERIC(15, 0) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS checked_out_at TIMESTAMPTZ;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints
        WHERE constraint_name = 'chk_carts_cart_code'
    ) THEN
        ALTER TABLE public.carts
            ADD CONSTRAINT chk_carts_cart_code
            CHECK (cart_code IS NULL OR cart_code ~ '^[0-9A-F]{8}$');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints
        WHERE constraint_name = 'chk_carts_status'
    ) THEN
        ALTER TABLE public.carts
            ADD CONSTRAINT chk_carts_status
            CHECK (status IN ('active', 'checked_out', 'abandoned'));
    END IF;
END $$;

-- ============================================================================
-- 4. CART ITEMS TABLE
-- ============================================================================
ALTER TABLE IF EXISTS public.cart_items
    ADD COLUMN IF NOT EXISTS cart_code VARCHAR(8),
    ADD COLUMN IF NOT EXISTS item_order_code VARCHAR(8),
    ADD COLUMN IF NOT EXISTS full_code VARCHAR(17),
    ADD COLUMN IF NOT EXISTS item_type TEXT DEFAULT 'ready_made',
    ADD COLUMN IF NOT EXISTS production_status production_status DEFAULT 'waiting',
    ADD COLUMN IF NOT EXISTS custom_type TEXT,
    ADD COLUMN IF NOT EXISTS custom_size TEXT,
    ADD COLUMN IF NOT EXISTS print_tech print_tech,
    ADD COLUMN IF NOT EXISTS infill TEXT,
    ADD COLUMN IF NOT EXISTS layer_height TEXT,
    ADD COLUMN IF NOT EXISTS color TEXT,
    ADD COLUMN IF NOT EXISTS material TEXT,
    ADD COLUMN IF NOT EXISTS notes TEXT,
    ADD COLUMN IF NOT EXISTS configuration JSONB DEFAULT '{}'::jsonb;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints
        WHERE constraint_name = 'chk_cart_items_cart_code'
    ) THEN
        ALTER TABLE public.cart_items
            ADD CONSTRAINT chk_cart_items_cart_code
            CHECK (cart_code IS NULL OR cart_code ~ '^[0-9A-F]{8}$');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints
        WHERE constraint_name = 'chk_cart_items_item_order_code'
    ) THEN
        ALTER TABLE public.cart_items
            ADD CONSTRAINT chk_cart_items_item_order_code
            CHECK (item_order_code IS NULL OR item_order_code ~ '^[0-9A-F]{8}$');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints
        WHERE constraint_name = 'chk_cart_items_full_code'
    ) THEN
        ALTER TABLE public.cart_items
            ADD CONSTRAINT chk_cart_items_full_code
            CHECK (full_code IS NULL OR full_code ~ '^[0-9A-F]{8}_[0-9A-F]{8}$');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints
        WHERE constraint_name = 'chk_cart_items_item_type'
    ) THEN
        ALTER TABLE public.cart_items
            ADD CONSTRAINT chk_cart_items_item_type
            CHECK (item_type IS NULL OR item_type IN ('ready_made', 'custom', 'printing'));
    END IF;
END $$;

-- ============================================================================
-- 5. ORDER ITEMS TABLE
-- ============================================================================
ALTER TABLE IF EXISTS public.order_items
    ADD COLUMN IF NOT EXISTS item_order_code VARCHAR(8),
    ADD COLUMN IF NOT EXISTS cart_code VARCHAR(8),
    ADD COLUMN IF NOT EXISTS full_code VARCHAR(17),
    ADD COLUMN IF NOT EXISTS item_type TEXT DEFAULT 'ready_made',
    ADD COLUMN IF NOT EXISTS production_status production_status DEFAULT 'waiting',
    ADD COLUMN IF NOT EXISTS file_path TEXT,
    ADD COLUMN IF NOT EXISTS custom_type TEXT,
    ADD COLUMN IF NOT EXISTS custom_size TEXT,
    ADD COLUMN IF NOT EXISTS print_tech print_tech,
    ADD COLUMN IF NOT EXISTS infill TEXT,
    ADD COLUMN IF NOT EXISTS layer_height TEXT,
    ADD COLUMN IF NOT EXISTS color TEXT,
    ADD COLUMN IF NOT EXISTS material TEXT,
    ADD COLUMN IF NOT EXISTS notes TEXT,
    ADD COLUMN IF NOT EXISTS configuration JSONB DEFAULT '{}'::jsonb;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints
        WHERE constraint_name = 'chk_order_items_item_order_code'
    ) THEN
        ALTER TABLE public.order_items
            ADD CONSTRAINT chk_order_items_item_order_code
            CHECK (item_order_code IS NULL OR item_order_code ~ '^[0-9A-F]{8}$');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints
        WHERE constraint_name = 'chk_order_items_cart_code'
    ) THEN
        ALTER TABLE public.order_items
            ADD CONSTRAINT chk_order_items_cart_code
            CHECK (cart_code IS NULL OR cart_code ~ '^[0-9A-F]{8}$');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints
        WHERE constraint_name = 'chk_order_items_full_code'
    ) THEN
        ALTER TABLE public.order_items
            ADD CONSTRAINT chk_order_items_full_code
            CHECK (full_code IS NULL OR full_code ~ '^[0-9A-F]{8}_[0-9A-F]{8}$');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints
        WHERE constraint_name = 'chk_order_items_item_type'
    ) THEN
        ALTER TABLE public.order_items
            ADD CONSTRAINT chk_order_items_item_type
            CHECK (item_type IS NULL OR item_type IN ('ready_made', 'custom', 'printing'));
    END IF;
END $$;

-- ============================================================================
-- 6. ORDER FILES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.order_files (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
    order_item_id uuid REFERENCES public.order_items(id) ON DELETE SET NULL,
    cart_id uuid REFERENCES public.carts(id) ON DELETE SET NULL,
    cart_item_id uuid REFERENCES public.cart_items(id) ON DELETE SET NULL,
    cart_code varchar(8),
    full_code varchar(17),
    order_code varchar(8),
    storage_provider text NOT NULL DEFAULT 'r2',
    file_key text,
    drive_file_id text,
    drive_path text,
    drive_url text,
    file_name text,
    mime_type text,
    size_bytes bigint,
    category text,
    owner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    is_public boolean DEFAULT false,
    allowed_user_ids uuid[] DEFAULT '{}'::uuid[],
    archived_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

ALTER TABLE IF EXISTS public.order_files
    ADD COLUMN IF NOT EXISTS order_id uuid,
    ADD COLUMN IF NOT EXISTS order_item_id uuid,
    ADD COLUMN IF NOT EXISTS cart_id uuid,
    ADD COLUMN IF NOT EXISTS cart_item_id uuid,
    ADD COLUMN IF NOT EXISTS cart_code varchar(8),
    ADD COLUMN IF NOT EXISTS full_code varchar(17),
    ADD COLUMN IF NOT EXISTS order_code varchar(8),
    ADD COLUMN IF NOT EXISTS storage_provider text DEFAULT 'r2',
    ADD COLUMN IF NOT EXISTS file_key text,
    ADD COLUMN IF NOT EXISTS drive_file_id text,
    ADD COLUMN IF NOT EXISTS drive_path text,
    ADD COLUMN IF NOT EXISTS drive_url text,
    ADD COLUMN IF NOT EXISTS file_name text,
    ADD COLUMN IF NOT EXISTS mime_type text,
    ADD COLUMN IF NOT EXISTS size_bytes bigint,
    ADD COLUMN IF NOT EXISTS category text,
    ADD COLUMN IF NOT EXISTS owner_id uuid,
    ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS allowed_user_ids uuid[] DEFAULT '{}'::uuid[],
    ADD COLUMN IF NOT EXISTS archived_at timestamptz;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints
        WHERE constraint_name = 'chk_order_files_cart_code'
    ) THEN
        ALTER TABLE public.order_files
            ADD CONSTRAINT chk_order_files_cart_code
            CHECK (cart_code IS NULL OR cart_code ~ '^[0-9A-F]{8}$');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints
        WHERE constraint_name = 'chk_order_files_full_code'
    ) THEN
        ALTER TABLE public.order_files
            ADD CONSTRAINT chk_order_files_full_code
            CHECK (full_code IS NULL OR full_code ~ '^[0-9A-F]{8}_[0-9A-F]{8}$');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints
        WHERE constraint_name = 'chk_order_files_order_code'
    ) THEN
        ALTER TABLE public.order_files
            ADD CONSTRAINT chk_order_files_order_code
            CHECK (order_code IS NULL OR order_code ~ '^[0-9A-F]{8}$');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints
        WHERE constraint_name = 'chk_order_files_category'
    ) THEN
        ALTER TABLE public.order_files
            ADD CONSTRAINT chk_order_files_category
            CHECK (category IS NULL OR category IN ('models', 'images', 'review', 'docs', 'reference'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_order_files_order_id ON public.order_files(order_id);
CREATE INDEX IF NOT EXISTS idx_order_files_cart_code ON public.order_files(cart_code);
CREATE INDEX IF NOT EXISTS idx_order_files_full_code ON public.order_files(full_code);
CREATE INDEX IF NOT EXISTS idx_order_files_order_code ON public.order_files(order_code);
CREATE INDEX IF NOT EXISTS idx_order_files_owner_id ON public.order_files(owner_id);
CREATE INDEX IF NOT EXISTS idx_order_files_file_key ON public.order_files(file_key);
CREATE INDEX IF NOT EXISTS idx_order_files_category ON public.order_files(category);
CREATE INDEX IF NOT EXISTS idx_order_files_is_public ON public.order_files(is_public) WHERE is_public = true;

-- ============================================================================
-- 7. BACKFILL CODES
-- ============================================================================
-- Orders: cart_code
UPDATE public.orders
SET cart_code = upper(encode(gen_random_bytes(4), 'hex'))
WHERE cart_code IS NULL;

-- Carts: cart_code
UPDATE public.carts
SET cart_code = upper(encode(gen_random_bytes(4), 'hex'))
WHERE cart_code IS NULL;

-- Cart items: cart_code from carts
UPDATE public.cart_items ci
SET cart_code = c.cart_code
FROM public.carts c
WHERE ci.cart_id = c.id AND (ci.cart_code IS NULL OR ci.cart_code = '');

-- Cart items: item_order_code
UPDATE public.cart_items
SET item_order_code = upper(encode(gen_random_bytes(4), 'hex'))
WHERE item_order_code IS NULL;

-- Cart items: full_code
UPDATE public.cart_items
SET full_code = cart_code || '_' || item_order_code
WHERE full_code IS NULL AND cart_code IS NOT NULL AND item_order_code IS NOT NULL;

-- Order items: cart_code from orders
UPDATE public.order_items oi
SET cart_code = o.cart_code
FROM public.orders o
WHERE oi.order_id = o.id AND (oi.cart_code IS NULL OR oi.cart_code = '');

-- Order items: item_order_code
UPDATE public.order_items
SET item_order_code = upper(encode(gen_random_bytes(4), 'hex'))
WHERE item_order_code IS NULL;

-- Order items: full_code
UPDATE public.order_items
SET full_code = cart_code || '_' || item_order_code
WHERE full_code IS NULL AND cart_code IS NOT NULL AND item_order_code IS NOT NULL;

-- Default item_type if null
UPDATE public.cart_items SET item_type = 'ready_made' WHERE item_type IS NULL;
UPDATE public.order_items SET item_type = 'ready_made' WHERE item_type IS NULL;
UPDATE public.cart_items SET production_status = 'waiting' WHERE production_status IS NULL;
UPDATE public.order_items SET production_status = 'waiting' WHERE production_status IS NULL;
UPDATE public.orders SET order_type = 'ready_made' WHERE order_type IS NULL;
UPDATE public.orders SET fulfillment_status = 'pending' WHERE fulfillment_status IS NULL;

-- ============================================================================
-- 8. ORDER FILES BACKFILL
-- ============================================================================
UPDATE public.order_files ofl
SET order_code = o.order_code
FROM public.orders o
WHERE ofl.order_id = o.id AND ofl.order_code IS NULL;

UPDATE public.order_files ofl
SET cart_code = COALESCE(ofl.cart_code, o.cart_code)
FROM public.orders o
WHERE ofl.order_id = o.id AND ofl.cart_code IS NULL;

UPDATE public.order_files ofl
SET cart_code = c.cart_code
FROM public.carts c
WHERE ofl.cart_id = c.id AND ofl.cart_code IS NULL;

UPDATE public.order_files ofl
SET full_code = oi.full_code
FROM public.order_items oi
WHERE ofl.order_item_id = oi.id AND ofl.full_code IS NULL;

UPDATE public.order_files ofl
SET owner_id = COALESCE(ofl.owner_id, o.user_id)
FROM public.orders o
WHERE ofl.order_id = o.id AND ofl.owner_id IS NULL;

UPDATE public.order_files ofl
SET owner_id = COALESCE(ofl.owner_id, c.user_id)
FROM public.carts c
WHERE ofl.cart_id = c.id AND ofl.owner_id IS NULL;

UPDATE public.order_files
SET storage_provider = CASE
    WHEN storage_provider IS NOT NULL THEN storage_provider
    WHEN drive_file_id IS NOT NULL OR drive_path IS NOT NULL THEN 'drive'
    ELSE 'r2'
END
WHERE storage_provider IS NULL;

UPDATE public.order_files
SET category = COALESCE(category, 'images')
WHERE category IS NULL;

-- ============================================================================
-- 9. INDEXES AND UNIQUE CONSTRAINTS
-- ============================================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_cart_code ON public.orders(cart_code) WHERE cart_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_cart_code_search ON public.orders(cart_code) WHERE cart_code IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_order_items_full_code_unique ON public.order_items(full_code) WHERE full_code IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_order_items_order_item_code ON public.order_items(order_id, item_order_code) WHERE item_order_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_order_items_cart_code ON public.order_items(cart_code) WHERE cart_code IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_cart_items_full_code_unique ON public.cart_items(full_code) WHERE full_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cart_items_cart_code ON public.cart_items(cart_code);

-- ============================================================================
-- 10. UNIQUE ACTIVE CART PER USER
-- ============================================================================
DO $$
DECLARE
    r record;
BEGIN
    FOR r IN
        SELECT c.conname
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(c.conkey)
        WHERE t.relname = 'carts' AND c.contype = 'u' AND a.attname = 'user_id'
    LOOP
        EXECUTE format('ALTER TABLE public.carts DROP CONSTRAINT IF EXISTS %I', r.conname);
    END LOOP;
END $$;

DO $$
DECLARE
    r record;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'carts'
          AND indexdef ILIKE '%UNIQUE%'
          AND indexdef ILIKE '%(user_id)%'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS public.%I', r.indexname);
    END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_carts_user_active ON public.carts(user_id) WHERE status = 'active';

-- ============================================================================
-- 11. ORDER_FILES RLS
-- ============================================================================
ALTER TABLE IF EXISTS public.order_files ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'order_files'
          AND policyname = 'Users can view own order files'
    ) THEN
        CREATE POLICY "Users can view own order files"
            ON public.order_files
            FOR SELECT
            USING (
                is_public = true
                OR owner_id = auth.uid()
                OR (allowed_user_ids IS NOT NULL AND auth.uid() = ANY(allowed_user_ids))
                OR (order_id IS NOT NULL AND EXISTS (
                    SELECT 1 FROM public.orders o WHERE o.id = order_files.order_id AND o.user_id = auth.uid()
                ))
                OR (cart_id IS NOT NULL AND EXISTS (
                    SELECT 1 FROM public.carts c WHERE c.id = order_files.cart_id AND c.user_id = auth.uid()
                ))
            );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'order_files'
          AND policyname = 'Service role full access order_files'
    ) THEN
        CREATE POLICY "Service role full access order_files"
            ON public.order_files
            FOR ALL TO service_role
            USING (true)
            WITH CHECK (true);
    END IF;
END $$;

-- ============================================================================
-- 12. ARCHIVE LEGACY TABLES
-- ============================================================================
DO $$
BEGIN
    IF to_regclass('public.custom_orders') IS NOT NULL AND to_regclass('public.custom_orders_archive') IS NULL THEN
        ALTER TABLE public.custom_orders RENAME TO custom_orders_archive;
    END IF;
    IF to_regclass('public.print_orders') IS NOT NULL AND to_regclass('public.print_orders_archive') IS NULL THEN
        ALTER TABLE public.print_orders RENAME TO print_orders_archive;
    END IF;
    IF to_regclass('public.product_orders') IS NOT NULL AND to_regclass('public.product_orders_archive') IS NULL THEN
        ALTER TABLE public.product_orders RENAME TO product_orders_archive;
    END IF;
    IF to_regclass('public.order_configs') IS NOT NULL AND to_regclass('public.order_configs_archive') IS NULL THEN
        ALTER TABLE public.order_configs RENAME TO order_configs_archive;
    END IF;
    IF to_regclass('public.order_parent') IS NOT NULL AND to_regclass('public.order_parent_archive') IS NULL THEN
        ALTER TABLE public.order_parent RENAME TO order_parent_archive;
    END IF;
    IF to_regclass('public.order_child') IS NOT NULL AND to_regclass('public.order_child_archive') IS NULL THEN
        ALTER TABLE public.order_child RENAME TO order_child_archive;
    END IF;
    IF to_regclass('public.product_order_items') IS NOT NULL AND to_regclass('public.product_order_items_archive') IS NULL THEN
        ALTER TABLE public.product_order_items RENAME TO product_order_items_archive;
    END IF;
END $$;

