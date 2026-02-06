
-- Create order_configs table for printing details
CREATE TABLE IF NOT EXISTS public.order_configs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    print_tech VARCHAR NOT NULL, -- 'fdm' or 'resin'
    material VARCHAR NOT NULL, -- 'pla', 'standard_resin', etc.
    color VARCHAR,
    quantity INTEGER DEFAULT 1,
    print_volume NUMERIC, -- cm3
    print_weight NUMERIC, -- grams
    print_time NUMERIC, -- hours
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create order_files table for linking files to orders
CREATE TABLE IF NOT EXISTS public.order_files (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    file_id VARCHAR NOT NULL, -- Drive ID or R2 Key
    file_type VARCHAR NOT NULL, -- 'stl', 'obj', 'guide', 'invoice', etc.
    file_name VARCHAR,
    file_url VARCHAR, -- Optional cached URL
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_order_configs_order_id ON public.order_configs(order_id);
CREATE INDEX IF NOT EXISTS idx_order_files_order_id ON public.order_files(order_id);

-- Grant permissions (if needed, though Service Role bypasses this)
GRANT ALL ON public.order_configs TO service_role;
GRANT ALL ON public.order_files TO service_role;
GRANT SELECT ON public.order_configs TO authenticated;
GRANT SELECT ON public.order_files TO authenticated;
