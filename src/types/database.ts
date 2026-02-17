// Database Types - Schema v3 Optimized

// ==================== ENUMS ====================
export type UserRole = 'customer' | 'admin' | 'staff';

export type OrderStatus =
    | 'pending'
    | 'confirmed'
    | 'paid'
    | 'processing'
    | 'designing'
    | 'review'      // Chờ khách duyệt demo
    | 'approved'    // Khách đã duyệt
    | 'production_pending' // Chờ sản xuất (Đã duyệt + Đã cọc/thanh toán)
    | 'revising'    // Yêu cầu chỉnh sửa
    | 'producing'
    | 'finished'      // Hoàn thiện (chờ xác nhận thành phẩm)
    | 'printing'
    | 'shipping'
    | 'delivered'
    | 'completed'
    | 'cancelled'
    | 'refunded';

export type PaymentStatus = 'pending' | 'partial' | 'deposit_paid' | 'paid' | 'refunded' | 'failed';

// Cart/Order fulfillment tracking
export type FulfillmentStatus = 'pending' | 'processing' | 'completed';

// Item/Sub-order production tracking
export type ProductionStatus = 'waiting' | 'printing' | 'done' | 'error';

export type ProductType = 'ready_made' | 'custom_template' | 'service' | 'print_3d';

// Order types for unified orders table
export type OrderType = 'product' | 'print_3d' | 'custom';
export type OrderItemType = 'product' | 'print_3d' | 'custom';

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

// Product size with its own images
export interface ProductSize {
    name: string;
    sku?: string;
    price: number;
    stock: number;
    enabled: boolean;
    images: string[]; // Each size has its own gallery
}

// Product image can be string (legacy) or object (current)
export type ProductImage = string | { url: string; is_main?: boolean };

export interface Product {
    id: string;
    category_id: string | null;
    sku: string | null;
    name: string;
    type: ProductType;
    base_price: number;
    sale_price: number | null;
    stock: number;
    images: ProductImage[]; // Default/fallback images
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
    // Sizes with per-size galleries
    sizes?: ProductSize[];
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

// ==================== ORDER EXTENSIONS (NEW) ====================

export interface OrderNote {
    id: string;
    order_id: string;
    author_id: string;
    content: string;
    type: 'customer' | 'admin' | 'system';
    created_at: string;
}

export interface OrderAddress {
    id: string;
    order_id: string;
    full_name: string;
    phone: string;
    province: string | null;
    district: string | null;
    ward: string | null;
    address_line: string;
}

export interface OrderRevision {
    id: string;
    order_id: string;
    version: number;
    status: 'pending' | 'approved' | 'rejected';
    feedback: string | null;
    created_at: string;
}

export interface PrintJob {
    id: string;
    order_item_id: string;
    material: string | null;
    color: string | null;
    infill: number | null;
    layer_height: number | null;
    estimated_hours: number | null;
    estimated_grams: number | null;
    status: 'waiting' | 'slicing' | 'printing' | 'done' | 'failed';
    created_at: string;
}

export interface FileRecord {
    id: string;
    file_url: string;
    mime_type: string | null;
    size_bytes: number | null;
    provider: 'r2' | 's3' | 'local';
    created_at: string;
}

export interface FileLink {
    id: string;
    file_id: string;
    ref_type: 'order' | 'order_item' | 'revision';
    ref_id: string;
    tag: string | null; // e.g 'demo', 'final', 'stl'
    created_at: string;
    // Relation
    file?: FileRecord;
}

export interface Order {
    id: string;
    order_code: string;
    cart_code: string | null; // 8-char hex for display (new orders)
    user_id: string | null;
    address_id: string | null;
    subtotal: number;
    discount: number;
    total_amount: number;
    deposit_amount: number;
    status: OrderStatus;
    payment_status: PaymentStatus; // Now a real column in DB
    fulfillment_status: FulfillmentStatus; // NEW: Cart/order fulfillment
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

    // New Relations (v3 Refactor)
    shipping_address?: OrderAddress; // Joined from order_addresses
    order_notes?: OrderNote[];
    revisions?: OrderRevision[];
    files?: FileLink[]; // Joined via file_links
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
    item_order_code: string | null; // 8-char hex for display (new orders)
    cart_code: string | null; // Denormalized from parent order
    full_code: string | null; // {cart_code}_{item_order_code}
    production_status: ProductionStatus; // Item production tracking
    file_path: string | null; // Storage path for production files
    name: string;
    sku: string | null;
    quantity: number;
    unit_price: number;
    total_price: number;
    configuration: OrderItemConfiguration;
    created_at: string;
    // Computed (client-side)
    item_code?: string; // {cart_code}_{item_order_code}
    // Relations
    product?: Product;
    order?: Order;

    // New Relations (v3 Refactor)
    print_job?: PrintJob; // Joined from print_jobs
    files?: FileLink[];
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
// Legacy OrderType removed - now unified at top of file as OrderType | OrderItemType

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
