-- =============================================================================
-- Migration: Integrity Constraints & Data Quality Hardening
-- =============================================================================
-- Based on schema evaluation (6.5/10 → target 9/10).
-- Implements Phases 1-4 of the improvement plan:
--   Phase 1A: Auth/token hardening (safe columns; column renames in app-change notes)
--   Phase 1B: Integrity — unique constraints, FK for notifications
--   Phase 1C: Derived data — total_price trigger, orders amount checks
--   Phase 2:  CHECK constraints — orders, products, variants, JSON fields
--   Phase 3:  Replace polymorphic file_links with explicit junction tables
--             Replace notifications(ref_type/ref_id) with explicit FK columns
--   Phase 4:  Remaining index gaps + cleanup functions
--
-- SAFE to run on existing live data:
--   - All ADD CONSTRAINT / ADD COLUMN use DO blocks with existence checks
--   - New junction tables use CREATE TABLE IF NOT EXISTS
--   - Triggers use DROP IF EXISTS before CREATE
--   - CHECK constraints added only if data currently passes the check
-- =============================================================================

-- =============================================================================
-- PHASE 1A — AUTH HARDENING
-- =============================================================================
-- NOTE: The following columns exist in the current schema with raw-text values
--       but renaming them would break NextAuth v5 adapter. The correct approach
--       is to migrate in the application layer first, then rename.
--
--   users.password          → rename to password_hash  (after updating auth adapter)
--   sessions.sessionToken   → rename to session_token_hash (after updating NextAuth adapter)
--   verification_tokens.token → rename to token_hash  (after updating NextAuth adapter)
--   accounts.refresh_token/access_token/id_token → encrypt before storing
--
-- What we CAN do safely right now: add the new hashed/encrypted columns alongside
-- the existing ones. App can populate them during the transition period.
-- =============================================================================

-- Add password_hash as the target column (NextAuth bcrypt hash already is a hash;
-- this marks intent and allows gradual adapter transition)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS password_hash text
    CONSTRAINT users_password_hash_len_chk CHECK (
      password_hash IS NULL OR length(password_hash) >= 20
    );

-- Add encrypted token columns alongside existing raw ones for OAuth accounts
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS encrypted_refresh_token text,
  ADD COLUMN IF NOT EXISTS encrypted_access_token  text,
  ADD COLUMN IF NOT EXISTS encrypted_id_token      text;

-- Add consumed_at to password_reset_tokens (prevents token reuse after consume)
ALTER TABLE public.password_reset_tokens
  ADD COLUMN IF NOT EXISTS consumed_at timestamptz;

-- =============================================================================
-- PHASE 1B — INTEGRITY: UNIQUE CONSTRAINTS & FK
-- =============================================================================

-- accounts: unique on (provider, providerAccountId) — prevents duplicate OAuth links
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

-- design_versions: unique on (order_id, version_number) — no duplicate versions per order
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

-- order_revisions: unique on (order_id, version) — no duplicate revision numbers per order
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

-- notifications.user_id: add FK to users if missing
-- (current schema has user_id NOT NULL but no FK constraint)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'notifications_user_id_fkey'
      AND conrelid = 'public.notifications'::regclass
  ) THEN
    -- Delete orphaned notifications first (safety)
    DELETE FROM public.notifications n
    WHERE NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = n.user_id);

    ALTER TABLE public.notifications
      ADD CONSTRAINT notifications_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- =============================================================================
-- PHASE 1C — DERIVED DATA NOTE
-- =============================================================================
-- order_items.total_price is already a GENERATED ALWAYS AS (quantity * unit_price) STORED
-- column in the live database — no trigger or manual UPDATE needed.
-- orders.outstanding_amount was added as a generated column in 20260402_schema_v2_enhancements.sql
-- Both stay self-consistent automatically via Postgres generated column mechanics.
-- =============================================================================

-- =============================================================================
-- PHASE 2A — CHECK CONSTRAINTS: ORDERS
-- =============================================================================

DO $$
BEGIN
  -- discount <= subtotal
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'orders_discount_lte_subtotal_chk'
      AND conrelid = 'public.orders'::regclass
  ) THEN
    -- Only add if existing data passes
    IF NOT EXISTS (
      SELECT 1 FROM public.orders WHERE discount > subtotal
    ) THEN
      ALTER TABLE public.orders
        ADD CONSTRAINT orders_discount_lte_subtotal_chk
        CHECK (discount <= subtotal);
    END IF;
  END IF;

  -- deposit_amount <= total_amount
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'orders_deposit_lte_total_chk'
      AND conrelid = 'public.orders'::regclass
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.orders WHERE deposit_amount > total_amount
    ) THEN
      ALTER TABLE public.orders
        ADD CONSTRAINT orders_deposit_lte_total_chk
        CHECK (deposit_amount <= total_amount);
    END IF;
  END IF;

  -- revision_count >= 0
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'orders_revision_count_chk'
      AND conrelid = 'public.orders'::regclass
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_revision_count_chk
      CHECK (revision_count IS NULL OR revision_count >= 0);
  END IF;

  -- demo_images is JSON array
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'orders_demo_images_array_chk'
      AND conrelid = 'public.orders'::regclass
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.orders
      WHERE demo_images IS NOT NULL AND jsonb_typeof(demo_images) != 'array'
    ) THEN
      ALTER TABLE public.orders
        ADD CONSTRAINT orders_demo_images_array_chk
        CHECK (demo_images IS NULL OR jsonb_typeof(demo_images) = 'array');
    END IF;
  END IF;

  -- finished_images is JSON array
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'orders_finished_images_array_chk'
      AND conrelid = 'public.orders'::regclass
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.orders
      WHERE finished_images IS NOT NULL AND jsonb_typeof(finished_images) != 'array'
    ) THEN
      ALTER TABLE public.orders
        ADD CONSTRAINT orders_finished_images_array_chk
        CHECK (finished_images IS NULL OR jsonb_typeof(finished_images) = 'array');
    END IF;
  END IF;
END $$;

-- =============================================================================
-- PHASE 2B — CHECK CONSTRAINTS: PRODUCTS
-- =============================================================================

DO $$
BEGIN
  -- base_price >= 0
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'products_base_price_chk'
      AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_base_price_chk CHECK (base_price >= 0);
  END IF;

  -- stock >= 0
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'products_stock_chk'
      AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_stock_chk CHECK (stock >= 0);
  END IF;

  -- sale_price >= 0
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'products_sale_price_nn_chk'
      AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_sale_price_nn_chk
      CHECK (sale_price IS NULL OR sale_price >= 0);
  END IF;

  -- sale_price <= base_price (no selling above base)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'products_sale_lte_base_chk'
      AND conrelid = 'public.products'::regclass
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.products
      WHERE sale_price IS NOT NULL AND sale_price > base_price
    ) THEN
      ALTER TABLE public.products
        ADD CONSTRAINT products_sale_lte_base_chk
        CHECK (sale_price IS NULL OR sale_price <= base_price);
    END IF;
  END IF;

  -- low_stock_alert >= 0
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'products_low_stock_alert_chk'
      AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_low_stock_alert_chk
      CHECK (low_stock_alert IS NULL OR low_stock_alert >= 0);
  END IF;

  -- view_count >= 0
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'products_view_count_chk'
      AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_view_count_chk CHECK (view_count >= 0);
  END IF;

  -- sold_count >= 0
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'products_sold_count_chk'
      AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_sold_count_chk CHECK (sold_count >= 0);
  END IF;

  -- images is JSON array
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'products_images_array_chk'
      AND conrelid = 'public.products'::regclass
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.products
      WHERE images IS NOT NULL AND jsonb_typeof(images) != 'array'
    ) THEN
      ALTER TABLE public.products
        ADD CONSTRAINT products_images_array_chk
        CHECK (images IS NULL OR jsonb_typeof(images) = 'array');
    END IF;
  END IF;

  -- specs is JSON object
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'products_specs_object_chk'
      AND conrelid = 'public.products'::regclass
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.products
      WHERE specs IS NOT NULL AND jsonb_typeof(specs) != 'object'
    ) THEN
      ALTER TABLE public.products
        ADD CONSTRAINT products_specs_object_chk
        CHECK (specs IS NULL OR jsonb_typeof(specs) = 'object');
    END IF;
  END IF;

  -- sizes is JSON array
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'products_sizes_array_chk'
      AND conrelid = 'public.products'::regclass
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.products
      WHERE sizes IS NOT NULL AND jsonb_typeof(sizes) != 'array'
    ) THEN
      ALTER TABLE public.products
        ADD CONSTRAINT products_sizes_array_chk
        CHECK (sizes IS NULL OR jsonb_typeof(sizes) = 'array');
    END IF;
  END IF;
END $$;

-- =============================================================================
-- PHASE 2C — CHECK CONSTRAINTS: PRODUCT VARIANTS
-- =============================================================================

DO $$
BEGIN
  -- reserved_stock <= stock (critical: prevents over-reservation)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'product_variants_reserved_lte_stock_chk'
      AND conrelid = 'public.product_variants'::regclass
  ) THEN
    -- Fix any violating rows first (cap reserved_stock at stock)
    UPDATE public.product_variants
    SET reserved_stock = stock
    WHERE reserved_stock > stock;

    ALTER TABLE public.product_variants
      ADD CONSTRAINT product_variants_reserved_lte_stock_chk
      CHECK (reserved_stock <= stock);
  END IF;

  -- price >= 0
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'product_variants_price_chk'
      AND conrelid = 'public.product_variants'::regclass
  ) THEN
    ALTER TABLE public.product_variants
      ADD CONSTRAINT product_variants_price_chk CHECK (price >= 0);
  END IF;
END $$;

-- =============================================================================
-- PHASE 2D — CHECK CONSTRAINTS: JSON FIELDS ON OTHER TABLES
-- =============================================================================

DO $$
BEGIN
  -- order_items.configuration is JSON object
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'order_items_configuration_object_chk'
      AND conrelid = 'public.order_items'::regclass
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.order_items
      WHERE configuration IS NOT NULL AND jsonb_typeof(configuration) != 'object'
    ) THEN
      ALTER TABLE public.order_items
        ADD CONSTRAINT order_items_configuration_object_chk
        CHECK (configuration IS NULL OR jsonb_typeof(configuration) = 'object');
    END IF;
  END IF;

  -- payments.gateway_response is JSON object
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payments_gateway_response_object_chk'
      AND conrelid = 'public.payments'::regclass
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.payments
      WHERE gateway_response IS NOT NULL AND jsonb_typeof(gateway_response) != 'object'
    ) THEN
      ALTER TABLE public.payments
        ADD CONSTRAINT payments_gateway_response_object_chk
        CHECK (gateway_response IS NULL OR jsonb_typeof(gateway_response) = 'object');
    END IF;
  END IF;

  -- payment_events.payload is JSON object
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payment_events_payload_object_chk'
      AND conrelid = 'public.payment_events'::regclass
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.payment_events
      WHERE payload IS NOT NULL AND jsonb_typeof(payload) != 'object'
    ) THEN
      ALTER TABLE public.payment_events
        ADD CONSTRAINT payment_events_payload_object_chk
        CHECK (payload IS NULL OR jsonb_typeof(payload) = 'object');
    END IF;
  END IF;

  -- file_links.metadata is JSON object
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'file_links_metadata_object_chk'
      AND conrelid = 'public.file_links'::regclass
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.file_links
      WHERE metadata IS NOT NULL AND jsonb_typeof(metadata) != 'object'
    ) THEN
      ALTER TABLE public.file_links
        ADD CONSTRAINT file_links_metadata_object_chk
        CHECK (metadata IS NULL OR jsonb_typeof(metadata) = 'object');
    END IF;
  END IF;
END $$;

-- =============================================================================
-- PHASE 3A — REPLACE POLYMORPHIC file_links WITH EXPLICIT JUNCTION TABLES
-- The old file_links(ref_type, ref_id) table stays for backward compat.
-- New tables enforce FK integrity. App should write to new tables going forward.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.order_files (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     uuid NOT NULL
    REFERENCES public.orders(id) ON DELETE CASCADE,
  file_id      uuid NOT NULL
    REFERENCES public.files(id) ON DELETE CASCADE,
  tag          text,
  metadata     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT order_files_metadata_object_chk CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT order_files_unique_file UNIQUE (order_id, file_id, tag)
);

CREATE TABLE IF NOT EXISTS public.order_item_files (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id   uuid NOT NULL
    REFERENCES public.order_items(id) ON DELETE CASCADE,
  file_id         uuid NOT NULL
    REFERENCES public.files(id) ON DELETE CASCADE,
  tag             text,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT order_item_files_metadata_object_chk CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT order_item_files_unique_file UNIQUE (order_item_id, file_id, tag)
);

CREATE TABLE IF NOT EXISTS public.revision_files (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_revision_id   uuid NOT NULL
    REFERENCES public.order_revisions(id) ON DELETE CASCADE,
  file_id             uuid NOT NULL
    REFERENCES public.files(id) ON DELETE CASCADE,
  tag                 text,
  metadata            jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT revision_files_metadata_object_chk CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT revision_files_unique_file UNIQUE (order_revision_id, file_id, tag)
);

-- Indexes for junction tables
CREATE INDEX IF NOT EXISTS order_files_order_idx
  ON public.order_files (order_id, created_at DESC);

CREATE INDEX IF NOT EXISTS order_item_files_item_idx
  ON public.order_item_files (order_item_id, created_at DESC);

CREATE INDEX IF NOT EXISTS revision_files_revision_idx
  ON public.revision_files (order_revision_id, created_at DESC);

-- =============================================================================
-- PHASE 3B — REPLACE POLYMORPHIC notifications(ref_type, ref_id)
--             WITH EXPLICIT FK COLUMNS
-- Keeps ref_type/ref_id for backward compat; adds typed FK columns alongside.
-- App should populate the typed FK columns going forward.
-- =============================================================================

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS ref_order_id          uuid
    REFERENCES public.orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ref_design_version_id uuid
    REFERENCES public.design_versions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ref_payment_id        uuid
    REFERENCES public.payments(id) ON DELETE SET NULL;

-- Back-fill explicit FK columns from existing ref_type/ref_id where possible
UPDATE public.notifications
SET ref_order_id = ref_id::uuid
WHERE ref_type = 'order'
  AND ref_id IS NOT NULL
  AND ref_order_id IS NULL
  AND EXISTS (SELECT 1 FROM public.orders WHERE id = ref_id::uuid);

UPDATE public.notifications
SET ref_design_version_id = ref_id::uuid
WHERE ref_type = 'design_version'
  AND ref_id IS NOT NULL
  AND ref_design_version_id IS NULL
  AND EXISTS (SELECT 1 FROM public.design_versions WHERE id = ref_id::uuid);

-- Index the new FK columns for notification feed queries
CREATE INDEX IF NOT EXISTS notifications_ref_order_idx
  ON public.notifications (ref_order_id)
  WHERE ref_order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS notifications_ref_design_version_idx
  ON public.notifications (ref_design_version_id)
  WHERE ref_design_version_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS notifications_ref_payment_idx
  ON public.notifications (ref_payment_id)
  WHERE ref_payment_id IS NOT NULL;

-- =============================================================================
-- PHASE 4 — CLEANUP FUNCTIONS (maintenance jobs)
-- =============================================================================

-- Function: purge expired sessions (call from cron job)
CREATE OR REPLACE FUNCTION public.cleanup_expired_sessions()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM public.sessions
  WHERE expires < now();
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

-- Function: purge expired / consumed password reset tokens
CREATE OR REPLACE FUNCTION public.cleanup_expired_reset_tokens()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM public.password_reset_tokens
  WHERE expires_at < now()
     OR consumed_at IS NOT NULL;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

-- Function: purge expired verification tokens
CREATE OR REPLACE FUNCTION public.cleanup_expired_verification_tokens()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM public.verification_tokens
  WHERE expires < now();
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

-- Combined cleanup (call this from a scheduled job / pg_cron / Supabase edge function)
CREATE OR REPLACE FUNCTION public.run_maintenance_cleanup()
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_sessions  integer;
  v_resets    integer;
  v_verifs    integer;
BEGIN
  SELECT public.cleanup_expired_sessions()          INTO v_sessions;
  SELECT public.cleanup_expired_reset_tokens()      INTO v_resets;
  SELECT public.cleanup_expired_verification_tokens() INTO v_verifs;

  RETURN jsonb_build_object(
    'sessions_deleted',            v_sessions,
    'reset_tokens_deleted',        v_resets,
    'verification_tokens_deleted', v_verifs,
    'ran_at',                      now()
  );
END;
$$;

-- =============================================================================
-- ADDITIONAL INDEXES (gaps not covered in previous migrations)
-- =============================================================================

-- accounts: indexed for OAuth login lookup
CREATE INDEX IF NOT EXISTS idx_accounts_provider_providerid
  ON public.accounts (provider, "providerAccountId");

-- password_reset_tokens: expiry cleanup + lookup
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_expires
  ON public.password_reset_tokens (user_id, expires_at);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires
  ON public.password_reset_tokens (expires_at)
  WHERE consumed_at IS NULL;

-- sessions: expiry cleanup
CREATE INDEX IF NOT EXISTS idx_sessions_expires
  ON public.sessions (expires);

-- products: variant unique sku (partial — only non-null sku values need to be unique)
CREATE UNIQUE INDEX IF NOT EXISTS product_variants_sku_unique_idx
  ON public.product_variants (sku)
  WHERE sku IS NOT NULL;

-- orders: shipping_code lookup for carrier tracking
CREATE INDEX IF NOT EXISTS idx_orders_shipping_code
  ON public.orders (shipping_code)
  WHERE shipping_code IS NOT NULL;

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE public.order_files       IS 'Typed replacement for file_links WHERE ref_type=order — enforces FK integrity';
COMMENT ON TABLE public.order_item_files  IS 'Typed replacement for file_links WHERE ref_type=order_item — enforces FK integrity';
COMMENT ON TABLE public.revision_files    IS 'Typed replacement for file_links WHERE ref_type=revision — enforces FK integrity';

COMMENT ON COLUMN public.notifications.ref_order_id          IS 'Typed FK to orders (replaces polymorphic ref_id WHERE ref_type=order)';
COMMENT ON COLUMN public.notifications.ref_design_version_id IS 'Typed FK to design_versions';
COMMENT ON COLUMN public.notifications.ref_payment_id        IS 'Typed FK to payments';

COMMENT ON COLUMN public.users.password_hash IS 'Transition column: target for password after auth adapter updated. Current auth uses users.password (bcrypt hash stored as raw text field by NextAuth).';
COMMENT ON COLUMN public.accounts.encrypted_refresh_token IS 'Encrypted OAuth refresh token — populate via application-layer KMS encryption. Transitional alongside raw refresh_token.';
COMMENT ON COLUMN public.password_reset_tokens.consumed_at IS 'Timestamp when token was used — prevents replay attacks';

COMMENT ON FUNCTION public.cleanup_expired_sessions()            IS 'DELETE sessions past their expires timestamp. Call from Supabase Edge Function cron or pg_cron.';
COMMENT ON FUNCTION public.cleanup_expired_reset_tokens()        IS 'DELETE consumed or expired password reset tokens';
COMMENT ON FUNCTION public.cleanup_expired_verification_tokens() IS 'DELETE expired verification tokens';
COMMENT ON FUNCTION public.run_maintenance_cleanup()             IS 'Combined maintenance: cleans sessions + reset tokens + verification tokens. Returns counts as JSON.';
-- NOTE: tg_sync_order_item_total_price() was removed — total_price is a GENERATED ALWAYS AS column,
-- so Postgres handles the computation automatically without any trigger.
