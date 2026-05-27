import type { Collection, Document } from 'mongodb';
import { getMongoDb } from './client';
import type {
  AddressDocument,
  CategoryDocument,
  FaqDocument,
  FailedLoginAttemptDocument,
  MasterOrderDocument,
  OrderDocument,
  OrderItemDocument,
  PaymentDocument,
  ProductDocument,
  ProductVariantDocument,
  ProfileDocument,
  QrPaymentDocument,
  RefreshTokenDocument,
  SessionDocument,
  SettingDocument,
  UserSessionDocument,
} from './documents';

export interface MongoCollections {
  profiles: Collection<ProfileDocument>;
  addresses: Collection<AddressDocument>;
  categories: Collection<CategoryDocument>;
  products: Collection<ProductDocument>;
  productVariants: Collection<ProductVariantDocument>;
  master_orders: Collection<MasterOrderDocument>;
  orders: Collection<OrderDocument>;
  order_items: Collection<OrderItemDocument>;
  payment: Collection<QrPaymentDocument>;
  payments: Collection<PaymentDocument>;
  payment_configs: Collection<Document>;
  refresh_tokens: Collection<RefreshTokenDocument>;
  sessions: Collection<SessionDocument>;
  user_sessions: Collection<UserSessionDocument>;
  settings: Collection<SettingDocument>;
  faqs: Collection<FaqDocument>;
  failed_login_attempts: Collection<FailedLoginAttemptDocument>;
}

export async function getMongoCollection<T extends Document = Document>(name: string): Promise<Collection<T>> {
  const db = await getMongoDb();
  return db.collection<T>(name);
}

export async function getMongoCollections(): Promise<MongoCollections> {
  const db = await getMongoDb();

  return {
    profiles: db.collection<ProfileDocument>('profiles'),
    addresses: db.collection<AddressDocument>('addresses'),
    categories: db.collection<CategoryDocument>('categories'),
    products: db.collection<ProductDocument>('products'),
    productVariants: db.collection<ProductVariantDocument>('product_variants'),
    master_orders: db.collection<MasterOrderDocument>('master_orders'),
    orders: db.collection<OrderDocument>('orders'),
    order_items: db.collection<OrderItemDocument>('order_items'),
    payment: db.collection<QrPaymentDocument>('payment'),
    payments: db.collection<PaymentDocument>('payments'),
    payment_configs: db.collection<Document>('payment_configs'),
    refresh_tokens: db.collection<RefreshTokenDocument>('refresh_tokens'),
    sessions: db.collection<SessionDocument>('sessions'),
    user_sessions: db.collection<UserSessionDocument>('user_sessions'),
    settings: db.collection<SettingDocument>('settings'),
    faqs: db.collection<FaqDocument>('faqs'),
    failed_login_attempts: db.collection<FailedLoginAttemptDocument>('failed_login_attempts'),
  };
}
