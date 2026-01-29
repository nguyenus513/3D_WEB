-- =====================================================
-- ENHANCED ORDER SYSTEM: Add Idempotency Support
-- Migration: 20260129_add_idempotency_support
-- =====================================================

-- 1. Add idempotency_key to payment table (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payment' AND column_name = 'idempotency_key'
    ) THEN
        ALTER TABLE payment ADD COLUMN idempotency_key TEXT UNIQUE;
    END IF;
END $$;

-- 2. Add correlation_id for request tracking
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payment' AND column_name = 'correlation_id'
    ) THEN
        ALTER TABLE payment ADD COLUMN correlation_id TEXT;
    END IF;
END $$;

-- 3. Create indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_payment_idempotency_key ON payment(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_payment_correlation_id ON payment(correlation_id);

-- 4. Add retry_count for tracking retries
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'order_child' AND column_name = 'retry_count'
    ) THEN
        ALTER TABLE order_child ADD COLUMN retry_count INT DEFAULT 0;
    END IF;
END $$;

-- 5. Fix foreign key reference if order_parent references profiles instead of auth.users
-- Note: This is a safety check, current migration uses auth.users which is correct
