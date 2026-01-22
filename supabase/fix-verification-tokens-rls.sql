-- =============================================
-- FIX RLS POLICIES FOR AUTH TABLES
-- Allow service_role to insert/delete verification_tokens
-- =============================================

-- Disable RLS on verification_tokens (service role bypasses anyway)
ALTER TABLE verification_tokens DISABLE ROW LEVEL SECURITY;

-- Or if you want to keep RLS enabled, create permissive policies:
-- DROP POLICY IF EXISTS "verification_tokens_all" ON verification_tokens;
-- DROP POLICY IF EXISTS "verification_tokens_select" ON verification_tokens;
-- DROP POLICY IF EXISTS "verification_tokens_insert" ON verification_tokens;
-- DROP POLICY IF EXISTS "verification_tokens_delete" ON verification_tokens;

-- CREATE POLICY "Allow service role all" ON verification_tokens
--     USING (true)
--     WITH CHECK (true);

-- Verify
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'verification_tokens';
