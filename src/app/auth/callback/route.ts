import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get('code');
    const origin = requestUrl.origin;

    if (code) {
        const supabase = await createClient();
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);

        if (!error && data.user) {
            // Check/create profile
            const { data: existingProfile } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', data.user.id)
                .single();

            if (!existingProfile) {
                // Create profile for OAuth user
                await supabase.from('profiles').upsert({
                    id: data.user.id,
                    email: data.user.email,
                    full_name: data.user.user_metadata?.full_name || data.user.user_metadata?.name,
                    role: 'customer',
                });
            }

            // Redirect based on role
            const role = existingProfile?.role || 'customer';
            if (role === 'admin') {
                return NextResponse.redirect(`${origin}/admin`);
            }
            return NextResponse.redirect(`${origin}/account`);
        }
    }

    // Error or no code, redirect to login
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
