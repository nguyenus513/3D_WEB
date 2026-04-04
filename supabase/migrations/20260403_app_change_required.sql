-- =============================================================================
-- Migration: Auth Hardening + Convention Normalization
-- =============================================================================
-- ⚠️  DO NOT RUN THIS MIGRATION until the corresponding app code changes
--     have been made and deployed. Running this on a live app without
--     updating the code first will break authentication completely.
--
-- STEPS before running this file:
--   1. Update NextAuth v5 adapter to use new column names
--   2. Update app code that reads/writes file_links and notifications.ref_type
--   3. Deploy updated app code
--   4. Verify auth works in staging environment
--   5. Then run this SQL in Supabase Dashboard SQL Editor
-- =============================================================================

-- =============================================================================
-- SECTION A: AUTH COLUMN RENAMES (requires NextAuth adapter update first)
-- =============================================================================

-- A1. users: rename password → password_hash
-- NextAuth adapter must be updated to use "password_hash" instead of "password"
-- before this runs. The transition column "password_hash" was added in
-- 20260402_integrity_constraints.sql — populate it in app layer first.
--
-- ALTER TABLE public.users RENAME COLUMN password TO password_hash;

-- A2. sessions: rename sessionToken → session_token (snake_case + semantic clarity)
-- NextAuth adapter must reference "session_token" after this rename.
--
-- ALTER TABLE public.sessions RENAME COLUMN "sessionToken" TO session_token;

-- A3. sessions: rename userId → user_id
--
-- ALTER TABLE public.sessions RENAME COLUMN "userId" TO user_id;

-- A4. sessions: rename expires → expires_at (consistent with rest of schema)
--
-- ALTER TABLE public.sessions RENAME COLUMN expires TO expires_at;

-- A5. verification_tokens: rename token → token_hash
-- App must hash tokens before storing (SHA-256) and compare hashes on verify.
--
-- ALTER TABLE public.verification_tokens RENAME COLUMN token TO token_hash;

-- A6. verification_tokens: rename expires → expires_at
--
-- ALTER TABLE public.verification_tokens RENAME COLUMN expires TO expires_at;

-- A7. accounts: rename camelCase columns → snake_case
-- NextAuth adapter must be updated for all renames below.
--
-- ALTER TABLE public.accounts RENAME COLUMN "userId"            TO user_id;
-- ALTER TABLE public.accounts RENAME COLUMN "providerAccountId" TO provider_account_id;
-- ALTER TABLE public.accounts RENAME COLUMN "access_token"      TO raw_access_token;   -- keep temporarily
-- ALTER TABLE public.accounts RENAME COLUMN "refresh_token"     TO raw_refresh_token;  -- keep temporarily
-- ALTER TABLE public.accounts RENAME COLUMN "id_token"          TO raw_id_token;       -- keep temporarily
-- ALTER TABLE public.accounts RENAME COLUMN "token_type"        TO token_type;         -- already snake_case
-- ALTER TABLE public.accounts RENAME COLUMN "expires_at"        TO access_token_expires_at;
-- ALTER TABLE public.accounts RENAME COLUMN "session_state"     TO session_state;      -- already snake_case

-- A8. users: rename emailVerified → email_verified_at
--
-- ALTER TABLE public.users RENAME COLUMN "emailVerified" TO email_verified_at;

-- =============================================================================
-- SECTION B: DROP RAW TOKEN COLUMNS
-- Run AFTER app has migrated fully to encrypted_* columns for OAuth tokens.
-- =============================================================================

-- B1. Drop raw OAuth token columns from accounts once encrypted_* are in use
--
-- ALTER TABLE public.accounts
--   DROP COLUMN IF EXISTS raw_refresh_token,
--   DROP COLUMN IF EXISTS raw_access_token,
--   DROP COLUMN IF EXISTS raw_id_token;

-- =============================================================================
-- SECTION C: CLEAN UP POLYMORPHIC PATTERNS
-- Run AFTER app code writes only to new junction tables and typed FK columns.
-- =============================================================================

-- C1. Drop file_links polymorphic table
-- First verify all active file references are in order_files/order_item_files/revision_files
--
-- DROP TABLE IF EXISTS public.file_links;

-- C2. Drop polymorphic columns from notifications
-- First verify app no longer reads/writes ref_type and ref_id
--
-- ALTER TABLE public.notifications
--   DROP COLUMN IF EXISTS ref_type,
--   DROP COLUMN IF EXISTS ref_id;

-- =============================================================================
-- SECTION D: ADD TOKEN SECURITY CONSTRAINTS
-- Run AFTER column renames in Section A are applied.
-- =============================================================================

-- D1. sessions: token must look like a hash (≥ 40 chars hex)
--   ALTER TABLE public.sessions
--     ADD CONSTRAINT sessions_token_hash_len_chk CHECK (length(session_token) >= 40);

-- D2. verification_tokens: token_hash length
--   ALTER TABLE public.verification_tokens
--     ADD CONSTRAINT verification_tokens_hash_len_chk CHECK (length(token_hash) >= 40);

-- =============================================================================
-- SECTION E: UPDATED_AT TRIGGERS (re-create with new snake_case column names)
-- Run AFTER all renames in Section A are done.
-- =============================================================================

-- E1. Re-create sessions updated_at trigger if sessions gets updated_at column
--   ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
--   DROP TRIGGER IF EXISTS trg_sessions_set_updated_at ON public.sessions;
--   CREATE TRIGGER trg_sessions_set_updated_at
--   BEFORE UPDATE ON public.sessions
--   FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =============================================================================
-- SECTION F: UUID DEFAULT NORMALIZATION
-- Standardize to gen_random_uuid() everywhere (drop uuid_generate_v4() usage)
-- =============================================================================

-- This is safe to apply at any time — only affects new row defaults.
-- Find tables still using uuid_generate_v4():

-- SELECT table_name, column_name, column_default
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND column_default LIKE '%uuid_generate_v4%';

-- For each found, run:
-- ALTER TABLE <table> ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- =============================================================================
-- CHECKLIST (update as steps are completed)
-- =============================================================================
-- [ ] NextAuth v5 adapter updated for snake_case column names
-- [ ] App code reads encrypted_* OAuth tokens instead of raw fields
-- [ ] App code writes to order_files / order_item_files / revision_files
-- [ ] App code uses notifications.ref_order_id / ref_payment_id etc.
-- [ ] Staging environment verified with new column names
-- [ ] Section A renames applied to production
-- [ ] Section B raw token columns dropped
-- [ ] Section C polymorphic tables/columns dropped
-- [ ] Section D token constraints added
-- [ ] Section E updated_at triggers re-created
-- [ ] Section F UUID defaults normalized
-- =============================================================================
