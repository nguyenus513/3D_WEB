import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createClient } from '@supabase/supabase-js';

// Supabase admin client to bypass RLS
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/admin/notifications
 * 
 * Fetches pending/paid orders for admin notifications dropdown.
 * Uses admin client to bypass RLS.
 */
export async function GET() {
    try {
        // Verify admin auth
        const session = await auth();
        const userRole = (session?.user as { role?: string })?.role;
        if (!session?.user || userRole !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Fetch pending/paid orders using admin client
        const { data, error } = await supabaseAdmin
            .from('orders')
            .select('id, order_code, order_type, status, total, created_at')
            .in('status', ['pending', 'paid'])
            .order('created_at', { ascending: false })
            .limit(10);

        if (error) {
            console.error('Notifications fetch error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ orders: data || [] });
    } catch (error) {
        console.error('Notifications API error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
