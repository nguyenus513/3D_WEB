/**
 * Featured Products API - Public endpoint
 * GET: Returns products with is_featured = true
 */

import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase/client';

export async function GET() {
    try {
        const supabase = getSupabase();

        const { data, error } = await supabase
            .from('products')
            .select('id, name, slug, base_price, sale_price, images, short_description')
            .eq('is_featured', true)
            .eq('status', 'active')
            .order('updated_at', { ascending: false })
            .limit(8);

        if (error) {
            console.error('Get featured products error:', error);
            return NextResponse.json({ error: 'Không thể tải sản phẩm' }, { status: 500 });
        }

        return NextResponse.json({ products: data || [] });
    } catch (error) {
        console.error('Featured products API error:', error);
        return NextResponse.json({ error: 'Đã có lỗi xảy ra' }, { status: 500 });
    }
}
