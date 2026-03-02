/**
 * Admin Single Product API Route
 *
 * GET /api/admin/products/[id] - Fetch single product
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/security/admin-guard';

export async function GET(
    request: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        // SECURITY: Verify admin access
        const { authorized, response } = await requireAdmin(request);
        if (!authorized) return response;

        const { id } = await props.params;

        if (!id) {
            return NextResponse.json(
                { success: false, error: { code: 'BAD_REQUEST', message: 'Product ID required' } },
                { status: 400 }
            );
        }

        const supabase = getAdminSupabase();

        const { data, error } = await supabase
            .from('products')
            .select('*, category:categories(id, name), product_variants(*)')
            .eq('id', id)
            .single();

        if (error) {
            console.error('[Admin Products API] Error fetching product:', error);
            if (error.code === 'PGRST116') {
                return NextResponse.json(
                    { success: false, error: { code: 'NOT_FOUND', message: 'Product not found' } },
                    { status: 404 }
                );
            }
            return NextResponse.json(
                { success: false, error: { code: 'DB_ERROR', message: error.message } },
                { status: 500 }
            );
        }

        // Map is_active to status
        const product = {
            ...data,
            status: data.is_active ? 'active' : 'draft',
        };

        return NextResponse.json({ success: true, data: { product } });
    } catch (error) {
        console.error('[Admin Products API] Error:', error);
        return NextResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
            { status: 500 }
        );
    }
}
