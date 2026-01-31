// Database Types - Schema v3 Optimized

// ==================== ENUMS ====================
export type UserRole = 'customer' | 'admin' | 'staff';

export type OrderStatus =
    | 'pending'
    | 'confirmed'
    | 'paid'
    | 'processing'
    | 'designing'
    | 'producing'
    | 'shipping'
    | 'delivered'
    | 'completed'
    | 'cancelled'
    | 'refunded';

export type PaymentStatus = 'pending' | 'partial' | 'paid' | 'refunded' | 'failed';

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
    status: OrderStatus;
    payment_status: PaymentStatus;
    shipping_address_snapshot: ShippingAddressSnapshot | null;
    notes: string | null;
    admin_notes: string | null;
    created_at: string;
    updated_at: string;
    confirmed_at: string | null;
    paid_at: string | null;
    completed_at: string | null;
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
    quantity: number;
    unit_price: number;
    total_price: number;
    configuration: OrderItemConfiguration;
    created_at: string;
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
    created_at: string;
}

// ==================== LEGACY COMPATIBILITY ====================
// These types can be removed after full migration
export type OrderType = 'ready_made' | 'custom' | 'printing';

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
