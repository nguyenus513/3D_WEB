import { auth } from '@/auth';
import { redirect } from 'next/navigation';

export async function GET() {
    const session = await auth();

    if (!session?.user) {
        redirect('/login');
    }

    // Check if new user (no phone number means incomplete profile)
    const isNewUser = (session.user as { isNewUser?: boolean }).isNewUser;

    if (isNewUser) {
        redirect('/complete-profile');
    }

    redirect('/account');
}
