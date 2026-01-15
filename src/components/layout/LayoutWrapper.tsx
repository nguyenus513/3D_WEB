'use client';

import { usePathname } from 'next/navigation';
import { NavLusion } from '@/components/layout/NavLusion';
import { Footer } from '@/components/layout/Footer';

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const isAdminPage = pathname.startsWith('/admin');

    // Admin pages have their own layout - no nav/footer
    if (isAdminPage) {
        return <>{children}</>;
    }

    // Regular pages get nav + footer
    return (
        <>
            <NavLusion />
            <main>{children}</main>
            <Footer />
        </>
    );
}
