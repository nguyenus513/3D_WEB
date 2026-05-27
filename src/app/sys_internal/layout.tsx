import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import AdminShell from '@/components/admin/AdminShell';

export default async function SysInternalLayout({ children }: { children: React.ReactNode }) {
    const session = await auth();
    if ((session?.user as { role?: string } | undefined)?.role !== 'admin') {
        redirect('/login?callbackUrl=/admin/verify-2fa');
    }

    return <AdminShell>{children}</AdminShell>;
}
