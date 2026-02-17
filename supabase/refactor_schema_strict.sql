-- =============================================================================
-- STRICT Database Refactoring Migration Script
-- Addressing ALL User Feedback (High Severity Architecture Fixes)
-- =============================================================================

-- Enable Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- 0. CLEANUP & PREP (CAUTION: This prepares the DB for strict mode)
-- =============================================================================
-- We assume we can ALTER existing tables. 
-- For ENUMs, we must drop old text constraints if any.

-- =============================================================================
-- 1. ENUMS (Strict Data Types)
-- =============================================================================
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'staff', 'customer');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE order_status_enum AS ENUM (
        'pending', 'confirmed', 'processing', 'designing', 'review', 
        'approved', 'production_pending', 'revising', 'producing', 
        'finished', 'printing', 'shipping', 'delivered', 'completed', 
        'cancelled', 'refunded'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_status_enum AS ENUM (
        'pending', 'partial', 'deposit_paid', 'paid', 'refunded', 'failed', 'expired'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE item_type_enum AS ENUM ('product', 'custom', 'print_3d');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE ref_type_enum AS ENUM ('order', 'order_item', 'revision');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================================
-- 2. USERS SYSTEM (Consolidated Core)
-- =============================================================================

-- ALTER users table (if accessible via public/auth schema logic in Supabase)
-- Often 'users' is in 'auth' schema. We'll focus on public tables 'users' (if you strictly use public.users) 
-- or 'profiles' which we rename/standardize to 'user_profiles'.

CREATE TABLE IF NOT EXISTS "users" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), -- Map to auth.uid() ideally
    "email" text UNIQUE NOT NULL,
    "role" user_role NOT NULL DEFAULT 'customer',
    "created_at" timestamptz DEFAULT now(),
    "updated_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "user_profiles" (
    "user_id" uuid PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
    "full_name" text,
    "phone" text,
    "avatar_url" text,
    "created_at" timestamptz DEFAULT now(),
    "updated_at" timestamptz DEFAULT now()
);

-- =============================================================================
-- 3. ADDRESSES (Shared)
-- =============================================================================

CREATE TABLE IF NOT EXISTS "user_addresses" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "user_id" uuid REFERENCES "users"("id") ON DELETE CASCADE,
    "full_name" text NOT NULL,
    "phone" text NOT NULL,
    "province" text,
    "district" text,
    "ward" text,
    "address_line" text NOT NULL,
    "is_default" boolean DEFAULT false,
    "created_at" timestamptz DEFAULT now()
);

-- =============================================================================
-- 4. PRODUCTS & CATEGORIES
-- =============================================================================

CREATE TABLE IF NOT EXISTS "categories" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "name" text NOT NULL,
    "parent_id" uuid REFERENCES "categories"("id") ON DELETE SET NULL,
    "created_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "products" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "category_id" uuid REFERENCES "categories"("id") ON DELETE SET NULL,
    "name" text NOT NULL,
    "sku" text UNIQUE,
    "base_price" numeric NOT NULL DEFAULT 0,
    "sale_price" numeric,
    "stock" integer DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "created_at" timestamptz DEFAULT now(),
    "updated_at" timestamptz DEFAULT now()
);
-- Note: 'specs' and 'images' JSON columns in 'products' are noted as anti-pattern.
-- For strictness, you would create 'product_variants' or 'product_images', but valid for now if small scale.

-- =============================================================================
-- 5. ORDERS (The Clean Core)
-- =============================================================================

CREATE TABLE IF NOT EXISTS "orders" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "order_code" text UNIQUE NOT NULL,
    "user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL, -- Keep order even if user deleted? Or CASCADE? Valid choice.
    "status" order_status_enum DEFAULT 'pending',
    "payment_status" payment_status_enum DEFAULT 'pending',
    "total_amount" numeric DEFAULT 0,
    "created_at" timestamptz DEFAULT now(),
    "updated_at" timestamptz DEFAULT now()
);

-- Index for User
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON "orders"("user_id");

-- =============================================================================
-- 6. ORDER EXTENSIONS (Modular)
-- =============================================================================

-- 6.1 Order Notes
CREATE TABLE IF NOT EXISTS "order_notes" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "order_id" uuid REFERENCES "orders"("id") ON DELETE CASCADE,
    "author_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
    "content" text NOT NULL,
    "type" text CHECK (type IN ('customer','admin','system')),
    "created_at" timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_order_notes_order_id ON "order_notes"("order_id");

-- 6.2 Order Addresses (Strict Columns)
CREATE TABLE IF NOT EXISTS "order_addresses" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "order_id" uuid UNIQUE REFERENCES "orders"("id") ON DELETE CASCADE,
    "full_name" text NOT NULL,
    "phone" text NOT NULL,
    "province" text,
    "district" text,
    "ward" text,
    "address_line" text NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_order_addresses_order_id ON "order_addresses"("order_id");

-- 6.3 Order Revisions
CREATE TABLE IF NOT EXISTS "order_revisions" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "order_id" uuid REFERENCES "orders"("id") ON DELETE CASCADE,
    "version" integer NOT NULL,
    "status" text CHECK (status IN ('pending','approved','rejected')),
    "feedback" text,
    "created_at" timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_order_revisions_order_id ON "order_revisions"("order_id");

-- 6.4 Order Status History
CREATE TABLE IF NOT EXISTS "order_status_history" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "order_id" uuid REFERENCES "orders"("id") ON DELETE CASCADE,
    "status" order_status_enum NOT NULL,
    "changed_at" timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_order_status_history_order_id ON "order_status_history"("order_id");

-- =============================================================================
-- 7. ORDER ITEMS (Strict Logic)
-- =============================================================================

CREATE TABLE IF NOT EXISTS "order_items" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "order_id" uuid REFERENCES "orders"("id") ON DELETE CASCADE,
    "product_id" uuid REFERENCES "products"("id") ON DELETE SET NULL,
    "name" text NOT NULL,
    "quantity" integer NOT NULL CHECK (quantity > 0),
    "unit_price" numeric NOT NULL DEFAULT 0,
    -- GENERATED Column (Postgres 12+)
    "total_price" numeric GENERATED ALWAYS AS (quantity * unit_price) STORED,
    "item_type" item_type_enum NOT NULL,
    "created_at" timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON "order_items"("order_id");

-- 7.1 Print Jobs (Extends Order Items)
CREATE TABLE IF NOT EXISTS "print_jobs" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "order_item_id" uuid UNIQUE REFERENCES "order_items"("id") ON DELETE CASCADE,
    "material" text,
    "color" text,
    "infill" integer,
    "layer_height" numeric,
    "estimated_hours" numeric,
    "estimated_grams" numeric,
    "status" text DEFAULT 'waiting',
    "created_at" timestamptz DEFAULT now()
);

-- =============================================================================
-- 8. FILES SYSTEM (Polymorphic)
-- =============================================================================

CREATE TABLE IF NOT EXISTS "files" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "file_url" text NOT NULL,
    "mime_type" text,
    "size_bytes" bigint,
    "provider" text DEFAULT 'r2',
    "created_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "file_links" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "file_id" uuid REFERENCES "files"("id") ON DELETE CASCADE,
    "ref_type" ref_type_enum NOT NULL,
    "ref_id" uuid NOT NULL, -- Polymorphic ID, application must enforce integrity
    "tag" text, -- e.g. 'demo', 'final', 'source'
    "created_at" timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_file_links_ref_id ON "file_links"("ref_id");

-- =============================================================================
-- 9. PAYMENTS (State Machine)
-- =============================================================================

CREATE TABLE IF NOT EXISTS "payments" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "order_id" uuid REFERENCES "orders"("id") ON DELETE CASCADE,
    "amount" numeric NOT NULL,
    "method" text DEFAULT 'qr',
    "status" payment_status_enum DEFAULT 'pending',
    "transaction_code" text,
    "created_at" timestamptz DEFAULT now(),
    "confirmed_at" timestamptz
);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON "payments"("order_id");

CREATE TABLE IF NOT EXISTS "payment_events" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "payment_id" uuid REFERENCES "payments"("id") ON DELETE CASCADE,
    "event_type" text,
    "payload" jsonb,
    "created_at" timestamptz DEFAULT now()
);

-- =============================================================================
-- 10. AUDIT LOGS
-- =============================================================================
CREATE TABLE IF NOT EXISTS "activity_logs" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
    "action" text NOT NULL,
    "metadata" jsonb,
    "created_at" timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON "activity_logs"("user_id");
