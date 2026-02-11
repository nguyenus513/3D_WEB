-- =============================================
-- 3D Print Shop - Database Schema (Production Safe)
-- Run this in Supabase SQL Editor
-- Safe to run multiple times
-- =============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- 1. PROFILES (extends auth.users)
-- =============================================
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    phone TEXT,
    email TEXT,
    instagram TEXT,
    role TEXT DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
    customer_code TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Drop existing trigger first (safe)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create or replace function
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO profiles (id, email, customer_code, role)
    VALUES (
        NEW.id, 
        NEW.email,
        'CUS-' || UPPER(SUBSTR(MD5(RANDOM()::TEXT), 1, 10)),
        'customer'
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =============================================
-- 2. ADDRESSES
-- =============================================
CREATE TABLE IF NOT EXISTS addresses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    label TEXT DEFAULT 'Nhà',
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    address_line TEXT NOT NULL,
    ward TEXT,
    district TEXT,
    province TEXT NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 3. CATEGORIES
-- =============================================
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    parent_id UUID REFERENCES categories(id),
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default categories (safe upsert)
INSERT INTO categories (name, slug, sort_order) VALUES
    ('Figure', 'figure', 1),
    ('Bust', 'bust', 2),
    ('Trophy', 'trophy', 3),
    ('Custom', 'custom', 4),
    ('Accessory', 'accessory', 5)
ON CONFLICT (slug) DO NOTHING;

-- =============================================
-- 4. PRODUCTS
-- =============================================
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sku TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    category_id UUID REFERENCES categories(id),
    type TEXT DEFAULT 'ready_made' CHECK (type IN ('ready_made', 'custom_template', 'service')),
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
    short_description TEXT,
    description TEXT,
    base_price DECIMAL(12, 0) NOT NULL DEFAULT 0,
    sale_price DECIMAL(12, 0),
    cost_price DECIMAL(12, 0),
    stock INT DEFAULT 0,
    low_stock_alert INT DEFAULT 5,
    images JSONB DEFAULT '[]',
    video_url TEXT,
    sizes JSONB DEFAULT '[]',
    seo_title TEXT,
    seo_description TEXT,
    tags TEXT[] DEFAULT '{}',
    is_featured BOOLEAN DEFAULT FALSE,
    view_count INT DEFAULT 0,
    sold_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 5. ORDERS
-- =============================================
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_code TEXT UNIQUE NOT NULL,
    user_id UUID REFERENCES profiles(id),
    order_type TEXT NOT NULL CHECK (order_type IN ('ready_made', 'custom', 'printing')),
    status TEXT DEFAULT 'pending' CHECK (status IN (
        'pending', 'expired', 'paid', 'preparing', 
        'designing', 'pending_demo_approval', 'contact_requested', 'approved',
        'printing', 'completed', 'shipped', 'delivered',
        'refund_requested', 'refunded', 'cancelled'
    )),
    subtotal DECIMAL(12, 0) DEFAULT 0,
    shipping_fee DECIMAL(12, 0) DEFAULT 0,
    discount DECIMAL(12, 0) DEFAULT 0,
    total DECIMAL(12, 0) DEFAULT 0,
    deposit_amount DECIMAL(12, 0) DEFAULT 0,
    deposit_paid BOOLEAN DEFAULT FALSE,
    shipping_address JSONB,
    shipping_code TEXT,
    shipping_status TEXT,
    customer_note TEXT,
    admin_note TEXT,
    paid_at TIMESTAMPTZ,
    shipped_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 6. ORDER ITEMS
-- =============================================
CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    sku TEXT,
    name TEXT NOT NULL,
    quantity INT DEFAULT 1,
    unit_price DECIMAL(12, 0) NOT NULL,
    total_price DECIMAL(12, 0) NOT NULL,
    configuration JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 7. PAYMENTS
-- =============================================
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    amount DECIMAL(12, 0) NOT NULL,
    payment_method TEXT,
    payment_type TEXT CHECK (payment_type IN ('deposit', 'full', 'remaining')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed', 'refunded')),
    transaction_id TEXT,
    payment_url TEXT,
    metadata JSONB DEFAULT '{}',
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 8. FAQ
-- =============================================
CREATE TABLE IF NOT EXISTS faqs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    category TEXT,
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 9. SETTINGS
-- =============================================
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default settings (safe upsert)
INSERT INTO settings (key, value) VALUES
    ('store_info', '{"name": "3D Print Shop", "phone": "0123456789", "email": "hello@3dprint.vn", "address": "TP.HCM"}'),
    ('pricing', '{"deposit_percent": 50, "fdm_gram_rate": 600, "fdm_hour_rate": 3000, "resin_gram_rate": 3000, "resin_hour_rate": 3000}'),
    ('custom_pricing', '{"single_base": 250000, "couple_base": 400000, "group_base": 600000}')
ON CONFLICT (key) DO NOTHING;

-- =============================================
-- ROW LEVEL SECURITY (RLS) - Production Safe
-- =============================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE faqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first (safe cleanup)
DO $$ 
BEGIN
    -- Profiles
    DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
    DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
    DROP POLICY IF EXISTS "Admin full access profiles" ON profiles;
    DROP POLICY IF EXISTS "Allow insert for auth" ON profiles;
    
    -- Addresses
    DROP POLICY IF EXISTS "Users can manage own addresses" ON addresses;
    DROP POLICY IF EXISTS "Admin full access addresses" ON addresses;
    
    -- Products
    DROP POLICY IF EXISTS "Anyone can view active products" ON products;
    DROP POLICY IF EXISTS "Admin full access products" ON products;
    
    -- Categories
    DROP POLICY IF EXISTS "Anyone can view categories" ON categories;
    DROP POLICY IF EXISTS "Admin full access categories" ON categories;
    
    -- Orders
    DROP POLICY IF EXISTS "Users can view own orders" ON orders;
    DROP POLICY IF EXISTS "Users can create orders" ON orders;
    DROP POLICY IF EXISTS "Admin full access orders" ON orders;
    
    -- Order items
    DROP POLICY IF EXISTS "Users can view own order items" ON order_items;
    DROP POLICY IF EXISTS "Admin full access order_items" ON order_items;
    
    -- Payments
    DROP POLICY IF EXISTS "Users can view own payments" ON payments;
    DROP POLICY IF EXISTS "Admin full access payments" ON payments;
    
    -- FAQs
    DROP POLICY IF EXISTS "Anyone can view active faqs" ON faqs;
    DROP POLICY IF EXISTS "Admin full access faqs" ON faqs;
    
    -- Settings
    DROP POLICY IF EXISTS "Anyone can view settings" ON settings;
    DROP POLICY IF EXISTS "Admin full access settings" ON settings;
END $$;

-- Admin check function
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- CREATE POLICIES
-- =============================================

-- Profiles
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Allow insert for auth" ON profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin full access profiles" ON profiles FOR ALL USING (is_admin());

-- Addresses
CREATE POLICY "Users can manage own addresses" ON addresses FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Admin full access addresses" ON addresses FOR ALL USING (is_admin());

-- Products
CREATE POLICY "Anyone can view active products" ON products FOR SELECT USING (status = 'active');
CREATE POLICY "Admin full access products" ON products FOR ALL USING (is_admin());

-- Categories
CREATE POLICY "Anyone can view categories" ON categories FOR SELECT USING (true);
CREATE POLICY "Admin full access categories" ON categories FOR ALL USING (is_admin());

-- Orders
CREATE POLICY "Users can view own orders" ON orders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create orders" ON orders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admin full access orders" ON orders FOR ALL USING (is_admin());

-- Order items
CREATE POLICY "Users can view own order items" ON order_items FOR SELECT 
    USING (EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid()));
CREATE POLICY "Admin full access order_items" ON order_items FOR ALL USING (is_admin());

-- Payments
CREATE POLICY "Users can view own payments" ON payments FOR SELECT 
    USING (EXISTS (SELECT 1 FROM orders WHERE orders.id = payments.order_id AND orders.user_id = auth.uid()));
CREATE POLICY "Admin full access payments" ON payments FOR ALL USING (is_admin());

-- FAQs
CREATE POLICY "Anyone can view active faqs" ON faqs FOR SELECT USING (is_active = true);
CREATE POLICY "Admin full access faqs" ON faqs FOR ALL USING (is_admin());

-- Settings
CREATE POLICY "Anyone can view settings" ON settings FOR SELECT USING (true);
CREATE POLICY "Admin full access settings" ON settings FOR ALL USING (is_admin());

-- =============================================
-- INDEXES (safe creation)
-- =============================================
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_code ON orders(order_code);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

-- =============================================
-- DONE! Now you can create users
-- =============================================
