-- ============================================================================
-- Optimization A: Additive schema alignment (safe, idempotent)
-- Date: 2026-02-06
-- ============================================================================

BEGIN;

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================
-- Profiles: email_verified
-- =============================
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'is_verified'
    ) THEN
        UPDATE public.profiles
        SET email_verified = COALESCE(email_verified, is_verified, false)
        WHERE email_verified IS NULL;
    END IF;
END $$;

-- =============================
-- FAQs: updated_at + trigger
-- =============================
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'faqs'
    ) THEN
        ALTER TABLE public.faqs
            ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

        CREATE OR REPLACE FUNCTION public.touch_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = now();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        DROP TRIGGER IF EXISTS trigger_faqs_updated_at ON public.faqs;
        CREATE TRIGGER trigger_faqs_updated_at
            BEFORE UPDATE ON public.faqs
            FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
    END IF;
END $$;

-- =============================
-- Orders: ensure total_amount
-- =============================
ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS total_amount NUMERIC(15, 0);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'total'
    ) THEN
        UPDATE public.orders
        SET total_amount = COALESCE(total_amount, total)
        WHERE total_amount IS NULL;
    END IF;
END $$;

-- =============================
-- Payments: align columns
-- =============================
ALTER TABLE public.payments
    ADD COLUMN IF NOT EXISTS transaction_code TEXT,
    ADD COLUMN IF NOT EXISTS method TEXT DEFAULT 'QR',
    ADD COLUMN IF NOT EXISTS gateway_response JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- =============================
-- Order files: archive metadata
-- =============================
ALTER TABLE public.order_files
    ADD COLUMN IF NOT EXISTS order_code TEXT,
    ADD COLUMN IF NOT EXISTS storage_provider TEXT DEFAULT 'r2',
    ADD COLUMN IF NOT EXISTS drive_file_id TEXT,
    ADD COLUMN IF NOT EXISTS drive_url TEXT,
    ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- =============================
-- System settings
-- =============================
CREATE TABLE IF NOT EXISTS public.system_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    label TEXT,
    description TEXT,
    group_name TEXT DEFAULT 'general',
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public configs are viewable by everyone" ON public.system_settings;
CREATE POLICY "Public configs are viewable by everyone"
ON public.system_settings FOR SELECT
USING (is_public = true);

DROP POLICY IF EXISTS "Admins can view all settings" ON public.system_settings;
CREATE POLICY "Admins can view all settings"
ON public.system_settings FOR SELECT TO authenticated
USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'));

DROP POLICY IF EXISTS "Admins can update settings" ON public.system_settings;
CREATE POLICY "Admins can update settings"
ON public.system_settings FOR UPDATE TO authenticated
USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'))
WITH CHECK (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'));

DROP POLICY IF EXISTS "No one can delete settings" ON public.system_settings;
CREATE POLICY "No one can delete settings"
ON public.system_settings FOR DELETE
USING (false);

-- =============================
-- Content tables
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

DROP POLICY IF EXISTS "Public read content pages" ON public.content_pages;
CREATE POLICY "Public read content pages" ON public.content_pages
    FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Public read content blocks" ON public.content_blocks;
CREATE POLICY "Public read content blocks" ON public.content_blocks
    FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Public read ui labels" ON public.ui_labels;
CREATE POLICY "Public read ui labels" ON public.ui_labels
    FOR SELECT USING (is_active = true);

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
-- Pricing tables
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
