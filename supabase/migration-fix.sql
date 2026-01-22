-- =====================================================
-- MIGRATION: Fix Orders Table for NextAuth Integration
-- Run this in Supabase SQL Editor
-- =====================================================

-- 1. Add missing columns to orders table (if not exist)
DO $$
BEGIN
    -- Add custom_config if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'orders' AND column_name = 'custom_config') THEN
        ALTER TABLE orders ADD COLUMN custom_config JSONB;
    END IF;

    -- Add printing_config if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'orders' AND column_name = 'printing_config') THEN
        ALTER TABLE orders ADD COLUMN printing_config JSONB;
    END IF;

    -- Add deposit_amount if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'orders' AND column_name = 'deposit_amount') THEN
        ALTER TABLE orders ADD COLUMN deposit_amount BIGINT DEFAULT 0;
    END IF;

    -- Add deposit_paid if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'orders' AND column_name = 'deposit_paid') THEN
        ALTER TABLE orders ADD COLUMN deposit_paid BOOLEAN DEFAULT FALSE;
    END IF;

    -- Add paid_at if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'orders' AND column_name = 'paid_at') THEN
        ALTER TABLE orders ADD COLUMN paid_at TIMESTAMPTZ;
    END IF;

    -- Add shipped_at if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'orders' AND column_name = 'shipped_at') THEN
        ALTER TABLE orders ADD COLUMN shipped_at TIMESTAMPTZ;
    END IF;

    -- Add delivered_at if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'orders' AND column_name = 'delivered_at') THEN
        ALTER TABLE orders ADD COLUMN delivered_at TIMESTAMPTZ;
    END IF;
END $$;

-- 2. Update foreign key constraint for orders.user_id to reference users table (NextAuth)
-- First check if the constraint referencing profiles exists
DO $$
BEGIN
    -- Drop old constraint if exists
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'orders_user_id_fkey' 
        AND table_name = 'orders'
    ) THEN
        ALTER TABLE orders DROP CONSTRAINT orders_user_id_fkey;
    END IF;
END $$;

-- Add new constraint referencing users table (nullable for guest orders)
-- Note: Only run this if you want to enforce FK
-- ALTER TABLE orders ADD CONSTRAINT orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

-- 3. Update addresses foreign key to users table
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'addresses_user_id_fkey' 
        AND table_name = 'addresses'
    ) THEN
        ALTER TABLE addresses DROP CONSTRAINT addresses_user_id_fkey;
    END IF;
END $$;

-- 4. Disable RLS temporarily for service role operations
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE addresses DISABLE ROW LEVEL SECURITY;
ALTER TABLE order_items DISABLE ROW LEVEL SECURITY;

-- Or create permissive policies for service role
DROP POLICY IF EXISTS "Service role full access orders" ON orders;
CREATE POLICY "Service role full access orders" ON orders FOR ALL USING (true);

DROP POLICY IF EXISTS "Service role full access addresses" ON addresses;
CREATE POLICY "Service role full access addresses" ON addresses FOR ALL USING (true);

DROP POLICY IF EXISTS "Service role full access order_items" ON order_items;
CREATE POLICY "Service role full access order_items" ON order_items FOR ALL USING (true);

-- Re-enable RLS
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- 5. Add phone column to users table if missing
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'phone') THEN
        ALTER TABLE users ADD COLUMN phone TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'customer_code') THEN
        ALTER TABLE users ADD COLUMN customer_code TEXT UNIQUE DEFAULT ('KH' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6)));
    END IF;
END $$;

SELECT 'Migration completed successfully!' AS message;
