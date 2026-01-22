-- Add foreign key constraint from order_items.order_id to orders.id
-- This is required for Supabase to do automatic joins

-- First, check if there are any orphan order_items (items with invalid order_id)
-- SELECT * FROM order_items WHERE order_id NOT IN (SELECT id FROM orders);

-- Add the foreign key constraint (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'order_items_order_id_fkey' 
        AND table_name = 'order_items'
    ) THEN
        ALTER TABLE order_items
        ADD CONSTRAINT order_items_order_id_fkey
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
        
        RAISE NOTICE 'Foreign key order_items_order_id_fkey added successfully';
    ELSE
        RAISE NOTICE 'Foreign key order_items_order_id_fkey already exists';
    END IF;
END $$;

-- Verify the foreign key was added
SELECT 
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name = 'order_items';
