-- =====================================================
-- CART TABLES FOR SERVER-SIDE CART SYNC
-- Run this SQL in Supabase SQL Editor
-- =====================================================

-- 1. CARTS - One cart per user
-- =====================================================
CREATE TABLE IF NOT EXISTS carts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- 2. CART ITEMS - Items in each cart
-- =====================================================
CREATE TABLE IF NOT EXISTS cart_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cart_id UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
    
    -- Item type: 'product', 'print', 'custom'
    item_type TEXT NOT NULL CHECK (item_type IN ('product', 'print', 'custom')),
    
    -- Common fields
    name TEXT NOT NULL,
    price BIGINT NOT NULL DEFAULT 0,
    quantity INT NOT NULL DEFAULT 1,
    image_url TEXT,
    
    -- Product-specific (nullable)
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    product_sku TEXT,
    size TEXT,
    original_price BIGINT,
    
    -- Print-specific (nullable) - stored as JSONB
    print_options JSONB,
    print_files JSONB,
    
    -- Custom-specific (nullable)
    description TEXT,
    custom_files JSONB,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;

-- Carts: Users can only access their own cart
CREATE POLICY "Users can manage own cart" ON carts
    FOR ALL USING (auth.uid() = user_id);

-- Cart Items: Users can manage items in their own cart
CREATE POLICY "Users can manage own cart items" ON cart_items
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM carts 
            WHERE carts.id = cart_items.cart_id 
            AND carts.user_id = auth.uid()
        )
    );

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_carts_user_id ON carts(user_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_cart_id ON cart_items(cart_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_product_id ON cart_items(product_id);

-- =====================================================
-- TRIGGER: Update cart timestamp when items change
-- =====================================================
CREATE OR REPLACE FUNCTION update_cart_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE carts SET updated_at = NOW() WHERE id = NEW.cart_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_cart_item_change
    AFTER INSERT OR UPDATE ON cart_items
    FOR EACH ROW EXECUTE FUNCTION update_cart_timestamp();

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================
SELECT 'Cart tables created successfully!' AS message;
