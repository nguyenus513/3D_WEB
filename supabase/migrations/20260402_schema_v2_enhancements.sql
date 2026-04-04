-- =============================================================================
-- Migration: Schema V2 Enhancements
-- =============================================================================
-- Applies backward-compatible improvements from schema_v2_complete.sql:
--   1. Extensions (pg_trgm for fuzzy search)
--   2. Helper trigger functions
--   3. Triggers for updated_at auto-update on all tables
--   4. Trigger: notifications.read_at auto-set
--   5. Trigger: orders.payment_status sync from payments table
--   6. New columns: orders.shipping_fee, orders.outstanding_amount (generated)
--   7. GIN trgm indexes for product/order search
--   8. Additional composite indexes from v2
--
-- All DDL uses IF NOT EXISTS / CREATE OR REPLACE / DROP TRIGGER IF EXISTS
-- Safe to run on existing database with live data.
-- Does NOT rename tables, columns, or change enum values.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. EXTENSIONS
-- -----------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;   -- fuzzy text search (GIN indexes below)

-- -----------------------------------------------------------------------------
-- 2. HELPER TRIGGER FUNCTIONS
-- -----------------------------------------------------------------------------

-- Auto-update updated_at on every UPDATE row
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Auto-set read_at when notification is marked read; clear it when unread
CREATE OR REPLACE FUNCTION public.tg_set_notification_read_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.is_read = true AND NEW.read_at IS NULL THEN
    NEW.read_at = now();
  ELSIF NEW.is_read = false THEN
    NEW.read_at = NULL;
  END IF;
  RETURN NEW;
END;
$$;

-- Sync orders.payment_status from actual payments after any payment insert/update/delete
-- Replaces manual payment_status updates in app code with a reliable DB trigger
CREATE OR REPLACE FUNCTION public.tg_sync_order_payment_status()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_order_id uuid;
  v_paid     numeric(12,2);
  v_total    numeric(12,2);
BEGIN
  v_order_id := COALESCE(NEW.order_id, OLD.order_id);

  SELECT COALESCE(SUM(amount), 0)
    INTO v_paid
  FROM public.payments
  WHERE order_id = v_order_id
    AND status = 'paid';

  SELECT total_amount
    INTO v_total
  FROM public.orders
  WHERE id = v_order_id;

  UPDATE public.orders
  SET
    payment_status = CASE
      WHEN v_paid <= 0                              THEN 'pending'::text
      WHEN v_paid < COALESCE(v_total, 0)            THEN 'partial'::text
      ELSE                                               'paid'::text
    END,
    paid_at = CASE
      WHEN v_paid >= COALESCE(v_total, 0) AND COALESCE(v_total, 0) > 0
           THEN COALESCE(paid_at, now())
      ELSE paid_at
    END,
    updated_at = now()
  WHERE id = v_order_id;

  RETURN NULL;
END;
$$;

-- -----------------------------------------------------------------------------
-- 3. UPDATED_AT TRIGGERS
-- Auto-keep updated_at in sync — no more manual .update({ updated_at: new Date() })
-- -----------------------------------------------------------------------------

DROP TRIGGER IF EXISTS trg_users_set_updated_at           ON public.users;
DROP TRIGGER IF EXISTS trg_user_profiles_set_updated_at   ON public.user_profiles;
DROP TRIGGER IF EXISTS trg_user_addresses_set_updated_at  ON public.user_addresses;
DROP TRIGGER IF EXISTS trg_categories_set_updated_at      ON public.categories;
DROP TRIGGER IF EXISTS trg_products_set_updated_at        ON public.products;
DROP TRIGGER IF EXISTS trg_product_variants_set_updated_at ON public.product_variants;
DROP TRIGGER IF EXISTS trg_orders_set_updated_at          ON public.orders;
DROP TRIGGER IF EXISTS trg_order_addresses_set_updated_at ON public.order_addresses;
DROP TRIGGER IF EXISTS trg_order_items_set_updated_at     ON public.order_items;
DROP TRIGGER IF EXISTS trg_payments_set_updated_at        ON public.payments;
DROP TRIGGER IF EXISTS trg_payment_configs_set_updated_at ON public.payment_configs;
DROP TRIGGER IF EXISTS trg_print_jobs_set_updated_at      ON public.print_jobs;
DROP TRIGGER IF EXISTS trg_system_settings_set_updated_at ON public.system_settings;

CREATE TRIGGER trg_users_set_updated_at
BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TRIGGER trg_user_profiles_set_updated_at
BEFORE UPDATE ON public.user_profiles
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TRIGGER trg_user_addresses_set_updated_at
BEFORE UPDATE ON public.user_addresses
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TRIGGER trg_categories_set_updated_at
BEFORE UPDATE ON public.categories
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TRIGGER trg_products_set_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TRIGGER trg_product_variants_set_updated_at
BEFORE UPDATE ON public.product_variants
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TRIGGER trg_orders_set_updated_at
BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TRIGGER trg_order_items_set_updated_at
BEFORE UPDATE ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TRIGGER trg_payments_set_updated_at
BEFORE UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TRIGGER trg_payment_configs_set_updated_at
BEFORE UPDATE ON public.payment_configs
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TRIGGER trg_print_jobs_set_updated_at
BEFORE UPDATE ON public.print_jobs
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TRIGGER trg_system_settings_set_updated_at
BEFORE UPDATE ON public.system_settings
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- -----------------------------------------------------------------------------
-- 4. NOTIFICATION read_at TRIGGER
-- Automatically sets/clears read_at when is_read changes
-- -----------------------------------------------------------------------------

DROP TRIGGER IF EXISTS trg_notifications_set_read_at ON public.notifications;
CREATE TRIGGER trg_notifications_set_read_at
BEFORE INSERT OR UPDATE OF is_read, read_at ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.tg_set_notification_read_at();

-- -----------------------------------------------------------------------------
-- 5. PAYMENT STATUS SYNC TRIGGER
-- After any payment row changes, DB recomputes orders.payment_status
-- Eliminates payment_status drift caused by missed app-code updates
-- -----------------------------------------------------------------------------

DROP TRIGGER IF EXISTS trg_payments_sync_order_payment_status ON public.payments;
CREATE TRIGGER trg_payments_sync_order_payment_status
AFTER INSERT OR UPDATE OR DELETE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.tg_sync_order_payment_status();

-- -----------------------------------------------------------------------------
-- 6. NEW COLUMNS (additive only — no existing columns touched)
-- -----------------------------------------------------------------------------

-- orders.shipping_fee — standard in v2; default 0 so existing rows are unaffected
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS shipping_fee numeric(12,2) NOT NULL DEFAULT 0
    CONSTRAINT orders_shipping_fee_chk CHECK (shipping_fee >= 0);

-- orders.outstanding_amount — computed: how much customer still owes
-- (total_amount - deposit_amount, floored at 0)
-- Safe additive column; existing rows get value computed from existing columns.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'orders'
      AND column_name  = 'outstanding_amount'
  ) THEN
    ALTER TABLE public.orders
      ADD COLUMN outstanding_amount numeric(12,2)
        GENERATED ALWAYS AS (GREATEST(total_amount - deposit_amount, 0::numeric)) STORED;
  END IF;
END $$;

-- order_items.product_variant_id — explicit FK to variants (v2 pattern)
-- Allows stock adjustment to use variant ID directly instead of name/sku lookup
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS product_variant_id uuid
    REFERENCES public.product_variants(id) ON DELETE SET NULL;

-- files.checksum_sha256 — deduplication + integrity check
ALTER TABLE public.files
  ADD COLUMN IF NOT EXISTS checksum_sha256 text;

-- files.original_filename — store upload filename separately from storage key
ALTER TABLE public.files
  ADD COLUMN IF NOT EXISTS original_filename text;

-- files.object_key — structured R2 key (bucket/path/file)
ALTER TABLE public.files
  ADD COLUMN IF NOT EXISTS object_key text;

-- auth_sessions — enhanced session tracking (used by NextAuth v5 adapter)
-- IP + user_agent columns help with audit and suspicious login detection
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS ip_address inet,
  ADD COLUMN IF NOT EXISTS user_agent text,
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

-- -----------------------------------------------------------------------------
-- 7. GIN TRGM INDEXES — fuzzy search
-- Enables fast ILIKE / similarity() queries on product names and order codes
-- Requires pg_trgm extension (added above)
-- -----------------------------------------------------------------------------

-- Product search by name (admin catalog, storefront search)
CREATE INDEX IF NOT EXISTS products_name_trgm_idx
  ON public.products USING gin (name gin_trgm_ops);

-- Product search by SKU
CREATE INDEX IF NOT EXISTS products_sku_trgm_idx
  ON public.products USING gin (sku gin_trgm_ops)
  WHERE sku IS NOT NULL;

-- Order code search (admin search bar, customer order lookup)
CREATE INDEX IF NOT EXISTS orders_order_code_trgm_idx
  ON public.orders USING gin (order_code gin_trgm_ops);

-- Customer name search via user_profiles
CREATE INDEX IF NOT EXISTS user_profiles_full_name_trgm_idx
  ON public.user_profiles USING gin (full_name gin_trgm_ops)
  WHERE full_name IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 8. ADDITIONAL V2 INDEXES (complement the 20260402_performance_indexes.sql set)
-- -----------------------------------------------------------------------------

-- orders: one-default-address constraint index (also in user_addresses)
CREATE UNIQUE INDEX IF NOT EXISTS user_addresses_one_default_per_user_idx
  ON public.user_addresses (user_id)
  WHERE is_default = true;

-- orders: filter by payment_status (revenue stats, admin payment view)
CREATE INDEX IF NOT EXISTS orders_payment_status_created_idx
  ON public.orders (payment_status, created_at DESC)
  WHERE archived_at IS NULL;

-- orders: filter by fulfillment_status (fulfillment queue)
CREATE INDEX IF NOT EXISTS orders_fulfillment_status_created_idx
  ON public.orders (fulfillment_status, created_at DESC)
  WHERE archived_at IS NULL;

-- orders: shipping code lookup (carrier tracking)
CREATE INDEX IF NOT EXISTS orders_shipping_code_idx
  ON public.orders (shipping_code)
  WHERE shipping_code IS NOT NULL;

-- order_items: variant FK (new column)
CREATE INDEX IF NOT EXISTS order_items_variant_idx
  ON public.order_items (product_variant_id)
  WHERE product_variant_id IS NOT NULL;

-- order_items: production status per order (print queue view)
CREATE INDEX IF NOT EXISTS order_items_order_production_status_idx
  ON public.order_items (order_id, production_status);

-- design_versions: sort by version_no within order (latest version query)
CREATE INDEX IF NOT EXISTS design_versions_order_created_idx
  ON public.design_versions (order_id, created_at DESC);

-- payments: gateway reference lookup (webhook matching)
CREATE INDEX IF NOT EXISTS payments_order_created_idx
  ON public.payments (order_id, created_at DESC);

-- print_jobs: status queue view
CREATE INDEX IF NOT EXISTS print_jobs_status_created_idx
  ON public.print_jobs (status, created_at DESC);

-- activity_logs: user timeline
CREATE INDEX IF NOT EXISTS activity_logs_user_created_idx
  ON public.activity_logs (user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

-- files: checksum deduplication lookup
CREATE INDEX IF NOT EXISTS files_checksum_idx
  ON public.files (checksum_sha256)
  WHERE checksum_sha256 IS NOT NULL;

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON FUNCTION public.tg_set_updated_at()              IS 'Auto-updates updated_at column on every UPDATE — schema v2 pattern';
COMMENT ON FUNCTION public.tg_set_notification_read_at()    IS 'Auto-sets/clears read_at when notification.is_read changes';
COMMENT ON FUNCTION public.tg_sync_order_payment_status()   IS 'Recomputes orders.payment_status from sum of paid payments after each payment change';

COMMENT ON COLUMN public.orders.shipping_fee                IS 'Shipping charge added to order total (v2 field, default 0)';
COMMENT ON COLUMN public.orders.outstanding_amount          IS 'Generated: total_amount - deposit_amount (≥ 0) — how much customer still owes';
COMMENT ON COLUMN public.order_items.product_variant_id     IS 'Explicit FK to product_variants — enables direct stock deduction by variant id';
COMMENT ON COLUMN public.files.checksum_sha256              IS 'SHA-256 of file content for deduplication and integrity checks';
COMMENT ON COLUMN public.files.original_filename            IS 'Original filename from client upload';
