import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/security/admin-guard';
import { revalidateTag } from 'next/cache';

function createSlug(input: string): string {
    return input
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\u0111/g, 'd')
        .replace(/\u0110/g, 'D')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80) || `danh-muc-${Date.now()}`;
}

async function getUniqueCategorySlug(supabase: ReturnType<typeof getAdminSupabase>, name: string, currentId?: string): Promise<string> {
    const base = createSlug(name);
    let candidate = base;
    for (let suffix = 2; suffix < 1000; suffix++) {
        const { data: existing } = await supabase
            .from('categories')
            .select('id')
            .eq('slug', candidate)
            .maybeSingle();
        if (!existing || existing.id === currentId) return candidate;
        candidate = `${base}-${suffix}`;
    }
    return `${base}-${Date.now()}`;
}


/**
 * GET /api/admin/categories
 * Fetch all categories
 */
export async function GET(request: NextRequest) {
    try {
        // SECURITY: Verify admin access
        const { authorized, response } = await requireAdmin(request);
        if (!authorized) return response;

        const supabase = getAdminSupabase();

        const { data, error } = await supabase
            .from('categories')
            .select('*')
            .or('deleted_at.is.null,deleted_at.eq.')
            .order('sort_order', { ascending: true });

        if (error) {
            console.error('Error fetching categories:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ categories: data || [] });
    } catch (error) {
        console.error('Categories API error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

/**
 * POST /api/admin/categories
 * Create new category
 */
export async function POST(request: NextRequest) {
    try {
        // SECURITY: Verify admin access
        const { authorized, response } = await requireAdmin(request);
        if (!authorized) return response;

        const supabase = getAdminSupabase();
        const body = await request.json();

        const { name, description } = body;

        if (!name) {
            return NextResponse.json({ error: 'Tên danh mục là bắt buộc' }, { status: 400 });
        }

        // Get max sort_order
        const { data: maxOrder } = await supabase
            .from('categories')
            .select('sort_order')
            .order('sort_order', { ascending: false })
            .limit(1)
            .single();

        const sortOrder = (maxOrder?.sort_order || 0) + 1;
        const slug = await getUniqueCategorySlug(supabase, name);

        const { data, error } = await supabase
            .from('categories')
            .insert({
                name,
                slug,
                description: description || null,
                sort_order: sortOrder,
                is_active: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating category:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        revalidateTag('categories');
        revalidateTag('products');
        return NextResponse.json({ category: data });
    } catch (error) {
        console.error('Create category error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

/**
 * DELETE /api/admin/categories
 * Delete category by ID (passed in body)
 */
export async function DELETE(request: NextRequest) {
    try {
        // SECURITY: Verify admin access
        const { authorized, response } = await requireAdmin(request);
        if (!authorized) return response;

        const supabase = getAdminSupabase();
        const { id } = await request.json();

        if (!id) {
            return NextResponse.json({ error: 'ID là bắt buộc' }, { status: 400 });
        }

        const { data: activeProducts } = await supabase
            .from('products')
            .select('id')
            .eq('category_id', id)
            .eq('is_active', true)
            .limit(1);

        if (activeProducts && activeProducts.length > 0) {
            return NextResponse.json({ error: 'Danh mục đang có sản phẩm hoạt động. Hãy chuyển/xóa sản phẩm trước.' }, { status: 409 });
        }

        const now = new Date().toISOString();
        const { error } = await supabase
            .from('categories')
            .update({ is_active: false, deleted_at: now, updated_at: now })
            .eq('id', id);

        if (error) {
            console.error('Error deleting category:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        revalidateTag('categories');
        revalidateTag('products');
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Delete category error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

/**
 * PUT /api/admin/categories
 * Update category
 */
export async function PUT(request: NextRequest) {
    try {
        // SECURITY: Verify admin access
        const { authorized, response } = await requireAdmin(request);
        if (!authorized) return response;

        const supabase = getAdminSupabase();
        const body = await request.json();

        const { id, name, description, sort_order } = body;

        if (!id || !name) {
            return NextResponse.json({ error: 'ID và tên là bắt buộc' }, { status: 400 });
        }

        const slug = await getUniqueCategorySlug(supabase, name, id);

        const { data, error } = await supabase
            .from('categories')
            .update({
                name,
                slug,
                description: body.description || null,
                sort_order: sort_order || 0,
                is_active: body.is_active ?? true,
                deleted_at: body.is_active === false ? new Date().toISOString() : null,
                updated_at: new Date().toISOString(),
            })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating category:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        revalidateTag('categories');
        revalidateTag('products');
        return NextResponse.json({ category: data });
    } catch (error) {
        console.error('Update category error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
