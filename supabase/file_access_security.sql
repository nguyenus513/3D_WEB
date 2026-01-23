-- =====================================================
-- File Access Security Migration
-- =====================================================
-- Purpose: Track file ownership and access logs for R2 security
-- 
-- Features:
-- 1. Track which users can access which files
-- 2. Audit log for all file access attempts
-- 3. RLS policies for security
-- =====================================================

-- =====================================================
-- 1. Update order_files table for ownership tracking
-- =====================================================

-- Add allowed_user_ids if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'order_files' AND column_name = 'allowed_user_ids'
    ) THEN
        ALTER TABLE order_files ADD COLUMN allowed_user_ids UUID[] DEFAULT '{}';
    END IF;
END $$;

-- Add owner_id for direct ownership
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'order_files' AND column_name = 'owner_id'
    ) THEN
        ALTER TABLE order_files ADD COLUMN owner_id UUID REFERENCES profiles(id);
    END IF;
END $$;

-- Add is_public flag for product images
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'order_files' AND column_name = 'is_public'
    ) THEN
        ALTER TABLE order_files ADD COLUMN is_public BOOLEAN DEFAULT false;
    END IF;
END $$;

-- =====================================================
-- 2. Create file_access_logs table
-- =====================================================

CREATE TABLE IF NOT EXISTS file_access_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_key TEXT NOT NULL,
    file_id UUID REFERENCES order_files(id),
    user_id UUID REFERENCES profiles(id),
    action TEXT NOT NULL CHECK (action IN ('view', 'download', 'delete')),
    ip_address TEXT,
    user_agent TEXT,
    success BOOLEAN DEFAULT true,
    denied_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_file_access_logs_file_key ON file_access_logs(file_key);
CREATE INDEX IF NOT EXISTS idx_file_access_logs_user_id ON file_access_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_file_access_logs_created_at ON file_access_logs(created_at DESC);

-- =====================================================
-- 3. RLS Policies
-- =====================================================

-- Enable RLS on file_access_logs
ALTER TABLE file_access_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Admin can view all logs" ON file_access_logs;
DROP POLICY IF EXISTS "Users can view own logs" ON file_access_logs;
DROP POLICY IF EXISTS "Service can insert logs" ON file_access_logs;

-- Admin can view all logs
CREATE POLICY "Admin can view all logs" ON file_access_logs
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'admin'
        )
    );

-- Users can view their own access logs
CREATE POLICY "Users can view own logs" ON file_access_logs
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

-- Allow service role to insert (for API logging)
CREATE POLICY "Service can insert logs" ON file_access_logs
    FOR INSERT TO authenticated
    WITH CHECK (true);

-- =====================================================
-- 4. Helper function to check file access
-- =====================================================

CREATE OR REPLACE FUNCTION can_access_file(
    p_user_id UUID,
    p_file_key TEXT
) RETURNS BOOLEAN AS $$
DECLARE
    v_file_record RECORD;
    v_user_role TEXT;
BEGIN
    -- Get user role
    SELECT role INTO v_user_role FROM profiles WHERE id = p_user_id;
    
    -- Admin can access everything
    IF v_user_role = 'admin' THEN
        RETURN true;
    END IF;
    
    -- Find the file
    SELECT * INTO v_file_record 
    FROM order_files 
    WHERE file_key = p_file_key OR file_id = p_file_key
    LIMIT 1;
    
    -- File not found
    IF NOT FOUND THEN
        RETURN false;
    END IF;
    
    -- Public files
    IF v_file_record.is_public THEN
        RETURN true;
    END IF;
    
    -- Owner check
    IF v_file_record.owner_id = p_user_id THEN
        RETURN true;
    END IF;
    
    -- Allowed users check
    IF p_user_id = ANY(v_file_record.allowed_user_ids) THEN
        RETURN true;
    END IF;
    
    -- Check if user owns the order
    IF EXISTS (
        SELECT 1 FROM orders 
        WHERE id = v_file_record.order_id 
        AND user_id = p_user_id
    ) THEN
        RETURN true;
    END IF;
    
    RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 5. Update existing order_files with ownership
-- =====================================================

-- Set owner_id from order's user_id for existing records
UPDATE order_files 
SET owner_id = orders.user_id
FROM orders 
WHERE order_files.order_id = orders.id 
AND order_files.owner_id IS NULL;

-- =====================================================
-- Done!
-- =====================================================

COMMENT ON TABLE file_access_logs IS 'Audit log for all file access attempts for security tracking';
COMMENT ON COLUMN order_files.allowed_user_ids IS 'Array of user IDs allowed to access this file';
COMMENT ON COLUMN order_files.owner_id IS 'User who uploaded this file';
COMMENT ON COLUMN order_files.is_public IS 'If true, file is publicly accessible (e.g., product images)';
