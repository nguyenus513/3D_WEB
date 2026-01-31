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
