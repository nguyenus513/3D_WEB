import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/security/admin-guard';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const slug = searchParams.get('slug');
        const draft = searchParams.get('draft') === '1';

        if (!slug) {
            return NextResponse.json({ error: 'Missing slug' }, { status: 400 });
        }

        if (draft) {
            const { authorized, response } = await requireAdmin(request);
            if (!authorized) return response;
        }

        const supabase = getAdminSupabase();

        let pageQuery = supabase
            .from('content_pages')
            .select('*')
            .eq('slug', slug);

        if (!draft) {
            pageQuery = pageQuery.eq('is_active', true);
        }

        const { data: page, error: pageError } = await pageQuery.maybeSingle();

        if (pageError) {
            return NextResponse.json({ error: pageError.message }, { status: 500 });
        }

        if (!page) {
            return NextResponse.json({ error: 'Content not found' }, { status: 404 });
        }

        let blockQuery = supabase
            .from('content_blocks')
            .select('*')
            .eq('page_id', page.id);

        if (!draft) {
            blockQuery = blockQuery.eq('is_active', true);
        }

        const { data: blocks, error: blockError } = await blockQuery.order('sort_order', { ascending: true });

        if (blockError) {
            return NextResponse.json({ error: blockError.message }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            page,
            blocks: blocks || [],
        });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
