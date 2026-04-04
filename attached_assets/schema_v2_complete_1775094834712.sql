
-- schema_v2_complete.sql
-- PostgreSQL production-ready schema for:
-- ecommerce + custom design / printing orders
--
-- Design goals:
-- - consistent snake_case naming
-- - strong relational integrity
-- - secure auth/session/token storage
-- - removal of polymorphic ref_type/ref_id where possible
-- - good default indexing for production workloads
-- - deterministic totals via triggers
--
-- Recommended PostgreSQL version: 14+

SET statement_timeout = 0;
SET lock_timeout = '5s';

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- =========================================================
-- 1) ENUM TYPES
-- =========================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role_enum') THEN
    CREATE TYPE public.user_role_enum AS ENUM ('customer', 'staff', 'admin');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_type_enum') THEN
    CREATE TYPE public.order_type_enum AS ENUM ('ready_made', 'custom', 'printing');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status_enum') THEN
    CREATE TYPE public.order_status_enum AS ENUM (
      'draft',
      'pending_confirmation',
      'confirmed',
      'in_design',
      'in_revision',
      'approved',
      'in_production',
      'ready_to_ship',
      'shipped',
      'completed',
      'cancelled'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status_enum') THEN
    CREATE TYPE public.payment_status_enum AS ENUM (
      'pending',
      'partial',
      'paid',
      'failed',
      'refunded',
      'cancelled'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method_enum') THEN
    CREATE TYPE public.payment_method_enum AS ENUM (
      'qr',
      'bank_transfer',
      'card',
      'cash',
      'wallet'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fulfillment_status_enum') THEN
    CREATE TYPE public.fulfillment_status_enum AS ENUM (
      'pending',
      'queued',
      'in_production',
      'packed',
      'shipped',
      'completed',
      'cancelled'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_item_type_enum') THEN
    CREATE TYPE public.order_item_type_enum AS ENUM (
      'product',
      'custom_design',
      'service',
      'fee'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'production_status_enum') THEN
    CREATE TYPE public.production_status_enum AS ENUM (
      'waiting',
      'queued',
      'printing',
      'post_processing',
      'done',
      'cancelled'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'revision_status_enum') THEN
    CREATE TYPE public.revision_status_enum AS ENUM (
      'pending',
      'approved',
      'rejected'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'design_version_status_enum') THEN
    CREATE TYPE public.design_version_status_enum AS ENUM (
      'pending_review',
      'approved',
      'rejected'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'print_job_status_enum') THEN
    CREATE TYPE public.print_job_status_enum AS ENUM (
      'waiting',
      'queued',
      'printing',
      'paused',
      'completed',
      'failed',
      'cancelled'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_type_enum') THEN
    CREATE TYPE public.notification_type_enum AS ENUM (
      'design_approved',
      'design_rejected',
      'design_uploaded',
      'order_status',
      'payment',
      'system'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'note_type_enum') THEN
    CREATE TYPE public.note_type_enum AS ENUM (
      'customer',
      'staff',
      'admin',
      'system'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'file_provider_enum') THEN
    CREATE TYPE public.file_provider_enum AS ENUM (
      'r2',
      's3',
      'cloudinary',
      'local',
      'external'
    );
  END IF;
END $$;

CREATE SEQUENCE IF NOT EXISTS public.order_code_seq;

-- =========================================================
-- 2) HELPER FUNCTIONS
-- =========================================================

CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

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

CREATE OR REPLACE FUNCTION public.tg_generate_order_code()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.order_code IS NULL OR btrim(NEW.order_code) = '' THEN
    NEW.order_code :=
      'ORD-' ||
      to_char(now(), 'YYYYMMDD') ||
      '-' ||
      lpad(nextval('public.order_code_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_assign_order_item_line_no()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.line_no IS NULL THEN
    SELECT COALESCE(MAX(line_no), 0) + 1
      INTO NEW.line_no
    FROM public.order_items
    WHERE order_id = NEW.order_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_recompute_order_amounts()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_order_id uuid;
BEGIN
  v_order_id := COALESCE(NEW.order_id, OLD.order_id);

  UPDATE public.orders o
  SET subtotal = COALESCE((
        SELECT SUM(oi.total_price)
        FROM public.order_items oi
        WHERE oi.order_id = v_order_id
      ), 0),
      total_amount = GREATEST(
        COALESCE((
          SELECT SUM(oi.total_price)
          FROM public.order_items oi
          WHERE oi.order_id = v_order_id
        ), 0)
        - COALESCE(o.discount, 0)
        + COALESCE(o.shipping_fee, 0),
        0
      ),
      updated_at = now()
  WHERE o.id = v_order_id;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_sync_order_payment_status()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_order_id uuid;
  v_paid numeric(12,2);
  v_total numeric(12,2);
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
  SET payment_status = CASE
        WHEN v_paid <= 0 THEN 'pending'
        WHEN v_paid < COALESCE(v_total, 0) THEN 'partial'
        ELSE 'paid'
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

CREATE OR REPLACE FUNCTION public.tg_assert_staff_or_admin()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_role public.user_role_enum;
BEGIN
  SELECT role
    INTO v_role
  FROM public.users
  WHERE id = NEW.admin_user_id;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'admin_user_id % does not exist', NEW.admin_user_id;
  END IF;

  IF v_role NOT IN ('staff', 'admin') THEN
    RAISE EXCEPTION 'user % is not staff/admin', NEW.admin_user_id;
  END IF;

  RETURN NEW;
END;
$$;

-- =========================================================
-- 3) CORE IDENTITY / AUTH
-- =========================================================

CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email citext NOT NULL UNIQUE,
  password_hash text,
  role public.user_role_enum NOT NULL DEFAULT 'customer',
  is_active boolean NOT NULL DEFAULT true,
  email_verified_at timestamptz,
  customer_code text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT users_email_not_blank_chk CHECK (length(btrim(email::text)) > 3),
  CONSTRAINT users_password_hash_chk CHECK (
    password_hash IS NULL OR length(password_hash) >= 20
  )
);

CREATE TABLE IF NOT EXISTS public.user_profiles (
  user_id uuid PRIMARY KEY
    REFERENCES public.users(id) ON DELETE CASCADE,
  full_name text,
  phone text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_profiles_phone_not_blank_chk CHECK (
    phone IS NULL OR length(btrim(phone)) > 0
  )
);

CREATE TABLE IF NOT EXISTS public.user_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL
    REFERENCES public.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  phone text NOT NULL,
  province text,
  district text,
  ward text,
  address_line text NOT NULL,
  postal_code text,
  country_code char(2) NOT NULL DEFAULT 'VN',
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_addresses_full_name_not_blank_chk CHECK (length(btrim(full_name)) > 0),
  CONSTRAINT user_addresses_phone_not_blank_chk CHECK (length(btrim(phone)) > 0),
  CONSTRAINT user_addresses_address_not_blank_chk CHECK (length(btrim(address_line)) > 0)
);

CREATE TABLE IF NOT EXISTS public.auth_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL
    REFERENCES public.users(id) ON DELETE CASCADE,
  provider text NOT NULL,
  provider_account_id text NOT NULL,
  account_type text NOT NULL,
  encrypted_refresh_token text,
  encrypted_access_token text,
  encrypted_id_token text,
  access_token_expires_at timestamptz,
  token_type text,
  scope text,
  session_state text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT auth_accounts_provider_not_blank_chk CHECK (length(btrim(provider)) > 0),
  CONSTRAINT auth_accounts_provider_account_id_not_blank_chk CHECK (length(btrim(provider_account_id)) > 0),
  CONSTRAINT auth_accounts_unique_provider_account UNIQUE (provider, provider_account_id)
);

CREATE TABLE IF NOT EXISTS public.auth_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL
    REFERENCES public.users(id) ON DELETE CASCADE,
  session_token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  last_seen_at timestamptz,
  ip_address inet,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT auth_sessions_token_hash_chk CHECK (length(btrim(session_token_hash)) >= 20)
);

CREATE TABLE IF NOT EXISTS public.verification_tokens (
  identifier citext NOT NULL,
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (identifier, token_hash),
  CONSTRAINT verification_tokens_identifier_not_blank_chk CHECK (length(btrim(identifier::text)) > 0),
  CONSTRAINT verification_tokens_hash_chk CHECK (length(btrim(token_hash)) >= 20)
);

CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL
    REFERENCES public.users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT password_reset_tokens_hash_chk CHECK (length(btrim(token_hash)) >= 20)
);

-- =========================================================
-- 4) CATALOG
-- =========================================================

CREATE TABLE IF NOT EXISTS public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid
    REFERENCES public.categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  sort_order smallint NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT categories_name_not_blank_chk CHECK (length(btrim(name)) > 0),
  CONSTRAINT categories_slug_not_blank_chk CHECK (length(btrim(slug)) > 0)
);

CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid
    REFERENCES public.categories(id) ON DELETE SET NULL,
  sku text UNIQUE,
  slug text UNIQUE,
  name text NOT NULL,
  short_description text,
  description text,
  base_price numeric(12,2) NOT NULL DEFAULT 0,
  sale_price numeric(12,2),
  currency_code char(3) NOT NULL DEFAULT 'VND',
  stock integer NOT NULL DEFAULT 0,
  reserved_stock integer NOT NULL DEFAULT 0,
  images jsonb NOT NULL DEFAULT '[]'::jsonb,
  specs jsonb NOT NULL DEFAULT '{}'::jsonb,
  sizes jsonb NOT NULL DEFAULT '[]'::jsonb,
  tags text[] NOT NULL DEFAULT '{}'::text[],
  is_active boolean NOT NULL DEFAULT false,
  is_featured boolean NOT NULL DEFAULT false,
  low_stock_alert integer NOT NULL DEFAULT 5,
  view_count bigint NOT NULL DEFAULT 0,
  sold_count bigint NOT NULL DEFAULT 0,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT products_name_not_blank_chk CHECK (length(btrim(name)) > 0),
  CONSTRAINT products_base_price_chk CHECK (base_price >= 0),
  CONSTRAINT products_sale_price_chk CHECK (sale_price IS NULL OR sale_price >= 0),
  CONSTRAINT products_sale_lte_base_chk CHECK (sale_price IS NULL OR sale_price <= base_price),
  CONSTRAINT products_stock_chk CHECK (stock >= 0),
  CONSTRAINT products_reserved_stock_chk CHECK (reserved_stock >= 0 AND reserved_stock <= stock),
  CONSTRAINT products_low_stock_alert_chk CHECK (low_stock_alert >= 0),
  CONSTRAINT products_view_count_chk CHECK (view_count >= 0),
  CONSTRAINT products_sold_count_chk CHECK (sold_count >= 0),
  CONSTRAINT products_images_array_chk CHECK (jsonb_typeof(images) = 'array'),
  CONSTRAINT products_specs_object_chk CHECK (jsonb_typeof(specs) = 'object'),
  CONSTRAINT products_sizes_array_chk CHECK (jsonb_typeof(sizes) = 'array')
);

CREATE TABLE IF NOT EXISTS public.product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL
    REFERENCES public.products(id) ON DELETE CASCADE,
  sku text,
  name text NOT NULL,
  price numeric(12,2) NOT NULL,
  stock integer NOT NULL DEFAULT 0,
  reserved_stock integer NOT NULL DEFAULT 0,
  image_url text,
  images jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_variants_name_not_blank_chk CHECK (length(btrim(name)) > 0),
  CONSTRAINT product_variants_price_chk CHECK (price >= 0),
  CONSTRAINT product_variants_stock_chk CHECK (stock >= 0),
  CONSTRAINT product_variants_reserved_stock_chk CHECK (reserved_stock >= 0 AND reserved_stock <= stock),
  CONSTRAINT product_variants_images_array_chk CHECK (jsonb_typeof(images) = 'array')
);

-- =========================================================
-- 5) FILE STORAGE
-- =========================================================

CREATE TABLE IF NOT EXISTS public.files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider public.file_provider_enum NOT NULL DEFAULT 'r2',
  bucket text,
  object_key text,
  public_url text,
  original_filename text,
  mime_type text,
  size_bytes bigint,
  checksum_sha256 text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id uuid
    REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT files_locator_chk CHECK (
    public_url IS NOT NULL OR (bucket IS NOT NULL AND object_key IS NOT NULL)
  ),
  CONSTRAINT files_size_bytes_chk CHECK (size_bytes IS NULL OR size_bytes >= 0),
  CONSTRAINT files_metadata_object_chk CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT files_unique_storage_object UNIQUE (provider, bucket, object_key)
);

-- =========================================================
-- 6) ORDERS
-- =========================================================

CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_code text NOT NULL UNIQUE,
  user_id uuid
    REFERENCES public.users(id) ON DELETE SET NULL,
  order_type public.order_type_enum NOT NULL DEFAULT 'ready_made',
  status public.order_status_enum NOT NULL DEFAULT 'draft',
  payment_status public.payment_status_enum NOT NULL DEFAULT 'pending',
  fulfillment_status public.fulfillment_status_enum NOT NULL DEFAULT 'pending',
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  discount numeric(12,2) NOT NULL DEFAULT 0,
  shipping_fee numeric(12,2) NOT NULL DEFAULT 0,
  total_amount numeric(12,2) NOT NULL DEFAULT 0,
  deposit_amount numeric(12,2) NOT NULL DEFAULT 0,
  outstanding_amount numeric(12,2)
    GENERATED ALWAYS AS (GREATEST(total_amount - deposit_amount, 0::numeric)) STORED,
  shipping_address_snapshot jsonb,
  notes text,
  admin_notes text,
  shipping_code text,
  confirmed_at timestamptz,
  approved_at timestamptz,
  paid_at timestamptz,
  shipped_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT orders_subtotal_chk CHECK (subtotal >= 0),
  CONSTRAINT orders_discount_chk CHECK (discount >= 0 AND discount <= subtotal),
  CONSTRAINT orders_shipping_fee_chk CHECK (shipping_fee >= 0),
  CONSTRAINT orders_total_amount_chk CHECK (total_amount >= 0),
  CONSTRAINT orders_deposit_amount_chk CHECK (deposit_amount >= 0 AND deposit_amount <= total_amount),
  CONSTRAINT orders_shipping_address_snapshot_chk CHECK (
    shipping_address_snapshot IS NULL OR jsonb_typeof(shipping_address_snapshot) = 'object'
  )
);

CREATE TABLE IF NOT EXISTS public.order_addresses (
  order_id uuid PRIMARY KEY
    REFERENCES public.orders(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  phone text NOT NULL,
  province text,
  district text,
  ward text,
  address_line text NOT NULL,
  postal_code text,
  country_code char(2) NOT NULL DEFAULT 'VN',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT order_addresses_full_name_not_blank_chk CHECK (length(btrim(full_name)) > 0),
  CONSTRAINT order_addresses_phone_not_blank_chk CHECK (length(btrim(phone)) > 0),
  CONSTRAINT order_addresses_address_not_blank_chk CHECK (length(btrim(address_line)) > 0)
);

CREATE TABLE IF NOT EXISTS public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL
    REFERENCES public.orders(id) ON DELETE CASCADE,
  line_no integer,
  product_id uuid
    REFERENCES public.products(id) ON DELETE SET NULL,
  product_variant_id uuid
    REFERENCES public.product_variants(id) ON DELETE SET NULL,
  item_type public.order_item_type_enum NOT NULL DEFAULT 'product',
  name text NOT NULL,
  sku text,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  total_price numeric(12,2)
    GENERATED ALWAYS AS ((quantity::numeric * unit_price)) STORED,
  production_status public.production_status_enum NOT NULL DEFAULT 'waiting',
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT order_items_line_no_chk CHECK (line_no IS NULL OR line_no > 0),
  CONSTRAINT order_items_name_not_blank_chk CHECK (length(btrim(name)) > 0),
  CONSTRAINT order_items_quantity_chk CHECK (quantity > 0),
  CONSTRAINT order_items_unit_price_chk CHECK (unit_price >= 0),
  CONSTRAINT order_items_configuration_object_chk CHECK (jsonb_typeof(configuration) = 'object'),
  CONSTRAINT order_items_unique_line UNIQUE (order_id, line_no)
);

CREATE TABLE IF NOT EXISTS public.order_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL
    REFERENCES public.orders(id) ON DELETE CASCADE,
  author_user_id uuid
    REFERENCES public.users(id) ON DELETE SET NULL,
  note_type public.note_type_enum NOT NULL DEFAULT 'system',
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT order_notes_content_not_blank_chk CHECK (length(btrim(content)) > 0)
);

CREATE TABLE IF NOT EXISTS public.order_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL
    REFERENCES public.orders(id) ON DELETE CASCADE,
  revision_no integer NOT NULL,
  status public.revision_status_enum NOT NULL DEFAULT 'pending',
  feedback text,
  requested_by_user_id uuid
    REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_by_user_id uuid
    REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  CONSTRAINT order_revisions_revision_no_chk CHECK (revision_no > 0),
  CONSTRAINT order_revisions_unique_no UNIQUE (order_id, revision_no)
);

CREATE TABLE IF NOT EXISTS public.design_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL
    REFERENCES public.orders(id) ON DELETE CASCADE,
  revision_id uuid
    REFERENCES public.order_revisions(id) ON DELETE SET NULL,
  version_no integer NOT NULL,
  status public.design_version_status_enum NOT NULL DEFAULT 'pending_review',
  admin_note text,
  user_feedback text,
  created_by_user_id uuid
    REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_by_user_id uuid
    REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  CONSTRAINT design_versions_version_no_chk CHECK (version_no > 0),
  CONSTRAINT design_versions_unique_no UNIQUE (order_id, version_no)
);

CREATE TABLE IF NOT EXISTS public.design_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  design_version_id uuid NOT NULL
    REFERENCES public.design_versions(id) ON DELETE CASCADE,
  file_id uuid NOT NULL
    REFERENCES public.files(id) ON DELETE RESTRICT,
  label text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT design_images_unique_file_per_version UNIQUE (design_version_id, file_id)
);

CREATE TABLE IF NOT EXISTS public.order_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL
    REFERENCES public.orders(id) ON DELETE CASCADE,
  file_id uuid NOT NULL
    REFERENCES public.files(id) ON DELETE CASCADE,
  tag text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT order_files_metadata_object_chk CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT order_files_unique_file UNIQUE (order_id, file_id, tag)
);

CREATE TABLE IF NOT EXISTS public.order_item_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id uuid NOT NULL
    REFERENCES public.order_items(id) ON DELETE CASCADE,
  file_id uuid NOT NULL
    REFERENCES public.files(id) ON DELETE CASCADE,
  tag text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT order_item_files_metadata_object_chk CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT order_item_files_unique_file UNIQUE (order_item_id, file_id, tag)
);

CREATE TABLE IF NOT EXISTS public.revision_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_revision_id uuid NOT NULL
    REFERENCES public.order_revisions(id) ON DELETE CASCADE,
  file_id uuid NOT NULL
    REFERENCES public.files(id) ON DELETE CASCADE,
  tag text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT revision_files_metadata_object_chk CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT revision_files_unique_file UNIQUE (order_revision_id, file_id, tag)
);

-- =========================================================
-- 7) PAYMENTS
-- =========================================================

CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL
    REFERENCES public.orders(id) ON DELETE CASCADE,
  transaction_code text UNIQUE,
  amount numeric(12,2) NOT NULL,
  currency_code char(3) NOT NULL DEFAULT 'VND',
  method public.payment_method_enum NOT NULL DEFAULT 'qr',
  status public.payment_status_enum NOT NULL DEFAULT 'pending',
  gateway_name text,
  gateway_reference text,
  gateway_response jsonb NOT NULL DEFAULT '{}'::jsonb,
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payments_amount_chk CHECK (amount >= 0),
  CONSTRAINT payments_gateway_response_object_chk CHECK (jsonb_typeof(gateway_response) = 'object')
);

CREATE TABLE IF NOT EXISTS public.payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL
    REFERENCES public.payments(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_events_event_type_not_blank_chk CHECK (length(btrim(event_type)) > 0),
  CONSTRAINT payment_events_payload_object_chk CHECK (jsonb_typeof(payload) = 'object')
);

CREATE TABLE IF NOT EXISTS public.payment_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_type public.order_type_enum NOT NULL UNIQUE,
  bank_code text NOT NULL,
  account_no text NOT NULL,
  account_name text NOT NULL,
  qr_template text,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_configs_bank_code_not_blank_chk CHECK (length(btrim(bank_code)) > 0),
  CONSTRAINT payment_configs_account_no_not_blank_chk CHECK (length(btrim(account_no)) > 0),
  CONSTRAINT payment_configs_account_name_not_blank_chk CHECK (length(btrim(account_name)) > 0)
);

-- =========================================================
-- 8) NOTIFICATIONS / LOGS / PRINTING / SETTINGS
-- =========================================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL
    REFERENCES public.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text,
  notification_type public.notification_type_enum NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  ref_order_id uuid
    REFERENCES public.orders(id) ON DELETE SET NULL,
  ref_design_version_id uuid
    REFERENCES public.design_versions(id) ON DELETE SET NULL,
  ref_payment_id uuid
    REFERENCES public.payments(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notifications_title_not_blank_chk CHECK (length(btrim(title)) > 0),
  CONSTRAINT notifications_read_consistency_chk CHECK (
    (is_read = false AND read_at IS NULL)
    OR
    (is_read = true)
  )
);

CREATE TABLE IF NOT EXISTS public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid
    REFERENCES public.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT activity_logs_action_not_blank_chk CHECK (length(btrim(action)) > 0),
  CONSTRAINT activity_logs_metadata_object_chk CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL
    REFERENCES public.users(id) ON DELETE RESTRICT,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_audit_logs_action_not_blank_chk CHECK (length(btrim(action)) > 0),
  CONSTRAINT admin_audit_logs_resource_type_not_blank_chk CHECK (length(btrim(resource_type)) > 0),
  CONSTRAINT admin_audit_logs_details_object_chk CHECK (jsonb_typeof(details) = 'object')
);

CREATE TABLE IF NOT EXISTS public.print_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id uuid NOT NULL UNIQUE
    REFERENCES public.order_items(id) ON DELETE CASCADE,
  printer_name text,
  material text,
  color text,
  infill_percent smallint,
  layer_height_mm numeric(5,2),
  estimated_hours numeric(8,2),
  estimated_grams numeric(10,2),
  status public.print_job_status_enum NOT NULL DEFAULT 'waiting',
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT print_jobs_infill_chk CHECK (infill_percent IS NULL OR (infill_percent >= 0 AND infill_percent <= 100)),
  CONSTRAINT print_jobs_layer_height_chk CHECK (layer_height_mm IS NULL OR layer_height_mm > 0),
  CONSTRAINT print_jobs_estimated_hours_chk CHECK (estimated_hours IS NULL OR estimated_hours >= 0),
  CONSTRAINT print_jobs_estimated_grams_chk CHECK (estimated_grams IS NULL OR estimated_grams >= 0)
);

CREATE TABLE IF NOT EXISTS public.system_settings (
  setting_key text PRIMARY KEY,
  value jsonb NOT NULL,
  label text,
  description text,
  group_name text NOT NULL DEFAULT 'general',
  is_public boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT system_settings_setting_key_not_blank_chk CHECK (length(btrim(setting_key)) > 0)
);

-- =========================================================
-- 9) INDEXES
-- =========================================================

-- users / auth
CREATE INDEX IF NOT EXISTS users_role_active_idx
  ON public.users (role, is_active);

CREATE INDEX IF NOT EXISTS users_created_at_idx
  ON public.users (created_at DESC);

CREATE INDEX IF NOT EXISTS user_profiles_full_name_trgm_idx
  ON public.user_profiles USING gin (full_name gin_trgm_ops);

CREATE UNIQUE INDEX IF NOT EXISTS user_addresses_one_default_idx
  ON public.user_addresses (user_id)
  WHERE is_default = true;

CREATE INDEX IF NOT EXISTS user_addresses_user_created_idx
  ON public.user_addresses (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS auth_accounts_user_id_idx
  ON public.auth_accounts (user_id);

CREATE INDEX IF NOT EXISTS auth_sessions_user_id_idx
  ON public.auth_sessions (user_id);

CREATE INDEX IF NOT EXISTS auth_sessions_expires_at_idx
  ON public.auth_sessions (expires_at);

CREATE INDEX IF NOT EXISTS verification_tokens_expires_at_idx
  ON public.verification_tokens (expires_at);

CREATE INDEX IF NOT EXISTS password_reset_tokens_user_expires_idx
  ON public.password_reset_tokens (user_id, expires_at);

-- catalog
CREATE INDEX IF NOT EXISTS categories_parent_sort_idx
  ON public.categories (parent_id, sort_order);

CREATE INDEX IF NOT EXISTS products_category_active_idx
  ON public.products (category_id, is_active)
  WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS products_featured_idx
  ON public.products (is_featured, created_at DESC)
  WHERE archived_at IS NULL AND is_active = true;

CREATE INDEX IF NOT EXISTS products_name_trgm_idx
  ON public.products USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS products_sku_trgm_idx
  ON public.products USING gin (sku gin_trgm_ops);

CREATE INDEX IF NOT EXISTS products_slug_idx
  ON public.products (slug);

CREATE INDEX IF NOT EXISTS products_tags_gin_idx
  ON public.products USING gin (tags);

CREATE INDEX IF NOT EXISTS product_variants_product_active_sort_idx
  ON public.product_variants (product_id, is_active, sort_order);

CREATE UNIQUE INDEX IF NOT EXISTS product_variants_sku_uidx
  ON public.product_variants (sku)
  WHERE sku IS NOT NULL;

-- files
CREATE INDEX IF NOT EXISTS files_created_by_idx
  ON public.files (created_by_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS files_checksum_idx
  ON public.files (checksum_sha256);

-- orders
CREATE INDEX IF NOT EXISTS orders_user_created_idx
  ON public.orders (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS orders_status_created_idx
  ON public.orders (status, created_at DESC)
  WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS orders_payment_status_created_idx
  ON public.orders (payment_status, created_at DESC)
  WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS orders_fulfillment_status_created_idx
  ON public.orders (fulfillment_status, created_at DESC)
  WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS orders_created_at_idx
  ON public.orders (created_at DESC);

CREATE INDEX IF NOT EXISTS orders_order_code_trgm_idx
  ON public.orders USING gin (order_code gin_trgm_ops);

CREATE INDEX IF NOT EXISTS orders_shipping_code_idx
  ON public.orders (shipping_code);

CREATE INDEX IF NOT EXISTS order_items_order_idx
  ON public.order_items (order_id);

CREATE INDEX IF NOT EXISTS order_items_product_idx
  ON public.order_items (product_id);

CREATE INDEX IF NOT EXISTS order_items_variant_idx
  ON public.order_items (product_variant_id);

CREATE INDEX IF NOT EXISTS order_items_order_status_idx
  ON public.order_items (order_id, production_status);

CREATE INDEX IF NOT EXISTS order_notes_order_created_idx
  ON public.order_notes (order_id, created_at DESC);

CREATE INDEX IF NOT EXISTS order_revisions_order_created_idx
  ON public.order_revisions (order_id, created_at DESC);

CREATE INDEX IF NOT EXISTS design_versions_order_created_idx
  ON public.design_versions (order_id, created_at DESC);

CREATE INDEX IF NOT EXISTS design_versions_revision_idx
  ON public.design_versions (revision_id);

CREATE INDEX IF NOT EXISTS design_images_version_sort_idx
  ON public.design_images (design_version_id, sort_order);

CREATE INDEX IF NOT EXISTS order_files_order_idx
  ON public.order_files (order_id, created_at DESC);

CREATE INDEX IF NOT EXISTS order_item_files_order_item_idx
  ON public.order_item_files (order_item_id, created_at DESC);

CREATE INDEX IF NOT EXISTS revision_files_revision_idx
  ON public.revision_files (order_revision_id, created_at DESC);

-- payments
CREATE INDEX IF NOT EXISTS payments_order_created_idx
  ON public.payments (order_id, created_at DESC);

CREATE INDEX IF NOT EXISTS payments_status_created_idx
  ON public.payments (status, created_at DESC);

CREATE INDEX IF NOT EXISTS payments_gateway_reference_idx
  ON public.payments (gateway_reference);

CREATE INDEX IF NOT EXISTS payment_events_payment_created_idx
  ON public.payment_events (payment_id, created_at DESC);

-- notifications / logs / print jobs
CREATE INDEX IF NOT EXISTS notifications_user_read_created_idx
  ON public.notifications (user_id, is_read, created_at DESC);

CREATE INDEX IF NOT EXISTS notifications_order_ref_idx
  ON public.notifications (ref_order_id);

CREATE INDEX IF NOT EXISTS activity_logs_user_created_idx
  ON public.activity_logs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS admin_audit_logs_admin_created_idx
  ON public.admin_audit_logs (admin_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS print_jobs_status_created_idx
  ON public.print_jobs (status, created_at DESC);

-- =========================================================
-- 10) TRIGGERS
-- =========================================================

DROP TRIGGER IF EXISTS trg_users_set_updated_at ON public.users;
CREATE TRIGGER trg_users_set_updated_at
BEFORE UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.tg_set_updated_at();

DROP TRIGGER IF EXISTS trg_user_profiles_set_updated_at ON public.user_profiles;
CREATE TRIGGER trg_user_profiles_set_updated_at
BEFORE UPDATE ON public.user_profiles
FOR EACH ROW
EXECUTE FUNCTION public.tg_set_updated_at();

DROP TRIGGER IF EXISTS trg_user_addresses_set_updated_at ON public.user_addresses;
CREATE TRIGGER trg_user_addresses_set_updated_at
BEFORE UPDATE ON public.user_addresses
FOR EACH ROW
EXECUTE FUNCTION public.tg_set_updated_at();

DROP TRIGGER IF EXISTS trg_auth_accounts_set_updated_at ON public.auth_accounts;
CREATE TRIGGER trg_auth_accounts_set_updated_at
BEFORE UPDATE ON public.auth_accounts
FOR EACH ROW
EXECUTE FUNCTION public.tg_set_updated_at();

DROP TRIGGER IF EXISTS trg_categories_set_updated_at ON public.categories;
CREATE TRIGGER trg_categories_set_updated_at
BEFORE UPDATE ON public.categories
FOR EACH ROW
EXECUTE FUNCTION public.tg_set_updated_at();

DROP TRIGGER IF EXISTS trg_products_set_updated_at ON public.products;
CREATE TRIGGER trg_products_set_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.tg_set_updated_at();

DROP TRIGGER IF EXISTS trg_product_variants_set_updated_at ON public.product_variants;
CREATE TRIGGER trg_product_variants_set_updated_at
BEFORE UPDATE ON public.product_variants
FOR EACH ROW
EXECUTE FUNCTION public.tg_set_updated_at();

DROP TRIGGER IF EXISTS trg_files_set_updated_at ON public.files;
CREATE TRIGGER trg_files_set_updated_at
BEFORE UPDATE ON public.files
FOR EACH ROW
EXECUTE FUNCTION public.tg_set_updated_at();

DROP TRIGGER IF EXISTS trg_orders_set_updated_at ON public.orders;
CREATE TRIGGER trg_orders_set_updated_at
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.tg_set_updated_at();

DROP TRIGGER IF EXISTS trg_order_addresses_set_updated_at ON public.order_addresses;
CREATE TRIGGER trg_order_addresses_set_updated_at
BEFORE UPDATE ON public.order_addresses
FOR EACH ROW
EXECUTE FUNCTION public.tg_set_updated_at();

DROP TRIGGER IF EXISTS trg_order_items_set_updated_at ON public.order_items;
CREATE TRIGGER trg_order_items_set_updated_at
BEFORE UPDATE ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION public.tg_set_updated_at();

DROP TRIGGER IF EXISTS trg_payment_configs_set_updated_at ON public.payment_configs;
CREATE TRIGGER trg_payment_configs_set_updated_at
BEFORE UPDATE ON public.payment_configs
FOR EACH ROW
EXECUTE FUNCTION public.tg_set_updated_at();

DROP TRIGGER IF EXISTS trg_payments_set_updated_at ON public.payments;
CREATE TRIGGER trg_payments_set_updated_at
BEFORE UPDATE ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.tg_set_updated_at();

DROP TRIGGER IF EXISTS trg_print_jobs_set_updated_at ON public.print_jobs;
CREATE TRIGGER trg_print_jobs_set_updated_at
BEFORE UPDATE ON public.print_jobs
FOR EACH ROW
EXECUTE FUNCTION public.tg_set_updated_at();

DROP TRIGGER IF EXISTS trg_system_settings_set_updated_at ON public.system_settings;
CREATE TRIGGER trg_system_settings_set_updated_at
BEFORE UPDATE ON public.system_settings
FOR EACH ROW
EXECUTE FUNCTION public.tg_set_updated_at();

DROP TRIGGER IF EXISTS trg_notifications_set_read_at ON public.notifications;
CREATE TRIGGER trg_notifications_set_read_at
BEFORE INSERT OR UPDATE OF is_read, read_at
ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.tg_set_notification_read_at();

DROP TRIGGER IF EXISTS trg_orders_generate_code ON public.orders;
CREATE TRIGGER trg_orders_generate_code
BEFORE INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.tg_generate_order_code();

DROP TRIGGER IF EXISTS trg_order_items_assign_line_no ON public.order_items;
CREATE TRIGGER trg_order_items_assign_line_no
BEFORE INSERT ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION public.tg_assign_order_item_line_no();

DROP TRIGGER IF EXISTS trg_order_items_recompute_order_amounts ON public.order_items;
CREATE TRIGGER trg_order_items_recompute_order_amounts
AFTER INSERT OR UPDATE OR DELETE ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION public.tg_recompute_order_amounts();

DROP TRIGGER IF EXISTS trg_payments_sync_order_payment_status ON public.payments;
CREATE TRIGGER trg_payments_sync_order_payment_status
AFTER INSERT OR UPDATE OR DELETE ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.tg_sync_order_payment_status();

DROP TRIGGER IF EXISTS trg_admin_audit_logs_assert_admin ON public.admin_audit_logs;
CREATE TRIGGER trg_admin_audit_logs_assert_admin
BEFORE INSERT OR UPDATE ON public.admin_audit_logs
FOR EACH ROW
EXECUTE FUNCTION public.tg_assert_staff_or_admin();

-- =========================================================
-- 11) OPTIONAL SEED SETTINGS
-- =========================================================

INSERT INTO public.system_settings (setting_key, value, label, description, group_name, is_public)
VALUES
  ('site.currency', '"VND"'::jsonb, 'Default Currency', 'Default currency code for prices', 'general', true),
  ('orders.default_deposit_ratio', '0.5'::jsonb, 'Default Deposit Ratio', 'Default deposit ratio for custom/printing orders', 'orders', false)
ON CONFLICT (setting_key) DO NOTHING;
