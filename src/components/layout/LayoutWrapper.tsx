'use client';

import { usePathname } from 'next/navigation';
import { NavLusion } from '@/components/layout/NavLusion';
import { Footer } from '@/components/layout/Footer';
import ContactWidget from '@/components/ui/ContactWidget';

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    // Admin pages detection:
    // 1. sys_internal (internal path after rewrite)
    // 2. Long random tokens (50 chars like /A7x...Z9k)
    const pathSegment = pathname.split('/')[1] || '';
    const isAdminPage = pathname.startsWith('/sys_internal') || pathSegment.length >= 40;

    // Admin pages have their own layout - no nav/footer
    if (isAdminPage) {
        return <>{children}</>;
    }

    // Regular pages get nav + footer + contact widget
    return (
        <>
            <NavLusion />
            <main>{children}</main>
            <Footer />
            <ContactWidget />
        </>
    );
}
