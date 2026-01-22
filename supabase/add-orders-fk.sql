-- Add Foreign Key constraint between orders and profiles
-- This ensures data integrity: orders.user_id must reference a valid profiles.id
-- Run this in Supabase SQL Editor

-- First, check for any orphan records (orders with user_id that doesn't exist in profiles)
SELECT o.id, o.order_code, o.user_id 
FROM orders o 
LEFT JOIN profiles p ON o.user_id = p.id 
WHERE o.user_id IS NOT NULL AND p.id IS NULL;

-- If above query returns rows, you can either:
-- 1. Delete those orphan orders
-- 2. Set their user_id to NULL

-- Option: Set orphan user_ids to NULL (safe approach)
UPDATE orders o
SET user_id = NULL
WHERE o.user_id IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = o.user_id);

-- Now add the Foreign Key constraint
ALTER TABLE orders 
ADD CONSTRAINT orders_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES profiles(id)
ON DELETE SET NULL;

-- Verify the constraint was added
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
  AND tc.table_name = 'orders'
  AND kcu.column_name = 'user_id';
