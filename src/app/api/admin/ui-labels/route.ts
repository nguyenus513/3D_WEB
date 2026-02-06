import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/security/admin-guard';

export async function GET(request: NextRequest) {
    const { authorized, response } = await requireAdmin(request);
    if (!authorized) return response;

    try {
        const { searchParams } = new URL(request.url);
        const scope = searchParams.get('scope');
        const search = searchParams.get('search');

        const supabase = getAdminSupabase();
        let query = supabase
            .from('ui_labels')
            .select('*')
            .order('scope', { ascending: true })
            .order('key', { ascending: true });

        if (scope) {
            query = query.eq('scope', scope);
        }

        if (search) {
            query = query.ilike('key', `%${search}%`);
        }

        const { data, error } = await query;
        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, labels: data || [] });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const { authorized, response } = await requireAdmin(request);
    if (!authorized) return response;

    try {
        const body = await request.json();
        const scope = String(body.scope || '').trim();
        const key = String(body.key || '').trim();

        if (!scope || !key) {
            return NextResponse.json({ error: 'Missing scope or key' }, { status: 400 });
        }

        const payload = {
            scope,
            key,
            value: body.value ?? {},
            description: body.description ?? null,
            is_active: body.is_active ?? true,
            updated_at: new Date().toISOString(),
        };

        const supabase = getAdminSupabase();
        const { data, error } = await supabase
            .from('ui_labels')
            .upsert(payload, { onConflict: 'scope,key' })
            .select('*')
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, label: data });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    const { authorized, response } = await requireAdmin(request);
    if (!authorized) return response;

    try {
        const body = await request.json();
        const id = String(body.id || '').trim();

        if (!id) {
            return NextResponse.json({ error: 'Missing id' }, { status: 400 });
        }

        const payload = {
            scope: body.scope,
            key: body.key,
            value: body.value ?? {},
            description: body.description ?? null,
            is_active: body.is_active ?? true,
            updated_at: new Date().toISOString(),
        };

        const supabase = getAdminSupabase();
        const { data, error } = await supabase
            .from('ui_labels')
            .update(payload)
            .eq('id', id)
            .select('*')
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, label: data });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    const { authorized, response } = await requireAdmin(request);
    if (!authorized) return response;

    try {
        const body = await request.json();
        const id = String(body.id || '').trim();

        if (!id) {
            return NextResponse.json({ error: 'Missing id' }, { status: 400 });
        }

        const supabase = getAdminSupabase();
        const { error } = await supabase
            .from('ui_labels')
            .delete()
            .eq('id', id);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
