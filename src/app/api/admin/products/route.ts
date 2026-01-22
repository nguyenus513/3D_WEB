/**
 * Admin Products API
 * Secure admin-only CRUD for products
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getAdminSupabase } from '@/lib/supabase/admin';

// Admin check
async function isAdmin(): Promise<boolean> {
    const session = await auth();
    return (session?.user as { role?: string } | undefined)?.role === 'admin';
}

// GET /api/admin/products - List products
export async function GET(request: NextRequest) {
    try {
        if (!await isAdmin()) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');
        const status = searchParams.get('status');

        const supabase = getAdminSupabase();

        let query = supabase
            .from('products')
            .select('*', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range((page - 1) * limit, page * limit - 1);

        if (status) {
            query = query.eq('status', status);
        }

        const { data, count, error } = await query;

        if (error) {
            console.error('Get products error:', error);
            return NextResponse.json({ error: 'Không thể tải sản phẩm' }, { status: 500 });
        }

        return NextResponse.json({ products: data, total: count });
    } catch (error) {
        console.error('Products API error:', error);
        return NextResponse.json({ error: 'Đã có lỗi xảy ra' }, { status: 500 });
    }
}

// POST /api/admin/products - Create product
export async function POST(request: NextRequest) {
    try {
        if (!await isAdmin()) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await request.json();

        // Validate required fields
        if (!body.name || !body.sku) {
            return NextResponse.json({ error: 'Tên và SKU là bắt buộc' }, { status: 400 });
        }

        const supabase = getAdminSupabase();

        // Generate slug if not provided
        const slug = body.slug || body.name.toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .slice(0, 150);

        const productData = {
            sku: body.sku.trim().slice(0, 20),
            name: body.name.trim().slice(0, 150),
            slug,
            category_id: body.category_id || null,
            type: body.type || 'ready_made',
            status: body.status || 'draft',
            short_description: body.short_description?.slice(0, 300) || null,
            description: body.description || null,
            base_price: parseInt(body.base_price) || 0,
            sale_price: body.sale_price ? parseInt(body.sale_price) : null,
            cost_price: body.cost_price ? parseInt(body.cost_price) : null,
            stock: parseInt(body.stock) || 0,
            low_stock_alert: parseInt(body.low_stock_alert) || 5,
            images: body.images || [],
            sizes: body.sizes || [],
            tags: body.tags || [],
            is_featured: body.is_featured || false,
        };

        const { data, error } = await supabase
            .from('products')
            .insert(productData)
            .select()
            .single();

        if (error) {
            console.error('Create product error:', error);
            if (error.code === '23505') {
                return NextResponse.json({ error: 'SKU hoặc slug đã tồn tại' }, { status: 400 });
            }
            return NextResponse.json({ error: 'Không thể tạo sản phẩm' }, { status: 500 });
        }

        return NextResponse.json({ product: data, success: true });
    } catch (error) {
        console.error('Create product error:', error);
        return NextResponse.json({ error: 'Đã có lỗi xảy ra' }, { status: 500 });
    }
}

// PUT /api/admin/products - Update product
export async function PUT(request: NextRequest) {
    try {
        if (!await isAdmin()) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await request.json();
        const { id, ...updates } = body;

        if (!id) {
            return NextResponse.json({ error: 'Product ID required' }, { status: 400 });
        }

        const supabase = getAdminSupabase();

        // Sanitize updates
        const sanitized: Record<string, unknown> = { updated_at: new Date().toISOString() };

        if (updates.name) sanitized.name = updates.name.trim().slice(0, 150);
        if (updates.sku) sanitized.sku = updates.sku.trim().slice(0, 20);
        if (updates.slug) sanitized.slug = updates.slug.trim().slice(0, 150);
        if (updates.status) sanitized.status = updates.status;
        if (updates.base_price !== undefined) sanitized.base_price = parseInt(updates.base_price) || 0;
        if (updates.sale_price !== undefined) sanitized.sale_price = updates.sale_price ? parseInt(updates.sale_price) : null;
        if (updates.stock !== undefined) sanitized.stock = parseInt(updates.stock) || 0;
        if (updates.is_featured !== undefined) sanitized.is_featured = updates.is_featured;
        if (updates.images !== undefined) sanitized.images = updates.images;
        if (updates.description !== undefined) sanitized.description = updates.description;

        const { error } = await supabase
            .from('products')
            .update(sanitized)
            .eq('id', id);

        if (error) {
            console.error('Update product error:', error);
            return NextResponse.json({ error: 'Không thể cập nhật sản phẩm' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Update product error:', error);
        return NextResponse.json({ error: 'Đã có lỗi xảy ra' }, { status: 500 });
    }
}

// DELETE /api/admin/products - Delete product (soft delete)
export async function DELETE(request: NextRequest) {
    try {
        if (!await isAdmin()) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Product ID required' }, { status: 400 });
        }

        const supabase = getAdminSupabase();

        // Soft delete by archiving
        const { error } = await supabase
            .from('products')
            .update({ status: 'archived', updated_at: new Date().toISOString() })
            .eq('id', id);

        if (error) {
            console.error('Delete product error:', error);
            return NextResponse.json({ error: 'Không thể xóa sản phẩm' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Delete product error:', error);
        return NextResponse.json({ error: 'Đã có lỗi xảy ra' }, { status: 500 });
    }
}
