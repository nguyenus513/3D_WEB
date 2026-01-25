import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createClient } from '@supabase/supabase-js';

// Supabase admin client
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
);

// GET /api/profile - Get current user's profile
export async function GET() {
    try {
        const session = await auth();

        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { data: profile, error } = await supabaseAdmin
            .from('profiles')
            .select('*')
            .eq('email', session.user.email.toLowerCase())
            .single();

        if (error) {
            console.error('[API/PROFILE] Error:', error);
            return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
        }

        return NextResponse.json(profile);
    } catch (error) {
        console.error('[API/PROFILE] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// PUT /api/profile - Update or create current user's profile
export async function PUT(request: NextRequest) {
    try {
        const session = await auth();

        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { name, phone, instagram } = body;

        // Validate required fields
        if (!name || !phone) {
            return NextResponse.json({ error: 'Name and phone are required' }, { status: 400 });
        }

        const email = session.user.email.toLowerCase();

        // First try to get existing profile
        const { data: existingProfile } = await supabaseAdmin
            .from('profiles')
            .select('id, customer_code')
            .eq('email', email)
            .maybeSingle();

        let profile;
        let error;

        if (existingProfile) {
            // Update existing profile
            const updateData: Record<string, string | null> = {
                name,
                phone,
            };

            if (instagram !== undefined) {
                updateData.instagram = instagram;
            }

            const result = await supabaseAdmin
                .from('profiles')
                .update(updateData)
                .eq('email', email)
                .select()
                .single();

            profile = result.data;
            error = result.error;
        } else {
            // Create new profile
            const { generateId } = await import('@/lib/generateId');
            const customerCode = generateId.user();

            const result = await supabaseAdmin
                .from('profiles')
                .insert({
                    email,
                    name,
                    phone,
                    customer_code: customerCode,
                    email_verified: true,
                    role: 'user',
                    instagram: instagram || null,
                })
                .select()
                .single();

            profile = result.data;
            error = result.error;
        }

        if (error) {
            console.error('[API/PROFILE] Update/Insert error:', error);
            return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
        }

        return NextResponse.json(profile);
    } catch (error) {
        console.error('[API/PROFILE] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
