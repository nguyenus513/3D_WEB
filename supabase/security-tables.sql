-- =====================================================
-- Security Enhancement Migration
-- Phase 3: Security Logging
-- Phase 4: Session Management & Token Rotation
-- =====================================================

-- =====================================================
-- 1. SECURITY LOGS TABLE
-- Tracks security events for audit and monitoring
-- =====================================================

CREATE TABLE IF NOT EXISTS security_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    ip_address INET,
    user_agent TEXT,
    details JSONB DEFAULT '{}',
    severity TEXT NOT NULL DEFAULT 'INFO' CHECK (severity IN ('INFO', 'WARNING', 'CRITICAL')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient querying
CREATE INDEX IF NOT EXISTS idx_security_logs_event_type ON security_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_security_logs_user_id ON security_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_security_logs_created_at ON security_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_logs_severity ON security_logs(severity);
CREATE INDEX IF NOT EXISTS idx_security_logs_ip ON security_logs(ip_address);

-- RLS: Admin only
ALTER TABLE security_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin read security logs" ON security_logs;
CREATE POLICY "Admin read security logs" ON security_logs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Service role can insert (for server-side logging)
DROP POLICY IF EXISTS "Service insert security logs" ON security_logs;
CREATE POLICY "Service insert security logs" ON security_logs
    FOR INSERT
    WITH CHECK (true);

-- =====================================================
-- 2. USER SESSIONS TABLE
-- Tracks active sessions for each user
-- =====================================================

CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    session_token TEXT UNIQUE NOT NULL,
    refresh_token TEXT UNIQUE,
    device_fingerprint TEXT,
    ip_address INET,
    user_agent TEXT,
    device_name TEXT,
    is_active BOOLEAN DEFAULT true,
    last_active_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_refresh ON user_sessions(refresh_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at);

-- RLS: Users can only see their own sessions
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own sessions" ON user_sessions;
CREATE POLICY "Users view own sessions" ON user_sessions
    FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own sessions" ON user_sessions;
CREATE POLICY "Users delete own sessions" ON user_sessions
    FOR DELETE
    USING (auth.uid() = user_id);

-- Service role can manage all sessions
DROP POLICY IF EXISTS "Service manage sessions" ON user_sessions;
CREATE POLICY "Service manage sessions" ON user_sessions
    FOR ALL
    WITH CHECK (true);

-- =====================================================
-- 3. REFRESH TOKENS TABLE
-- For secure token rotation
-- =====================================================

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    token_hash TEXT UNIQUE NOT NULL, -- Store hashed, not plain
    session_id UUID REFERENCES user_sessions(id) ON DELETE CASCADE,
    family_id UUID NOT NULL, -- For token rotation tracking
    is_revoked BOOLEAN DEFAULT false,
    revoked_at TIMESTAMPTZ,
    revoked_reason TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_family ON refresh_tokens(family_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_active ON refresh_tokens(is_revoked) WHERE is_revoked = false;

-- RLS
ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;

-- Only service role can access refresh tokens
DROP POLICY IF EXISTS "Service manage refresh tokens" ON refresh_tokens;
CREATE POLICY "Service manage refresh tokens" ON refresh_tokens
    FOR ALL
    WITH CHECK (true);

-- =====================================================
-- 4. FAILED LOGIN ATTEMPTS TABLE
-- For brute force protection
-- =====================================================

CREATE TABLE IF NOT EXISTS failed_login_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    ip_address INET NOT NULL,
    user_agent TEXT,
    attempt_count INTEGER DEFAULT 1,
    first_attempt_at TIMESTAMPTZ DEFAULT NOW(),
    last_attempt_at TIMESTAMPTZ DEFAULT NOW(),
    blocked_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_failed_logins_email ON failed_login_attempts(email);
CREATE INDEX IF NOT EXISTS idx_failed_logins_ip ON failed_login_attempts(ip_address);
CREATE INDEX IF NOT EXISTS idx_failed_logins_blocked ON failed_login_attempts(blocked_until) WHERE blocked_until IS NOT NULL;

-- Composite index for lookup
CREATE UNIQUE INDEX IF NOT EXISTS idx_failed_logins_email_ip ON failed_login_attempts(email, ip_address);

-- RLS
ALTER TABLE failed_login_attempts ENABLE ROW LEVEL SECURITY;

-- Only service role
DROP POLICY IF EXISTS "Service manage failed logins" ON failed_login_attempts;
CREATE POLICY "Service manage failed logins" ON failed_login_attempts
    FOR ALL
    WITH CHECK (true);

-- =====================================================
-- 5. CLEANUP FUNCTIONS
-- =====================================================

-- Function to cleanup expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
    -- Deactivate expired sessions
    UPDATE user_sessions
    SET is_active = false
    WHERE expires_at < NOW() AND is_active = true;
    
    -- Delete very old sessions (30 days)
    DELETE FROM user_sessions
    WHERE created_at < NOW() - INTERVAL '30 days';
    
    -- Delete old security logs (90 days, keep critical)
    DELETE FROM security_logs
    WHERE created_at < NOW() - INTERVAL '90 days'
    AND severity != 'CRITICAL';
    
    -- Delete old failed login attempts (7 days)
    DELETE FROM failed_login_attempts
    WHERE last_attempt_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to revoke all user sessions (for "logout everywhere")
CREATE OR REPLACE FUNCTION revoke_all_user_sessions(target_user_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE user_sessions
    SET is_active = false
    WHERE user_id = target_user_id AND is_active = true;
    
    UPDATE refresh_tokens
    SET is_revoked = true, revoked_at = NOW(), revoked_reason = 'user_logout_all'
    WHERE user_id = target_user_id AND is_revoked = false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 6. GRANTS
-- =====================================================

-- Grant access to authenticated users
GRANT SELECT ON security_logs TO authenticated;
GRANT SELECT, DELETE ON user_sessions TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

COMMENT ON TABLE security_logs IS 'Audit log for security events';
COMMENT ON TABLE user_sessions IS 'Active user sessions for device management';
COMMENT ON TABLE refresh_tokens IS 'Refresh tokens for secure token rotation';
COMMENT ON TABLE failed_login_attempts IS 'Track failed logins for brute force protection';
