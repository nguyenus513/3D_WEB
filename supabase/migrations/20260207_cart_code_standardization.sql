-- Cart Code Standardization Migration
-- Format: cart_code (8-char hex) on orders, item_order_code (8-char hex) on order_items
-- Display: {cart_code}_{item_order_code} = 17 chars
-- QR/Transfer: cart_code only = 8 chars

-- =====================================================================
-- 1. Add cart_code to orders table
-- =====================================================================

ALTER TABLE public.orders 
    ADD COLUMN IF NOT EXISTS cart_code VARCHAR(8);

COMMENT ON COLUMN public.orders.cart_code IS 'Unique 8-char hex code for cart/order display. Format: [0-9A-F]{8}';

-- =====================================================================
-- 2. Add item_order_code to order_items table
-- =====================================================================

ALTER TABLE public.order_items 
    ADD COLUMN IF NOT EXISTS item_order_code VARCHAR(8);

COMMENT ON COLUMN public.order_items.item_order_code IS 'Unique 8-char hex code per item. Display format: cart_code_item_order_code';

-- =====================================================================
-- 3. Add check constraints for hex format
-- =====================================================================

DO $$ 
BEGIN
    -- Check constraint for orders.cart_code
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints 
        WHERE constraint_name = 'chk_orders_cart_code'
    ) THEN
        ALTER TABLE public.orders 
            ADD CONSTRAINT chk_orders_cart_code 
            CHECK (cart_code IS NULL OR cart_code ~ '^[0-9A-F]{8}$');
    END IF;

    -- Check constraint for order_items.item_order_code
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints 
        WHERE constraint_name = 'chk_order_items_item_order_code'
    ) THEN
        ALTER TABLE public.order_items 
            ADD CONSTRAINT chk_order_items_item_order_code 
            CHECK (item_order_code IS NULL OR item_order_code ~ '^[0-9A-F]{8}$');
    END IF;
END $$;

-- =====================================================================
-- 4. Add unique indexes
-- =====================================================================

-- Unique index on cart_code (partial - only non-null values)
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_cart_code 
    ON public.orders(cart_code) 
    WHERE cart_code IS NOT NULL;

-- Composite unique index on (order_id, item_order_code)
CREATE UNIQUE INDEX IF NOT EXISTS idx_order_items_order_item_code 
    ON public.order_items(order_id, item_order_code) 
    WHERE item_order_code IS NOT NULL;

-- =====================================================================
-- 5. Performance indexes
-- =====================================================================

-- Index for searching by cart_code
CREATE INDEX IF NOT EXISTS idx_orders_cart_code_search 
    ON public.orders(cart_code) 
    WHERE cart_code IS NOT NULL;
