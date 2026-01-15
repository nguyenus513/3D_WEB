import { AccountSidebar } from '@/components/account';
import Link from 'next/link';

export default function AccountLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen bg-[#0a0a0a] pt-28 pb-20">
            <div className="max-w-[1200px] mx-auto px-6">
                {/* Breadcrumb */}
                <nav className="mb-8">
                    <ol className="flex items-center gap-2 text-sm text-white/50">
                        <li><Link href="/" className="hover:text-white transition-colors">Trang chủ</Link></li>
                        <li>/</li>
                        <li className="text-white">Tài khoản</li>
                    </ol>
                </nav>

                {/* Layout grid */}
                <div className="flex flex-col lg:flex-row gap-8">
                    {/* Sidebar */}
                    <AccountSidebar />

                    {/* Main content */}
                    <main className="flex-1 min-w-0">
                        {children}
                    </main>
                </div>
            </div>
        </div>
    );
}
