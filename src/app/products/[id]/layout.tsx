/**
 * Product Detail Layout with SEO Metadata
 * 
 * Server Component that generates dynamic metadata for product pages
 */

import type { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';

// Supabase client for server-side data fetching
const supabase = createClient(
    (process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'),
    (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder')
);

interface Product {
    id: string;
    name: string;
    description: string | null;
    short_description: string | null;
    base_price: number;
    sale_price: number | null;
    images: { url: string }[] | null;
    sku: string;
    stock: number;
}

type Props = {
    params: Promise<{ id: string }>;
    children: React.ReactNode;
};

async function getProduct(id: string): Promise<Product | null> {
    // Check if it's a UUID or slug
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

    const { data } = await supabase
        .from('products')
        .select('id, name, description, short_description, base_price, sale_price, images, sku, stock')
        .eq(isUUID ? 'id' : 'slug', id)
        .single();

    return data;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
    const { id } = await params;
    const product = await getProduct(id);

    if (!product) {
        return {
            title: 'Sản phẩm không tồn tại | Miniver3D Lab',
            description: 'Không tìm thấy sản phẩm này.',
        };
    }

    const price = product.sale_price || product.base_price;
    const description = product.short_description || product.description || `${product.name} - Sản phẩm handmade độc đáo từ Miniver3D Lab`;
    const imageUrl = product.images?.[0]?.url || '/og-default.jpg';

    return {
        title: `${product.name} | Miniver3D Lab`,
        description: description.substring(0, 160),
        keywords: [product.name, 'handmade', 'tượng 3D', 'Miniver3D', 'quà tặng'],
        openGraph: {
            title: product.name,
            description: description.substring(0, 160),
            images: [{ url: imageUrl, width: 1200, height: 630 }],
            type: 'website',
            siteName: 'Miniver3D Lab',
            locale: 'vi_VN',
        },
        twitter: {
            card: 'summary_large_image',
            title: product.name,
            description: description.substring(0, 160),
            images: [imageUrl],
        },
        other: {
            'product:price:amount': price.toString(),
            'product:price:currency': 'VND',
            'product:availability': product.stock > 0 ? 'in stock' : 'out of stock',
        },
    };
}

export default async function ProductLayout({ children }: Props) {
    return <>{children}</>;
}

