'use client';

import { usePathname } from 'next/navigation';
import { NavLusion } from '@/components/layout/NavLusion';
import { Footer } from '@/components/layout/Footer';
import ContactWidget from '@/components/ui/ContactWidget';

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    // Admin pages have their own layout (sidebar + header)
    const isAdminPage = pathname.startsWith('/admin') || pathname.startsWith('/sys_internal');

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
