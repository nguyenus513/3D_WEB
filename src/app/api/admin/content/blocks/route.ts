import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/security/admin-guard';

export async function GET(request: NextRequest) {
    const { authorized, response } = await requireAdmin(request);
    if (!authorized) return response;

    try {
        const { searchParams } = new URL(request.url);
        const pageId = searchParams.get('page_id');
        if (!pageId) {
            return NextResponse.json({ error: 'Missing page_id' }, { status: 400 });
        }

        const supabase = getAdminSupabase();
        const { data, error } = await supabase
            .from('content_blocks')
            .select('*')
            .eq('page_id', pageId)
            .order('sort_order', { ascending: true });

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, blocks: data || [] });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const { authorized, response } = await requireAdmin(request);
    if (!authorized) return response;

    try {
        const body = await request.json();
        const pageId = String(body.page_id || '').trim();
        const blockKey = String(body.block_key || '').trim();
        const blockType = String(body.block_type || '').trim();

        if (!pageId || !blockKey || !blockType) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const payload = {
            page_id: pageId,
            block_key: blockKey,
            block_type: blockType,
            sort_order: body.sort_order ?? 0,
            data: body.data ?? {},
            is_active: body.is_active ?? true,
        };

        const supabase = getAdminSupabase();
        const { data, error } = await supabase
            .from('content_blocks')
            .insert(payload)
            .select('*')
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, block: data });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
