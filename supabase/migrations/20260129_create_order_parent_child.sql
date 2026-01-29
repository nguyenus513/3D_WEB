-- =====================================================
-- UNIFIED ORDER SYSTEM: Parent/Child Orders with QR Payment
-- Migration: 20260129_create_order_parent_child
-- =====================================================
-- IMPORTANT: This version uses profiles.id instead of auth.users
-- to maintain consistency with the rest of the application
-- =====================================================

-- 1. ORDER PARENT TABLE (Master order when checkout from cart)
CREATE TABLE IF NOT EXISTS order_parent (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code_parent CHAR(12) NOT NULL UNIQUE,               -- 12 hex characters
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,  -- FIXED: Reference profiles
    total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    currency VARCHAR(5) NOT NULL DEFAULT 'VND',
    status VARCHAR(20) NOT NULL DEFAULT 'pending',       -- pending, processing, paid, completed, cancelled
    shipping_address JSONB,
    shipping_fee NUMERIC(12,2) DEFAULT 0,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. ORDER CHILD TABLE (Individual product orders)
CREATE TABLE IF NOT EXISTS order_child (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID REFERENCES order_parent(id) ON DELETE SET NULL,
    code_child CHAR(12) NOT NULL UNIQUE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,  -- FIXED: Reference profiles
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    product_type VARCHAR(20) NOT NULL DEFAULT 'product',
    product_name VARCHAR(255),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(12,2) NOT NULL,
    total_price NUMERIC(12,2) NOT NULL,
    currency VARCHAR(5) NOT NULL DEFAULT 'VND',
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    payment_qr_url TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. PAYMENT TABLE
CREATE TABLE IF NOT EXISTS payment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_type VARCHAR(15) NOT NULL CHECK (order_type IN ('parent', 'child', 'direct_child')),
    order_id UUID NOT NULL,
    reference_code CHAR(12) NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    currency VARCHAR(5) NOT NULL DEFAULT 'VND',
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    method VARCHAR(20) NOT NULL DEFAULT 'QR',
    qr_url TEXT NOT NULL,
    bank_code VARCHAR(10) DEFAULT 'MB',
    account_no VARCHAR(20) DEFAULT '0336668386',
    account_name VARCHAR(100) DEFAULT 'NGUYEN MINH NHAT',
    expires_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    idempotency_key TEXT UNIQUE,    -- NEW: For duplicate prevention
    correlation_id TEXT,             -- NEW: For request tracing
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (order_type, order_id)
);

-- 4. INDEXES
CREATE INDEX IF NOT EXISTS idx_order_parent_user_id ON order_parent(user_id);
CREATE INDEX IF NOT EXISTS idx_order_parent_code ON order_parent(code_parent);
CREATE INDEX IF NOT EXISTS idx_order_child_parent_id ON order_child(parent_id);
CREATE INDEX IF NOT EXISTS idx_order_child_user_id ON order_child(user_id);
CREATE INDEX IF NOT EXISTS idx_order_child_code ON order_child(code_child);
CREATE INDEX IF NOT EXISTS idx_payment_reference ON payment(reference_code);
CREATE INDEX IF NOT EXISTS idx_payment_idempotency ON payment(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_payment_correlation ON payment(correlation_id);

-- 5. RLS POLICIES
ALTER TABLE order_parent ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_child ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment ENABLE ROW LEVEL SECURITY;

-- RLS for order_parent (using subquery to avoid recursion)
CREATE POLICY "Users can view own parent orders" ON order_parent 
  FOR SELECT USING (user_id IN (SELECT id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Users can insert own parent orders" ON order_parent 
  FOR INSERT WITH CHECK (user_id IN (SELECT id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Users can update own parent orders" ON order_parent 
  FOR UPDATE USING (user_id IN (SELECT id FROM profiles WHERE id = auth.uid()));

-- RLS for order_child
CREATE POLICY "Users can view own child orders" ON order_child 
  FOR SELECT USING (user_id IN (SELECT id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Users can insert own child orders" ON order_child 
  FOR INSERT WITH CHECK (user_id IN (SELECT id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Users can update own child orders" ON order_child 
  FOR UPDATE USING (user_id IN (SELECT id FROM profiles WHERE id = auth.uid()));

-- RLS for payment
CREATE POLICY "Users can view own payments" ON payment FOR SELECT
USING (
    EXISTS (SELECT 1 FROM order_parent WHERE order_parent.id = payment.order_id AND order_parent.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM order_child WHERE order_child.id = payment.order_id AND order_child.user_id = auth.uid())
);

-- 6. TRIGGERS
CREATE OR REPLACE FUNCTION update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_order_parent_updated_at ON order_parent;
DROP TRIGGER IF EXISTS update_order_child_updated_at ON order_child;
DROP TRIGGER IF EXISTS update_payment_updated_at ON payment;

CREATE TRIGGER update_order_parent_updated_at BEFORE UPDATE ON order_parent FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_order_child_updated_at BEFORE UPDATE ON order_child FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payment_updated_at BEFORE UPDATE ON payment FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 7. ADMIN BYPASS POLICIES (for service role operations)
CREATE POLICY "Service role bypass for order_parent" ON order_parent
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');
CREATE POLICY "Service role bypass for order_child" ON order_child
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');
CREATE POLICY "Service role bypass for payment" ON payment
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');
