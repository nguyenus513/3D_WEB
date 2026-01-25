-- =====================================================
-- SECURITY TABLES FOR 3D WEB
-- Run this SQL in Supabase SQL Editor AFTER main schema
-- =====================================================

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. SECURITY LOGS TABLE
-- =====================================================
-- Stores all security-related events for audit trail
CREATE TABLE IF NOT EXISTS security_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type TEXT NOT NULL CHECK (event_type IN (
        'LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGIN_BLOCKED',
        'LOGOUT', 'REGISTER', 'PASSWORD_RESET_REQUEST',
        'PASSWORD_RESET_SUCCESS', 'EMAIL_VERIFIED',
        'ADMIN_ACCESS', 'ADMIN_ACTION', 'API_RATE_LIMITED',
        'SUSPICIOUS_ACTIVITY', 'FILE_UPLOAD', 'FILE_REJECTED',
        'PERMISSION_DENIED', 'SESSION_EXPIRED', 'CSRF_VIOLATION'
    )),
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    ip_address INET,
    user_agent TEXT,
    details JSONB DEFAULT '{}',
    severity TEXT NOT NULL CHECK (severity IN ('INFO', 'WARNING', 'CRITICAL')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for security logs
CREATE INDEX IF NOT EXISTS idx_security_logs_event_type ON security_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_security_logs_user_id ON security_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_security_logs_severity ON security_logs(severity);
CREATE INDEX IF NOT EXISTS idx_security_logs_created_at ON security_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_logs_ip ON security_logs(ip_address);
CREATE INDEX IF NOT EXISTS idx_security_logs_composite ON security_logs(event_type, created_at DESC);

-- RLS for security logs (admin only for viewing, system for insert)
ALTER TABLE security_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Only admins can view security logs" ON security_logs;
CREATE POLICY "Only admins can view security logs" ON security_logs FOR SELECT
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "System can insert security logs" ON security_logs;
CREATE POLICY "System can insert security logs" ON security_logs FOR INSERT
    WITH CHECK (true); -- Inserted via service role

-- =====================================================
-- 2. FAILED LOGIN ATTEMPTS TABLE
-- =====================================================
-- Tracks failed login attempts for brute force protection
CREATE TABLE IF NOT EXISTS failed_login_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT NOT NULL,
    ip_address INET NOT NULL,
    attempt_count INTEGER DEFAULT 1,
    first_attempt_at TIMESTAMPTZ DEFAULT NOW(),
    last_attempt_at TIMESTAMPTZ DEFAULT NOW(),
    blocked_until TIMESTAMPTZ,
    user_agent TEXT,
    UNIQUE(email, ip_address)
);

-- Indexes for failed login attempts
CREATE INDEX IF NOT EXISTS idx_failed_login_email ON failed_login_attempts(email);
CREATE INDEX IF NOT EXISTS idx_failed_login_ip ON failed_login_attempts(ip_address);
CREATE INDEX IF NOT EXISTS idx_failed_login_blocked ON failed_login_attempts(blocked_until)
    WHERE blocked_until IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_failed_login_last_attempt ON failed_login_attempts(last_attempt_at DESC);

-- RLS for failed login attempts (admin only for viewing)
ALTER TABLE failed_login_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view failed attempts" ON failed_login_attempts;
CREATE POLICY "Admins can view failed attempts" ON failed_login_attempts FOR SELECT
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "System can manage failed attempts" ON failed_login_attempts;
CREATE POLICY "System can manage failed attempts" ON failed_login_attempts FOR ALL
    WITH CHECK (true); -- Managed via service role

-- =====================================================
-- 3. USER SESSIONS TABLE (for session management)
-- =====================================================
-- Tracks active user sessions for security monitoring
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    session_token TEXT UNIQUE NOT NULL,
    ip_address INET,
    user_agent TEXT,
    device_fingerprint TEXT,
    last_activity_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    is_revoked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for user sessions
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_active ON user_sessions(user_id, is_revoked, expires_at)
    WHERE is_revoked = FALSE;

-- RLS for user sessions
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own sessions" ON user_sessions;
CREATE POLICY "Users can view own sessions" ON user_sessions FOR SELECT
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can revoke own sessions" ON user_sessions;
CREATE POLICY "Users can revoke own sessions" ON user_sessions FOR UPDATE
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can view all sessions" ON user_sessions;
CREATE POLICY "Admins can view all sessions" ON user_sessions FOR SELECT
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "System can manage sessions" ON user_sessions;
CREATE POLICY "System can manage sessions" ON user_sessions FOR ALL
    WITH CHECK (true); -- Managed via service role

-- =====================================================
-- 4. RATE LIMIT LOGS TABLE (for audit)
-- =====================================================
-- Tracks when rate limits are hit for monitoring
CREATE TABLE IF NOT EXISTS rate_limit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    endpoint TEXT NOT NULL,
    ip_address INET NOT NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    hit_count INTEGER DEFAULT 1,
    blocked_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for rate limit logs
CREATE INDEX IF NOT EXISTS idx_rate_limit_endpoint ON rate_limit_logs(endpoint);
CREATE INDEX IF NOT EXISTS idx_rate_limit_ip ON rate_limit_logs(ip_address);
CREATE INDEX IF NOT EXISTS idx_rate_limit_blocked_at ON rate_limit_logs(blocked_at DESC);

-- RLS for rate limit logs (admin only)
ALTER TABLE rate_limit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view rate limit logs" ON rate_limit_logs;
CREATE POLICY "Admins can view rate limit logs" ON rate_limit_logs FOR SELECT
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "System can insert rate limit logs" ON rate_limit_logs;
CREATE POLICY "System can insert rate limit logs" ON rate_limit_logs FOR INSERT
    WITH CHECK (true); -- Inserted via service role

-- =====================================================
-- 5. CSRF TOKENS TABLE (optional, for stateful CSRF)
-- =====================================================
-- For double-submit cookie pattern with database validation
CREATE TABLE IF NOT EXISTS csrf_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    token TEXT UNIQUE NOT NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    session_id TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_csrf_token ON csrf_tokens(token);
CREATE INDEX IF NOT EXISTS idx_csrf_expires ON csrf_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_csrf_user ON csrf_tokens(user_id);

-- RLS
ALTER TABLE csrf_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "System can manage CSRF tokens" ON csrf_tokens;
CREATE POLICY "System can manage CSRF tokens" ON csrf_tokens FOR ALL
    WITH CHECK (true); -- Managed via service role

-- =====================================================
-- CLEANUP FUNCTIONS
-- =====================================================

-- Cleanup old security logs (keep 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_security_logs()
RETURNS void AS $$
BEGIN
    DELETE FROM security_logs WHERE created_at < NOW() - INTERVAL '90 days';
    DELETE FROM failed_login_attempts 
        WHERE last_attempt_at < NOW() - INTERVAL '7 days' 
        AND blocked_until IS NULL;
    DELETE FROM rate_limit_logs WHERE blocked_at < NOW() - INTERVAL '30 days';
    DELETE FROM csrf_tokens WHERE expires_at < NOW();
    DELETE FROM user_sessions 
        WHERE (expires_at < NOW() AND is_revoked = FALSE)
        OR (is_revoked = TRUE AND created_at < NOW() - INTERVAL '7 days');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cleanup expired sessions (run periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
    UPDATE user_sessions 
    SET is_revoked = TRUE 
    WHERE expires_at < NOW() AND is_revoked = FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Unblock IP function (for admin use)
CREATE OR REPLACE FUNCTION unblock_login_ip(target_email TEXT, target_ip INET)
RETURNS void AS $$
BEGIN
    DELETE FROM failed_login_attempts 
    WHERE email = target_email AND ip_address = target_ip;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get blocked IPs function (for admin dashboard)
CREATE OR REPLACE FUNCTION get_blocked_ips()
RETURNS TABLE (
    email TEXT,
    ip_address INET,
    attempt_count INTEGER,
    blocked_until TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        f.email,
        f.ip_address,
        f.attempt_count,
        f.blocked_until
    FROM failed_login_attempts f
    WHERE f.blocked_until IS NOT NULL AND f.blocked_until > NOW()
    ORDER BY f.blocked_until DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- SECURITY DASHBOARD VIEWS
-- =====================================================

-- Recent security events view (for admin dashboard)
CREATE OR REPLACE VIEW recent_security_events AS
SELECT 
    id,
    event_type,
    user_id,
    ip_address::TEXT,
    severity,
    details,
    created_at
FROM security_logs
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 100;

-- Security summary view
CREATE OR REPLACE VIEW security_summary AS
SELECT
    (SELECT COUNT(*) FROM security_logs WHERE event_type = 'LOGIN_FAILED' AND created_at > NOW() - INTERVAL '24 hours') as failed_logins_24h,
    (SELECT COUNT(*) FROM security_logs WHERE event_type = 'LOGIN_BLOCKED' AND created_at > NOW() - INTERVAL '24 hours') as blocked_logins_24h,
    (SELECT COUNT(*) FROM security_logs WHERE event_type = 'API_RATE_LIMITED' AND created_at > NOW() - INTERVAL '24 hours') as rate_limited_24h,
    (SELECT COUNT(*) FROM security_logs WHERE severity = 'CRITICAL' AND created_at > NOW() - INTERVAL '24 hours') as critical_events_24h,
    (SELECT COUNT(*) FROM failed_login_attempts WHERE blocked_until IS NOT NULL AND blocked_until > NOW()) as currently_blocked_ips,
    (SELECT COUNT(*) FROM user_sessions WHERE is_revoked = FALSE AND expires_at > NOW()) as active_sessions;

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================
SELECT 'Security tables created successfully!' AS message;
