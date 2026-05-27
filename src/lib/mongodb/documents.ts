export type MongoId = string;
export type MongoDate = Date;
export type Money = number;

export interface ProfileDocument {
  _id: MongoId;
  full_name?: string | null;
  phone?: string | null;
  email?: string | null;
  role?: 'customer' | 'admin' | null;
  customer_code?: string | null;
  created_at?: MongoDate | null;
  updated_at?: MongoDate | null;
  password?: string | null;
  email_verified?: boolean | null;
  totp_enabled?: boolean | null;
  totp_secret?: string | null;
  totp_recovery_codes?: string[] | null;
  deleted_at?: MongoDate | null;
}

export interface AddressDocument {
  _id: MongoId;
  user_id?: MongoId | null;
  label?: string | null;
  full_name: string;
  phone: string;
  address_line: string;
  ward?: string | null;
  district?: string | null;
  province: string;
  is_default?: boolean | null;
  created_at?: MongoDate | null;
}

export interface CategoryDocument {
  _id: MongoId;
  name: string;
  slug: string;
  description?: string | null;
  parent_id?: MongoId | null;
  sort_order?: number | null;
  is_active?: boolean | null;
  deleted_at?: MongoDate | string | null;
  created_at?: MongoDate | null;
}

export interface ProductDocument {
  _id: MongoId;
  sku: string;
  name: string;
  slug: string;
  category_id?: MongoId | null;
  type?: 'ready_made' | 'custom_template' | 'service' | null;
  status?: 'draft' | 'active' | 'archived' | null;
  is_active?: boolean | null;
  deleted_at?: MongoDate | string | null;
  short_description?: string | null;
  description?: string | null;
  base_price: Money;
  sale_price?: Money | null;
  cost_price?: Money | null;
  stock?: number | null;
  low_stock_alert?: number | null;
  images?: unknown[] | null;
  video_url?: string | null;
  sizes?: unknown[] | null;
  seo_title?: string | null;
  seo_description?: string | null;
  tags?: string[] | null;
  is_featured?: boolean | null;
  view_count?: number | null;
  sold_count?: number | null;
  created_at?: MongoDate | null;
  updated_at?: MongoDate | null;
}


export interface ProductVariantDocument {
  _id: MongoId;
  product_id: MongoId;
  sku?: string | null;
  name: string;
  price: Money;
  stock?: number | null;
  reserved_stock?: number | null;
  image_url?: string | null;
  images?: string[] | null;
  is_active?: boolean | null;
  sort_order?: number | null;
  deleted_at?: MongoDate | string | null;
  created_at?: MongoDate | null;
  updated_at?: MongoDate | null;
}

export interface MasterOrderDocument {
  _id: MongoId;
  order_number: string;
  user_id: MongoId;
  address_id?: MongoId | null;
  subtotal: Money;
  shipping: Money;
  discount: Money;
  total: Money;
  status?: 'pending' | 'confirmed' | 'processing' | 'shipping' | 'delivered' | 'cancelled' | null;
  payment_status?: 'pending' | 'partial' | 'paid' | 'refunded' | null;
  note?: string | null;
  created_at?: MongoDate | null;
  updated_at?: MongoDate | null;
}

export interface OrderDocument {
  _id: MongoId;
  order_code: string;
  user_id?: MongoId | null;
  order_type: 'ready_made' | 'custom' | 'printing';
  status?: string | null;
  subtotal?: number | null;
  shipping_fee?: number | null;
  discount?: number | null;
  total?: number | null;
  deposit_amount?: number | null;
  deposit_paid?: boolean | null;
  shipping_address?: Record<string, unknown> | null;
  shipping_code?: string | null;
  shipping_status?: string | null;
  customer_note?: string | null;
  admin_note?: string | null;
  paid_at?: MongoDate | null;
  shipped_at?: MongoDate | null;
  delivered_at?: MongoDate | null;
  created_at?: MongoDate | null;
  updated_at?: MongoDate | null;
  custom_config?: Record<string, unknown> | null;
  printing_config?: Record<string, unknown> | null;
  processing_at?: MongoDate | null;
  designing_at?: MongoDate | null;
  review_at?: MongoDate | null;
  approved_at?: MongoDate | null;
  printing_at?: MongoDate | null;
  shipping_address_id?: MongoId | null;
  confirmed_at?: MongoDate | null;
  producing_at?: MongoDate | null;
  revising_at?: MongoDate | null;
  demo_image_url?: string | null;
  master_order_id?: MongoId | null;
}

export interface OrderItemDocument {
  _id: MongoId;
  order_id?: MongoId | null;
  product_id?: MongoId | null;
  sku?: string | null;
  name: string;
  quantity?: number | null;
  unit_price: number;
  total_price: number;
  configuration?: Record<string, unknown> | null;
  created_at?: MongoDate | null;
  size?: string | null;
}

export interface PaymentDocument {
  _id: MongoId;
  order_id?: MongoId | null;
  amount: number;
  payment_method?: string | null;
  payment_type?: 'deposit' | 'full' | 'remaining' | null;
  status?: 'pending' | 'success' | 'failed' | 'refunded' | null;
  transaction_id?: string | null;
  paid_at?: MongoDate | null;
  created_at?: MongoDate | null;
}

export interface QrPaymentDocument {
  _id: MongoId;
  order_type: 'parent' | 'child' | 'direct_child';
  order_id: MongoId;
  reference_code: string;
  amount: Money;
  currency: string;
  status: string;
  method: string;
  qr_url: string;
  bank_code?: string | null;
  account_no?: string | null;
  account_name?: string | null;
  expires_at?: MongoDate | null;
  paid_at?: MongoDate | null;
  created_at?: MongoDate | null;
  updated_at?: MongoDate | null;
  idempotency_key?: string | null;
  correlation_id?: string | null;
}

export interface RefreshTokenDocument {
  _id: MongoId;
  user_id: MongoId;
  token_hash: string;
  session_id?: MongoId | null;
  family_id: MongoId;
  is_revoked?: boolean | null;
  revoked_at?: MongoDate | null;
  revoked_reason?: string | null;
  expires_at: MongoDate;
  created_at?: MongoDate | null;
}

export interface SessionDocument {
  _id: MongoId;
  sessionToken: string;
  userId: MongoId;
  expires: MongoDate;
}

export interface UserSessionDocument {
  _id: MongoId;
  user_id: MongoId;
  session_token: string;
  refresh_token?: string | null;
  device_fingerprint?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  device_name?: string | null;
  is_active?: boolean | null;
  last_active_at?: MongoDate | null;
  expires_at: MongoDate;
  created_at?: MongoDate | null;
}

export interface SettingDocument {
  _id: string;
  key: string;
  value: unknown;
  updated_at?: MongoDate | null;
}

export interface FaqDocument {
  _id: MongoId;
  question: string;
  answer: string;
  category?: string | null;
  sort_order?: number | null;
  is_active?: boolean | null;
  created_at?: MongoDate | null;
}

export interface FailedLoginAttemptDocument {
  _id: MongoId;
  email: string;
  ip_address: string;
  user_agent?: string | null;
  attempt_count?: number | null;
  first_attempt_at?: MongoDate | null;
  last_attempt_at?: MongoDate | null;
  blocked_until?: MongoDate | null;
  created_at?: MongoDate | null;
}
