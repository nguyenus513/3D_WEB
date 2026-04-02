-- =============================================================================
-- Migration: Performance Indexes
-- =============================================================================
-- Postgres indexes PKs automatically but NOT foreign keys or filter columns.
-- Every unindexed FK or WHERE/ORDER BY column causes a sequential scan.
-- All indexes use IF NOT EXISTS — safe to run multiple times.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- orders
-- Heaviest table: admin listing, customer order history, status tabs, archiving
-- -----------------------------------------------------------------------------

-- Customer fetches their order list → WHERE user_id = $1 ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_orders_user_id
    ON public.orders (user_id);

-- Admin status tab filter → WHERE status = $1
CREATE INDEX IF NOT EXISTS idx_orders_status
    ON public.orders (status);

-- Admin order type filter (new "Loại đơn" column) → WHERE order_type = $1
CREATE INDEX IF NOT EXISTS idx_orders_order_type
    ON public.orders (order_type);

-- Admin listing default sort → ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_orders_created_at_desc
    ON public.orders (created_at DESC);

-- Archive job: only active orders → WHERE archived_at IS NULL
CREATE INDEX IF NOT EXISTS idx_orders_archived_at
    ON public.orders (archived_at)
    WHERE archived_at IS NULL;

-- Combined: customer order list with status filter
-- WHERE user_id = $1 AND status = $2 ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_orders_user_status_created
    ON public.orders (user_id, status, created_at DESC);

-- -----------------------------------------------------------------------------
-- order_items
-- Joined on virtually every order query
-- -----------------------------------------------------------------------------

-- FK join → WHERE order_id = $1
CREATE INDEX IF NOT EXISTS idx_order_items_order_id
    ON public.order_items (order_id);

-- Stock adjustment → WHERE product_id = $1
CREATE INDEX IF NOT EXISTS idx_order_items_product_id
    ON public.order_items (product_id)
    WHERE product_id IS NOT NULL;

-- Filter by item type (product / print_3d / custom)
CREATE INDEX IF NOT EXISTS idx_order_items_item_type
    ON public.order_items (item_type);

-- -----------------------------------------------------------------------------
-- notifications
-- Per-user fetch with unread filter — called every 30 s per logged-in user
-- -----------------------------------------------------------------------------

-- Fetch all notifications for user → WHERE user_id = $1 ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_notifications_user_id_created
    ON public.notifications (user_id, created_at DESC);

-- Unread count badge → WHERE user_id = $1 AND is_read = false
-- Partial index: only unread rows — small and fast
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
    ON public.notifications (user_id, created_at DESC)
    WHERE is_read = false;

-- -----------------------------------------------------------------------------
-- file_links
-- Polymorphic lookup: "find all files attached to this order/item"
-- -----------------------------------------------------------------------------

-- WHERE ref_id = $1 (order or order_item)
CREATE INDEX IF NOT EXISTS idx_file_links_ref_id
    ON public.file_links (ref_id);

-- FK to files table
CREATE INDEX IF NOT EXISTS idx_file_links_file_id
    ON public.file_links (file_id);

-- Combined ref lookup → WHERE ref_id = $1 AND ref_type = $2
CREATE INDEX IF NOT EXISTS idx_file_links_ref_id_type
    ON public.file_links (ref_id, ref_type);

-- -----------------------------------------------------------------------------
-- design_versions / design_images
-- -----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_design_versions_order_id
    ON public.design_versions (order_id);

-- Latest version per order → ORDER BY version_number DESC
CREATE INDEX IF NOT EXISTS idx_design_versions_order_version
    ON public.design_versions (order_id, version_number DESC);

CREATE INDEX IF NOT EXISTS idx_design_images_version_id
    ON public.design_images (version_id);

-- -----------------------------------------------------------------------------
-- order_status_history / order_notes / order_revisions
-- All filtered by order_id and ordered by time
-- -----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_order_status_history_order_id
    ON public.order_status_history (order_id, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_order_notes_order_id
    ON public.order_notes (order_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_order_revisions_order_id
    ON public.order_revisions (order_id, version DESC);

-- -----------------------------------------------------------------------------
-- payments / payment_events
-- -----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_payments_order_id
    ON public.payments (order_id);

-- Revenue/admin stats → WHERE status = $1
CREATE INDEX IF NOT EXISTS idx_payments_status
    ON public.payments (status);

CREATE INDEX IF NOT EXISTS idx_payment_events_payment_id
    ON public.payment_events (payment_id);

-- -----------------------------------------------------------------------------
-- products
-- Product listing, search, admin catalog
-- -----------------------------------------------------------------------------

-- Category filter → WHERE category_id = $1
CREATE INDEX IF NOT EXISTS idx_products_category_id
    ON public.products (category_id)
    WHERE category_id IS NOT NULL;

-- Active product listing → WHERE is_active = true ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_products_active_created
    ON public.products (is_active, created_at DESC);

-- Featured products endpoint (called on homepage)
CREATE INDEX IF NOT EXISTS idx_products_featured
    ON public.products (is_featured, created_at DESC)
    WHERE is_featured = true AND is_active = true;

-- Non-archived products (soft-delete pattern)
CREATE INDEX IF NOT EXISTS idx_products_not_archived
    ON public.products (created_at DESC)
    WHERE archived_at IS NULL;

-- SKU lookup for order items
CREATE INDEX IF NOT EXISTS idx_products_sku
    ON public.products (sku)
    WHERE sku IS NOT NULL;

-- -----------------------------------------------------------------------------
-- product_variants
-- FK from order_items; stock check in adjustStockForOrder
-- -----------------------------------------------------------------------------

-- Join from product detail → WHERE product_id = $1
CREATE INDEX IF NOT EXISTS idx_product_variants_product_id
    ON public.product_variants (product_id);

-- Active variants only (most queries filter active)
CREATE INDEX IF NOT EXISTS idx_product_variants_product_active
    ON public.product_variants (product_id, is_active)
    WHERE is_active = true;

-- Stock/size lookup in adjustStockForOrder → WHERE product_id = $1 AND (name = $2 OR sku = $2)
CREATE INDEX IF NOT EXISTS idx_product_variants_product_name
    ON public.product_variants (product_id, name);

CREATE INDEX IF NOT EXISTS idx_product_variants_product_sku
    ON public.product_variants (product_id, sku)
    WHERE sku IS NOT NULL;

-- -----------------------------------------------------------------------------
-- print_jobs
-- print_jobs(order_item_id) is UNIQUE → already indexed by PK constraint
-- Additional: status filter for print queue admin view
-- -----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_print_jobs_status
    ON public.print_jobs (status);

-- -----------------------------------------------------------------------------
-- user_addresses
-- -----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_user_addresses_user_id
    ON public.user_addresses (user_id);

-- Default address lookup → WHERE user_id = $1 AND is_default = true
CREATE INDEX IF NOT EXISTS idx_user_addresses_user_default
    ON public.user_addresses (user_id, is_default)
    WHERE is_default = true;

-- -----------------------------------------------------------------------------
-- NextAuth tables (accounts / sessions)
-- These are queried on every auth request
-- -----------------------------------------------------------------------------

-- accounts: OAuth login lookup → WHERE provider = $1 AND providerAccountId = $2
CREATE INDEX IF NOT EXISTS idx_accounts_provider_account
    ON public.accounts (provider, "providerAccountId");

-- accounts: FK to users (cascade, ON DELETE queries)
CREATE INDEX IF NOT EXISTS idx_accounts_user_id
    ON public.accounts ("userId");

-- sessions: validate session token (sessionToken has UNIQUE — already indexed)
-- sessions: clean up expired sessions → WHERE expires < now()
CREATE INDEX IF NOT EXISTS idx_sessions_expires
    ON public.sessions (expires);

-- sessions: FK to users
CREATE INDEX IF NOT EXISTS idx_sessions_user_id
    ON public.sessions ("userId");

-- -----------------------------------------------------------------------------
-- activity_logs / admin_audit_log
-- Time-series append-only tables — queried by user and time range
-- -----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id
    ON public.activity_logs (user_id, created_at DESC)
    WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_admin_id
    ON public.admin_audit_log (admin_id, created_at DESC);

-- Admin audit by resource type → WHERE resource_type = $1 ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_resource
    ON public.admin_audit_log (resource_type, created_at DESC);

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON INDEX idx_orders_user_id              IS 'Customer order history - WHERE user_id';
COMMENT ON INDEX idx_orders_status               IS 'Admin status tab filter';
COMMENT ON INDEX idx_orders_order_type           IS 'Admin order type column filter';
COMMENT ON INDEX idx_orders_created_at_desc      IS 'Default sort newest first';
COMMENT ON INDEX idx_orders_archived_at          IS 'Partial: active orders only for archive job';
COMMENT ON INDEX idx_orders_user_status_created  IS 'Composite: customer filtered order list';
COMMENT ON INDEX idx_order_items_order_id        IS 'Join on every order fetch';
COMMENT ON INDEX idx_notifications_user_id_created IS 'Per-user notification feed';
COMMENT ON INDEX idx_notifications_user_unread   IS 'Partial: unread badge count - tiny index';
COMMENT ON INDEX idx_file_links_ref_id           IS 'Polymorphic file lookup by ref';
COMMENT ON INDEX idx_design_versions_order_id    IS 'Design review per order';
COMMENT ON INDEX idx_products_featured           IS 'Partial: homepage featured endpoint';
COMMENT ON INDEX idx_product_variants_product_active IS 'Partial: active variants only';
