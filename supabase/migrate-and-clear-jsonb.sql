-- =============================================
-- MIGRATE OLD DATA & CLEAR JSONB COLUMNS
-- For a completely clean normalized system
-- =============================================

BEGIN;

-- =============================================
-- 1. MIGRATE shipping_address from ORDERS → addresses
-- =============================================

INSERT INTO addresses (user_id, full_name, phone, address_line, ward, district, province, label, is_default)
SELECT DISTINCT ON (o.user_id)
    o.user_id,
    (o.shipping_address->>'full_name')::text,
    (o.shipping_address->>'phone')::text,
    (o.shipping_address->>'address_line')::text,
    (o.shipping_address->>'ward')::text,
    (o.shipping_address->>'district')::text,
    (o.shipping_address->>'province')::text,
    'Từ đơn hàng',
    true
FROM orders o
WHERE o.shipping_address IS NOT NULL 
  AND (o.shipping_address->>'province') IS NOT NULL
  AND o.shipping_address_id IS NULL
  AND o.user_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM addresses a WHERE a.user_id = o.user_id
  );

-- Update orders to use shipping_address_id
UPDATE orders o
SET shipping_address_id = (
    SELECT a.id FROM addresses a 
    WHERE a.user_id = o.user_id 
    ORDER BY a.is_default DESC, a.created_at DESC 
    LIMIT 1
)
WHERE o.shipping_address_id IS NULL 
  AND o.user_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM addresses WHERE user_id = o.user_id);

-- =============================================
-- 2. MIGRATE custom_config → order_configs
-- custom_type = ENUM, custom_size = VARCHAR
-- =============================================

INSERT INTO order_configs (order_id, custom_type, custom_size)
SELECT 
    o.id,
    -- Cast to custom_type ENUM
    CASE 
        WHEN (o.custom_config->>'type') IN ('single', 'couple', 'group') 
        THEN (o.custom_config->>'type')::custom_type
        ELSE NULL
    END,
    -- VARCHAR, no cast needed
    (o.custom_config->>'size')::text
FROM orders o
WHERE o.order_type = 'custom'
  AND o.custom_config IS NOT NULL
  AND (o.custom_config->>'type') IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM order_configs oc WHERE oc.order_id = o.id
  );

-- Migrate custom images to order_files
INSERT INTO order_files (order_id, file_id, file_type, file_name)
SELECT 
    o.id,
    (img->>'id')::text,
    'photo',
    (img->>'name')::text
FROM orders o,
     jsonb_array_elements(o.custom_config->'images') AS img
WHERE o.order_type = 'custom'
  AND o.custom_config->'images' IS NOT NULL
  AND jsonb_array_length(o.custom_config->'images') > 0
  AND (img->>'id') IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM order_files f WHERE f.order_id = o.id AND f.file_type = 'photo'
  );

-- =============================================
-- 3. MIGRATE printing_config → order_configs
-- print_tech = ENUM (FDM, Resin), others = VARCHAR
-- =============================================

INSERT INTO order_configs (order_id, print_tech, material, color, weight_grams, print_time_hours)
SELECT 
    o.id,
    -- Cast to print_tech ENUM (FDM or Resin)
    CASE 
        WHEN UPPER((o.printing_config->>'type')) = 'FDM' THEN 'FDM'::print_tech
        WHEN UPPER((o.printing_config->>'type')) = 'RESIN' THEN 'Resin'::print_tech
        ELSE NULL
    END,
    -- VARCHAR fields
    (o.printing_config->>'material')::text,
    (o.printing_config->>'color')::text,
    -- Numeric fields
    (o.printing_config->'analysis'->>'grams')::smallint,
    (o.printing_config->'analysis'->>'hours')::smallint
FROM orders o
WHERE o.order_type = 'printing'
  AND o.printing_config IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM order_configs oc WHERE oc.order_id = o.id
  );

-- Migrate printing files to order_files
INSERT INTO order_files (order_id, file_id, file_type, file_name)
SELECT 
    o.id,
    COALESCE(
        SUBSTRING((f->>'url')::text FROM '/d/([^/]+)/'),
        (f->>'name')::text,
        'unknown'
    ),
    'stl',
    (f->>'name')::text
FROM orders o,
     jsonb_array_elements(o.printing_config->'files') AS f
WHERE o.order_type = 'printing'
  AND o.printing_config->'files' IS NOT NULL
  AND jsonb_array_length(o.printing_config->'files') > 0
  AND NOT EXISTS (
      SELECT 1 FROM order_files fl WHERE fl.order_id = o.id AND fl.file_type = 'stl'
  );

-- =============================================
-- 4. CLEAR OLD JSONB COLUMNS IN ORDERS
-- =============================================

UPDATE orders SET 
    shipping_address = NULL,
    custom_config = NULL,
    printing_config = NULL
WHERE shipping_address IS NOT NULL 
   OR custom_config IS NOT NULL 
   OR printing_config IS NOT NULL;

-- =============================================
-- 5. VERIFY MIGRATION
-- =============================================

DO $$
DECLARE
    addr_count INT;
    config_count INT;
    files_count INT;
BEGIN
    SELECT COUNT(*) INTO addr_count FROM addresses;
    SELECT COUNT(*) INTO config_count FROM order_configs;
    SELECT COUNT(*) INTO files_count FROM order_files;
    
    RAISE NOTICE '✅ Migration complete!';
    RAISE NOTICE '   - Addresses: % records', addr_count;
    RAISE NOTICE '   - Order configs: % records', config_count;
    RAISE NOTICE '   - Order files: % records', files_count;
END $$;

COMMIT;
