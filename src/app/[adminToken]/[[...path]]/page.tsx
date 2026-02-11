'use client';

import { useParams, notFound } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

// Dynamic imports for admin pages
const AdminDashboardContent = dynamic(() => import('../AdminDashboardContent'));
const OrderList = dynamic(() => import('@/components/admin/OrderList').then(m => ({ default: m.OrderList })));
const AdminItemList = dynamic(() => import('@/components/admin/AdminItemList').then(m => ({ default: m.AdminItemList })));
const AdminCustomersPage = dynamic(() => import('@/app/sys_internal/customers/page'));
const AdminCategoriesPage = dynamic(() => import('@/app/sys_internal/categories/page'));
const AdminProductsPage = dynamic(() => import('@/app/sys_internal/products/page'));
const AdminSettingsPage = dynamic(() => import('@/app/sys_internal/settings/page'));
const AdminRevenuePage = dynamic(() => import('@/app/sys_internal/revenue/page'));
const AdminFeaturedPage = dynamic(() => import('@/app/sys_internal/featured/page'));
const AdminPrintingPage = dynamic(() => import('@/app/sys_internal/printing/page'));
const AdminCustomPage = dynamic(() => import('@/app/sys_internal/custom/page'));

// Dynamic pages with IDs
const AdminOrderDetailPage = dynamic(() => import('@/app/sys_internal/orders/[id]/page'));
const AdminCustomerDetailPage = dynamic(() => import('@/app/sys_internal/customers/[id]/page'));
const AdminProductDetailPage = dynamic(() => import('@/app/sys_internal/products/[id]/page'));
const AdminProductNewPage = dynamic(() => import('@/app/sys_internal/products/new/page'));
const AdminPrintingDetailPage = dynamic(() => import('@/app/sys_internal/printing/[id]/page'));
const AdminCustomDetailPage = dynamic(() => import('@/app/sys_internal/custom/[id]/page'));

// Excluded paths (not admin routes)
const EXCLUDED_PATHS = [
    'about', 'account', 'admin', 'api', 'auth', 'cart', 'checkout',
    'custom', 'faq', 'forgot-password', 'login', 'printing',
    'products', 'register', 'reset-password', 'sys_internal',
    'favicon.ico', '_next', 'static'
];

// Loading component
function LoadingSpinner() {
    return (
        <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        </div>
    );
}

export default function AdminCatchAllPage() {
    const params = useParams();
    const [isValid, setIsValid] = useState<boolean | null>(null);

    // Get adminToken and path segments
    const adminToken = params.adminToken as string;
    const pathSegments = (params.path as string[] | undefined) || [];
    const path = pathSegments.join('/');

    // Verify token format (50 alphanumeric characters)
    const isValidTokenFormat = /^[a-zA-Z0-9]{50}$/.test(adminToken || '');

    // Check if this is an excluded path (not an admin token)
    if (adminToken && (EXCLUDED_PATHS.includes(adminToken) || adminToken.startsWith('_') || !isValidTokenFormat)) {
        notFound();
    }

    // Verify session on mount
    useEffect(() => {
        const verifySession = async () => {
            try {
                const res = await fetch('/api/auth/session');
                const session = await res.json();

                if (session?.user?.role === 'admin') {
                    setIsValid(true);
                } else {
                    setIsValid(false);
                    window.location.href = '/login';
                }
            } catch {
                setIsValid(false);
                window.location.href = '/login';
            }
        };
        verifySession();
    }, []);

    if (isValid === null) {
        return <LoadingSpinner />;
    }

    if (!isValid) {
        return null;
    }

    // Route to appropriate component based on path
    // Dashboard (empty path)
    if (path === '' || !path) {
        return <AdminDashboardContent />;
    }

    // /orders (TẤT CẢ - đơn tổng / cart view)
    if (path === 'orders') {
        return <OrderList orderType="all" title="Tất cả đơn hàng" subtitle="Danh sách đơn tổng (cart)" />;
    }

    // /orders/products (đơn con - sản phẩm có sẵn)
    if (path === 'orders/products') {
        return <AdminItemList itemType="product" title="Đơn sản phẩm" subtitle="Đơn con - Hàng có sẵn" />;
    }

    // /orders/printing (đơn con - in 3D)
    if (path === 'orders/printing') {
        return <AdminItemList itemType="printing" title="Đơn in 3D" subtitle="Đơn con - Xưởng in 3D" />;
    }

    // /orders/custom (đơn con - hàng theo yêu cầu)
    if (path === 'orders/custom') {
        return <AdminItemList itemType="custom" title="Đơn Custom" subtitle="Đơn con - Hàng theo yêu cầu" />;
    }

    // /orders/[id]
    if (pathSegments[0] === 'orders' && pathSegments[1] && !['products', 'printing', 'custom'].includes(pathSegments[1])) {
        // Component uses useParams() internally
        return <AdminOrderDetailPage />;
    }

    // /customers
    if (path === 'customers') {
        return <AdminCustomersPage />;
    }

    // /customers/[id]
    if (pathSegments[0] === 'customers' && pathSegments[1]) {
        // Component uses useParams() internally
        return <AdminCustomerDetailPage />;
    }

    // /products
    if (path === 'products') {
        return <AdminProductsPage />;
    }

    // /products/new
    if (path === 'products/new') {
        return <AdminProductNewPage />;
    }

    // /products/[id]
    if (pathSegments[0] === 'products' && pathSegments[1] && pathSegments[1] !== 'new') {
        // Component uses useParams() internally
        return <AdminProductDetailPage />;
    }

    // /categories
    if (path === 'categories') {
        return <AdminCategoriesPage />;
    }

    // /settings
    if (path === 'settings') {
        return <AdminSettingsPage />;
    }

    // /revenue
    if (path === 'revenue') {
        return <AdminRevenuePage />;
    }

    // /featured
    if (path === 'featured') {
        return <AdminFeaturedPage />;
    }

    // /printing
    if (path === 'printing') {
        return <AdminPrintingPage />;
    }

    // /printing/[id]
    if (pathSegments[0] === 'printing' && pathSegments[1]) {
        // Component uses useParams() internally
        return <AdminPrintingDetailPage />;
    }

    // /custom
    if (path === 'custom') {
        return <AdminCustomPage />;
    }

    // /custom/[id]
    if (pathSegments[0] === 'custom' && pathSegments[1]) {
        // Component uses useParams() internally
        return <AdminCustomDetailPage />;
    }

    // Not found
    return (
        <div className="flex flex-col items-center justify-center h-64 text-center">
            <h2 className="text-2xl font-bold text-white mb-2">404</h2>
            <p className="text-white/50">Trang không tồn tại: /{path}</p>
        </div>
    );
}
