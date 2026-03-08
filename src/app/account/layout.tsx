import { AccountSidebar } from '@/components/account';
import Link from 'next/link';
import { Separator } from '@/components/ui/separator';

export default function AccountLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen bg-[var(--bg-void)] pt-28 pb-20">
            <div className="max-w-[1200px] mx-auto px-6">
                <nav className="mb-8">
                    <ol className="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
                        <li><Link href="/" className="hover:text-[var(--text-primary)] transition-colors">Trang chủ</Link></li>
                        <li>/</li>
                        <li className="text-[var(--text-primary)]">Tài khoản</li>
                    </ol>
                </nav>

                <Separator className="mb-8" />

                <div className="flex flex-col lg:flex-row gap-8">
                    <AccountSidebar />

                    <main className="flex-1 min-w-0">
                        {children}
                    </main>
                </div>
            </div>
        </div>
    );
}
