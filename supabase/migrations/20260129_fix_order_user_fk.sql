-- =====================================================
-- EMERGENCY FIX: Correct order_child/order_parent FK
-- Migration: 20260129_fix_order_user_fk.sql
-- Runtime: ~45-60 seconds
-- FK Target: profiles.id (instead of auth.users)
-- =====================================================

-- Log migration start
DO $$
BEGIN
    RAISE NOTICE '════════════════════════════════════════════════════';
    RAISE NOTICE '🚀 MIGRATION START: Fix order_user_fk';
    RAISE NOTICE 'Timestamp: %', NOW();
    RAISE NOTICE '════════════════════════════════════════════════════';
END $$;

BEGIN;

-- =====================================================
-- STEP 1: DIAGNOSIS & LOGGING
-- =====================================================

DO $$
DECLARE
    old_child_fk TEXT;
    old_parent_fk TEXT;
    child_fkey_table TEXT;
    parent_fkey_table TEXT;
BEGIN
    -- Get current FK info for order_child
    SELECT tc.constraint_name, ccu.table_name
    INTO old_child_fk, child_fkey_table
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
    WHERE tc.table_name = 'order_child'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'user_id'
    LIMIT 1;
    
    -- Get current FK info for order_parent
    SELECT tc.constraint_name, ccu.table_name
    INTO old_parent_fk, parent_fkey_table
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
    WHERE tc.table_name = 'order_parent'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'user_id'
    LIMIT 1;
    
    RAISE NOTICE '📊 DIAGNOSIS RESULTS:';
    RAISE NOTICE '  order_child FK: % → %', COALESCE(old_child_fk, 'NONE'), COALESCE(child_fkey_table, 'N/A');
    RAISE NOTICE '  order_parent FK: % → %', COALESCE(old_parent_fk, 'NONE'), COALESCE(parent_fkey_table, 'N/A');
    RAISE NOTICE '  Expected Target: profiles';
    
    IF child_fkey_table = 'profiles' AND parent_fkey_table = 'profiles' THEN
        RAISE NOTICE '✅ FK already correct - Nothing to do!';
    END IF;
END $$;

-- =====================================================
-- STEP 2: DROP EXISTING FOREIGN KEYS
-- =====================================================

DO $$ BEGIN RAISE NOTICE '⚙️  STEP 1/5: Dropping existing FK...'; END $$;

ALTER TABLE order_child 
  DROP CONSTRAINT IF EXISTS order_child_user_id_fkey;
  
ALTER TABLE order_parent 
  DROP CONSTRAINT IF EXISTS order_parent_user_id_fkey;

DO $$ BEGIN RAISE NOTICE '✅ Step 1 completed - Old FK dropped'; END $$;

-- =====================================================
-- STEP 3: DATA VALIDATION (LOG ORPHANED RECORDS)
-- =====================================================

DO $$ BEGIN RAISE NOTICE '⚙️  STEP 2/5: Validating data integrity...'; END $$;

DO $$
DECLARE
    orphan_count INT;
BEGIN
    SELECT COUNT(*) INTO orphan_count
    FROM order_child oc
    WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = oc.user_id);
    
    IF orphan_count > 0 THEN
        RAISE WARNING '⚠️  Found % orphaned records in order_child (will be preserved)', orphan_count;
    ELSE
        RAISE NOTICE '✅ No orphaned records in order_child';
    END IF;
END $$;

DO $$
DECLARE
    orphan_count INT;
BEGIN
    SELECT COUNT(*) INTO orphan_count
    FROM order_parent op
    WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = op.user_id);
    
    IF orphan_count > 0 THEN
        RAISE WARNING '⚠️  Found % orphaned records in order_parent (will be preserved)', orphan_count;
    ELSE
        RAISE NOTICE '✅ No orphaned records in order_parent';
    END IF;
END $$;

DO $$ BEGIN RAISE NOTICE '✅ Step 2 completed - Data integrity validated'; END $$;

-- =====================================================
-- STEP 4: DROP OLD RLS POLICIES
-- =====================================================

DO $$ BEGIN RAISE NOTICE '⚙️  STEP 3/5: Dropping old RLS policies...'; END $$;

DROP POLICY IF EXISTS "Users can view own child orders" ON order_child;
DROP POLICY IF EXISTS "Users can insert own child orders" ON order_child;
DROP POLICY IF EXISTS "Users can update own child orders" ON order_child;
DROP POLICY IF EXISTS "Users can view own parent orders" ON order_parent;
DROP POLICY IF EXISTS "Users can insert own parent orders" ON order_parent;
DROP POLICY IF EXISTS "Users can update own parent orders" ON order_parent;

DO $$ BEGIN RAISE NOTICE '✅ Step 3 completed - Old RLS policies dropped'; END $$;

-- =====================================================
-- STEP 5: CREATE NEW FK (REFERENCES PROFILES.ID)
-- =====================================================

DO $$ BEGIN RAISE NOTICE '⚙️  STEP 4/5: Creating new FK to profiles...'; END $$;

ALTER TABLE order_child
  ADD CONSTRAINT order_child_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE order_parent
  ADD CONSTRAINT order_parent_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

DO $$ BEGIN RAISE NOTICE '✅ Step 4 completed - New FK created: user_id → profiles.id'; END $$;

-- =====================================================
-- STEP 6: CREATE NEW RLS POLICIES
-- =====================================================

DO $$ BEGIN RAISE NOTICE '⚙️  STEP 5/5: Creating new RLS policies...'; END $$;

-- RLS for order_child
CREATE POLICY "Users can view own child orders" ON order_child 
  FOR SELECT USING (
    user_id IN (SELECT id FROM profiles WHERE id = auth.uid())
  );
  
CREATE POLICY "Users can insert own child orders" ON order_child 
  FOR INSERT WITH CHECK (
    user_id IN (SELECT id FROM profiles WHERE id = auth.uid())
  );
  
CREATE POLICY "Users can update own child orders" ON order_child 
  FOR UPDATE USING (
    user_id IN (SELECT id FROM profiles WHERE id = auth.uid())
  );

-- RLS for order_parent
CREATE POLICY "Users can view own parent orders" ON order_parent 
  FOR SELECT USING (
    user_id IN (SELECT id FROM profiles WHERE id = auth.uid())
  );
  
CREATE POLICY "Users can insert own parent orders" ON order_parent 
  FOR INSERT WITH CHECK (
    user_id IN (SELECT id FROM profiles WHERE id = auth.uid())
  );
  
CREATE POLICY "Users can update own parent orders" ON order_parent 
  FOR UPDATE USING (
    user_id IN (SELECT id FROM profiles WHERE id = auth.uid())
  );

DO $$ BEGIN RAISE NOTICE '✅ Step 5 completed - New RLS policies created'; END $$;

COMMIT;

-- =====================================================
-- POST-MIGRATION VERIFICATION
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '════════════════════════════════════════════════════';
    RAISE NOTICE '🎉 MIGRATION COMPLETE!';
    RAISE NOTICE '════════════════════════════════════════════════════';
END $$;

-- Verify new FK
SELECT
    '✅ NEW FK STATUS' AS phase,
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

-- Final counts
SELECT 
    '📊 FINAL DATA COUNTS' AS phase,
    (SELECT COUNT(*) FROM order_child) AS order_child_count,
    (SELECT COUNT(*) FROM order_parent) AS order_parent_count,
    (SELECT COUNT(*) FROM payment) AS payment_count;
