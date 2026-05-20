import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { NextRequest } from 'next/server';

function getSafeCallbackUrl(request: NextRequest): string {
    const callbackUrl = request.nextUrl.searchParams.get('callbackUrl') || '/account';
    return callbackUrl.startsWith('/') && !callbackUrl.startsWith('//') ? callbackUrl : '/account';
}

export async function GET(request: NextRequest) {
    const session = await auth();
    const callbackUrl = getSafeCallbackUrl(request);

    if (!session?.user) {
        redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
    }

    // Check if new user (no phone number means incomplete profile)
    const isNewUser = (session.user as { isNewUser?: boolean }).isNewUser;

    // Redirect admins to internal system FIRST (skip profile completion)
    const role = (session.user as { role?: string }).role;
    if (role === 'admin') {
        redirect('/sys_internal');
    }

    if (isNewUser) {
        redirect(`/complete-profile?callbackUrl=${encodeURIComponent(callbackUrl)}`);
    }

    redirect(callbackUrl);
}
