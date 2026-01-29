// Database Types - Auto-generated from schema

export interface Profile {
    id: string;
    full_name: string | null;
    name?: string | null; // Alias for full_name (backward compatibility)
    phone: string | null;
    email: string | null;
    instagram: string | null;
    role: 'customer' | 'admin';
    customer_code: string;
    created_at: string;
    updated_at: string;
}

export interface Address {
    id: string;
    user_id: string;
    label: string;
    full_name: string;
    phone: string;
    address_line: string;
    ward: string | null;
    district: string | null;
    province: string;
    is_default: boolean;
    created_at: string;
}

export interface Category {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    parent_id: string | null;
    sort_order: number;
    created_at: string;
}

export interface ProductImage {
    url: string;
    alt?: string;
    is_main?: boolean;
}

export interface ProductSize {
    name: string;
    price: number;
    stock: number;
    enabled: boolean;
}

export interface Product {
    id: string;
    sku: string;
    name: string;
    slug: string;
    category_id: string | null;
    type: 'ready_made' | 'custom_template' | 'service';
    status: 'draft' | 'active' | 'archived';
    short_description: string | null;
    description: string | null;
    base_price: number;
    sale_price: number | null;
    cost_price: number | null;
    stock: number;
    low_stock_alert: number;
    images: ProductImage[];
    video_url: string | null;
    sizes: ProductSize[];
    seo_title: string | null;
    seo_description: string | null;
    tags: string[];
    is_featured: boolean;
    view_count: number;
    sold_count: number;
    created_at: string;
    updated_at: string;
    // Relations
    category?: Category;
}

export type OrderType = 'ready_made' | 'custom' | 'printing';

export type OrderStatus =
    | 'pending'
    | 'expired'
    | 'paid'
    | 'preparing'
    | 'designing'
    | 'review'
    | 'pending_demo_approval'
    | 'contact_requested'
    | 'approved'
    | 'printing'
    | 'completed'
    | 'shipped'
    | 'delivered'
    | 'refund_requested'
    | 'refunded'
    | 'cancelled';

export interface ShippingAddress {
    full_name: string;
    phone: string;
    address_line: string;
    ward?: string;
    district?: string;
    province: string;
}

export interface Order {
    id: string;
    order_code: string;
    code_formatted?: string; // New formatted code: CART-YYYYMMDD-XXXX-...
    user_id: string;
    order_type: OrderType;
    status: OrderStatus;
    subtotal: number;
    shipping_fee: number;
    discount: number;
    total: number;
    deposit_amount: number;
    deposit_paid: boolean;
    shipping_address: ShippingAddress | null;
    shipping_code: string | null;
    shipping_status: string | null;
    customer_note: string | null;
    admin_note: string | null;
    paid_at: string | null;
    processing_at: string | null;
    designing_at: string | null;
    review_at: string | null;
    approved_at: string | null;
    printing_at: string | null;
    shipped_at: string | null;
    delivered_at: string | null;
    created_at: string;
    updated_at: string;
    // Relations
    items?: OrderItem[];
    payments?: Payment[];
    user?: Profile;
}

export interface CustomConfig {
    type: 'single' | 'couple' | 'group';
    photos: { drive_file_id: string; file_name: string; web_view_link: string }[];
    style?: string;
    size?: string;
    demo_photo?: { drive_file_id: string; file_name: string };
    customer_approved?: boolean;
    approved_at?: string;
}

export interface PrintingConfig {
    stl_file: { drive_file_id: string; file_name: string; web_view_link: string };
    print_type: 'FDM' | 'Resin';
    material: string;
    color: string;
    infill?: number;
    layer_height?: number;
    calculated_price: number;
    _internal?: {
        print_time_hours: number;
        weight_grams: number;
    };
}

export interface OrderItem {
    id: string;
    order_id: string;
    product_id: string | null;
    sku: string;
    name: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    configuration: CustomConfig | PrintingConfig | Record<string, unknown>;
    created_at: string;
    // Relations
    product?: Product;
}

export type PaymentStatus = 'pending' | 'success' | 'failed' | 'refunded';
export type PaymentType = 'deposit' | 'full' | 'remaining';

export interface Payment {
    id: string;
    order_id: string;
    amount: number;
    payment_method: string | null;
    payment_type: PaymentType;
    status: PaymentStatus;
    transaction_id: string | null;
    payment_url: string | null;
    metadata: Record<string, unknown>;
    paid_at: string | null;
    created_at: string;
}

export interface FAQ {
    id: string;
    question: string;
    answer: string;
    category: string | null;
    sort_order: number;
    is_active: boolean;
    created_at: string;
}

export interface StoreSettings {
    name: string;
    phone: string;
    email: string;
    address: string;
}

export interface PricingSettings {
    deposit_percent: number;
    fdm_gram_rate: number;
    fdm_hour_rate: number;
    resin_gram_rate: number;
    resin_hour_rate: number;
}

export interface CustomPricingSettings {
    single_base: number;
    couple_base: number;
    group_base: number;
}
