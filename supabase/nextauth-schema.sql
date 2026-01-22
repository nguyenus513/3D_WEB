-- NextAuth.js Schema for Supabase
-- Run this in Supabase SQL Editor

-- 1. Create users table (NextAuth compatible)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT,
    email TEXT UNIQUE NOT NULL,
    "emailVerified" TIMESTAMPTZ,
    image TEXT,
    password TEXT, -- For credentials provider (bcrypt hash)
    role TEXT DEFAULT 'user', -- 'user' or 'admin'
    phone TEXT,
    customer_code TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create accounts table (for OAuth providers like Google, Facebook)
CREATE TABLE IF NOT EXISTS public.accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    provider TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    refresh_token TEXT,
    access_token TEXT,
    expires_at BIGINT,
    token_type TEXT,
    scope TEXT,
    id_token TEXT,
    session_state TEXT,
    UNIQUE(provider, "providerAccountId")
);

-- 3. Create sessions table
CREATE TABLE IF NOT EXISTS public.sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "sessionToken" TEXT UNIQUE NOT NULL,
    "userId" UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    expires TIMESTAMPTZ NOT NULL
);

-- 4. Create verification tokens table (for email OTP / magic links)
CREATE TABLE IF NOT EXISTS public.verification_tokens (
    identifier TEXT NOT NULL,
    token TEXT NOT NULL,
    expires TIMESTAMPTZ NOT NULL,
    UNIQUE(identifier, token)
);

-- 5. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_accounts_user ON public.accounts("userId");
CREATE INDEX IF NOT EXISTS idx_sessions_user ON public.sessions("userId");
CREATE INDEX IF NOT EXISTS idx_sessions_token ON public.sessions("sessionToken");

-- 6. Enable Row Level Security (optional but recommended)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_tokens ENABLE ROW LEVEL SECURITY;

-- 7. Policies (allow service role full access)
CREATE POLICY "Service role access" ON public.users FOR ALL USING (true);
CREATE POLICY "Service role access" ON public.accounts FOR ALL USING (true);
CREATE POLICY "Service role access" ON public.sessions FOR ALL USING (true);
CREATE POLICY "Service role access" ON public.verification_tokens FOR ALL USING (true);

-- 8. Generate customer code function
CREATE OR REPLACE FUNCTION generate_customer_code()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.customer_code IS NULL THEN
        NEW.customer_code := 'KH-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', ''), 1, 8));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 9. Trigger to auto-generate customer code
DROP TRIGGER IF EXISTS trigger_generate_customer_code ON public.users;
CREATE TRIGGER trigger_generate_customer_code
    BEFORE INSERT ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION generate_customer_code();

-- Done! Now go to your app and configure NextAuth.
