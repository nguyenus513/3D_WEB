-- ============================================================================
-- Optimization G: Retention cleanup functions
-- Date: 2026-02-06
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cleanup_log_tables()
RETURNS void AS $$
BEGIN
    -- File access logs (90 days)
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'file_access_logs'
    ) THEN
        DELETE FROM public.file_access_logs
        WHERE created_at < NOW() - INTERVAL '90 days';
    END IF;

    -- Security logs (90 days, keep CRITICAL)
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'security_logs'
    ) THEN
        DELETE FROM public.security_logs
        WHERE created_at < NOW() - INTERVAL '90 days'
          AND COALESCE(severity, 'INFO') <> 'CRITICAL';
    END IF;

    -- Failed login attempts (7 days)
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'failed_login_attempts'
    ) THEN
        DELETE FROM public.failed_login_attempts
        WHERE last_attempt_at < NOW() - INTERVAL '7 days';
    END IF;

    -- User sessions (30 days)
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'user_sessions'
    ) THEN
        UPDATE public.user_sessions
        SET is_active = false
        WHERE expires_at < NOW() AND is_active = true;

        DELETE FROM public.user_sessions
        WHERE created_at < NOW() - INTERVAL '30 days';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.cleanup_log_tables IS
'Cleanup routine for log/session tables: file_access_logs (90d), security_logs (90d except CRITICAL), failed_login_attempts (7d), user_sessions (30d).';

-- Optional scheduling with pg_cron (if available):
-- SELECT cron.schedule('cleanup-log-tables', '0 3 * * *', 'SELECT public.cleanup_log_tables();');
