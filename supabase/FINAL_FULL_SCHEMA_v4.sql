-- =====================================================
-- OPTIMIZED SUPABASE SCHEMA v3.0
-- Đã tối ưu: Gộp bảng, ENUM, JSONB, Index, RLS
-- =====================================================

-- 1. Bật các extension cần thiết
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Định nghĩa ENUMs và XÓA BẢNG CŨ (Reset sạch sẽ)
-- DROP TABLES (Để tránh lỗi "Already exists")
DROP TABLE IF EXISTS public.cart_items CASCADE;
DROP TABLE IF EXISTS public.carts CASCADE;
DROP TABLE IF EXISTS public.payments CASCADE;
DROP TABLE IF EXISTS public.order_items CASCADE;
DROP TABLE IF EXISTS public.orders CASCADE;
DROP TABLE IF EXISTS public.products CASCADE;
DROP TABLE IF EXISTS public.categories CASCADE;
DROP TABLE IF EXISTS public.addresses CASCADE;
DROP TABLE IF EXISTS public.refresh_tokens CASCADE;
DROP TABLE IF EXISTS public.security_logs CASCADE;
DROP TABLE IF EXISTS public.system_settings CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- DROP ENUMS
DROP TYPE IF EXISTS user_role CASCADE;
DROP TYPE IF EXISTS order_status CASCADE;
DROP TYPE IF EXISTS payment_status CASCADE;
DROP TYPE IF EXISTS product_type CASCADE;
DROP TYPE IF EXISTS print_tech CASCADE;

CREATE TYPE user_role AS ENUM ('customer', 'admin', 'staff');
CREATE TYPE order_status AS ENUM ('pending', 'confirmed', 'paid', 'processing', 'designing', 'producing', 'shipping', 'delivered', 'completed', 'cancelled', 'refunded');
CREATE TYPE payment_status AS ENUM ('pending', 'partial', 'paid', 'refunded', 'failed');
CREATE TYPE product_type AS ENUM ('ready_made', 'custom_template', 'service', 'printing');
CREATE TYPE print_tech AS ENUM ('fdm', 'resin', 'sla');

-- 3. Bảng Profiles (Người dùng) - Tối ưu index và bỏ cột thừa
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY, -- Khớp với ID của auth.users nếu dùng Supabase/Firebase
  email text UNIQUE NOT NULL,
  full_name text,
  phone varchar(20),
  role user_role DEFAULT 'customer',
  customer_code varchar(50) UNIQUE,
  avatar_url text,
  is_verified boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX idx_profiles_email ON public.profiles(email);
CREATE INDEX idx_profiles_role ON public.profiles(role);

-- Trigger để tự tạo profile khi user đăng ký
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Bảng Addresses (Địa chỉ) - Liên kết chặt chẽ
CREATE TABLE public.addresses (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  label varchar(50) DEFAULT 'Nhà',
  full_name text NOT NULL,
  phone varchar(20) NOT NULL,
  province text NOT NULL,
  district text NOT NULL,
  ward text,
  address_line text NOT NULL,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_addresses_user_id ON public.addresses(user_id);

-- 5. Bảng Categories (Danh mục) - Cấu trúc cây
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  parent_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  sort_order smallint DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_categories_parent_id ON public.categories(parent_id);

-- 6. Bảng Products (Sản phẩm) - Gộp cấu hình vào JSONB để linh hoạt
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  sku varchar(50) UNIQUE,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  type product_type DEFAULT 'ready_made',
  base_price numeric(15, 0) NOT NULL DEFAULT 0,
  sale_price numeric(15, 0),
  stock integer DEFAULT 0,
  images jsonb DEFAULT '[]'::jsonb,
  specs jsonb DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT false,
  view_count integer DEFAULT 0,
  sold_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX idx_products_category ON public.products(category_id);
CREATE INDEX idx_products_slug ON public.products(slug);
CREATE INDEX idx_products_active ON public.products(is_active) WHERE is_active = true;

-- 7. Bảng Orders (Đơn hàng) - HỢP NHẤT TẤT CẢ CÁC BẢNG ORDER CŨ
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_code varchar(20) NOT NULL UNIQUE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  address_id uuid REFERENCES public.addresses(id),
  
  subtotal numeric(15, 0) DEFAULT 0,
  shipping_fee numeric(15, 0) DEFAULT 0,
  discount numeric(15, 0) DEFAULT 0,
  total_amount numeric(15, 0) DEFAULT 0,
  deposit_amount numeric(15, 0) DEFAULT 0,
  
  status order_status DEFAULT 'pending',
  payment_status payment_status DEFAULT 'pending',
  
  shipping_address_snapshot jsonb,
  notes text,
  admin_notes text,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  confirmed_at timestamptz,
  paid_at timestamptz,
  completed_at timestamptz
);
CREATE INDEX idx_orders_user_id ON public.orders(user_id);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_orders_created_at ON public.orders(created_at DESC);

-- 8. Bảng Order Items (Chi tiết đơn hàng)
CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  
  name text NOT NULL,
  sku varchar(50),
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price numeric(15, 0) NOT NULL,
  total_price numeric(15, 0) NOT NULL,
  
  configuration jsonb DEFAULT '{}'::jsonb, 
  
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX idx_order_items_product_id ON public.order_items(product_id);

-- 9. Bảng Payments (Thanh toán)
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  transaction_code varchar(100),
  amount numeric(15, 0) NOT NULL,
  method varchar(50) DEFAULT 'QR',
  status payment_status DEFAULT 'pending',
  gateway_response jsonb,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_payments_order_id ON public.payments(order_id);

-- 10. Bảng Carts (Giỏ hàng)
CREATE TABLE public.carts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

CREATE TABLE public.cart_items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  cart_id uuid NOT NULL REFERENCES public.carts(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  configuration jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(cart_id, product_id)
);
CREATE INDEX idx_cart_items_cart_id ON public.cart_items(cart_id);

-- 11. Bảng Security Logs (Bảo mật)
CREATE TABLE public.security_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_type varchar(50) NOT NULL,
  ip_address inet,
  user_agent text,
  details jsonb,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_security_logs_user ON public.security_logs(user_id);
CREATE INDEX idx_security_logs_created ON public.security_logs(created_at);

-- 12. Bảng Refresh Tokens (Auth)
CREATE TABLE public.refresh_tokens (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_refresh_tokens_user ON public.refresh_tokens(user_id);

-- === TRIGGERS CẬP NHẬT UPDATED_AT TỰ ĐỘNG ===
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_profiles_modtime BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_products_modtime BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_orders_modtime BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_carts_modtime BEFORE UPDATE ON public.carts FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_cart_items_modtime BEFORE UPDATE ON public.cart_items FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- === BẢO MẬT (ROW LEVEL SECURITY - RLS) ===
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Profiles: User có thể xem profile của mình
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Orders: User có thể xem đơn hàng của mình
CREATE POLICY "Users can view own orders" ON public.orders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own orders" ON public.orders FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Order Items: User có thể xem chi tiết đơn hàng của mình
CREATE POLICY "Users can view own order items" ON public.order_items FOR SELECT 
  USING (EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid()));

-- Addresses: User có thể quản lý địa chỉ của mình
CREATE POLICY "Users can manage own addresses" ON public.addresses FOR ALL USING (auth.uid() = user_id);

-- Carts: User có thể quản lý giỏ hàng của mình
CREATE POLICY "Users can manage own cart" ON public.carts FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own cart items" ON public.cart_items FOR ALL 
  USING (EXISTS (SELECT 1 FROM public.carts WHERE carts.id = cart_items.cart_id AND carts.user_id = auth.uid()));

-- Payments: User có thể xem payments của đơn hàng mình
CREATE POLICY "Users can view own payments" ON public.payments FOR SELECT 
  USING (EXISTS (SELECT 1 FROM public.orders WHERE orders.id = payments.order_id AND orders.user_id = auth.uid()));

-- Products & Categories: Public read
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active products" ON public.products FOR SELECT USING (is_active = true);
CREATE POLICY "Anyone can view active categories" ON public.categories FOR SELECT USING (is_active = true);

-- Service role bypass (Cho API server)
CREATE POLICY "Service role full access profiles" ON public.profiles FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access orders" ON public.orders FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access order_items" ON public.order_items FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access products" ON public.products FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access categories" ON public.categories FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access addresses" ON public.addresses FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access carts" ON public.carts FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access cart_items" ON public.cart_items FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access payments" ON public.payments FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access security_logs" ON public.security_logs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access refresh_tokens" ON public.refresh_tokens FOR ALL TO service_role USING (true) WITH CHECK (true);

-- =====================================================
-- SCHEMA OPTIMIZED COMPLETE!
-- =====================================================
-- =====================================================
-- PATCH: Thêm các cột bị thiếu vào bảng Products
-- Chạy file này nếu bạn vừa chạy schema_v3_optimized.sql
-- =====================================================

ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS description text,
ADD COLUMN IF NOT EXISTS short_description text,
ADD COLUMN IF NOT EXISTS is_featured boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';

-- Index cho tags để tìm kiếm nhanh
CREATE INDEX IF NOT EXISTS idx_products_tags ON public.products USING GIN (tags);

-- Comment
COMMENT ON COLUMN public.products.images IS 'Mảng chứa các URL ảnh (string[]). VD: ["url1", "url2"]';
-- ==============================================================================
-- SCHEMA V4: SYSTEM SETTINGS & SECURITY HARDENING
-- Mục tiêu: 
-- 1. "Không hardcode": Lưu cấu hình web (Banner, SĐT, Phí ship) vào DB.
-- 2. "Chống hack": Siết chặt RLS, đảm bảo log an ninh không thể bị xóa bởi user.
-- ==============================================================================

-- 1. Bảng System Settings (Cấu hình hệ thống động)
CREATE TABLE IF NOT EXISTS public.system_settings (
    key text PRIMARY KEY,             -- VD: 'site_banner', 'shipping_fee_default'
    value jsonb NOT NULL,             -- Giá trị linh hoạt (text, number, boolean, array)
    label text,                       -- Tên hiển thị trong Admin (VD: "Phí ship mặc định")
    description text,                 -- Hướng dẫn (VD: "Phí ship áp dụng cho đơn dưới 1 triệu")
    group_name text DEFAULT 'general',-- Nhóm: 'general', 'payment', 'contact'
    is_public boolean DEFAULT false,  -- True = Frontend đọc được, False = Chỉ Backend/Admin
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Bảo mật bảng Settings
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Tất cả mọi người (kể cả khách) xem được cấu hình Public
CREATE POLICY "Public configs are viewable by everyone" 
ON public.system_settings FOR SELECT 
USING (is_public = true);

-- Policy: Admin xem được toàn bộ cấu hình (bao gồm private key, api secrets nếu có)
CREATE POLICY "Admins can view all settings" 
ON public.system_settings FOR SELECT 
TO authenticated 
USING (
  auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
);

-- Policy: Chỉ Admin mới được sửa cấu hình
CREATE POLICY "Admins can update settings" 
ON public.system_settings FOR UPDATE 
TO authenticated 
USING (
  auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
)
WITH CHECK (
  auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
);

-- Policy: Chặn tuyệt đối việc DELETE cấu hình (Chỉ cho phép sửa)
CREATE POLICY "No one can delete settings" 
ON public.system_settings FOR DELETE 
USING (false);

-- 2. Dữ liệu mẫu (Seed Data) - Để web chạy ngay không cần hardcode
INSERT INTO public.system_settings (key, value, label, group_name, is_public) VALUES 
('site_name', '"3D Web Store"', 'Tên Website', 'general', true),
('contact_phone', '"0912345678"', 'Hotline', 'contact', true),
('contact_email', '"support@3dweb.com"', 'Email liên hệ', 'contact', true),
('shipping_fee_standard', '30000', 'Phí ship tiêu chuẩn', 'payment', true),
('free_ship_threshold', '1000000', 'Mức miễn phí vận chuyển', 'payment', true),
('maintenance_mode', 'false', 'Bảo trì hệ thống', 'security', true)
ON CONFLICT (key) DO NOTHING;


-- 3. Hardening Security Logs (Chống xóa dấu vết)
ALTER TABLE public.security_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Admin chỉ được XEM log, KHÔNG ĐƯỢC XÓA/SỬA để đảm bảo tính toàn vẹn
CREATE POLICY "Admins can view security logs" 
ON public.security_logs FOR SELECT 
TO authenticated 
USING (
  auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
);

-- Policy: Hệ thống (Service Role) được ghi log. User thường không được ghi trực tiếp.
-- (Lưu ý: Supabase Service Role bypass RLS, nên policy này chủ yếu chặn user thường spam log)
CREATE POLICY "Users cannot retrieve logs" 
ON public.security_logs FOR SELECT 
USING (false); 

-- Chặn hoàn toàn Delete/Update trên bảng Log (Immutability)
CREATE POLICY "Security logs are immutable" 
ON public.security_logs FOR UPDATE USING (false);

CREATE POLICY "Security logs cannot be deleted" 
ON public.security_logs FOR DELETE USING (false);


-- 4. Review lại bảng Products (Đảm bảo chỉ Admin sửa được)
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read products" ON public.products;
CREATE POLICY "Public read products" 
ON public.products FOR SELECT 
USING (is_active = true OR auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('admin', 'staff')));

DROP POLICY IF EXISTS "Admin full access products" ON public.products;
CREATE POLICY "Admin full access products" 
ON public.products FOR ALL 
TO authenticated
USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'))
WITH CHECK (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'));

-- Thông báo
COMMENT ON TABLE public.system_settings IS 'Lưu trữ cấu hình động của website, thay thế hardcode file';
