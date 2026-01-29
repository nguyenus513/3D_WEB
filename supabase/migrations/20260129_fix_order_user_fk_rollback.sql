-- =====================================================
-- ROLLBACK SCRIPT - FK Fix Migration
-- File: 20260129_fix_order_user_fk_rollback.sql
-- Use ONLY if main migration fails or needs reverting
-- =====================================================

BEGIN;

RAISE NOTICE '🔄 STARTING ROLLBACK: Reverting FK to auth.users';

-- =====================================================
-- STEP 1: Drop new FK (references profiles)
-- =====================================================
ALTER TABLE order_child DROP CONSTRAINT IF EXISTS order_child_user_id_fkey;
ALTER TABLE order_parent DROP CONSTRAINT IF EXISTS order_parent_user_id_fkey;

RAISE NOTICE '✅ Dropped profiles FK constraints';

-- =====================================================
-- STEP 2: Restore old FK (references auth.users)
-- =====================================================
ALTER TABLE order_child
  ADD CONSTRAINT order_child_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE order_parent
  ADD CONSTRAINT order_parent_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

RAISE NOTICE '✅ Restored auth.users FK constraints';

-- =====================================================
-- STEP 3: Restore old RLS policies
-- =====================================================
DROP POLICY IF EXISTS "Users can view own child orders" ON order_child;
DROP POLICY IF EXISTS "Users can insert own child orders" ON order_child;
DROP POLICY IF EXISTS "Users can update own child orders" ON order_child;
DROP POLICY IF EXISTS "Users can view own parent orders" ON order_parent;
DROP POLICY IF EXISTS "Users can insert own parent orders" ON order_parent;
DROP POLICY IF EXISTS "Users can update own parent orders" ON order_parent;

-- Recreate policies using auth.uid()
CREATE POLICY "Users can view own child orders" ON order_child 
  FOR SELECT USING (auth.uid() = user_id);
  
CREATE POLICY "Users can insert own child orders" ON order_child 
  FOR INSERT WITH CHECK (auth.uid() = user_id);
  
CREATE POLICY "Users can update own child orders" ON order_child 
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own parent orders" ON order_parent 
  FOR SELECT USING (auth.uid() = user_id);
  
CREATE POLICY "Users can insert own parent orders" ON order_parent 
  FOR INSERT WITH CHECK (auth.uid() = user_id);
  
CREATE POLICY "Users can update own parent orders" ON order_parent 
  FOR UPDATE USING (auth.uid() = user_id);

RAISE NOTICE '✅ Restored old RLS policies';

COMMIT;

RAISE NOTICE '🎉 ROLLBACK COMPLETE: FK now references auth.users';
