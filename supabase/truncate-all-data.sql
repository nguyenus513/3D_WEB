-- =============================================
-- TRUNCATE ALL DATA (For Testing)
-- This will DELETE ALL DATA from tables
-- =============================================

-- ⚠️ WARNING: THIS WILL DELETE ALL DATA!

BEGIN;

-- Disable FK temporarily
SET CONSTRAINTS ALL DEFERRED;

-- Delete in correct order (children first)
TRUNCATE TABLE order_files CASCADE;
TRUNCATE TABLE order_configs CASCADE;
TRUNCATE TABLE order_items CASCADE;
TRUNCATE TABLE payments CASCADE;
TRUNCATE TABLE orders CASCADE;

TRUNCATE TABLE product_images CASCADE;
TRUNCATE TABLE products CASCADE;

TRUNCATE TABLE addresses CASCADE;
TRUNCATE TABLE sessions CASCADE;
TRUNCATE TABLE accounts CASCADE;
TRUNCATE TABLE verification_tokens CASCADE;
TRUNCATE TABLE profiles CASCADE;

-- Keep settings and categories (app config)
-- TRUNCATE TABLE settings CASCADE;
-- TRUNCATE TABLE categories CASCADE;
-- TRUNCATE TABLE faqs CASCADE;

COMMIT;

-- =============================================
-- After running:
-- ✅ All users deleted
-- ✅ All orders deleted
-- ✅ All products deleted
-- ✅ Settings & categories kept
-- =============================================
