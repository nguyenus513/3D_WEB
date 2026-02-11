-- ============================================================================
-- PRODUCTION SCHEMA v6 - Simplified 2-Table Structure
-- ============================================================================
-- 
-- NAMING CONVENTION:
-- - cart_code: 8 HEX characters (e.g., A9F3C2D8)
-- - cart_order_code: 17 characters (e.g., A9F3C2D8_7B91E2AF)
--
-- STRUCTURE:
-- - carts: Main order container (customer-facing)
-- - orders: Individual products/items (internal processing)
--
-- ============================================================================

-- ============================================================================
-- SECTION 1: EXTENSIONS
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- SECTION 2: HELPER FUNCTIONS
-- ============================================================================

-- Generate 8-character HEX code
CREATE OR REPLACE FUNCTION generate_hex8()
RETURNS TEXT AS $$
BEGIN
    RETURN upper(encode(gen_random_bytes(4), 'hex'));
END;
$$ LANGUAGE plpgsql;

-- Generate cart_order_code (17 chars: CARTCODE_ORDERCODE)
CREATE OR REPLACE FUNCTION generate_cart_order_code(cart_code TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN cart_code || '_' || upper(encode(gen_random_bytes(4), 'hex'));
END;
$$ LANGUAGE plpgsql;

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SECTION 3: PROFILES TABLE (Keep existing)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    phone TEXT,
    role TEXT DEFAULT 'customer' CHECK (role IN ('customer', 'admin', 'super_admin')),
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- SECTION 4: PRODUCTS TABLE (Keep existing structure)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE,
    sku TEXT UNIQUE,
    description TEXT,
    short_description TEXT,
    price BIGINT NOT NULL DEFAULT 0,
    compare_price BIGINT,
    cost_price BIGINT,
    stock INT DEFAULT 0,
    low_stock_alert INT DEFAULT 5,
    category TEXT,
    type TEXT DEFAULT 'ready_made',
    images TEXT[] DEFAULT '{}',
    sizes JSONB DEFAULT '[]',
    specs JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- SECTION 5: CARTS TABLE (Main Order Container)
-- ============================================================================
-- 
-- cart_code: 8 HEX (customer-facing, shown in dashboard)
-- This is what users see and use for tracking
--

CREATE TABLE IF NOT EXISTS public.carts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cart_code CHAR(8) UNIQUE NOT NULL DEFAULT generate_hex8(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    
    -- Pricing
    subtotal BIGINT NOT NULL DEFAULT 0,
    shipping_fee BIGINT DEFAULT 0,
    discount BIGINT DEFAULT 0,
    total_amount BIGINT NOT NULL DEFAULT 0,
    deposit_amount BIGINT DEFAULT 0,
    deposit_paid BOOLEAN DEFAULT false,
    
    -- Status
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'checked_out', 'abandoned', 'completed', 'cancelled')),
    payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'partial', 'paid', 'refunded', 'failed')),
    fulfillment_status TEXT DEFAULT 'pending' CHECK (fulfillment_status IN ('pending', 'processing', 'producing', 'shipping', 'delivered', 'returned')),
    
    -- Shipping
    shipping_address JSONB,
    
    -- Metadata
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    checked_out_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ
);

COMMENT ON TABLE public.carts IS 'Main order container - customer sees cart_code (8 HEX)';
COMMENT ON COLUMN public.carts.cart_code IS '8-character HEX code, e.g., A9F3C2D8';

-- ============================================================================
-- SECTION 6: ORDERS TABLE (Individual Products/Items)
-- ============================================================================
--
-- cart_order_code: 17 chars (CARTCODE_ORDERCODE)
-- Each product in cart = 1 row in orders
-- Used for internal processing (shipping, refunds, production)
--

CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cart_id UUID NOT NULL REFERENCES public.carts(id) ON DELETE CASCADE,
    cart_order_code CHAR(17) UNIQUE NOT NULL,
    
    -- Product Reference
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    sku TEXT,
    
    -- Quantity & Pricing
    quantity INT NOT NULL DEFAULT 1,
    unit_price BIGINT NOT NULL,
    total_price BIGINT NOT NULL,
    
    -- Item Status (can differ per item)
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'producing', 'shipped', 'delivered', 'cancelled', 'refunded')),
    
    -- Item Type
    item_type TEXT DEFAULT 'ready_made' CHECK (item_type IN ('ready_made', 'custom', 'printing')),
    custom_type TEXT, -- single, couple, group
    custom_size TEXT, -- S, M, L, XL
    
    -- Configuration (for custom orders)
    configuration JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.orders IS 'Individual order items - cart_order_code = CARTCODE_ORDERCODE (17 chars)';
COMMENT ON COLUMN public.orders.cart_order_code IS '17-character code: CARTCODE_ORDERCODE, e.g., A9F3C2D8_7B91E2AF';

-- ============================================================================
-- SECTION 7: ORDER FILES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.order_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cart_id UUID REFERENCES public.carts(id) ON DELETE CASCADE,
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    cart_code CHAR(8),
    
    -- Storage
    file_key TEXT,
    storage_provider TEXT DEFAULT 'r2' CHECK (storage_provider IN ('r2', 'drive')),
    drive_file_id TEXT,
    drive_url TEXT,
    
    -- File info
    file_name TEXT NOT NULL,
    mime_type TEXT,
    size_bytes BIGINT,
    category TEXT DEFAULT 'images' CHECK (category IN ('images', 'models', 'review', 'final')),
    
    -- Ownership
    owner_id TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- SECTION 8: PAYMENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cart_id UUID REFERENCES public.carts(id) ON DELETE CASCADE,
    cart_code CHAR(8),
    
    -- Payment details
    amount BIGINT NOT NULL,
    method TEXT DEFAULT 'bank_transfer',
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'refunded')),
    
    -- Reference
    transaction_id TEXT,
    provider_ref TEXT,
    payment_proof_url TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now(),
    verified_at TIMESTAMPTZ,
    verified_by UUID REFERENCES public.profiles(id)
);

-- ============================================================================
-- SECTION 9: INDEXES
-- ============================================================================

-- Profiles
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- Products
CREATE INDEX IF NOT EXISTS idx_products_sku ON public.products(sku);
CREATE INDEX IF NOT EXISTS idx_products_slug ON public.products(slug);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);
CREATE INDEX IF NOT EXISTS idx_products_active ON public.products(is_active) WHERE is_active = true;

-- Carts
CREATE INDEX IF NOT EXISTS idx_carts_user ON public.carts(user_id);
CREATE INDEX IF NOT EXISTS idx_carts_cart_code ON public.carts(cart_code);
CREATE INDEX IF NOT EXISTS idx_carts_status ON public.carts(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_carts_user_active ON public.carts(user_id) WHERE status = 'active';

-- Orders
CREATE INDEX IF NOT EXISTS idx_orders_cart ON public.orders(cart_id);
CREATE INDEX IF NOT EXISTS idx_orders_cart_order_code ON public.orders(cart_order_code);
CREATE INDEX IF NOT EXISTS idx_orders_product ON public.orders(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);

-- Order Files
CREATE INDEX IF NOT EXISTS idx_order_files_cart ON public.order_files(cart_id);
CREATE INDEX IF NOT EXISTS idx_order_files_order ON public.order_files(order_id);
CREATE INDEX IF NOT EXISTS idx_order_files_cart_code ON public.order_files(cart_code);

-- Payments
CREATE INDEX IF NOT EXISTS idx_payments_cart ON public.payments(cart_id);
CREATE INDEX IF NOT EXISTS idx_payments_cart_code ON public.payments(cart_code);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);

-- ============================================================================
-- SECTION 10: TRIGGERS
-- ============================================================================

-- Auto-update updated_at
DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS products_updated_at ON public.products;
CREATE TRIGGER products_updated_at BEFORE UPDATE ON public.products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS carts_updated_at ON public.carts;
CREATE TRIGGER carts_updated_at BEFORE UPDATE ON public.carts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS orders_updated_at ON public.orders;
CREATE TRIGGER orders_updated_at BEFORE UPDATE ON public.orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- SECTION 11: ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Profiles policies
DROP POLICY IF EXISTS "Profiles viewable by owner" ON public.profiles;
CREATE POLICY "Profiles viewable by owner" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Profiles updatable by owner" ON public.profiles;
CREATE POLICY "Profiles updatable by owner" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

-- Products policies (public read)
DROP POLICY IF EXISTS "Products are viewable by everyone" ON public.products;
CREATE POLICY "Products are viewable by everyone" ON public.products
    FOR SELECT USING (true);

-- Carts policies
DROP POLICY IF EXISTS "Users can view own carts" ON public.carts;
CREATE POLICY "Users can view own carts" ON public.carts
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create carts" ON public.carts;
CREATE POLICY "Users can create carts" ON public.carts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own carts" ON public.carts;
CREATE POLICY "Users can update own carts" ON public.carts
    FOR UPDATE USING (auth.uid() = user_id);

-- Orders policies (via cart ownership)
DROP POLICY IF EXISTS "Users can view orders via cart" ON public.orders;
CREATE POLICY "Users can view orders via cart" ON public.orders
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.carts WHERE id = orders.cart_id AND user_id = auth.uid())
    );

-- Order files policies
DROP POLICY IF EXISTS "Users can view own order files" ON public.order_files;
CREATE POLICY "Users can view own order files" ON public.order_files
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.carts WHERE id = order_files.cart_id AND user_id = auth.uid())
    );

-- Payments policies
DROP POLICY IF EXISTS "Users can view own payments" ON public.payments;
CREATE POLICY "Users can view own payments" ON public.payments
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.carts WHERE id = payments.cart_id AND user_id = auth.uid())
    );

-- ============================================================================
-- SECTION 12: ADMIN POLICIES
-- ============================================================================

-- Admin can do everything
DO $$
BEGIN
    -- Profiles admin policy
    DROP POLICY IF EXISTS "Admin full access to profiles" ON public.profiles;
    EXECUTE 'CREATE POLICY "Admin full access to profiles" ON public.profiles FOR ALL TO authenticated USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN (''admin'', ''super_admin''))
    )';
    
    -- Products admin policy
    DROP POLICY IF EXISTS "Admin full access to products" ON public.products;
    EXECUTE 'CREATE POLICY "Admin full access to products" ON public.products FOR ALL TO authenticated USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN (''admin'', ''super_admin''))
    )';
    
    -- Carts admin policy
    DROP POLICY IF EXISTS "Admin full access to carts" ON public.carts;
    EXECUTE 'CREATE POLICY "Admin full access to carts" ON public.carts FOR ALL TO authenticated USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN (''admin'', ''super_admin''))
    )';
    
    -- Orders admin policy
    DROP POLICY IF EXISTS "Admin full access to orders" ON public.orders;
    EXECUTE 'CREATE POLICY "Admin full access to orders" ON public.orders FOR ALL TO authenticated USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN (''admin'', ''super_admin''))
    )';
    
    -- Order files admin policy
    DROP POLICY IF EXISTS "Admin full access to order_files" ON public.order_files;
    EXECUTE 'CREATE POLICY "Admin full access to order_files" ON public.order_files FOR ALL TO authenticated USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN (''admin'', ''super_admin''))
    )';
    
    -- Payments admin policy
    DROP POLICY IF EXISTS "Admin full access to payments" ON public.payments;
    EXECUTE 'CREATE POLICY "Admin full access to payments" ON public.payments FOR ALL TO authenticated USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN (''admin'', ''super_admin''))
    )';
END $$;

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
