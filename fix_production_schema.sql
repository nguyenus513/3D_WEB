-- RUN THIS IN SUPABASE SQL EDITOR

-- 1. Fix custom_orders table
ALTER TABLE custom_orders 
ADD COLUMN IF NOT EXISTS demo_image_url text,
ADD COLUMN IF NOT EXISTS review_at timestamp with time zone;

-- 2. Fix print_orders table
ALTER TABLE print_orders 
ADD COLUMN IF NOT EXISTS demo_image_url text,
ADD COLUMN IF NOT EXISTS review_at timestamp with time zone;

-- 3. Create Status Update Function (Bypasses Cache Issues)
CREATE OR REPLACE FUNCTION update_order_status(
    p_table_name TEXT,
    p_order_id UUID,
    p_status TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF p_table_name = 'orders' THEN
        UPDATE orders SET status = p_status WHERE id = p_order_id;
    ELSIF p_table_name = 'custom_orders' THEN
        UPDATE custom_orders SET status = p_status WHERE id = p_order_id;
    ELSIF p_table_name = 'print_orders' THEN
        UPDATE print_orders SET status = p_status WHERE id = p_order_id;
    ELSE
        RETURN FALSE;
    END IF;
    RETURN TRUE;
END;
$$;

-- 4. Force Schema Cache Reload
NOTIFY pgrst, 'reload schema';
