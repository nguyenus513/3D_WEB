'use client';

import { usePathname } from 'next/navigation';

export function useAdminPath() {
    const pathname = usePathname();
    const firstSegment = pathname.split('/').filter(Boolean)[0];
    const adminRoot = firstSegment && firstSegment !== 'admin' && firstSegment !== 'sys_internal' ? `/${firstSegment}` : '/api/admin/launch';
    return { adminRoot };
}
