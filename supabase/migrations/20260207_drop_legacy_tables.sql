-- ============================================================================
-- DROP LEGACY TABLES MIGRATION
-- Date: 2026-02-07
-- ============================================================================
-- WARNING: This migration permanently deletes archived legacy tables.
-- Run ONLY after verifying all data has been migrated to unified tables.
-- ============================================================================

-- Check data was migrated before dropping
DO $$
DECLARE
    order_count integer;
    archived_count integer;
BEGIN
    -- Count in unified orders
    SELECT COUNT(*) INTO order_count FROM public.orders;
    
    -- Count in archived tables (if they exist)
    archived_count := 0;
    IF to_regclass('public.custom_orders_archive') IS NOT NULL THEN
        EXECUTE 'SELECT COUNT(*) FROM public.custom_orders_archive' INTO archived_count;
    END IF;
    
    RAISE NOTICE 'Unified orders: %, Archived: %', order_count, archived_count;
    
    -- Safety check: abort if unified is empty but archive has data
    IF order_count = 0 AND archived_count > 0 THEN
        RAISE EXCEPTION 'Aborted: Unified orders table is empty but archive has % records', archived_count;
    END IF;
END $$;

-- Drop archived legacy tables
DROP TABLE IF EXISTS public.custom_orders_archive CASCADE;
DROP TABLE IF EXISTS public.print_orders_archive CASCADE;
DROP TABLE IF EXISTS public.product_orders_archive CASCADE;
DROP TABLE IF EXISTS public.order_configs_archive CASCADE;
DROP TABLE IF EXISTS public.order_parent_archive CASCADE;
DROP TABLE IF EXISTS public.order_child_archive CASCADE;
DROP TABLE IF EXISTS public.product_order_items_archive CASCADE;

-- Drop other legacy tables (if not already archived/dropped)
DROP TABLE IF EXISTS public.master_orders CASCADE;
DROP TABLE IF EXISTS public.custom_orders CASCADE;
DROP TABLE IF EXISTS public.print_orders CASCADE;
DROP TABLE IF EXISTS public.product_orders CASCADE;
DROP TABLE IF EXISTS public.order_configs CASCADE;
DROP TABLE IF EXISTS public.order_parent CASCADE;
DROP TABLE IF EXISTS public.order_child CASCADE;
DROP TABLE IF EXISTS public.product_order_items CASCADE;

-- Log completion
DO $$
BEGIN
    RAISE NOTICE 'Legacy tables dropped successfully at %', now();
END $$;
