/**
 * Admin Settings API Route
 * 
 * Handles system_settings and payment_configs tables.
 * Uses Supabase Admin Client to bypass RLS.
 */

import { NextResponse, NextRequest } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/security/admin-guard';
import { requireCsrf } from '@/lib/security/csrf';

/**
 * GET /api/admin/settings
 * Fetch system settings and payment configs
 */
export async function GET(request: NextRequest) {
    try {
        // SECURITY: Verify admin access
        const { authorized, response } = await requireAdmin(request);
        if (!authorized) return response;

        const csrf = await requireCsrf(request);
        if (!csrf.valid) {
            return csrf.error!;
        }

        const supabase = getAdminSupabase();

        // Fetch both tables in parallel
        const [systemRes, paymentRes] = await Promise.all([
            supabase.from('system_settings').select('*').order('key'),
            supabase.from('payment_configs').select('*').order('created_at'),
        ]);

        if (systemRes.error) {
            console.error('[AdminSettings] system_settings error:', systemRes.error);
        }
        if (paymentRes.error) {
            console.error('[AdminSettings] payment_configs error:', paymentRes.error);
        }

        return NextResponse.json({
            system: systemRes.data || [],
            payment: paymentRes.data || [],
        });
    } catch (error: any) {
        console.error('[AdminSettings] GET Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * PUT /api/admin/settings
 * Update settings (system_settings or payment_configs)
 */
export async function PUT(request: NextRequest) {
    try {
        // SECURITY: Verify admin access
        const { authorized, response } = await requireAdmin(request);
        if (!authorized) return response;

        const body = await request.json();
        const { type, data } = body;

        if (!type || !data) {
            return NextResponse.json({ error: 'Missing type or data' }, { status: 400 });
        }

        const supabase = getAdminSupabase();

        if (type === 'system_settings') {
            // Upsert system setting by key
            const { error } = await supabase
                .from('system_settings')
                .upsert(data, { onConflict: 'key' });

            if (error) throw error;
        } else if (type === 'payment_configs') {
            // Update payment config by id
            const { id, ...updateData } = data;
            if (!id) {
                return NextResponse.json({ error: 'Missing id for payment_configs update' }, { status: 400 });
            }

            const { error } = await supabase
                .from('payment_configs')
                .update({ ...updateData, updated_at: new Date().toISOString() })
                .eq('id', id);

            if (error) throw error;
        } else {
            return NextResponse.json({ error: 'Invalid type. Use system_settings or payment_configs' }, { status: 400 });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('[AdminSettings] PUT Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
