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

// PUT /api/profile - Update current user's profile
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

        // Update profile
        const updateData: Record<string, string | null> = {
            name,
            phone,
        };

        if (instagram !== undefined) {
            updateData.instagram = instagram;
        }

        const { data: profile, error } = await supabaseAdmin
            .from('profiles')
            .update(updateData)
            .eq('email', session.user.email.toLowerCase())
            .select()
            .single();

        if (error) {
            console.error('[API/PROFILE] Update error:', error);
            return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
        }

        return NextResponse.json(profile);
    } catch (error) {
        console.error('[API/PROFILE] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
