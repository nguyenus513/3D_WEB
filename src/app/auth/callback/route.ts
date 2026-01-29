import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Service role client for bypassing RLS
const supabaseAdmin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get('code');
    const origin = requestUrl.origin;

    if (code) {
        const supabase = await createClient();
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);

        if (!error && data.user) {
            // Use admin client to bypass RLS
            const { data: existingProfile } = await supabaseAdmin
                .from('profiles')
                .select('role')
                .eq('id', data.user.id)
                .single();

            if (!existingProfile) {
                // Create profile for OAuth user
                await supabaseAdmin.from('profiles').upsert({
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
