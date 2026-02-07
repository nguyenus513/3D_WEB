-- Migration: Cart/Order Code Standardization v2
-- Date: 2026-02-07
-- Description: Add fulfillment_status, production_status enums; extend order_items for Sub Order tracking

-- ============================================================================
-- ENUMS
-- ============================================================================

-- Cart/Order level fulfillment tracking
CREATE TYPE fulfillment_status AS ENUM ('pending', 'processing', 'completed');

-- Item/Sub-order level production tracking
CREATE TYPE production_status AS ENUM ('waiting', 'printing', 'done', 'error');

-- ============================================================================
-- ORDERS TABLE (Cart/Master)
-- ============================================================================

-- Add fulfillment status (tracks overall order fulfillment)
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS fulfillment_status fulfillment_status DEFAULT 'pending';

-- ============================================================================
-- ORDER_ITEMS TABLE (Sub Orders)
-- ============================================================================

-- Add cart_code reference (copied from parent order for denormalized queries)
ALTER TABLE order_items 
ADD COLUMN IF NOT EXISTS cart_code VARCHAR(8);

-- Add full_code = {cart_code}_{item_order_code} for unique item identification
ALTER TABLE order_items 
ADD COLUMN IF NOT EXISTS full_code VARCHAR(17);

-- Add production status for item-level tracking (waiting → printing → done/error)
ALTER TABLE order_items 
ADD COLUMN IF NOT EXISTS production_status production_status DEFAULT 'waiting';

-- Add file_path for associated production files
ALTER TABLE order_items 
ADD COLUMN IF NOT EXISTS file_path TEXT;

-- ============================================================================
-- CONSTRAINTS
-- ============================================================================

-- Validate cart_code format (8 hex chars)
ALTER TABLE order_items 
ADD CONSTRAINT chk_order_items_cart_code 
CHECK (cart_code IS NULL OR cart_code ~ '^[0-9A-F]{8}$');

-- Validate full_code format ({8hex}_{8hex})
ALTER TABLE order_items 
ADD CONSTRAINT chk_order_items_full_code 
CHECK (full_code IS NULL OR full_code ~ '^[0-9A-F]{8}_[0-9A-F]{8}$');

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Fast lookup by cart_code (for grouping items by cart)
CREATE INDEX IF NOT EXISTS idx_order_items_cart_code 
ON order_items(cart_code) WHERE cart_code IS NOT NULL;

-- Unique full_code (each item has unique identifier)
CREATE UNIQUE INDEX IF NOT EXISTS idx_order_items_full_code_unique 
ON order_items(full_code) WHERE full_code IS NOT NULL;

-- Production status filter (for admin printing page)
CREATE INDEX IF NOT EXISTS idx_order_items_production_status 
ON order_items(production_status);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON COLUMN orders.fulfillment_status IS 'Overall fulfillment: pending (not yet processed), processing (in production), completed (all items done)';
COMMENT ON COLUMN order_items.cart_code IS 'Denormalized cart_code from parent order for fast queries';
COMMENT ON COLUMN order_items.full_code IS 'Unique item identifier: {cart_code}_{item_order_code}. Format: XXXXXXXX_YYYYYYYY';
COMMENT ON COLUMN order_items.production_status IS 'Item production: waiting (queue), printing (in progress), done (complete), error (failed)';
COMMENT ON COLUMN order_items.file_path IS 'Storage path for production files: orders/{cart_code}/{full_code}/...';
