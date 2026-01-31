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
