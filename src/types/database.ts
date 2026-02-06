// Database Types - Schema v3 Optimized

// ==================== ENUMS ====================
export type UserRole = 'customer' | 'admin' | 'staff';

export type OrderStatus =
    | 'pending'
    | 'pending_confirmation'
    | 'confirmed'
    | 'paid'
    | 'processing'
    | 'designing'
    | 'review'      // Chờ khách duyệt demo
    | 'approved'    // Khách đã duyệt
    | 'production_pending' // Chờ sản xuất (Đã duyệt + Đã cọc/thanh toán)
    | 'revising'    // Yêu cầu chỉnh sửa
    | 'producing'
    | 'printing'
    | 'shipping'
    | 'delivered'
    | 'completed'
    | 'cancelled'
    | 'expired'
    | 'payment_failed'
    | 'refunded';

export type PaymentStatus = 'pending' | 'partial' | 'deposit_paid' | 'paid' | 'refunded' | 'failed';

export type ProductType = 'ready_made' | 'custom_template' | 'service' | 'printing';

export type PrintTech = 'fdm' | 'resin' | 'sla';

// ==================== PROFILES ====================
export interface Profile {
    id: string;
    email: string;
    full_name: string | null;
    phone: string | null;
    role: UserRole;
    customer_code: string | null;
    avatar_url: string | null;
    is_verified: boolean;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
}

// ==================== ADDRESSES ====================
export interface Address {
    id: string;
    user_id: string;
    label: string;
    full_name: string;
    phone: string;
    province: string;
    district: string;
    ward: string | null;
    address_line: string;
    is_default: boolean;
    created_at: string;
}

// ==================== CATEGORIES ====================
export interface Category {
    id: string;
    name: string;
    slug: string;
    parent_id: string | null;
    sort_order: number;
    is_active: boolean;
    created_at: string;
}

// ==================== PRODUCTS ====================
export interface ProductSpecs {
    sizes?: { name: string; price: number; stock: number }[];
    colors?: string[];
    materials?: string[];
    dimensions?: { width: number; height: number; depth: number };
    weight?: number;
    [key: string]: unknown;
}

export interface Product {
    id: string;
    category_id: string | null;
    sku: string | null;
    size?: string | null;
    name: string;
    slug: string;
    type: ProductType;
    base_price: number;
    sale_price: number | null;
    stock: number;
    images: string[]; // Array of URLs
    specs: ProductSpecs;
    is_active: boolean; // Computed or legacy? v3 has status.
    status: 'draft' | 'active' | 'archived'; // Added for v3
    // Restored fields (Patch v3)
    description: string | null;
    short_description: string | null;
    is_featured: boolean;
    tags: string[];

    view_count: number;
    sold_count: number;
    created_at: string;
    updated_at: string;
    // Relations
    category?: Category;
    // Computed/Frontend Helpers (optional)
    sizes?: { name: string; price: number; stock: number; enabled: boolean }[];
}

// ==================== ORDERS ====================
export interface ShippingAddressSnapshot {
    full_name: string;
    phone: string;
    province: string;
    district: string;
    ward?: string;
    address_line: string;
}

export interface Order {
    id: string;
    order_code: string;
    user_id: string | null;
    address_id: string | null;
    subtotal: number;
    shipping_fee: number;
    discount: number;
    total_amount: number;
    deposit_amount: number;
    deposit_paid?: boolean;
    order_type?: OrderType | string;
    parent_order_id?: string | null;
    master_order_id?: string | null;
    order_number?: string | null;
    shipping_code?: string | null;
    shipping_status?: string | null;
    status: OrderStatus;
    payment_status: PaymentStatus;
    shipping_address_snapshot: ShippingAddressSnapshot | null;
    notes: string | null;
    admin_notes: string | null;
    created_at: string;
    updated_at: string;
    confirmed_at: string | null;
    processing_at?: string | null;
    designing_at?: string | null;
    paid_at: string | null;
    producing_at?: string | null;
    printing_at?: string | null;
    shipped_at?: string | null;
    delivered_at?: string | null;
    completed_at: string | null;
    approved_at?: string | null;
    revising_at?: string | null;
    review_at?: string | null;
    demo_image_url?: string | null;
    custom_config?: Record<string, unknown> | null;
    printing_config?: Record<string, unknown> | null;
    archived_at?: string | null;
    // Relations
    items?: OrderItem[];
    payments?: Payment[];
    user?: Profile;
    address?: Address;
}

// ==================== ORDER ITEMS ====================
export interface OrderItemConfiguration {
    // For 3D Printing
    layer_height?: number;
    infill?: string;
    color?: string;
    material?: string;
    file_url?: string;
    file_name?: string;
    print_tech?: PrintTech;
    // For Custom
    photos?: { url: string; name: string }[];
    style?: string;
    // General
    size?: string;
    [key: string]: unknown;
}

export interface OrderItem {
    id: string;
    order_id: string;
    product_id: string | null;
    name: string;
    sku: string | null;
    size?: string | null;
    quantity: number;
    unit_price: number;
    total_price: number;
    configuration: OrderItemConfiguration;
    created_at: string;
    updated_at?: string;
    // Relations
    product?: Product;
    order?: Order;
}

// ==================== PAYMENTS ====================
export interface Payment {
    id: string;
    order_id: string;
    transaction_code: string | null;
    amount: number;
    method: string;
    status: PaymentStatus;
    gateway_response: Record<string, unknown> | null;
    created_at: string;
    updated_at?: string;
    // Relations
    order?: Order;
}

// ==================== CARTS ====================
export interface Cart {
    id: string;
    user_id: string;
    created_at: string;
    updated_at: string;
    // Relations
    items?: CartItem[];
}

export interface CartItem {
    id: string;
    cart_id: string;
    product_id: string;
    quantity: number;
    configuration: OrderItemConfiguration;
    item_type?: string | null;
    name?: string | null;
    price?: number | null;
    image_url?: string | null;
    product_sku?: string | null;
    size?: string | null;
    original_price?: number | null;
    print_options?: Record<string, unknown> | null;
    print_files?: Record<string, unknown>[] | null;
    description?: string | null;
    custom_files?: Record<string, unknown>[] | null;
    created_at: string;
    updated_at: string;
    // Relations
    product?: Product;
}

// ==================== SECURITY ====================
export interface SecurityLog {
    id: string;
    user_id: string | null;
    event_type: string;
    severity?: string;
    ip_address: string | null;
    user_agent: string | null;
    details: Record<string, unknown> | null;
    created_at: string;
}

export interface RefreshToken {
    id: string;
    user_id: string;
    token: string;
    expires_at: string;
    revoked: boolean;
    token_hash?: string | null;
    session_id?: string | null;
    family_id?: string | null;
    is_revoked?: boolean;
    revoked_at?: string | null;
    revoked_reason?: string | null;
    created_at: string;
}

// ==================== LEGACY COMPATIBILITY ====================
// These types can be removed after full migration
export type OrderType = 'ready_made' | 'custom' | 'printing' | 'master';

// ==================== SETTINGS (Not in DB, for app use) ====================
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

export interface FAQ {
    id: string;
    question: string;
    answer: string;
    category: string;
    is_active: boolean;
    sort_order: number;
    created_at: string;
    updated_at: string;
}
