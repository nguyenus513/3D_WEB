-- Order Status Enum Update
-- Run this in Supabase SQL Editor

-- Add new status values to order_status enum (if it exists)
DO $$ 
BEGIN
    -- Try to add values, ignore if they already exist
    ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'designing';
    ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'review';
    ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'approved';
    ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'revising';
    ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'producing';
    ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'printing';
EXCEPTION WHEN undefined_object THEN
    -- Enum doesn't exist, that's OK - status is likely just a varchar
    RAISE NOTICE 'order_status enum does not exist, using varchar instead';
END $$;

-- Verify custom_orders has required columns
-- (These should already exist, but check)
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'custom_orders' 
AND column_name IN ('status', 'demo_image_url', 'updated_at');
