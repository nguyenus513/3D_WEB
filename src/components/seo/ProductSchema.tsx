/**
 * Product JSON-LD Schema Component
 * 
 * Generates structured data for Google Rich Results
 * @see https://schema.org/Product
 */

interface ProductSchemaProps {
    product: {
        id: string;
        name: string;
        description: string | null;
        base_price: number;
        sale_price: number | null;
        images?: { url: string }[] | null;
        sku: string;
        stock: number;
    };
    url: string;
}

export function ProductSchema({ product, url }: ProductSchemaProps) {
    const price = product.sale_price || product.base_price;
    const imageUrl = product.images?.[0]?.url || 'https://miniver3d.com/og-default.jpg';

    const schema = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: product.name,
        description: product.description || `${product.name} - Sản phẩm handmade từ Miniver3D Lab`,
        image: imageUrl,
        sku: product.sku,
        brand: {
            '@type': 'Brand',
            name: 'Miniver3D Lab',
        },
        offers: {
            '@type': 'Offer',
            url: url,
            priceCurrency: 'VND',
            price: price,
            availability: product.stock > 0
                ? 'https://schema.org/InStock'
                : 'https://schema.org/OutOfStock',
            seller: {
                '@type': 'Organization',
                name: 'Miniver3D Lab',
            },
        },
    };

    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
    );
}

/**
 * Breadcrumb JSON-LD Schema
 */
interface BreadcrumbSchemaProps {
    items: { name: string; url: string }[];
}

export function BreadcrumbSchema({ items }: BreadcrumbSchemaProps) {
    const schema = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: items.map((item, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: item.name,
            item: item.url,
        })),
    };

    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
    );
}

/**
 * Organization JSON-LD Schema (for homepage)
 */
export function OrganizationSchema() {
    const schema = {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'Miniver3D Lab',
        description: 'Studio thiết kế và sản xuất tượng 3D handmade cao cấp',
        url: 'https://miniver3d.com',
        logo: 'https://miniver3d.com/logo.png',
        sameAs: [
            'https://facebook.com/miniver3d',
            'https://instagram.com/miniver3d',
        ],
        contactPoint: {
            '@type': 'ContactPoint',
            contactType: 'customer service',
            areaServed: 'VN',
            availableLanguage: 'Vietnamese',
        },
    };

    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
    );
}
