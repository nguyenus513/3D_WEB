/*
 * Read-only MongoDB production schema audit.
 * Usage:
 *   MONGODB_URI="..." MONGODB_DB_NAME="intelligentroutex" node scripts/mongodb/audit-production-schema.js
 * Optional:
 *   AUDIT_OUTPUT="test-results/mongodb-audit.json"
 */

const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || process.env.db_MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME || process.env.ATLAS_DB_NAME || 'intelligentroutex';
const output = process.env.AUDIT_OUTPUT;

const canonicalCollections = [
  'profiles',
  'addresses',
  'categories',
  'products',
  'orders',
  'order_items',
  'files',
  'file_links',
  'payments',
  'notifications',
  'design_versions',
  'design_images',
  'print_jobs',
  'sessions',
  'user_sessions',
  'refresh_tokens',
  'verification_tokens',
  'security_logs',
  'admin_audit_log',
  'settings',
  'system_settings',
  'faqs',
];

const legacyCollections = [
  'master_orders',
  'order_parent',
  'order_child',
  'order_files',
  'custom_orders',
  'print_orders',
  'payment',
  '_backup_accounts',
  '_backup_order_configs',
  '_backup_product_images',
];

const expectedIndexes = {
  profiles: ['profiles_email_unique', 'profiles_customer_code_unique'],
  orders: ['orders_order_code_unique', 'orders_user_created_idx', 'orders_type_status_created_idx', 'orders_user_type_created_idx', 'orders_payment_created_idx'],
  order_items: ['order_items_order_idx', 'order_items_order_type_idx'],
  files: ['files_url_unique', 'files_object_key_unique', 'files_file_key_unique', 'files_owner_created_idx'],
  file_links: ['file_links_file_idx', 'file_links_ref_idx'],
  payments: ['payments_order_idx', 'payments_order_status_idx', 'payments_transaction_code_unique'],
  notifications: ['notifications_user_read_created_idx'],
  sessions: ['sessions_expires_ttl'],
  user_sessions: ['user_sessions_expires_ttl'],
  verification_tokens: ['verification_expires_ttl'],
  refresh_tokens: ['refresh_tokens_expires_ttl'],
};

const allowedOrderStatuses = new Set([
  'pending', 'confirmed', 'paid', 'processing', 'designing', 'review', 'revising', 'approved', 'producing',
  'printing', 'finished', 'shipping', 'shipped', 'delivered', 'completed', 'cancelled', 'expired', 'pending_confirmation',
  'pending_demo_approval', 'contact_requested', 'refund_requested', 'refunded', null,
]);
const allowedPaymentStatuses = new Set(['pending', 'paid', 'success', 'failed', 'refunded', 'expired', null]);
const allowedOrderPaymentStatuses = new Set(['unpaid', 'pending', 'partial', 'deposit_paid', 'paid', 'failed', 'refunded', null]);

function redact(value) {
  if (!value) return value;
  return String(value).replace(/(mongodb(?:\+srv)?:\/\/)([^@]+)@/i, '$1<redacted>@');
}

async function collectionExists(db, name) {
  const collections = await db.listCollections({ name }).toArray();
  return collections.length > 0;
}

async function getIndexNames(db, collection) {
  if (!(await collectionExists(db, collection))) return [];
  return (await db.collection(collection).indexes()).map((idx) => idx.name);
}

async function safeCount(db, collection, filter = {}) {
  if (!(await collectionExists(db, collection))) return null;
  return db.collection(collection).countDocuments(filter);
}

async function duplicateKeys(db, collection, field) {
  if (!(await collectionExists(db, collection))) return [];
  return db.collection(collection).aggregate([
    { $match: { [field]: { $exists: true, $ne: null } } },
    { $group: { _id: `$${field}`, count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $limit: 20 },
  ]).toArray();
}

async function danglingFileLinks(db) {
  if (!(await collectionExists(db, 'file_links'))) return [];
  return db.collection('file_links').aggregate([
    { $lookup: { from: 'files', localField: 'file_id', foreignField: '_id', as: 'file' } },
    { $match: { file: { $size: 0 } } },
    { $project: { _id: 1, file_id: 1, ref_type: 1, ref_id: 1, tag: 1 } },
    { $limit: 50 },
  ]).toArray();
}

async function ordersMissingTimestamps(db) {
  if (!(await collectionExists(db, 'orders'))) return { total: 0, withSignals: 0, orphan: 0, samples: [] };
  const rows = await db.collection('orders').find({
    $or: [{ created_at: { $exists: false } }, { created_at: null }, { updated_at: { $exists: false } }, { updated_at: null }],
  }, { projection: { _id: 1, order_code: 1, user_id: 1, order_type: 1, status: 1, payment_status: 1 } }).toArray();

  let withSignals = 0;
  const samples = [];
  for (const row of rows) {
    const ids = [row._id, row.order_code].filter(Boolean).map(String);
    const hasRelated = await db.collection('order_items').countDocuments({ order_id: { $in: ids } }, { limit: 1 })
      || await db.collection('payments').countDocuments({ order_id: { $in: ids } }, { limit: 1 })
      || await db.collection('notifications').countDocuments({ $or: [{ order_id: { $in: ids } }, { 'metadata.order_id': { $in: ids } }, { 'metadata.order_code': row.order_code }] }, { limit: 1 });
    if (hasRelated) withSignals += 1;
    if (samples.length < 20) samples.push({ ...row, hasRelated: Boolean(hasRelated) });
  }
  return { total: rows.length, withSignals, orphan: rows.length - withSignals, samples };
}

async function run() {
  if (!uri) {
    console.error(JSON.stringify({ ok: false, error: 'Missing MONGODB_URI or db_MONGODB_URI', dbName }, null, 2));
    process.exit(2);
  }

  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
  await client.connect();
  const db = client.db(dbName);

  const existing = (await db.listCollections().toArray()).map((c) => c.name).sort();
  const report = {
    ok: true,
    generatedAt: new Date().toISOString(),
    database: dbName,
    uri: redact(uri),
    collections: {
      existing,
      missingCanonical: canonicalCollections.filter((name) => !existing.includes(name)),
      presentLegacy: legacyCollections.filter((name) => existing.includes(name)),
    },
    counts: {},
    indexes: {},
    integrity: {},
    duplicates: {},
    recommendations: [],
  };

  for (const name of canonicalCollections) {
    report.counts[name] = await safeCount(db, name);
  }

  for (const [collection, names] of Object.entries(expectedIndexes)) {
    const actual = await getIndexNames(db, collection);
    report.indexes[collection] = {
      actual,
      missing: names.filter((name) => !actual.includes(name)),
    };
  }

  report.integrity.ordersMissingCreatedAt = await safeCount(db, 'orders', { $or: [{ created_at: { $exists: false } }, { created_at: null }] });
  report.integrity.ordersMissingUpdatedAt = await safeCount(db, 'orders', { $or: [{ updated_at: { $exists: false } }, { updated_at: null }] });
  report.integrity.ordersMissingTimestamps = await ordersMissingTimestamps(db);
  report.integrity.ordersMissingPaymentStatus = await safeCount(db, 'orders', { payment_status: { $exists: false } });
  report.integrity.ordersInvalidStatus = await safeCount(db, 'orders', { status: { $nin: [...allowedOrderStatuses] } });
  report.integrity.ordersInvalidPaymentStatus = await safeCount(db, 'orders', { payment_status: { $nin: [...allowedOrderPaymentStatuses] } });
  report.integrity.paymentsInvalidStatus = await safeCount(db, 'payments', { status: { $nin: [...allowedPaymentStatuses] } });
  report.integrity.filesMissingLocator = await safeCount(db, 'files', { $and: [{ file_url: { $exists: false } }, { object_key: { $exists: false } }, { file_key: { $exists: false } }] });
  report.integrity.fileLinksDangling = await danglingFileLinks(db);

  report.duplicates.orderCode = await duplicateKeys(db, 'orders', 'order_code');
  report.duplicates.profileEmail = await duplicateKeys(db, 'profiles', 'email');
  report.duplicates.customerCode = await duplicateKeys(db, 'profiles', 'customer_code');
  report.duplicates.paymentTransactionCode = await duplicateKeys(db, 'payments', 'transaction_code');

  for (const [collection, data] of Object.entries(report.indexes)) {
    if (data.missing.length > 0) report.recommendations.push(`Create missing indexes on ${collection}: ${data.missing.join(', ')}`);
  }
  if (report.collections.missingCanonical.length > 0) report.recommendations.push(`Create missing canonical collections: ${report.collections.missingCanonical.join(', ')}`);
  if (report.collections.presentLegacy.length > 0) report.recommendations.push(`Keep legacy collections read-only or migrate: ${report.collections.presentLegacy.join(', ')}`);
  if (report.integrity.fileLinksDangling.length > 0) report.recommendations.push('Fix dangling file_links before enforcing validationAction:error');

  await client.close();

  const json = JSON.stringify(report, null, 2);
  if (output) {
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, json);
  }
  console.log(json);

  const hardProblems = [
    report.collections.missingCanonical.length,
    Object.values(report.indexes).reduce((sum, item) => sum + item.missing.length, 0),
    report.integrity.ordersInvalidStatus || 0,
    report.integrity.ordersInvalidPaymentStatus || 0,
    report.integrity.paymentsInvalidStatus || 0,
    report.integrity.fileLinksDangling.length,
  ].reduce((a, b) => a + b, 0);

  if (hardProblems > 0) process.exit(1);
}

run().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
  process.exit(1);
});
