import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { isAdmin } from '@/lib/security/admin-guard';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const scopesParam = searchParams.get('scopes') || 'common';
        const scopes = scopesParam
            .split(',')
            .map((scope) => scope.trim())
            .filter(Boolean);

        if (scopes.length === 0) {
            return NextResponse.json({ error: 'Missing scopes' }, { status: 400 });
        }

        const admin = await isAdmin();
        const allowedScopes = admin
            ? scopes
            : scopes.filter((scope) => scope === 'common' || scope.startsWith('public.'));

        if (allowedScopes.length === 0) {
            return NextResponse.json({ error: 'No allowed scopes' }, { status: 403 });
        }

        const supabase = getAdminSupabase();
        const { data, error } = await supabase
            .from('ui_labels')
            .select('scope, key, value')
            .in('scope', allowedScopes)
            .eq('is_active', true);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        const labels: Record<string, Record<string, unknown>> = {};
        for (const row of data || []) {
            if (!labels[row.scope]) {
                labels[row.scope] = {};
            }
            labels[row.scope][row.key] = row.value;
        }

        return NextResponse.json({
            success: true,
            scopes: allowedScopes,
            labels,
        });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
