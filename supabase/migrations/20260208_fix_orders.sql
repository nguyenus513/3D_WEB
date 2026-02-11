-- STEP 1: Add cart_id column to orders table
-- Run this FIRST if migration is failing

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'orders' 
                   AND column_name = 'cart_id') THEN
        ALTER TABLE public.orders ADD COLUMN cart_id UUID;
        RAISE NOTICE 'Added cart_id column to orders';
    ELSE
        RAISE NOTICE 'cart_id column already exists';
    END IF;
END $$;

-- STEP 2: Add cart_order_code column
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'orders' 
                   AND column_name = 'cart_order_code') THEN
        ALTER TABLE public.orders ADD COLUMN cart_order_code CHAR(17);
        RAISE NOTICE 'Added cart_order_code column to orders';
    ELSE
        RAISE NOTICE 'cart_order_code column already exists';
    END IF;
END $$;

-- STEP 3: Generate cart_order_code for existing records
UPDATE public.orders 
SET cart_order_code = COALESCE(cart_code, upper(encode(gen_random_bytes(4), 'hex'))) || '_' || upper(encode(gen_random_bytes(4), 'hex'))
WHERE cart_order_code IS NULL;

-- STEP 4: Add other missing columns
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS quantity INT DEFAULT 1;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS unit_price BIGINT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS total_price BIGINT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS item_type TEXT DEFAULT 'ready_made';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS custom_type TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS custom_size TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS configuration JSONB DEFAULT '{}';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS sku TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS product_id UUID;

-- STEP 5: Set default values for name column
UPDATE public.orders 
SET name = COALESCE(order_type, 'Order') || ' - ' || COALESCE(order_code, id::text) 
WHERE name IS NULL;

-- STEP 6: Set default values for price columns
UPDATE public.orders SET unit_price = COALESCE(total_amount, 0) WHERE unit_price IS NULL;
UPDATE public.orders SET total_price = COALESCE(total_amount, 0) WHERE total_price IS NULL;

-- DONE
SELECT 'Migration completed successfully' as status;
