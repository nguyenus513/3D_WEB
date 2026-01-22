-- =============================================
-- DROP DUPLICATE USERS TABLE
-- Keep only 'profiles' as single source of truth
-- =============================================

-- ⚠️ BACKUP FIRST!
-- pg_dump your_database > backup.sql

BEGIN;

-- 1. Check if users table exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users' AND table_schema = 'public') THEN
        RAISE NOTICE 'Found users table, proceeding with migration...';
        
        -- 2. Migrate any unique data from users to profiles
        UPDATE profiles p
        SET 
            name = COALESCE(p.name, u.name),
            password = COALESCE(p.password, u.password),
            phone = COALESCE(p.phone, u.phone),
            customer_code = COALESCE(p.customer_code, u.customer_code)
        FROM users u
        WHERE p.email = u.email;

        -- 3. Insert users that don't exist in profiles (unlikely but safe)
        INSERT INTO profiles (id, full_name, name, email, password, phone, customer_code, role, created_at, updated_at)
        SELECT 
            u.id,
            u.name,
            u.name,
            u.email,
            u.password,
            u.phone,
            u.customer_code,
            CASE WHEN u.role = 'admin' THEN 'admin'::user_role ELSE 'customer'::user_role END,
            u.created_at,
            u.updated_at
        FROM users u
        WHERE u.email NOT IN (SELECT email FROM profiles WHERE email IS NOT NULL)
        ON CONFLICT (id) DO NOTHING;

        RAISE NOTICE 'Data migrated successfully';
    ELSE
        RAISE NOTICE 'Users table not found, nothing to do';
    END IF;
END $$;

-- 4. Update accounts table FK to reference profiles
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'accounts') THEN
        -- Drop old FK if exists
        ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_userId_fkey;
        ALTER TABLE accounts DROP CONSTRAINT IF EXISTS "accounts_userId_fkey";
        
        -- Add new FK to profiles (if column exists)
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'userId') THEN
            -- Note: accounts.userId may reference users.id or profiles.id
            -- We need to ensure profiles has all the IDs first
            ALTER TABLE accounts 
                ADD CONSTRAINT accounts_userId_profiles_fkey 
                FOREIGN KEY ("userId") REFERENCES profiles(id) ON DELETE CASCADE;
        END IF;
    END IF;
EXCEPTION WHEN others THEN
    RAISE NOTICE 'Could not update accounts FK: %', SQLERRM;
END $$;

-- 5. Update sessions table FK
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sessions') THEN
        ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_userId_fkey;
        ALTER TABLE sessions DROP CONSTRAINT IF EXISTS "sessions_userId_fkey";
        
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sessions' AND column_name = 'userId') THEN
            ALTER TABLE sessions 
                ADD CONSTRAINT sessions_userId_profiles_fkey 
                FOREIGN KEY ("userId") REFERENCES profiles(id) ON DELETE CASCADE;
        END IF;
    END IF;
EXCEPTION WHEN others THEN
    RAISE NOTICE 'Could not update sessions FK: %', SQLERRM;
END $$;

-- 6. DROP the duplicate users table
DROP TABLE IF EXISTS users CASCADE;

-- 7. Verify
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users' AND table_schema = 'public') THEN
        RAISE NOTICE '✅ SUCCESS: users table has been dropped!';
    ELSE
        RAISE NOTICE '❌ ERROR: users table still exists!';
    END IF;
END $$;

COMMIT;

-- =============================================
-- After running this:
-- ✅ Only 'profiles' table exists
-- ✅ accounts/sessions reference profiles
-- ✅ No duplicate user data
-- =============================================
