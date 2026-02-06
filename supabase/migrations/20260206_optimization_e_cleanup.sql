-- ============================================================================
-- Optimization E: Cleanup legacy columns/tables after backfill
-- Date: 2026-02-06
-- ============================================================================

BEGIN;

-- Drop redundant columns
ALTER TABLE public.orders
    DROP COLUMN IF EXISTS items,
    DROP COLUMN IF EXISTS items_config,
    DROP COLUMN IF EXISTS total;

ALTER TABLE public.order_files
    DROP COLUMN IF EXISTS file_id;

ALTER TABLE public.profiles
    DROP COLUMN IF EXISTS is_verified;

-- Drop legacy tables
DROP TABLE IF EXISTS public.order_parent CASCADE;
DROP TABLE IF EXISTS public.order_child CASCADE;
DROP TABLE IF EXISTS public.payment CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;
DROP TABLE IF EXISTS public.accounts CASCADE;
DROP TABLE IF EXISTS public.sessions CASCADE;

COMMIT;
