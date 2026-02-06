-- ============================================================================
-- Optimization F: Indexes & constraints
-- Date: 2026-02-06
-- ============================================================================

BEGIN;

-- Indexes
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'verification_tokens'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_verification_tokens_identifier
            ON public.verification_tokens(identifier);
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'faqs'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_faqs_is_active ON public.faqs(is_active);
        CREATE INDEX IF NOT EXISTS idx_faqs_sort_order ON public.faqs(sort_order);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_categories_sort_order ON public.categories(sort_order);

-- Common query indexes (safe if already present)
CREATE INDEX IF NOT EXISTS idx_orders_user_created ON public.orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status_created ON public.orders(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON public.payments(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);

-- Constraints (non-negative values)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'total_amount'
    ) AND NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'orders_total_amount_nonneg'
    ) THEN
        ALTER TABLE public.orders ADD CONSTRAINT orders_total_amount_nonneg CHECK (total_amount >= 0) NOT VALID;
        ALTER TABLE public.orders VALIDATE CONSTRAINT orders_total_amount_nonneg;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'subtotal'
    ) AND NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'orders_subtotal_nonneg'
    ) THEN
        ALTER TABLE public.orders ADD CONSTRAINT orders_subtotal_nonneg CHECK (subtotal >= 0) NOT VALID;
        ALTER TABLE public.orders VALIDATE CONSTRAINT orders_subtotal_nonneg;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'shipping_fee'
    ) AND NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'orders_shipping_fee_nonneg'
    ) THEN
        ALTER TABLE public.orders ADD CONSTRAINT orders_shipping_fee_nonneg CHECK (shipping_fee >= 0) NOT VALID;
        ALTER TABLE public.orders VALIDATE CONSTRAINT orders_shipping_fee_nonneg;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'discount'
    ) AND NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'orders_discount_nonneg'
    ) THEN
        ALTER TABLE public.orders ADD CONSTRAINT orders_discount_nonneg CHECK (discount >= 0) NOT VALID;
        ALTER TABLE public.orders VALIDATE CONSTRAINT orders_discount_nonneg;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'deposit_amount'
    ) AND NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'orders_deposit_amount_nonneg'
    ) THEN
        ALTER TABLE public.orders ADD CONSTRAINT orders_deposit_amount_nonneg CHECK (deposit_amount >= 0) NOT VALID;
        ALTER TABLE public.orders VALIDATE CONSTRAINT orders_deposit_amount_nonneg;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'amount'
    ) AND NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'payments_amount_positive'
    ) THEN
        ALTER TABLE public.payments ADD CONSTRAINT payments_amount_positive CHECK (amount >= 0) NOT VALID;
        ALTER TABLE public.payments VALIDATE CONSTRAINT payments_amount_positive;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'quantity'
    ) AND NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'order_items_quantity_positive'
    ) THEN
        ALTER TABLE public.order_items ADD CONSTRAINT order_items_quantity_positive CHECK (quantity > 0) NOT VALID;
        ALTER TABLE public.order_items VALIDATE CONSTRAINT order_items_quantity_positive;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'unit_price'
    ) AND NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'order_items_unit_price_nonneg'
    ) THEN
        ALTER TABLE public.order_items ADD CONSTRAINT order_items_unit_price_nonneg CHECK (unit_price >= 0) NOT VALID;
        ALTER TABLE public.order_items VALIDATE CONSTRAINT order_items_unit_price_nonneg;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'total_price'
    ) AND NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'order_items_total_price_nonneg'
    ) THEN
        ALTER TABLE public.order_items ADD CONSTRAINT order_items_total_price_nonneg CHECK (total_price >= 0) NOT VALID;
        ALTER TABLE public.order_items VALIDATE CONSTRAINT order_items_total_price_nonneg;
    END IF;
END $$;

COMMIT;
