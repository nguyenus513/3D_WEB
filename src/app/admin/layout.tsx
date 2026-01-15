import { AdminSidebar, AdminHeader } from '@/components/admin';

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen bg-[#0a0a0a]">
            {/* Sidebar */}
            <AdminSidebar />

            {/* Main content */}
            <div className="pl-64">
                <AdminHeader />
                <main className="p-6">
                    {children}
                </main>
            </div>
        </div>
    );
}
