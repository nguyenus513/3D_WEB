import { auth } from '@/auth';
import { redirect } from 'next/navigation';

export async function GET() {
    const session = await auth();

    if (!session?.user) {
        redirect('/login');
    }

    // Check if new user (no phone number means incomplete profile)
    const isNewUser = (session.user as { isNewUser?: boolean }).isNewUser;

    // Redirect admins to internal system FIRST (skip profile completion)
    const role = (session.user as { role?: string }).role;
    if (role === 'admin') {
        redirect('/sys_internal');
    }

    if (isNewUser) {
        redirect('/complete-profile');
    }

    redirect('/account');
}
