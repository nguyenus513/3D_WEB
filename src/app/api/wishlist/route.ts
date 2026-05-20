import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { getMongoDb } from '@/lib/mongodb/client';
import { getProfileId } from '@/lib/utils/getProfileId';

/**
 * GET /api/wishlist
 * Get user's wishlist
 */
export async function GET() {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabase = getAdminSupabase();

        // Smart profile ID lookup with email fallback
        const profileId = await getProfileId(session.user, supabase);
        if (!profileId) {
            return NextResponse.json({ error: 'Profile not found' }, { status: 400 });
        }

        const db = await getMongoDb();
        const wishlistRows = await db.collection('wishlists')
            .find({ user_id: profileId })
            .sort({ created_at: -1 })
            .toArray();
        const productIds = wishlistRows.map((row) => row.product_id).filter(Boolean);
        const products = productIds.length > 0
            ? await db.collection('products').find({ _id: { $in: productIds } }).toArray()
            : [];
        const productsById = new Map(products.map((product) => [String(product._id), product]));

        // Filter out products that are no longer active
        interface WishlistItem {
            id: string;
            created_at: string;
            product: { status?: string } | null;
        }
        const activeWishlist = wishlistRows.map((item) => {
            const product = productsById.get(String(item.product_id));
            if (!product || product.is_active !== true) return null;
            return {
                id: String(item._id),
                created_at: item.created_at,
                product: {
                    id: String(product._id),
                    name: product.name,
                    slug: product.slug || String(product._id),
                    sku: product.sku,
                    base_price: product.base_price || 0,
                    sale_price: product.sale_price ?? null,
                    images: product.images || [],
                    status: product.is_active ? 'active' : 'draft',
                },
            };
        }).filter(Boolean);

        return NextResponse.json({
            success: true,
            wishlist: activeWishlist,
            count: activeWishlist.length,
        });
    } catch (error) {
        console.error('[Wishlist] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

/**
 * POST /api/wishlist
 * Add product to wishlist
 */
export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { productId } = await request.json();

        if (!productId) {
            return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
        }

        const supabase = getAdminSupabase();

        // Smart profile ID lookup with email fallback
        const profileId = await getProfileId(session.user, supabase);
        if (!profileId) {
            return NextResponse.json({ error: 'Profile not found' }, { status: 400 });
        }

        const db = await getMongoDb();
        const existing = await db.collection('wishlists').findOne({ user_id: profileId, product_id: productId });

        if (existing) {
            return NextResponse.json({
                success: true,
                message: 'Already in wishlist',
                alreadyExists: true
            });
        }

        await db.collection('wishlists').insertOne({
            user_id: profileId,
            product_id: productId,
            created_at: new Date().toISOString(),
        });

        return NextResponse.json({
            success: true,
            message: 'Added to wishlist',
        });
    } catch (error) {
        console.error('[Wishlist] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

/**
 * DELETE /api/wishlist
 * Remove product from wishlist
 */
export async function DELETE(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { productId } = await request.json();

        if (!productId) {
            return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
        }

        const supabase = getAdminSupabase();

        // Smart profile ID lookup with email fallback
        const profileId = await getProfileId(session.user, supabase);
        if (!profileId) {
            return NextResponse.json({ error: 'Profile not found' }, { status: 400 });
        }

        const db = await getMongoDb();
        await db.collection('wishlists').deleteMany({ user_id: profileId, product_id: productId });

        return NextResponse.json({
            success: true,
            message: 'Removed from wishlist',
        });
    } catch (error) {
        console.error('[Wishlist] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
