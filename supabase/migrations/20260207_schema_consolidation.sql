-- ============================================================
-- Phase 11: Schema Consolidation Migration
-- Consolidate custom_orders, print_orders, product_orders → orders
-- ============================================================

-- Step 1: Add item_type column to order_items if not exists
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'order_items' AND column_name = 'item_type') THEN
        ALTER TABLE order_items ADD COLUMN item_type text DEFAULT 'product';
    END IF;
END $$;

-- Step 2: Migrate custom_orders → orders (preserve existing data)
INSERT INTO orders (
    id, order_code, user_id, order_type,
    subtotal, shipping_fee, discount, total_amount, deposit_amount,
    status, payment_status, shipping_address,
    custom_config,
    customer_note, admin_note,
    created_at, updated_at, confirmed_at, completed_at
)
SELECT 
    id, 
    order_code, 
    user_id, 
    'custom',
    COALESCE(subtotal, 0)::numeric,
    COALESCE(shipping_fee, 0)::numeric,
    COALESCE(discount, 0)::numeric,
    COALESCE(total_amount, 0)::numeric,
    COALESCE(deposit_amount, 0)::numeric,
    status,
    payment_status,
    shipping_address,
    jsonb_build_object(
        'custom_type', custom_type,
        'custom_size', custom_size,
        'description', description,
        'reference_images', COALESCE(reference_images, '[]'::jsonb),
        'demo_image_url', demo_image_url,
        'deposit_paid', deposit_paid
    ),
    customer_note,
    admin_note,
    created_at,
    updated_at,
    confirmed_at,
    completed_at
FROM custom_orders
WHERE NOT EXISTS (
    SELECT 1 FROM orders o WHERE o.order_code = custom_orders.order_code
);

-- Step 3: Migrate print_orders → orders (if any exist)
INSERT INTO orders (
    id, order_code, user_id, order_type,
    subtotal, shipping_fee, discount, total_amount, deposit_amount,
    status, payment_status, shipping_address,
    custom_config,
    customer_note, admin_note,
    created_at, updated_at, confirmed_at, completed_at
)
SELECT 
    id,
    order_code,
    user_id,
    'print',
    COALESCE(subtotal, 0)::numeric,
    COALESCE(shipping_fee, 0)::numeric,
    COALESCE(discount, 0)::numeric,
    COALESCE(total_amount, 0)::numeric,
    COALESCE(deposit_amount, 0)::numeric,
    status,
    payment_status,
    shipping_address,
    jsonb_build_object(
        'print_type', print_type,
        'material', material,
        'color', color,
        'infill', infill,
        'quantity', quantity,
        'file_url', file_url,
        'file_name', file_name,
        'grams', grams,
        'print_hours', print_hours,
        'deposit_paid', deposit_paid
    ),
    customer_note,
    admin_note,
    created_at,
    updated_at,
    confirmed_at,
    completed_at
FROM print_orders
WHERE NOT EXISTS (
    SELECT 1 FROM orders o WHERE o.order_code = print_orders.order_code
);

-- Step 4: Migrate product_orders → orders (if any exist)
INSERT INTO orders (
    id, order_code, user_id, order_type,
    subtotal, shipping_fee, discount, total_amount,
    status, payment_status, shipping_address,
    customer_note, admin_note,
    created_at, updated_at, completed_at
)
SELECT 
    id,
    order_code,
    user_id,
    'product',
    COALESCE(subtotal, 0)::numeric,
    COALESCE(shipping_fee, 0)::numeric,
    COALESCE(discount, 0)::numeric,
    COALESCE(total_amount, 0)::numeric,
    status,
    payment_status,
    shipping_address,
    customer_note,
    admin_note,
    created_at,
    updated_at,
    completed_at
FROM product_orders
WHERE NOT EXISTS (
    SELECT 1 FROM orders o WHERE o.order_code = product_orders.order_code
);

-- Step 5: Migrate product_order_items → order_items
INSERT INTO order_items (
    id, order_id, product_id, name, sku,
    quantity, unit_price, total_price, configuration,
    created_at
)
SELECT 
    poi.id,
    poi.order_id,
    poi.product_id,
    poi.name,
    poi.sku,
    poi.quantity,
    poi.unit_price,
    poi.total_price,
    poi.configuration,
    poi.created_at
FROM product_order_items poi
WHERE NOT EXISTS (
    SELECT 1 FROM order_items oi WHERE oi.id = poi.id
);

-- Step 6: Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_order_type ON orders(order_type);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_production_status ON order_items(production_status);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);

-- Step 7: Archive legacy tables (rename with _archive suffix)
-- Comment out if you want to drop completely after verification
ALTER TABLE IF EXISTS custom_orders RENAME TO custom_orders_archive;
ALTER TABLE IF EXISTS print_orders RENAME TO print_orders_archive;
ALTER TABLE IF EXISTS product_orders RENAME TO product_orders_archive;
ALTER TABLE IF EXISTS product_order_items RENAME TO product_order_items_archive;
ALTER TABLE IF EXISTS order_configs RENAME TO order_configs_archive;

-- ============================================================
-- VERIFICATION QUERY: Run after migration
-- ============================================================
-- SELECT 
--     'orders' as table_name, COUNT(*) as count FROM orders
-- UNION ALL SELECT 
--     'order_items', COUNT(*) FROM order_items
-- UNION ALL SELECT 
--     'custom_orders_archive', COUNT(*) FROM custom_orders_archive
-- UNION ALL SELECT 
--     'print_orders_archive', COUNT(*) FROM print_orders_archive;
