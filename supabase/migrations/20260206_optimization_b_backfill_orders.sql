-- ============================================================================
-- Optimization B: Backfill orders.items -> order_items and items_config -> configs
-- Date: 2026-02-06
-- ============================================================================

BEGIN;

-- Backfill order_items from orders.items JSONB when no relational items exist
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'items'
    ) THEN
        WITH orders_missing AS (
            SELECT o.id, o.items
            FROM public.orders o
            LEFT JOIN public.order_items oi ON oi.order_id = o.id
            WHERE o.items IS NOT NULL
              AND jsonb_typeof(o.items) = 'array'
            GROUP BY o.id, o.items
            HAVING COUNT(oi.id) = 0
        ),
        expanded AS (
            SELECT
                om.id AS order_id,
                item
            FROM orders_missing om,
            LATERAL jsonb_array_elements(om.items) AS item
        )
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
            order_id,
            CASE
                WHEN (item->>'product_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                THEN (item->>'product_id')::uuid
                ELSE NULL
            END,
            COALESCE(item->>'name', 'Item'),
            NULLIF(item->>'sku', ''),
            CASE
                WHEN (item->>'quantity') ~ '^[0-9]+$' THEN (item->>'quantity')::int
                ELSE 1
            END,
            CASE
                WHEN (item->>'unit_price') ~ '^-?[0-9]+(\.[0-9]+)?$' THEN (item->>'unit_price')::numeric
                ELSE 0
            END,
            CASE
                WHEN (item->>'total_price') ~ '^-?[0-9]+(\.[0-9]+)?$' THEN (item->>'total_price')::numeric
                ELSE 0
            END,
            COALESCE(item->'configuration', '{}'::jsonb),
            CASE
                WHEN (item->>'created_at') IS NOT NULL AND (item->>'created_at') <> ''
                THEN (item->>'created_at')::timestamptz
                ELSE now()
            END
        FROM expanded;
    END IF;
END $$;

-- Backfill configs from items_config if present
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'items_config'
    ) THEN
        UPDATE public.orders
        SET custom_config = COALESCE(custom_config, items_config->'custom')
        WHERE custom_config IS NULL AND items_config ? 'custom';

        UPDATE public.orders
        SET printing_config = COALESCE(printing_config, items_config->'printing')
        WHERE printing_config IS NULL AND items_config ? 'printing';
    END IF;
END $$;

COMMIT;
