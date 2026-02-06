-- ============================================================================
-- Content + Pricing + Archive Columns (safe, additive)
-- Date: 2026-02-06
-- ============================================================================

BEGIN;

-- =============================
-- ORDER_FILES: archive metadata
-- =============================
ALTER TABLE public.order_files
    ADD COLUMN IF NOT EXISTS order_code TEXT,
    ADD COLUMN IF NOT EXISTS storage_provider TEXT DEFAULT 'r2',
    ADD COLUMN IF NOT EXISTS drive_file_id TEXT,
    ADD COLUMN IF NOT EXISTS drive_url TEXT,
    ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_order_files_order_code ON public.order_files(order_code);
CREATE INDEX IF NOT EXISTS idx_order_files_storage ON public.order_files(storage_provider);

-- =============================
-- CONTENT TABLES
-- =============================
CREATE TABLE IF NOT EXISTS public.content_pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL,
    title TEXT,
    meta JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.content_blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    page_id UUID NOT NULL REFERENCES public.content_pages(id) ON DELETE CASCADE,
    block_key TEXT NOT NULL,
    block_type TEXT NOT NULL,
    sort_order INT DEFAULT 0,
    data JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_content_blocks_page ON public.content_blocks(page_id);
CREATE INDEX IF NOT EXISTS idx_content_blocks_sort ON public.content_blocks(page_id, sort_order);

-- =============================
-- UI LABELS (Full Site Text)
-- =============================
CREATE TABLE IF NOT EXISTS public.ui_labels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scope TEXT NOT NULL,
    key TEXT NOT NULL,
    value JSONB NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ui_labels_scope_key ON public.ui_labels(scope, key);

ALTER TABLE public.content_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ui_labels ENABLE ROW LEVEL SECURITY;

-- Public can read active content
DROP POLICY IF EXISTS "Public read content pages" ON public.content_pages;
CREATE POLICY "Public read content pages" ON public.content_pages
    FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Public read content blocks" ON public.content_blocks;
CREATE POLICY "Public read content blocks" ON public.content_blocks
    FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Public read ui labels" ON public.ui_labels;
CREATE POLICY "Public read ui labels" ON public.ui_labels
    FOR SELECT USING (is_active = true);

-- Admin can manage content
DROP POLICY IF EXISTS "Admin manage content pages" ON public.content_pages;
CREATE POLICY "Admin manage content pages" ON public.content_pages
    FOR ALL USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'))
    WITH CHECK (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'));

DROP POLICY IF EXISTS "Admin manage content blocks" ON public.content_blocks;
CREATE POLICY "Admin manage content blocks" ON public.content_blocks
    FOR ALL USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'))
    WITH CHECK (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'));

DROP POLICY IF EXISTS "Admin manage ui labels" ON public.ui_labels;
CREATE POLICY "Admin manage ui labels" ON public.ui_labels
    FOR ALL USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'))
    WITH CHECK (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'));

-- =============================
-- PRICING TABLES
-- =============================
CREATE TABLE IF NOT EXISTS public.pricing_custom_types (
    type TEXT PRIMARY KEY CHECK (type IN ('single', 'couple', 'group')),
    label TEXT NOT NULL,
    base_price NUMERIC NOT NULL DEFAULT 0,
    deposit_percent NUMERIC NOT NULL DEFAULT 50
);

CREATE TABLE IF NOT EXISTS public.pricing_custom_sizes (
    size_code TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    multiplier NUMERIC NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS public.pricing_printing (
    print_type TEXT PRIMARY KEY CHECK (print_type IN ('fdm', 'resin')),
    label TEXT NOT NULL,
    density NUMERIC NOT NULL DEFAULT 1.2,
    speed NUMERIC NOT NULL DEFAULT 10,
    shell_factor NUMERIC NOT NULL DEFAULT 1.2,
    resin_factor NUMERIC NOT NULL DEFAULT 1.25,
    deposit_percent NUMERIC NOT NULL DEFAULT 100,
    rate_gram NUMERIC NOT NULL DEFAULT 600,
    rate_hour NUMERIC NOT NULL DEFAULT 3000,
    infill_factors JSONB DEFAULT '{}'::jsonb,
    layer_multipliers JSONB DEFAULT '{}'::jsonb,
    colors JSONB DEFAULT '[]'::jsonb
);

ALTER TABLE public.pricing_custom_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_custom_sizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_printing ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read pricing custom types" ON public.pricing_custom_types;
CREATE POLICY "Public read pricing custom types" ON public.pricing_custom_types
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read pricing custom sizes" ON public.pricing_custom_sizes;
CREATE POLICY "Public read pricing custom sizes" ON public.pricing_custom_sizes
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read pricing printing" ON public.pricing_printing;
CREATE POLICY "Public read pricing printing" ON public.pricing_printing
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin manage pricing custom types" ON public.pricing_custom_types;
CREATE POLICY "Admin manage pricing custom types" ON public.pricing_custom_types
    FOR ALL USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'))
    WITH CHECK (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'));

DROP POLICY IF EXISTS "Admin manage pricing custom sizes" ON public.pricing_custom_sizes;
CREATE POLICY "Admin manage pricing custom sizes" ON public.pricing_custom_sizes
    FOR ALL USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'))
    WITH CHECK (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'));

DROP POLICY IF EXISTS "Admin manage pricing printing" ON public.pricing_printing;
CREATE POLICY "Admin manage pricing printing" ON public.pricing_printing
    FOR ALL USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'))
    WITH CHECK (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'));

COMMIT;

-- =============================
-- SEED DEFAULT PRICING (safe upsert)
-- =============================
INSERT INTO public.pricing_custom_types (type, label, base_price, deposit_percent) VALUES
('single', 'Single', 350000, 50),
('couple', 'Couple', 550000, 50),
('group', 'Group', 750000, 50)
ON CONFLICT (type) DO NOTHING;

INSERT INTO public.pricing_custom_sizes (size_code, label, multiplier) VALUES
('S', 'S (10cm)', 1),
('M', 'M (15cm)', 1.3),
('L', 'L (20cm)', 1.6),
('XL', 'XL (25cm)', 2)
ON CONFLICT (size_code) DO NOTHING;

INSERT INTO public.pricing_printing (print_type, label, density, speed, shell_factor, resin_factor, deposit_percent, rate_gram, rate_hour, infill_factors, layer_multipliers, colors) VALUES
(
 'fdm',
 'FDM',
 1.24,
 12,
 1.2,
 1.25,
 100,
 600,
 3000,
 '{"15%":0.15,"20%":0.2,"30%":0.3,"50%":0.5}'::jsonb,
 '{"0.2":1,"0.12":2,"0.08":4}'::jsonb,
 '[{"id":"white","name":"Trắng","hex":"#FFFFFF"},{"id":"black","name":"Đen","hex":"#1D1D1F"},{"id":"transparent","name":"Trong suốt","hex":"#E5E5EA"}]'::jsonb
),
(
 'resin',
 'SLA (Resin)',
 1.1,
 6,
 1.2,
 1.25,
 100,
 3000,
 3000,
 '{"100%":1.0}'::jsonb,
 '{"0.2":1,"0.12":2,"0.08":4}'::jsonb,
 '[{"id":"white","name":"Trắng","hex":"#FFFFFF"}]'::jsonb
)
ON CONFLICT (print_type) DO NOTHING;

-- =============================
-- SEED CONTENT (Home)
-- =============================
INSERT INTO public.content_pages (slug, title, meta, is_active) VALUES
('home', 'Home', '{}'::jsonb, true)
ON CONFLICT (slug) DO NOTHING;

-- Insert home blocks if missing
WITH page AS (
  SELECT id FROM public.content_pages WHERE slug = 'home' LIMIT 1
)
INSERT INTO public.content_blocks (page_id, block_key, block_type, sort_order, data, is_active) VALUES
(
 (SELECT id FROM page),
 'hero',
 'hero',
 1,
 '{"title":"Miniver 3D Lab","subtitle":"In 3D & Thiết kế Custom","description":"Dịch vụ in 3D chuyên nghiệp, thiết kế mô hình theo yêu cầu, và sản phẩm độc đáo."}'::jsonb,
 true
),
(
 (SELECT id FROM page),
 'services',
 'services',
 2,
 '{"heading":"Dịch Vụ Của Chúng Tôi","subheading":"Từ sản phẩm có sẵn đến custom hoàn toàn theo ý bạn","items":[{"id":"products","title":"Sản Phẩm Có Sẵn","description":"Khám phá bộ sưu tập mô hình 3D độc đáo, chất lượng cao.","href":"/products"},{"id":"custom","title":"Tùy Biến Theo Yêu Cầu","description":"Tạo mô hình từ ảnh của bạn. Single, Couple, Group.","href":"/custom"},{"id":"printing","title":"Dịch Vụ In 3D","description":"Upload file STL • Báo giá tự động • FDM & Resin","href":"/printing"}]}'::jsonb,
 true
),
(
 (SELECT id FROM page),
 'features',
 'features',
 3,
 '{"heading":"Tại Sao Chọn Chúng Tôi?","items":[{"title":"Thủ Công Tỉ Mỉ","description":"Mỗi sản phẩm được chế tác thủ công với sự tỉ mỉ cao nhất."},{"title":"Giao Hàng Nhanh","description":"Thời gian sản xuất 5-7 ngày, giao hàng toàn quốc."},{"title":"Xem Trước Sản Phẩm","description":"Gửi ảnh demo trước khi giao, đảm bảo hài lòng 100%."}]}'::jsonb,
 true
),
(
 (SELECT id FROM page),
 'cta',
 'cta',
 4,
 '{"title":"Sẵn Sàng Tạo Mô Hình Của Bạn?","subtitle":"Chỉ cần upload ảnh, chúng tôi sẽ biến nó thành hiện thực.","primaryLabel":"Bắt đầu Custom","primaryHref":"/custom","secondaryLabel":"Xem Sản Phẩm","secondaryHref":"/products"}'::jsonb,
 true
)
ON CONFLICT DO NOTHING;
