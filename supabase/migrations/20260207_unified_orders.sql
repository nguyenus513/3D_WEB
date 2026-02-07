-- ============================================================================
-- Unified Orders Schema Migration
-- Date: 2026-02-07
-- Purpose: Add order_type to orders, extend order_files for multi-storage tracking
-- ============================================================================

BEGIN;

-- =============================
-- 1. Add order_type to orders table
-- =============================
ALTER TABLE public.orders 
    ADD COLUMN IF NOT EXISTS order_type TEXT;

-- Add check constraint for order_type values
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'chk_orders_order_type'
    ) THEN
        ALTER TABLE public.orders 
            ADD CONSTRAINT chk_orders_order_type 
            CHECK (order_type IS NULL OR order_type IN ('ready_made', 'custom', 'printing'));
    END IF;
END $$;

-- Index for order_type queries
CREATE INDEX IF NOT EXISTS idx_orders_order_type ON public.orders(order_type);

-- =============================
-- 2. Extend order_files table with full tracking columns
-- =============================
ALTER TABLE public.order_files
    ADD COLUMN IF NOT EXISTS file_name TEXT,
    ADD COLUMN IF NOT EXISTS mime_type TEXT,
    ADD COLUMN IF NOT EXISTS size_bytes BIGINT,
    ADD COLUMN IF NOT EXISTS category TEXT,
    ADD COLUMN IF NOT EXISTS owner_id UUID,
    ADD COLUMN IF NOT EXISTS allowed_user_ids UUID[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE;

-- Add check constraint for category values
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'chk_order_files_category'
    ) THEN
        ALTER TABLE public.order_files 
            ADD CONSTRAINT chk_order_files_category 
            CHECK (category IS NULL OR category IN ('models', 'images', 'review', 'docs', 'reference'));
    END IF;
END $$;

-- Add foreign key for owner_id if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'fk_order_files_owner'
    ) THEN
        ALTER TABLE public.order_files 
            ADD CONSTRAINT fk_order_files_owner 
            FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
    END IF;
END $$;

-- =============================
-- 3. Add indexes for performance
-- =============================
CREATE INDEX IF NOT EXISTS idx_order_files_category ON public.order_files(category);
CREATE INDEX IF NOT EXISTS idx_order_files_order_code ON public.order_files(order_code);
CREATE INDEX IF NOT EXISTS idx_order_files_owner_id ON public.order_files(owner_id);
CREATE INDEX IF NOT EXISTS idx_order_files_is_public ON public.order_files(is_public) WHERE is_public = true;

-- =============================
-- 4. Backfill order_type for existing orders
-- =============================
-- Set order_type based on existing order_code patterns or linked items
UPDATE public.orders o
SET order_type = 'ready_made'
WHERE order_type IS NULL 
  AND EXISTS (
      SELECT 1 FROM public.order_items oi 
      WHERE oi.order_id = o.id AND oi.product_id IS NOT NULL
  );

-- Orders with custom configs get custom type
UPDATE public.orders o
SET order_type = 'custom'
WHERE order_type IS NULL 
  AND EXISTS (
      SELECT 1 FROM public.order_items oi 
      WHERE oi.order_id = o.id AND oi.config IS NOT NULL AND oi.config::text LIKE '%custom%'
  );

COMMIT;
