-- Migration: Pure Hex Order Codes
-- Description: Ensure order tables have proper columns for hex codes
-- Date: 2026-01-30

-- 1. Check and add metadata column to order_parent if not exists
ALTER TABLE order_parent ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- 2. Check product_sku column in order_child
ALTER TABLE order_child ADD COLUMN IF NOT EXISTS product_sku VARCHAR(50);

-- 3. Create/update indexes for hex code lookups
CREATE INDEX IF NOT EXISTS idx_order_parent_code ON order_parent(code_parent);
CREATE INDEX IF NOT EXISTS idx_order_child_code ON order_child(code_child);
CREATE INDEX IF NOT EXISTS idx_order_child_parent ON order_child(parent_id);
CREATE INDEX IF NOT EXISTS idx_order_child_product_sku ON order_child(product_sku);

-- 4. Add comments
COMMENT ON COLUMN order_parent.code_parent IS '8-character hex code for cart/parent order';
COMMENT ON COLUMN order_child.code_child IS '12-character hex code (parent 8 + random 4)';
COMMENT ON COLUMN order_child.product_sku IS 'Product SKU for ready-made products';

-- 5. Drop unused columns if they exist (code_formatted was planned but not needed with pure hex)
-- Note: Only run these if columns exist and are not in use
-- ALTER TABLE order_parent DROP COLUMN IF EXISTS code_formatted;
-- ALTER TABLE order_child DROP COLUMN IF EXISTS code_formatted;
