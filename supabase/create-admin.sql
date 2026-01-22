-- =============================================
-- CREATE ADMIN ACCOUNT
-- Email: miniver2026@3dlab.com
-- Password: Miniver2026@ (hashed with bcrypt)
-- =============================================

INSERT INTO profiles (
    id,
    email,
    full_name,
    name,
    password,
    role,
    customer_code
) VALUES (
    gen_random_uuid(),
    'miniver2026@3dlab.com',
    'Admin 3D Lab',
    'Admin',
    -- Bcrypt hash of 'Miniver2026@' (12 rounds)
    '$2b$12$dzCgkIqbZUpRhPhdxfRvQu2lqvQlfKzEAbErQxqw3JtfA3tVl5MRO',
    'admin'::user_role,
    'ADMIN-001'
)
ON CONFLICT (email) DO UPDATE SET
    role = 'admin'::user_role,
    password = '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.3Fy/wVhEO5qV3i';

-- Verify
SELECT id, email, role, customer_code FROM profiles WHERE email = 'miniver2026@3dlab.com';

