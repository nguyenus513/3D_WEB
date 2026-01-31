import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getSupabase } from '@/lib/supabase/client';
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

        const supabase = getSupabase();

        // Smart profile ID lookup with email fallback
        const profileId = await getProfileId(session.user, supabase);
        if (!profileId) {
            return NextResponse.json({ error: 'Profile not found' }, { status: 400 });
        }

        const { data, error } = await supabase
            .from('wishlists')
            .select(`
                id,
                created_at,
                product:products (
                    id,
                    name,
                    slug,
                    sku,
                    base_price,
                    sale_price,
                    images,
                    status
                )
            `)
            .eq('user_id', profileId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('[Wishlist] Error fetching:', error);
            return NextResponse.json({ error: 'Failed to fetch wishlist' }, { status: 500 });
        }

        // Filter out products that are no longer active
        interface WishlistItem {
            id: string;
            created_at: string;
            product: { status?: string } | null;
        }
        const activeWishlist = (data as WishlistItem[] | null)?.filter((item: WishlistItem) =>
            item.product && item.product.status === 'active'
        ) || [];

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

        const supabase = getSupabase();

        // Smart profile ID lookup with email fallback
        const profileId = await getProfileId(session.user, supabase);
        if (!profileId) {
            return NextResponse.json({ error: 'Profile not found' }, { status: 400 });
        }

        // Check if already in wishlist
        const { data: existing } = await supabase
            .from('wishlists')
            .select('id')
            .eq('user_id', profileId)
            .eq('product_id', productId)
            .single();

        if (existing) {
            return NextResponse.json({
                success: true,
                message: 'Already in wishlist',
                alreadyExists: true
            });
        }

        // Add to wishlist
        const { error } = await supabase
            .from('wishlists')
            .insert({
                user_id: profileId,
                product_id: productId,
            });

        if (error) {
            console.error('[Wishlist] Error adding:', error);
            return NextResponse.json({ error: 'Failed to add to wishlist' }, { status: 500 });
        }

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

        const supabase = getSupabase();

        // Smart profile ID lookup with email fallback
        const profileId = await getProfileId(session.user, supabase);
        if (!profileId) {
            return NextResponse.json({ error: 'Profile not found' }, { status: 400 });
        }

        const { error } = await supabase
            .from('wishlists')
            .delete()
            .eq('user_id', profileId)
            .eq('product_id', productId);

        if (error) {
            console.error('[Wishlist] Error removing:', error);
            return NextResponse.json({ error: 'Failed to remove from wishlist' }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            message: 'Removed from wishlist',
        });
    } catch (error) {
        console.error('[Wishlist] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
