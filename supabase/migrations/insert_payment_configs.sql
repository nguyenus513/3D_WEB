-- =====================================================
-- Payment Configs Table + Data
-- Run this in Supabase SQL Editor
-- =====================================================

-- 1. Create table
CREATE TABLE IF NOT EXISTS payment_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_type TEXT NOT NULL UNIQUE CHECK (order_type IN ('ready_made', 'custom', 'printing')),
    bank_code TEXT NOT NULL,
    account_no TEXT NOT NULL,
    account_name TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create indexes
CREATE INDEX IF NOT EXISTS idx_payment_configs_order_type ON payment_configs(order_type);
CREATE INDEX IF NOT EXISTS idx_payment_configs_active ON payment_configs(is_active) WHERE is_active = true;

-- 3. Insert/Update payment configs (UPSERT)
INSERT INTO payment_configs (order_type, bank_code, account_no, account_name, is_active, notes)
VALUES 
    ('ready_made', 'TCB', '1919039561357018', 'NGUYEN NGOC LAN NHI', true, 'Techcombank - Sản phẩm có sẵn'),
    ('custom', 'TCB', '1919039561357018', 'NGUYEN NGOC LAN NHI', true, 'Techcombank - Đơn hàng custom'),
    ('printing', 'STB', '067410012004', 'NGUYEN NHAT MINH', true, 'Sacombank - In 3D')
ON CONFLICT (order_type) DO UPDATE SET
    bank_code = EXCLUDED.bank_code,
    account_no = EXCLUDED.account_no,
    account_name = EXCLUDED.account_name,
    is_active = EXCLUDED.is_active,
    notes = EXCLUDED.notes,
    updated_at = NOW();

-- 4. Verify
SELECT * FROM payment_configs WHERE is_active = true;
