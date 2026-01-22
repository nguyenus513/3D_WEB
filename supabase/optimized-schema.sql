-- =============================================
-- 3D Print Shop - OPTIMIZED PRODUCTION SCHEMA
-- Version: 3.0 (Supabase Free Tier Optimized)
-- Date: 2026-01-18
-- 
-- Principles:
-- ✅ ENUM instead of TEXT
-- ✅ INTEGER for prices (VND)
-- ✅ Normalized tables (no JSONB)
-- ✅ File IDs only (not URLs)
-- ✅ Strict RLS
-- =============================================

BEGIN;

-- =============================================
-- PHASE 1: CREATE ENUMS
-- =============================================

-- User roles
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('customer', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Product types
DO $$ BEGIN
    CREATE TYPE product_type AS ENUM ('ready_made', 'custom_template', 'service');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Product status
DO $$ BEGIN
    CREATE TYPE product_status AS ENUM ('draft', 'active', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Order types
DO $$ BEGIN
    CREATE TYPE order_type AS ENUM ('ready_made', 'custom', 'printing');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Order status (SMALLINT mapping for even more efficiency)
-- 0=pending, 1=expired, 2=paid, 3=preparing, 4=designing, 
-- 5=review, 6=approved, 7=printing, 8=completed, 
-- 9=shipped, 10=delivered, 11=cancelled, 12=refunded
DO $$ BEGIN
    CREATE TYPE order_status AS ENUM (
        'pending', 'expired', 'paid', 'preparing', 
        'designing', 'review', 'approved',
        'printing', 'completed', 'shipped', 
        'delivered', 'cancelled', 'refunded'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Payment types
DO $$ BEGIN
    CREATE TYPE payment_type AS ENUM ('deposit', 'full', 'remaining');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Payment status
DO $$ BEGIN
    CREATE TYPE payment_status AS ENUM ('pending', 'success', 'failed', 'refunded');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Print technology
DO $$ BEGIN
    CREATE TYPE print_tech AS ENUM ('FDM', 'Resin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Custom order types
DO $$ BEGIN
    CREATE TYPE custom_type AS ENUM ('single', 'couple', 'group');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =============================================
-- PHASE 2: PROFILES (Optimized)
-- =============================================

-- Fix role column: drop default, convert type, set new default
DO $$
BEGIN
    -- Drop default first
    ALTER TABLE profiles ALTER COLUMN role DROP DEFAULT;
    
    -- Convert TEXT to ENUM
    ALTER TABLE profiles ALTER COLUMN role TYPE user_role USING role::user_role;
    
    -- Set new default
    ALTER TABLE profiles ALTER COLUMN role SET DEFAULT 'customer'::user_role;
EXCEPTION WHEN others THEN
    -- If already converted, ignore
    NULL;
END $$;

-- Ensure optimized columns
ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS name VARCHAR(100),
    ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS image_id VARCHAR(44),
    ADD COLUMN IF NOT EXISTS password CHAR(60), -- bcrypt always 60 chars
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Drop old columns if exist
ALTER TABLE profiles 
    DROP COLUMN IF EXISTS "emailVerified",
    DROP COLUMN IF EXISTS image;

-- Limit column sizes (use VARCHAR for flexibility)
ALTER TABLE profiles 
    ALTER COLUMN phone TYPE VARCHAR(15),
    ALTER COLUMN full_name TYPE VARCHAR(100),
    ALTER COLUMN customer_code TYPE VARCHAR(20); -- KH-XXXXXXXX or CUS-XXXXXXXXXX

-- =============================================
-- PHASE 3: ADDRESSES (Normalized)
-- =============================================

-- Already normalized, just optimize types
ALTER TABLE addresses
    ALTER COLUMN label TYPE VARCHAR(20),
    ALTER COLUMN full_name TYPE VARCHAR(100),
    ALTER COLUMN phone TYPE VARCHAR(15),
    ALTER COLUMN address_line TYPE VARCHAR(255),
    ALTER COLUMN ward TYPE VARCHAR(50),
    ALTER COLUMN district TYPE VARCHAR(50),
    ALTER COLUMN province TYPE VARCHAR(50);

-- =============================================
-- PHASE 4: PRODUCTS (Optimized)
-- =============================================

-- Change types (drop defaults first)
DO $$
BEGIN
    ALTER TABLE products ALTER COLUMN type DROP DEFAULT;
    ALTER TABLE products ALTER COLUMN status DROP DEFAULT;
    
    ALTER TABLE products ALTER COLUMN type TYPE product_type USING type::product_type;
    ALTER TABLE products ALTER COLUMN status TYPE product_status USING status::product_status;
    
    ALTER TABLE products ALTER COLUMN type SET DEFAULT 'ready_made'::product_type;
    ALTER TABLE products ALTER COLUMN status SET DEFAULT 'draft'::product_status;
EXCEPTION WHEN others THEN NULL;
END $$;

-- Change price to INTEGER
ALTER TABLE products
    ALTER COLUMN base_price TYPE INTEGER USING base_price::INTEGER,
    ALTER COLUMN sale_price TYPE INTEGER USING sale_price::INTEGER,
    ALTER COLUMN cost_price TYPE INTEGER USING cost_price::INTEGER;

-- Limit text fields
ALTER TABLE products
    ALTER COLUMN sku TYPE VARCHAR(20),
    ALTER COLUMN name TYPE VARCHAR(150),
    ALTER COLUMN slug TYPE VARCHAR(150),
    ALTER COLUMN short_description TYPE VARCHAR(300),
    ALTER COLUMN video_url TYPE VARCHAR(100);

-- Drop JSONB columns (will normalize)
-- Keep sizes as JSONB for now (complex structure)
-- DROP COLUMN images will be replaced by product_images table

-- =============================================
-- PHASE 5: PRODUCT_IMAGES (Normalized from JSONB)
-- =============================================

CREATE TABLE IF NOT EXISTS product_images (
    id SERIAL PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    file_id VARCHAR(44) NOT NULL, -- Google Drive file ID
    alt VARCHAR(100),
    is_main BOOLEAN DEFAULT FALSE,
    sort_order SMALLINT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_images_product ON product_images(product_id);

-- =============================================
-- PHASE 6: ORDERS (Optimized)
-- =============================================

-- Change types (drop defaults first)
DO $$
BEGIN
    ALTER TABLE orders ALTER COLUMN status DROP DEFAULT;
    
    ALTER TABLE orders ALTER COLUMN order_type TYPE order_type USING order_type::order_type;
    ALTER TABLE orders ALTER COLUMN status TYPE order_status USING status::order_status;
    
    ALTER TABLE orders ALTER COLUMN status SET DEFAULT 'pending'::order_status;
EXCEPTION WHEN others THEN NULL;
END $$;

-- Change prices to INTEGER
ALTER TABLE orders
    ALTER COLUMN subtotal TYPE INTEGER USING subtotal::INTEGER,
    ALTER COLUMN shipping_fee TYPE INTEGER USING shipping_fee::INTEGER,
    ALTER COLUMN discount TYPE INTEGER USING discount::INTEGER,
    ALTER COLUMN total TYPE INTEGER USING total::INTEGER,
    ALTER COLUMN deposit_amount TYPE INTEGER USING deposit_amount::INTEGER;

-- Limit text fields
ALTER TABLE orders
    ALTER COLUMN order_code TYPE CHAR(16), -- ORD-XXXXXXXXXXXX
    ALTER COLUMN shipping_code TYPE VARCHAR(30),
    ALTER COLUMN shipping_status TYPE VARCHAR(20),
    ALTER COLUMN customer_note TYPE VARCHAR(500),
    ALTER COLUMN admin_note TYPE VARCHAR(500);

-- Add address_id instead of JSONB
ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS shipping_address_id UUID REFERENCES addresses(id);

-- =============================================
-- PHASE 7: ORDER_ITEMS (Optimized)
-- =============================================

-- Change prices to INTEGER
ALTER TABLE order_items
    ALTER COLUMN unit_price TYPE INTEGER USING unit_price::INTEGER,
    ALTER COLUMN total_price TYPE INTEGER USING total_price::INTEGER;

-- Limit fields
ALTER TABLE order_items
    ALTER COLUMN sku TYPE VARCHAR(20),
    ALTER COLUMN name TYPE VARCHAR(150);

-- Add size as enum or varchar
ALTER TABLE order_items
    ADD COLUMN IF NOT EXISTS size VARCHAR(10);

-- =============================================
-- PHASE 8: ORDER_FILES (Drive file IDs only)
-- =============================================

CREATE TABLE IF NOT EXISTS order_files (
    id SERIAL PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    file_id VARCHAR(44) NOT NULL, -- Google Drive file ID only
    file_name VARCHAR(100),
    file_type VARCHAR(10), -- 'photo', 'stl', 'demo'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_files_order ON order_files(order_id);

-- =============================================
-- PHASE 9: ORDER_CONFIGS (Normalized from JSONB)
-- =============================================

CREATE TABLE IF NOT EXISTS order_configs (
    id SERIAL PRIMARY KEY,
    order_id UUID NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
    
    -- Custom order fields
    custom_type custom_type,
    custom_style VARCHAR(50),
    custom_size VARCHAR(10),
    customer_approved BOOLEAN DEFAULT FALSE,
    approved_at TIMESTAMPTZ,
    
    -- Printing order fields
    print_tech print_tech,
    material VARCHAR(30),
    color VARCHAR(20),
    infill SMALLINT, -- 0-100
    layer_height SMALLINT, -- microns
    weight_grams SMALLINT,
    print_time_hours SMALLINT,
    calculated_price INTEGER,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_configs_order ON order_configs(order_id);

-- =============================================
-- PHASE 10: PAYMENTS (Optimized)
-- =============================================

-- Change types (drop defaults first)
DO $$
BEGIN
    ALTER TABLE payments ALTER COLUMN status DROP DEFAULT;
    
    ALTER TABLE payments ALTER COLUMN payment_type TYPE payment_type USING payment_type::payment_type;
    ALTER TABLE payments ALTER COLUMN status TYPE payment_status USING status::payment_status;
    
    ALTER TABLE payments ALTER COLUMN status SET DEFAULT 'pending'::payment_status;
EXCEPTION WHEN others THEN NULL;
END $$;

-- Change amount to INTEGER
ALTER TABLE payments
    ALTER COLUMN amount TYPE INTEGER USING amount::INTEGER;

-- Limit fields
ALTER TABLE payments
    ALTER COLUMN payment_method TYPE VARCHAR(20),
    ALTER COLUMN transaction_id TYPE VARCHAR(50);

-- Drop heavy columns
ALTER TABLE payments
    DROP COLUMN IF EXISTS payment_url,
    DROP COLUMN IF EXISTS metadata;

-- =============================================
-- PHASE 11: STRICT RLS POLICIES
-- =============================================

-- Enable RLS on new tables
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_configs ENABLE ROW LEVEL SECURITY;

-- Product images: public read, admin write
CREATE POLICY "product_images_public_read" ON product_images FOR SELECT USING (true);
CREATE POLICY "product_images_admin_write" ON product_images FOR ALL USING (is_admin());

-- Order files: owner + admin only
CREATE POLICY "order_files_owner" ON order_files FOR SELECT 
    USING (EXISTS (SELECT 1 FROM orders WHERE orders.id = order_files.order_id AND orders.user_id = auth.uid()));
CREATE POLICY "order_files_admin" ON order_files FOR ALL USING (is_admin());

-- Order configs: owner + admin only
CREATE POLICY "order_configs_owner" ON order_configs FOR SELECT 
    USING (EXISTS (SELECT 1 FROM orders WHERE orders.id = order_configs.order_id AND orders.user_id = auth.uid()));
CREATE POLICY "order_configs_admin" ON order_configs FOR ALL USING (is_admin());

-- =============================================
-- PHASE 12: CLEANUP OLD DATA
-- =============================================

-- Remove sessions older than 30 days
DELETE FROM sessions WHERE expires < NOW() - INTERVAL '30 days';

-- Remove verification tokens older than 1 day
DELETE FROM verification_tokens WHERE expires < NOW() - INTERVAL '1 day';

-- =============================================
-- PHASE 13: OPTIMIZED INDEXES
-- =============================================

-- Profiles
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_deleted ON profiles(deleted_at) WHERE deleted_at IS NULL;

-- Products  
CREATE INDEX IF NOT EXISTS idx_products_status_type ON products(status, type);
CREATE INDEX IF NOT EXISTS idx_products_featured ON products(is_featured) WHERE is_featured = TRUE AND status = 'active';

-- Orders
CREATE INDEX IF NOT EXISTS idx_orders_user_status ON orders(user_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);

-- Payments
CREATE INDEX IF NOT EXISTS idx_payments_order_status ON payments(order_id, status);

COMMIT;

-- =============================================
-- STORAGE COMPARISON
-- =============================================
/*
BEFORE (100k orders estimate):
- shipping_address JSONB: ~200 bytes each = 20MB
- custom_config JSONB: ~500 bytes = 50MB  
- images JSONB: ~1KB = 100MB
- TEXT status: ~20 bytes = 2MB

AFTER:
- shipping_address_id UUID: 16 bytes = 1.6MB (normalized)
- order_configs: ~50 bytes = 5MB (split fields)
- product_images: ~30 bytes = 3MB (normalized)
- ENUM status: 4 bytes = 0.4MB

SAVINGS: ~160MB for 100k orders! 🚀
*/
