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
        console.log('[API/PROFILE] Session:', JSON.stringify(session, null, 2));

        if (!session?.user?.email) {
            console.log('[API/PROFILE] No session or email');
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        console.log('[API/PROFILE] Request body:', body);
        const { name, phone, instagram } = body;

        // Validate required fields
        if (!name || !phone) {
            console.log('[API/PROFILE] Missing name or phone');
            return NextResponse.json({ error: 'Name and phone are required' }, { status: 400 });
        }

        const email = session.user.email.toLowerCase();
        console.log('[API/PROFILE] Processing for email:', email);

        // First try to get existing profile
        const { data: existingProfile, error: queryError } = await supabaseAdmin
            .from('profiles')
            .select('id, customer_code')
            .eq('email', email)
            .maybeSingle();

        console.log('[API/PROFILE] Existing profile:', existingProfile);
        console.log('[API/PROFILE] Query error:', queryError);

        let profile;
        let error;

        if (existingProfile) {
            console.log('[API/PROFILE] Updating existing profile...');
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

            console.log('[API/PROFILE] Update result:', result);
            profile = result.data;
            error = result.error;
        } else {
            console.log('[API/PROFILE] Creating new profile...');
            // Create new profile
            const { generateId } = await import('@/lib/generateId');
            const customerCode = generateId.user();
            console.log('[API/PROFILE] Generated customer code:', customerCode);

            const insertData = {
                id: crypto.randomUUID(), // Generate UUID for id column
                email,
                name,
                phone,
                customer_code: customerCode,
                email_verified: true,
                role: 'customer', // Must be 'customer' or 'admin' per profiles_role_check constraint
                instagram: instagram || null,
            };
            console.log('[API/PROFILE] Insert data:', insertData);

            const result = await supabaseAdmin
                .from('profiles')
                .insert(insertData)
                .select()
                .single();

            console.log('[API/PROFILE] Insert result:', result);
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
