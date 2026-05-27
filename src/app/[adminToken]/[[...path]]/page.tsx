import { notFound, redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { auth } from '@/auth';
import AdminCatchAllClient from './AdminCatchAllClient';

const EXCLUDED_PATHS = new Set([
    'about', 'account', 'admin', 'api', 'auth', 'cart', 'checkout',
    'custom', 'faq', 'forgot-password', 'login', 'printing',
    'products', 'register', 'reset-password', 'sys_internal',
    'favicon.ico', '_next', 'static',
]);

export default async function AdminCatchAllPage({ params }: { params: Promise<{ adminToken?: string; path?: string[] }> }) {
    const { adminToken } = await params;
    const token = adminToken || '';

    if (EXCLUDED_PATHS.has(token) || token.startsWith('_') || !/^[a-zA-Z0-9]{50}$/.test(token)) {
        notFound();
    }

    const session = await auth();
    if ((session?.user as { role?: string } | undefined)?.role !== 'admin') {
        redirect('/login?callbackUrl=/admin/verify-2fa');
    }

    const cookieStore = await cookies();
    if (cookieStore.get('admin_phoenix_token')?.value !== token) {
        notFound();
    }

    return <AdminCatchAllClient />;
}
