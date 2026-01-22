-- Add timestamp columns for order status progress
-- Run this in Supabase SQL Editor

-- Add new timestamp columns
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS processing_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS designing_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS review_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS printing_at TIMESTAMPTZ;

-- Verify columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'orders' 
  AND column_name IN ('processing_at', 'designing_at', 'review_at', 'approved_at', 'printing_at', 'paid_at', 'shipped_at', 'delivered_at');
