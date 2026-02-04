-- Add missing timestamp columns for order workflow
-- Run this in Supabase SQL Editor

-- 1. For custom_orders table
ALTER TABLE custom_orders
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS revising_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS review_at TIMESTAMPTZ;

-- 2. For print_orders table
ALTER TABLE print_orders
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS revising_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS review_at TIMESTAMPTZ;

-- 3. For orders table (just in case)
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS revising_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS review_at TIMESTAMPTZ;

-- 4. Reload Schema Cache (Force Supabase to recognize new columns)
NOTIFY pgrst, 'reload config';
