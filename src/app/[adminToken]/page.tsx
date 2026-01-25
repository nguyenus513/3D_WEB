import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import AdminDashboardContent from './AdminDashboardContent';

interface PageProps {
    params: Promise<{ adminToken: string }>;
}

// List of paths that should NOT be caught by this dynamic route
const EXCLUDED_PATHS = [
    'about', 'account', 'admin', 'api', 'auth', 'cart', 'checkout',
    'custom', 'faq', 'forgot-password', 'login', 'printing',
    'products', 'register', 'reset-password', 'sys_internal',
    'favicon.ico', '_next', 'static'
];

export default async function AdminTokenPage({ params }: PageProps) {
    const { adminToken } = await params;

    // Skip if this is a known route (let Next.js handle it)
    if (EXCLUDED_PATHS.includes(adminToken) || adminToken.startsWith('_')) {
        notFound();
    }

    // Token must be exactly 50 alphanumeric characters
    const isValidTokenFormat = /^[a-zA-Z0-9]{50}$/.test(adminToken);
    if (!isValidTokenFormat) {
        notFound();
    }

    // Verify token from cookie matches URL
    const cookieStore = await cookies();
    const storedToken = cookieStore.get('admin_phoenix_token')?.value;

    if (!storedToken || storedToken !== adminToken) {
        // Invalid or missing token - redirect to login
        redirect('/login');
    }

    // Token verified! Render admin dashboard
    return <AdminDashboardContent />;
}
