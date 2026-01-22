-- =====================================================
-- 3D WEB DATABASE SCHEMA
-- Run this SQL in Supabase SQL Editor
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. PROFILES (extends auth.users)
-- =====================================================
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    phone TEXT,
    email TEXT,
    instagram TEXT,
    role TEXT DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
    customer_code TEXT UNIQUE DEFAULT ('KH' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6))),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO profiles (id, email, full_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =====================================================
-- 2. ADDRESSES
-- =====================================================
CREATE TABLE addresses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
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

-- =====================================================
-- 3. CATEGORIES
-- =====================================================
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    parent_id UUID REFERENCES categories(id),
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 4. PRODUCTS
-- =====================================================
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sku TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    category_id UUID REFERENCES categories(id),
    type TEXT DEFAULT 'ready_made' CHECK (type IN ('ready_made', 'custom_template', 'service')),
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
    short_description TEXT,
    description TEXT,
    base_price BIGINT NOT NULL DEFAULT 0,
    sale_price BIGINT,
    cost_price BIGINT,
    stock INT DEFAULT 0,
    low_stock_alert INT DEFAULT 5,
    images JSONB DEFAULT '[]'::JSONB,
    video_url TEXT,
    sizes JSONB DEFAULT '[]'::JSONB,
    seo_title TEXT,
    seo_description TEXT,
    tags TEXT[] DEFAULT '{}',
    is_featured BOOLEAN DEFAULT FALSE,
    view_count INT DEFAULT 0,
    sold_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 5. ORDERS
-- =====================================================
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_code TEXT UNIQUE NOT NULL,
    user_id UUID REFERENCES profiles(id),
    order_type TEXT NOT NULL CHECK (order_type IN ('ready_made', 'custom', 'printing')),
    status TEXT DEFAULT 'pending',
    subtotal BIGINT DEFAULT 0,
    shipping_fee BIGINT DEFAULT 0,
    discount BIGINT DEFAULT 0,
    total BIGINT DEFAULT 0,
    deposit_amount BIGINT DEFAULT 0,
    deposit_paid BOOLEAN DEFAULT FALSE,
    shipping_address JSONB,
    shipping_code TEXT,
    shipping_status TEXT,
    customer_note TEXT,
    admin_note TEXT,
    custom_config JSONB,
    printing_config JSONB,
    paid_at TIMESTAMPTZ,
    shipped_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 6. ORDER ITEMS
-- =====================================================
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    product_name TEXT NOT NULL,
    product_sku TEXT,
    size TEXT,
    quantity INT NOT NULL DEFAULT 1,
    unit_price BIGINT NOT NULL,
    total_price BIGINT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 7. PAYMENTS
-- =====================================================
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    amount BIGINT NOT NULL,
    method TEXT DEFAULT 'bank_transfer',
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
    transaction_id TEXT,
    bank_code TEXT,
    bank_name TEXT,
    account_number TEXT,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 8. FAQs
-- =====================================================
CREATE TABLE faqs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    category TEXT,
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE faqs ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can read/update their own
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Addresses: Users manage their own
CREATE POLICY "Users can manage own addresses" ON addresses FOR ALL USING (auth.uid() = user_id);

-- Products: Everyone can read active, admins can write
CREATE POLICY "Anyone can view active products" ON products FOR SELECT USING (status = 'active');
CREATE POLICY "Admins can manage products" ON products FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Orders: Users can view their own, admins can view all
CREATE POLICY "Users can view own orders" ON orders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create orders" ON orders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can manage all orders" ON orders FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Order Items: Same as orders
CREATE POLICY "Users can view own order items" ON order_items FOR SELECT 
    USING (EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid()));
CREATE POLICY "Admins can manage order items" ON order_items FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- FAQs: Everyone can read active
CREATE POLICY "Anyone can view active FAQs" ON faqs FOR SELECT USING (is_active = TRUE);
CREATE POLICY "Admins can manage FAQs" ON faqs FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_slug ON products(slug);
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_type ON orders(order_type);
CREATE INDEX idx_order_items_order ON order_items(order_id);

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================
SELECT 'Database schema created successfully!' AS message;
