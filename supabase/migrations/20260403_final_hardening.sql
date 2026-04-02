-- =============================================================================
-- Migration: Final Hardening — Close Remaining Schema Gaps
-- =============================================================================
-- Addresses remaining 8/10 → 9.5/10 items that are safe to apply without
-- changing app code. Items requiring NextAuth / app-layer changes are in:
--   supabase/migrations/20260403_app_change_required.sql (run AFTER updating app)
--
-- SAFE to run on live data (all statements idempotent):
--   - DO blocks check existence before adding
--   - No column renames or drops
--   - No changes to existing data types
-- =============================================================================

-- =============================================================================
-- 1. NOTIFICATIONS: is_read / read_at CONSISTENCY CHECK
-- The trigger tg_set_notification_read_at keeps these in sync on INSERT/UPDATE,
-- but a CHECK constraint prevents data from being inserted in an invalid state
-- even if the trigger is bypassed (direct SQL, seed scripts, etc.)
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'notifications_read_consistency_chk'
      AND conrelid = 'public.notifications'::regclass
  ) THEN
    -- Fix any inconsistent rows first: if is_read=false ensure read_at is null
    UPDATE public.notifications
    SET read_at = NULL
    WHERE is_read = false AND read_at IS NOT NULL;

    ALTER TABLE public.notifications
      ADD CONSTRAINT notifications_read_consistency_chk CHECK (
        (is_read = false AND read_at IS NULL)
        OR
        (is_read = true)
      );
  END IF;
END $$;

-- =============================================================================
-- 2. VERIFY / RE-APPLY UNIQUE CONSTRAINTS
-- These were added with DO blocks in 20260402_integrity_constraints.sql.
-- Re-stated here explicitly so they appear clearly in schema introspection.
-- =============================================================================

-- accounts: one OAuth link per provider per account
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'accounts_provider_account_unique'
      AND conrelid = 'public.accounts'::regclass
  ) THEN
    ALTER TABLE public.accounts
      ADD CONSTRAINT accounts_provider_account_unique
      UNIQUE (provider, "providerAccountId");
  END IF;
END $$;

-- design_versions: no duplicate version numbers within same order
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'design_versions_order_version_unique'
      AND conrelid = 'public.design_versions'::regclass
  ) THEN
    ALTER TABLE public.design_versions
      ADD CONSTRAINT design_versions_order_version_unique
      UNIQUE (order_id, version_number);
  END IF;
END $$;

-- order_revisions: no duplicate revision numbers within same order
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'order_revisions_order_version_unique'
      AND conrelid = 'public.order_revisions'::regclass
  ) THEN
    ALTER TABLE public.order_revisions
      ADD CONSTRAINT order_revisions_order_version_unique
      UNIQUE (order_id, version);
  END IF;
END $$;

-- user_addresses: exactly one default address per user
CREATE UNIQUE INDEX IF NOT EXISTS user_addresses_one_default_per_user_idx
  ON public.user_addresses (user_id)
  WHERE is_default = true;

-- product_variants: unique SKU when set (partial — nulls excluded)
CREATE UNIQUE INDEX IF NOT EXISTS product_variants_sku_unique_idx
  ON public.product_variants (sku)
  WHERE sku IS NOT NULL;

-- =============================================================================
-- 3. VERIFY / RE-APPLY CHECK CONSTRAINTS FROM INTEGRITY MIGRATION
-- These were wrapped in DO blocks; re-stated explicitly for clarity.
-- =============================================================================

DO $$
BEGIN
  -- orders.discount <= subtotal
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'orders_discount_lte_subtotal_chk'
      AND conrelid = 'public.orders'::regclass
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM public.orders WHERE discount > subtotal) THEN
      ALTER TABLE public.orders
        ADD CONSTRAINT orders_discount_lte_subtotal_chk CHECK (discount <= subtotal);
    END IF;
  END IF;

  -- orders.deposit_amount <= total_amount
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'orders_deposit_lte_total_chk'
      AND conrelid = 'public.orders'::regclass
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM public.orders WHERE deposit_amount > total_amount) THEN
      ALTER TABLE public.orders
        ADD CONSTRAINT orders_deposit_lte_total_chk CHECK (deposit_amount <= total_amount);
    END IF;
  END IF;

  -- product_variants.reserved_stock <= stock
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'product_variants_reserved_lte_stock_chk'
      AND conrelid = 'public.product_variants'::regclass
  ) THEN
    -- Cap any violating rows first
    UPDATE public.product_variants SET reserved_stock = stock WHERE reserved_stock > stock;
    ALTER TABLE public.product_variants
      ADD CONSTRAINT product_variants_reserved_lte_stock_chk CHECK (reserved_stock <= stock);
  END IF;
END $$;

-- =============================================================================
-- 4. ADDITIVE COLUMNS
-- =============================================================================

-- order_notes: add updated_at for audit trail (schema had no updated_at on this table)
ALTER TABLE public.order_notes
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS trg_order_notes_set_updated_at ON public.order_notes;
CREATE TRIGGER trg_order_notes_set_updated_at
BEFORE UPDATE ON public.order_notes
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- print_jobs: add updated_at (schema had no updated_at on this table)
ALTER TABLE public.print_jobs
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS trg_print_jobs_set_updated_at ON public.print_jobs;
CREATE TRIGGER trg_print_jobs_set_updated_at
BEFORE UPDATE ON public.print_jobs
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =============================================================================
-- 5. INDEX GAPS — items confirmed missing from previous migrations
-- =============================================================================

-- sessions: userId FK — camelCase preserved to match actual column name
CREATE INDEX IF NOT EXISTS idx_sessions_user_id
  ON public.sessions ("userId");

-- notifications: user feed (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_notifications_user_read_created
  ON public.notifications (user_id, is_read, created_at DESC);

-- design_versions: per-order version listing
CREATE INDEX IF NOT EXISTS idx_design_versions_order_created
  ON public.design_versions (order_id, created_at DESC);

-- order_revisions: per-order revision listing
CREATE INDEX IF NOT EXISTS idx_order_revisions_order_created
  ON public.order_revisions (order_id, created_at DESC);

-- order_notes: per-order notes listing
CREATE INDEX IF NOT EXISTS idx_order_notes_order_created
  ON public.order_notes (order_id, created_at DESC);

-- payment_events: per-payment event log
CREATE INDEX IF NOT EXISTS idx_payment_events_payment_created
  ON public.payment_events (payment_id, created_at DESC);

-- print_jobs: by status for print queue view
CREATE INDEX IF NOT EXISTS idx_print_jobs_status_created
  ON public.print_jobs (status, created_at DESC);

-- admin_audit_log: admin action timeline
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_admin_created
  ON public.admin_audit_log (admin_id, created_at DESC);

-- activity_logs: user timeline
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_created
  ON public.activity_logs (user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

-- files: checksum deduplication
CREATE INDEX IF NOT EXISTS idx_files_checksum
  ON public.files (checksum_sha256)
  WHERE checksum_sha256 IS NOT NULL;

-- =============================================================================
-- 6. SYSTEM SETTINGS SEED (idempotent)
-- =============================================================================

-- system_settings PK column is "key" (not "setting_key")
INSERT INTO public.system_settings (key, value, label, description, group_name, is_public)
VALUES
  ('site.name',           '"Miniver Lab"'::jsonb,       'Site Name',            'Display name of the store',              'general', true),
  ('site.currency',       '"VND"'::jsonb,               'Default Currency',     'Currency code for all prices',           'general', true),
  ('site.email',          '"hello@miniver.lab"'::jsonb, 'Contact Email',        'Primary contact email',                  'general', true),
  ('orders.deposit_ratio','0.5'::jsonb,                 'Default Deposit %',    '50% deposit for custom/printing orders', 'orders',  false),
  ('print.fdm_gram_rate', '700'::jsonb,                 'FDM Price/gram (VND)', '700 VND per gram filament',              'printing',false),
  ('print.resin_gram_rate','4000'::jsonb,               'Resin Price/gram (VND)','4000 VND per gram resin',               'printing',false),
  ('print.min_fdm',       '15000'::jsonb,               'Min FDM Order (VND)',  'Minimum charge for FDM print',           'printing',false),
  ('print.min_resin',     '20000'::jsonb,               'Min Resin Order (VND)','Minimum charge for resin print',         'printing',false)
ON CONFLICT (key) DO NOTHING;

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON CONSTRAINT notifications_read_consistency_chk
  ON public.notifications IS 'Enforces: if is_read=false then read_at must be NULL. Complements trigger tg_set_notification_read_at.';

COMMENT ON INDEX user_addresses_one_default_per_user_idx
  IS 'Partial UNIQUE: each user may have at most one default address';

COMMENT ON INDEX product_variants_sku_unique_idx
  IS 'Partial UNIQUE: variant SKUs must be globally unique when set (NULLs allowed)';
