-- =====================================================
-- DB Audit Snapshot (manual run)
-- Captures schema, size, indexes, and legacy table counts
-- =====================================================

-- 1. Table sizes
SELECT
  schemaname,
  relname AS table_name,
  pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
  pg_size_pretty(pg_relation_size(relid)) AS table_size,
  pg_size_pretty(pg_indexes_size(relid)) AS index_size
FROM pg_catalog.pg_statio_user_tables
ORDER BY pg_total_relation_size(relid) DESC;

-- 2. Columns overview
SELECT table_schema, table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;

-- 3. Indexes
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- 4. Legacy table counts
SELECT
  (SELECT COUNT(*) FROM public.order_parent) AS order_parent_count,
  (SELECT COUNT(*) FROM public.order_child) AS order_child_count,
  (SELECT COUNT(*) FROM public.payment) AS payment_count,
  (SELECT COUNT(*) FROM public.users) AS users_count,
  (SELECT COUNT(*) FROM public.accounts) AS accounts_count,
  (SELECT COUNT(*) FROM public.sessions) AS sessions_count;

-- 5. Expected tables exist?
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'system_settings',
    'content_pages',
    'content_blocks',
    'ui_labels',
    'pricing_custom_types',
    'pricing_custom_sizes',
    'pricing_printing',
    'order_files',
    'file_access_logs',
    'payment_configs',
    'wishlists',
    'password_reset_tokens',
    'verification_tokens',
    'faqs'
  )
ORDER BY table_name;
