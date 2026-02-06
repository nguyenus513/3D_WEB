-- ============================================================================
-- Canonical Order Items Backfill + Indexes (safe, additive)
-- Date: 2026-02-06
-- Notes:
-- - Backfill order_items from orders.items where missing
-- - Add missing indexes for performance
-- ============================================================================

BEGIN;

-- Backfill order_items from JSONB snapshot if missing
INSERT INTO public.order_items (
    order_id,
    product_id,
    name,
    sku,
    quantity,
    unit_price,
    total_price,
    configuration,
    created_at
)
SELECT
    o.id,
    NULLIF(item->>'product_id', '')::uuid,
    COALESCE(item->>'name', 'Item'),
    item->>'sku',
    COALESCE((item->>'quantity')::int, 1),
    COALESCE((item->>'unit_price')::numeric, 0),
    COALESCE((item->>'total_price')::numeric, 0),
    COALESCE(item->'configuration', '{}'::jsonb),
    now()
FROM public.orders o,
     LATERAL jsonb_array_elements(o.items) AS item
WHERE o.items IS NOT NULL
  AND jsonb_typeof(o.items) = 'array'
  AND jsonb_array_length(o.items) > 0
  AND NOT EXISTS (
      SELECT 1 FROM public.order_items oi WHERE oi.order_id = o.id
  );

-- Performance indexes (safe)
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_code ON public.orders(order_code);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_products_slug ON public.products(slug);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON public.products(is_active);

COMMIT;

-- NOTE: Do NOT drop orders.items until verified and signed off.
