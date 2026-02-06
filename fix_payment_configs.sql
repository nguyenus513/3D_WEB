-- FIX: Insert payment configs for Direct Payment API
-- Run this in Supabase SQL Editor to fix 500 error on /api/payments/direct

-- Check current data
SELECT * FROM payment_configs ORDER BY created_at;

-- If empty, insert all 3 payment configs:
INSERT INTO payment_configs (order_type, bank_code, account_no, account_name, is_active, notes)
VALUES 
    ('ready_made', 'MB', '9704229207359292', 'NGUYEN VAN A', true, 'Dùng cho đơn hàng sản phẩm có sẵn'),
    ('custom', 'MB', '9704229207359292', 'NGUYEN VAN A', true, 'Dùng cho đơn custom design'),
    ('printing', 'MB', '9704229207359292', 'NGUYEN VAN A', true, 'Dùng cho đơn in 3D')
ON CONFLICT (order_type) DO UPDATE SET
    bank_code = EXCLUDED.bank_code,
    account_no = EXCLUDED.account_no,
    account_name = EXCLUDED.account_name,
    is_active = EXCLUDED.is_active;

-- Verify
SELECT id, order_type, bank_code, account_no, account_name, is_active FROM payment_configs;
