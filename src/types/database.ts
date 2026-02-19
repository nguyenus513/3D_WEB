// =============================================================================
// Database Types — Generated from Supabase schema (2026-02-17)
// DB is source of truth. DO NOT add fields that don't exist in DB.
// =============================================================================

// ==================== ENUMS (match Postgres ENUMs exactly) ====================

export type UserRole = 'customer' | 'admin' | 'staff';

export type OrderStatus =
    | 'pending'
    | 'confirmed'
    | 'paid'
    | 'review'
    | 'approved'
    | 'revising'
    | 'production_pending'
    | 'processing'
    | 'designing'
    | 'printing'
    | 'producing'
    | 'shipping'
    | 'delivered'
    | 'completed'
    | 'cancelled'
    | 'refunded'
    | 'pending_confirmation'
    | 'finished';

export type PaymentStatus =
    | 'pending'
    | 'deposit_paid'
    | 'partial'
    | 'paid'
    | 'refunded'
    | 'failed';

export type OrderType = 'product' | 'custom' | 'print_3d' | 'mixed';

export type ItemType = 'product' | 'custom' | 'print_3d';

export type ProductionStatus = 'waiting' | 'printing' | 'done' | 'error';

export type FulfillmentStatus = 'pending' | 'processing' | 'completed'; // fulfillment_status_enum in DB

export type PrintTech = 'fdm' | 'resin' | 'sla';

export type PrintStatus = 'waiting' | 'slicing' | 'printing' | 'done' | 'failed'; // print_status_enum in DB

export type ProductType = 'ready_made' | 'custom_template' | 'service' | 'printing';

// ==================== USERS (replaces old Profile) ====================

export interface User {
    id: string;
    name: string | null;
    email: string;
    emailVerified: string | null;
    image: string | null;
    password: string | null;
    phone: string | null;
    customer_code: string | null;
    role: UserRole;
    created_at: string;
    updated_at: string;
    // Relations
    profile?: UserProfile;
}

export interface UserProfile {
    user_id: string;
    full_name: string | null;
    phone: string | null;
    avatar_url: string | null;
    created_at: string;
    updated_at: string;
}

// ==================== USER ADDRESSES ====================

export interface UserAddress {
    id: string;
    user_id: string; // NOT NULL
    full_name: string;
    phone: string;
    province: string | null;
    district: string | null;
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

export interface ProductSize {
    name: string;
    sku?: string;
    price: number;
    stock: number;
    enabled: boolean;
    images: string[];
}

export type ProductImage = string | { url: string; is_main?: boolean };

export interface Product {
    id: string;
    category_id: string | null;
    sku: string | null;
    name: string;
    base_price: number;
    sale_price: number | null;
    stock: number;
    images: ProductImage[];
    specs: ProductSpecs;
    is_active: boolean;
    description: string | null;
    short_description: string | null;
    is_featured: boolean;
    tags: string[];
    low_stock_alert: number | null;
    sizes: ProductSize[] | null;
    view_count: number;
    sold_count: number;
    archived_at: string | null; // Soft delete
    created_at: string;
    updated_at: string;
    // Relations
    category?: Category;
}

// ==================== SHIPPING ADDRESS SNAPSHOT ====================

export interface ShippingAddressSnapshot {
    full_name: string;
    phone: string;
    province: string;
    district: string;
    ward?: string;
    address_line: string;
}

// ==================== ORDERS ====================
// DB columns (23): id, order_code, user_id, subtotal, discount, total_amount,
// deposit_amount, order_type, status, payment_status, fulfillment_status,
// shipping_address_snapshot, notes, admin_notes, created_at, updated_at,
// confirmed_at, paid_at, shipped_at, completed_at, approved_at, shipping_code, archived_at

export interface Order {
    id: string;
    order_code: string;
    user_id: string | null;
    subtotal: number;
    discount: number;
    total_amount: number;
    deposit_amount: number;
    order_type: OrderType;
    status: OrderStatus;
    payment_status: PaymentStatus;
    fulfillment_status: FulfillmentStatus;
    shipping_address_snapshot: ShippingAddressSnapshot | null;
    created_at: string;
    updated_at: string;
    confirmed_at: string | null;
    paid_at: string | null;
    shipped_at: string | null;
    completed_at: string | null;
    approved_at: string | null;
    shipping_code: string | null;
    archived_at: string | null;
    notes: string | null;
    admin_notes: string | null;
    // Relations (joined via Supabase select)
    items?: OrderItem[];
    payments?: Payment[];
    user?: User;
    shipping_address?: OrderAddress;     // 1:1 from order_addresses
    order_notes?: OrderNote[];            // 1:N from order_notes
    revisions?: OrderRevision[];          // 1:N from order_revisions
    files?: FileLink[];                   // via file_links(ref_type='order')
    status_history?: OrderStatusHistory[];
}

// ==================== ORDER ITEMS ====================
// DB columns (14): id, order_id, product_id, item_code, full_code, name, sku,
// quantity, unit_price, item_type, production_status, configuration, created_at, total_price(GENERATED)

export interface OrderItem {
    id: string;
    order_id: string; // NOT NULL, CASCADE
    product_id: string | null;
    item_code: string;
    full_code: string;
    name: string;
    sku: string | null;
    quantity: number;
    unit_price: number;
    total_price: number; // GENERATED ALWAYS AS (quantity * unit_price) STORED — read-only
    item_type: ItemType;
    production_status: ProductionStatus;
    configuration: Record<string, unknown> | null;
    created_at: string;
    // Relations
    product?: Product;
    order?: Order;
    print_job?: PrintJob;   // 1:1 from print_jobs
    files?: FileLink[];     // via file_links(ref_type='order_item')
}

// ==================== ORDER ADDRESS (1:1 with order) ====================

export interface OrderAddress {
    id: string;
    order_id: string; // NOT NULL, UNIQUE
    full_name: string;
    phone: string;
    province: string | null;
    district: string | null;
    ward: string | null;
    address_line: string;
}

// ==================== ORDER NOTES ====================

export interface OrderNote {
    id: string;
    order_id: string; // NOT NULL, CASCADE
    author_id: string | null; // SET NULL on user delete
    content: string;
    type: 'customer' | 'admin' | 'system';
    created_at: string;
}

// ==================== ORDER REVISIONS ====================

export interface OrderRevision {
    id: string;
    order_id: string; // NOT NULL, CASCADE
    version: number;
    status: 'pending' | 'approved' | 'rejected';
    feedback: string | null;
    created_at: string;
}

// ==================== ORDER STATUS HISTORY ====================

export interface OrderStatusHistory {
    id: string;
    order_id: string; // NOT NULL, CASCADE
    status: OrderStatus;
    changed_at: string;
}

// ==================== PRINT JOBS ====================

export interface PrintJob {
    id: string;
    order_item_id: string; // NOT NULL, UNIQUE, CASCADE
    material: string | null;
    color: string | null;
    infill: number | null;
    layer_height: number | null;
    estimated_hours: number | null;
    estimated_grams: number | null;
    status: PrintStatus; // print_status_enum in DB
    started_at: string | null;
    completed_at: string | null;
    created_at: string;
}

// ==================== PAYMENTS ====================

export interface Payment {
    id: string;
    order_id: string; // NOT NULL, CASCADE
    transaction_code: string | null; // UNIQUE (allow null for pending)
    amount: number; // CHECK >= 0
    method: string;
    status: PaymentStatus; // payment_status ENUM
    gateway_response: Record<string, unknown> | null;
    confirmed_at: string | null;
    created_at: string;
    // Relations
    order?: Order;
    events?: PaymentEvent[];
}

// ==================== PAYMENT EVENTS ====================

export interface PaymentEvent {
    id: string;
    payment_id: string; // NOT NULL, CASCADE
    event_type: string | null;
    payload: Record<string, unknown> | null;
    created_at: string;
}

// ==================== FILES & FILE LINKS ====================

export interface FileRecord {
    id: string;
    file_url: string;
    mime_type: string | null;
    size_bytes: number | null;
    provider: string; // 'r2' | 's3' | 'local' (text in DB)
    created_at: string;
}

export interface FileLink {
    id: string;
    file_id: string; // NOT NULL, CASCADE
    ref_type: string; // text in DB (order, order_item, revision)
    ref_id: string; // NOT NULL
    tag: string | null; // e.g. 'demo', 'final', 'stl'
    created_at: string;
    // Relation
    file?: FileRecord;
}

// ==================== ACTIVITY LOGS ====================

export interface ActivityLog {
    id: string;
    user_id: string | null;
    action: string | null;
    metadata: Record<string, unknown> | null;
    created_at: string;
}

// ==================== SETTINGS (app-level, not DB tables) ====================

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

// ==================== LEGACY COMPATIBILITY (use for migration period) ====================
// These types exist for backward compatibility with old code.
// Gradually remove as code is updated.

/** @deprecated Use User instead */
export type Profile = User;

/** @deprecated Use UserAddress instead */
export type Address = UserAddress;

/** @deprecated Use OrderType instead */
export type OrderItemType = ItemType;

/** @deprecated Use ItemType instead */
export type OrderItemConfiguration = {
    layer_height?: number;
    infill?: string;
    color?: string;
    material?: string;
    file_url?: string;
    file_name?: string;
    print_tech?: PrintTech;
    photos?: { url: string; name: string }[];
    style?: string;
    size?: string;
    [key: string]: unknown;
};

// ShippingAddressSnapshot and FulfillmentStatus are now real DB columns — see Order interface above.
