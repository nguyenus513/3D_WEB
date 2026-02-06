-- ============================================================================
-- Optimization C: Migrate legacy order_parent/order_child/payment into unified orders
-- Date: 2026-02-06
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public._legacy_order_map (
    id BIGSERIAL PRIMARY KEY,
    order_parent_id UUID,
    order_child_id UUID,
    new_order_id UUID NOT NULL,
    order_code TEXT NOT NULL,
    source TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (order_parent_id, order_child_id, source)
);

DO $$
DECLARE
    has_parent BOOLEAN;
    has_child BOOLEAN;
    has_payment BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'order_parent'
    ) INTO has_parent;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'order_child'
    ) INTO has_child;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'payment'
    ) INTO has_payment;

    IF has_parent THEN
        -- Insert parent orders
        WITH src AS (
            SELECT
                op.*,
                CASE
                    WHEN EXISTS (SELECT 1 FROM public.orders o WHERE o.order_code = op.code_parent)
                    THEN 'LEG-' || op.code_parent
                    ELSE op.code_parent
                END AS target_code
            FROM public.order_parent op
            LEFT JOIN public._legacy_order_map m
                ON m.order_parent_id = op.id AND m.order_child_id IS NULL
            WHERE m.id IS NULL
        ),
        ins AS (
            INSERT INTO public.orders (
                order_code,
                user_id,
                order_type,
                status,
                payment_status,
                subtotal,
                shipping_fee,
                total_amount,
                deposit_amount,
                shipping_address_snapshot,
                notes,
                created_at,
                updated_at
            )
            SELECT
                src.target_code,
                src.user_id,
                'ready_made',
                CASE src.status
                    WHEN 'pending' THEN 'pending'
                    WHEN 'processing' THEN 'processing'
                    WHEN 'paid' THEN 'paid'
                    WHEN 'completed' THEN 'completed'
                    WHEN 'cancelled' THEN 'cancelled'
                    ELSE 'pending'
                END,
                CASE src.status
                    WHEN 'paid' THEN 'paid'
                    WHEN 'completed' THEN 'paid'
                    WHEN 'cancelled' THEN 'failed'
                    ELSE 'pending'
                END,
                COALESCE(src.total_amount, 0),
                COALESCE(src.shipping_fee, 0),
                COALESCE(src.total_amount, 0),
                0,
                src.shipping_address,
                src.note,
                src.created_at,
                src.updated_at
            FROM src
            ON CONFLICT (order_code) DO NOTHING
            RETURNING id, order_code
        )
        INSERT INTO public._legacy_order_map (order_parent_id, new_order_id, order_code, source)
        SELECT
            src.id,
            COALESCE(ins.id, o.id),
            src.target_code,
            'order_parent'
        FROM src
        LEFT JOIN ins ON ins.order_code = src.target_code
        LEFT JOIN public.orders o ON o.order_code = src.target_code
        WHERE COALESCE(ins.id, o.id) IS NOT NULL
          AND NOT EXISTS (
              SELECT 1 FROM public._legacy_order_map m
              WHERE m.order_parent_id = src.id AND m.order_child_id IS NULL
          );
    END IF;

    IF has_child THEN
        -- Direct child orders (no parent_id)
        WITH src AS (
            SELECT
                oc.*,
                CASE
                    WHEN EXISTS (SELECT 1 FROM public.orders o WHERE o.order_code = oc.code_child)
                    THEN 'LEG-' || oc.code_child
                    ELSE oc.code_child
                END AS target_code
            FROM public.order_child oc
            LEFT JOIN public._legacy_order_map m
                ON m.order_child_id = oc.id
            WHERE oc.parent_id IS NULL AND m.id IS NULL
        ),
        ins AS (
            INSERT INTO public.orders (
                order_code,
                user_id,
                order_type,
                status,
                payment_status,
                subtotal,
                total_amount,
                deposit_amount,
                notes,
                created_at,
                updated_at
            )
            SELECT
                src.target_code,
                src.user_id,
                'ready_made',
                CASE src.status
                    WHEN 'pending' THEN 'pending'
                    WHEN 'processing' THEN 'processing'
                    WHEN 'paid' THEN 'paid'
                    WHEN 'completed' THEN 'completed'
                    WHEN 'cancelled' THEN 'cancelled'
                    ELSE 'pending'
                END,
                CASE src.status
                    WHEN 'paid' THEN 'paid'
                    WHEN 'completed' THEN 'paid'
                    WHEN 'cancelled' THEN 'failed'
                    ELSE 'pending'
                END,
                COALESCE(src.total_price, 0),
                COALESCE(src.total_price, 0),
                0,
                src.product_name,
                src.created_at,
                src.updated_at
            FROM src
            ON CONFLICT (order_code) DO NOTHING
            RETURNING id, order_code
        )
        INSERT INTO public._legacy_order_map (order_child_id, new_order_id, order_code, source)
        SELECT
            src.id,
            COALESCE(ins.id, o.id),
            src.target_code,
            'order_child'
        FROM src
        LEFT JOIN ins ON ins.order_code = src.target_code
        LEFT JOIN public.orders o ON o.order_code = src.target_code
        WHERE COALESCE(ins.id, o.id) IS NOT NULL
          AND NOT EXISTS (
              SELECT 1 FROM public._legacy_order_map m
              WHERE m.order_child_id = src.id
          );

        -- Insert order_items for child orders that belong to a parent
        INSERT INTO public.order_items (
            order_id,
            product_id,
            sku,
            name,
            quantity,
            unit_price,
            total_price,
            configuration,
            created_at
        )
        SELECT
            m.new_order_id,
            oc.product_id,
            oc.product_sku,
            oc.product_name,
            oc.quantity,
            oc.unit_price,
            oc.total_price,
            jsonb_strip_nulls(
                COALESCE(oc.metadata, '{}'::jsonb) ||
                jsonb_build_object(
                    'legacy_code_child', oc.code_child,
                    'legacy_order_child_id', oc.id,
                    'legacy_parent_id', oc.parent_id
                )
            ),
            oc.created_at
        FROM public.order_child oc
        JOIN public._legacy_order_map m
            ON m.order_parent_id = oc.parent_id AND m.order_child_id IS NULL
        WHERE oc.parent_id IS NOT NULL
          AND NOT EXISTS (
              SELECT 1 FROM public.order_items oi
              WHERE oi.order_id = m.new_order_id
                AND oi.configuration->>'legacy_order_child_id' = oc.id::text
          );

        -- Insert order_items for direct child orders
        INSERT INTO public.order_items (
            order_id,
            product_id,
            sku,
            name,
            quantity,
            unit_price,
            total_price,
            configuration,
            created_at
        )
        SELECT
            m.new_order_id,
            oc.product_id,
            oc.product_sku,
            oc.product_name,
            oc.quantity,
            oc.unit_price,
            oc.total_price,
            jsonb_strip_nulls(
                COALESCE(oc.metadata, '{}'::jsonb) ||
                jsonb_build_object(
                    'legacy_code_child', oc.code_child,
                    'legacy_order_child_id', oc.id
                )
            ),
            oc.created_at
        FROM public.order_child oc
        JOIN public._legacy_order_map m
            ON m.order_child_id = oc.id
        WHERE oc.parent_id IS NULL
          AND NOT EXISTS (
              SELECT 1 FROM public.order_items oi
              WHERE oi.order_id = m.new_order_id
                AND oi.configuration->>'legacy_order_child_id' = oc.id::text
          );
    END IF;

    IF has_payment THEN
        -- Migrate legacy payment records
        INSERT INTO public.payments (
            order_id,
            transaction_code,
            amount,
            status,
            method,
            gateway_response,
            created_at,
            updated_at
        )
        SELECT
            target.order_id,
            p.reference_code,
            p.amount,
            p.status,
            p.method,
            jsonb_strip_nulls(
                jsonb_build_object(
                    'qr_url', p.qr_url,
                    'bank_code', p.bank_code,
                    'account_no', p.account_no,
                    'account_name', p.account_name,
                    'reference_code', p.reference_code,
                    'expires_at', p.expires_at,
                    'correlation_id', p.correlation_id,
                    'idempotency_key', p.idempotency_key
                )
            ),
            p.created_at,
            p.updated_at
        FROM public.payment p
        LEFT JOIN public.order_child oc ON oc.id = p.order_id
        LEFT JOIN public._legacy_order_map parent_map
            ON parent_map.order_parent_id = p.order_id AND p.order_type = 'parent'
        LEFT JOIN public._legacy_order_map child_map
            ON child_map.order_child_id = p.order_id AND p.order_type IN ('child', 'direct_child')
        LEFT JOIN public._legacy_order_map oc_parent_map
            ON oc_parent_map.order_parent_id = oc.parent_id AND oc.parent_id IS NOT NULL
        CROSS JOIN LATERAL (
            SELECT
                CASE
                    WHEN p.order_type = 'parent' THEN parent_map.new_order_id
                    WHEN p.order_type IN ('child', 'direct_child') AND oc.parent_id IS NOT NULL THEN oc_parent_map.new_order_id
                    WHEN p.order_type IN ('child', 'direct_child') THEN child_map.new_order_id
                    ELSE NULL
                END AS order_id
        ) AS target
        WHERE target.order_id IS NOT NULL
          AND NOT EXISTS (
              SELECT 1 FROM public.payments pay
              WHERE pay.order_id = target.order_id
                AND pay.transaction_code = p.reference_code
          );
    END IF;
END $$;

COMMIT;
