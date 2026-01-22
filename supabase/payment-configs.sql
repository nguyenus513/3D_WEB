-- =====================================================
-- Payment Configs Table
-- Secure storage for bank account information
-- Phase 2: Bank Account Security
-- =====================================================

-- Create table for payment configurations
CREATE TABLE IF NOT EXISTS payment_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_type TEXT NOT NULL UNIQUE CHECK (order_type IN ('ready_made', 'custom', 'printing')),
    bank_code TEXT NOT NULL,
    account_no TEXT NOT NULL, -- Consider encrypting with pgcrypto for extra security
    account_name TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    notes TEXT, -- Internal notes
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_payment_configs_order_type ON payment_configs(order_type);
CREATE INDEX IF NOT EXISTS idx_payment_configs_active ON payment_configs(is_active) WHERE is_active = true;

-- Enable RLS - Admin only access
ALTER TABLE payment_configs ENABLE ROW LEVEL SECURITY;

-- Only admin can view payment configs
DROP POLICY IF EXISTS "Admin view payment configs" ON payment_configs;
CREATE POLICY "Admin view payment configs" ON payment_configs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Only admin can modify payment configs
DROP POLICY IF EXISTS "Admin manage payment configs" ON payment_configs;
CREATE POLICY "Admin manage payment configs" ON payment_configs
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Service role can read for API endpoints
-- (Service role bypasses RLS anyway, but this is documentation)

-- Insert default payment configs (run once)
-- Replace with your actual values or set via admin panel
INSERT INTO payment_configs (order_type, bank_code, account_no, account_name, notes) VALUES
    ('ready_made', 'TCB', '19039561357018', 'NGUYEN NGOC LAN NHI', 'Techcombank - Products'),
    ('custom', 'TCB', '19039561357018', 'NGUYEN NGOC LAN NHI', 'Techcombank - Custom orders'),
    ('printing', 'STB', '067410012004', 'NGUYEN NHAT MINH', 'Sacombank - 3D Printing')
ON CONFLICT (order_type) DO UPDATE SET
    bank_code = EXCLUDED.bank_code,
    account_no = EXCLUDED.account_no,
    account_name = EXCLUDED.account_name,
    notes = EXCLUDED.notes,
    updated_at = NOW();

-- Grant access
GRANT SELECT ON payment_configs TO authenticated;

-- Comments
COMMENT ON TABLE payment_configs IS 'Bank account configurations for different order types';
COMMENT ON COLUMN payment_configs.order_type IS 'Type of order: ready_made, custom, printing';
COMMENT ON COLUMN payment_configs.bank_code IS 'VietQR bank code (TCB, STB, VCB, etc.)';
