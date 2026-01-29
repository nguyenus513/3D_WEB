-- =====================================================
-- PRE-MIGRATION CHECK SCRIPT
-- Run this BEFORE executing the FK fix migration
-- File: pre_migration_check.sql
-- =====================================================

-- Check 1: Current Foreign Keys on order tables
SELECT
    '📋 CURRENT FK STATUS' AS phase,
    tc.table_name,
    tc.constraint_name,
    kcu.column_name,
    ccu.table_name AS foreign_table,
    ccu.column_name AS foreign_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name IN ('order_child', 'order_parent')
  AND tc.constraint_type = 'FOREIGN KEY';

-- Check 2: Count orphaned records
DO $$
DECLARE
    child_orphans INT;
    parent_orphans INT;
BEGIN
    SELECT COUNT(*) INTO child_orphans
    FROM order_child oc
    WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = oc.user_id);
    
    SELECT COUNT(*) INTO parent_orphans
    FROM order_parent op
    WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = op.user_id);
    
    RAISE NOTICE '════════════════════════════════════════';
    RAISE NOTICE '  ORPHAN RECORDS CHECK';
    RAISE NOTICE '════════════════════════════════════════';
    
    IF child_orphans > 0 THEN
        RAISE WARNING '⚠️  Found % orphaned records in order_child', child_orphans;
    ELSE
        RAISE NOTICE '✅ No orphaned records in order_child';
    END IF;
    
    IF parent_orphans > 0 THEN
        RAISE WARNING '⚠️  Found % orphaned records in order_parent', parent_orphans;
    ELSE
        RAISE NOTICE '✅ No orphaned records in order_parent';
    END IF;
    
    RAISE NOTICE '════════════════════════════════════════';
END $$;

-- Check 3: Verify auth.users vs profiles mapping
SELECT
    '🔗 AUTH-PROFILE SYNC' AS check_name,
    COUNT(*) AS total_auth_users,
    (SELECT COUNT(*) FROM profiles WHERE id IN (SELECT id FROM auth.users)) AS synced_profiles
FROM auth.users;

-- Check 4: Count existing data
SELECT 
    '📊 DATA COUNTS' AS phase,
    (SELECT COUNT(*) FROM order_child) AS order_child_count,
    (SELECT COUNT(*) FROM order_parent) AS order_parent_count,
    (SELECT COUNT(*) FROM payment) AS payment_count;

-- Check 5: List orphaned user_ids (if any)
SELECT 
    '👻 ORPHANED USER IDS IN ORDER_CHILD' AS check_type,
    oc.user_id,
    oc.code_child,
    oc.created_at
FROM order_child oc
WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = oc.user_id)
LIMIT 10;

SELECT 
    '👻 ORPHANED USER IDS IN ORDER_PARENT' AS check_type,
    op.user_id,
    op.code_parent,
    op.created_at
FROM order_parent op
WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = op.user_id)
LIMIT 10;
