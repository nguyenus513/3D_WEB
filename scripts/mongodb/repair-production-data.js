/*
 * Safe MongoDB production repair.
 * - Creates missing indexes.
 * - Backfills missing order created_at/updated_at from related records.
 * - Does not delete documents or rewrite business statuses by default.
 *
 * Usage:
 *   MONGODB_URI="..." MONGODB_DB_NAME="intelligentroutex" npm run mongo:repair
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || process.env.db_MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME || process.env.ATLAS_DB_NAME || 'intelligentroutex';
const dryRun = process.env.DRY_RUN === '1';

const indexes = [
  ['orders', { order_type: 1, status: 1, created_at: -1 }, { name: 'orders_type_status_created_idx' }],
  ['orders', { user_id: 1, order_type: 1, created_at: -1 }, { name: 'orders_user_type_created_idx' }],
  ['orders', { payment_status: 1, created_at: -1 }, { name: 'orders_payment_created_idx' }],
  ['orders', { archived_at: 1 }, { sparse: true, name: 'orders_archived_idx' }],
  ['order_items', { order_id: 1, item_type: 1 }, { name: 'order_items_order_type_idx' }],
  ['files', { file_url: 1 }, { unique: true, name: 'files_url_unique' }],
  ['files', { object_key: 1 }, { unique: true, sparse: true, name: 'files_object_key_unique' }],
  ['files', { file_key: 1 }, { unique: true, sparse: true, name: 'files_file_key_unique' }],
  ['files', { owner_id: 1, created_at: -1 }, { sparse: true, name: 'files_owner_created_idx' }],
  ['file_links', { file_id: 1 }, { name: 'file_links_file_idx' }],
  ['file_links', { ref_type: 1, ref_id: 1, tag: 1 }, { name: 'file_links_ref_idx' }],
  ['payments', { order_id: 1, status: 1 }, { name: 'payments_order_status_idx' }],
  ['payments', { transaction_code: 1 }, { unique: true, sparse: true, name: 'payments_transaction_code_unique' }],
  ['notifications', { user_id: 1, is_read: 1, created_at: -1 }, { name: 'notifications_user_read_created_idx' }],
];

const orderDateFields = [
  'created_at', 'updated_at', 'paid_at', 'confirmed_at', 'processing_at', 'designing_at',
  'review_at', 'approved_at', 'revising_at', 'producing_at', 'printing_at', 'finished_at',
  'shipping_at', 'shipped_at', 'delivered_at', 'cancelled_at',
];

function toDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function minDate(values) {
  const dates = values.map(toDate).filter(Boolean).sort((a, b) => a.getTime() - b.getTime());
  return dates[0] || null;
}

function maxDate(values) {
  const dates = values.map(toDate).filter(Boolean).sort((a, b) => b.getTime() - a.getTime());
  return dates[0] || null;
}

async function createIndexes(db) {
  const results = [];
  for (const [collection, keys, options] of indexes) {
    try {
      if (!dryRun) await db.collection(collection).createIndex(keys, options);
      results.push({ collection, name: options.name, ok: true, dryRun });
    } catch (error) {
      results.push({ collection, name: options.name, ok: false, error: error.message });
    }
  }
  return results;
}

async function relatedDates(db, order) {
  const ids = [order._id, order.id, order.order_code].filter(Boolean).map(String);
  const candidates = [];

  for (const field of orderDateFields) candidates.push(order[field]);

  const itemRows = await db.collection('order_items')
    .find({ order_id: { $in: ids } }, { projection: { created_at: 1, updated_at: 1 } })
    .limit(20)
    .toArray();
  itemRows.forEach((row) => candidates.push(row.created_at, row.updated_at));

  const paymentRows = await db.collection('payments')
    .find({ order_id: { $in: ids } }, { projection: { created_at: 1, updated_at: 1, paid_at: 1, confirmed_at: 1 } })
    .limit(20)
    .toArray();
  paymentRows.forEach((row) => candidates.push(row.created_at, row.updated_at, row.paid_at, row.confirmed_at));

  const notificationRows = await db.collection('notifications')
    .find({ $or: [{ order_id: { $in: ids } }, { 'metadata.order_id': { $in: ids } }, { 'metadata.order_code': order.order_code }] }, { projection: { created_at: 1 } })
    .limit(20)
    .toArray();
  notificationRows.forEach((row) => candidates.push(row.created_at));

  return { first: minDate(candidates), last: maxDate(candidates) };
}

async function backfillOrderTimes(db) {
  const cursor = db.collection('orders').find({
    $or: [{ created_at: { $exists: false } }, { created_at: null }, { updated_at: { $exists: false } }, { updated_at: null }],
  });
  const results = { matched: 0, updated: 0, skipped: 0, samples: [] };

  for await (const order of cursor) {
    results.matched += 1;
    const related = await relatedDates(db, order);
    const fallback = related.first || related.last;
    if (!fallback) {
      results.skipped += 1;
      results.samples.push({ id: order._id, order_code: order.order_code, reason: 'no_related_date' });
      continue;
    }

    const update = {};
    if (!toDate(order.created_at)) update.created_at = fallback.toISOString();
    if (!toDate(order.updated_at)) update.updated_at = (related.last || fallback).toISOString();

    if (Object.keys(update).length > 0) {
      if (!dryRun) await db.collection('orders').updateOne({ _id: order._id }, { $set: update });
      results.updated += 1;
      if (results.samples.length < 10) results.samples.push({ id: order._id, order_code: order.order_code, update });
    }
  }

  return results;
}

async function run() {
  if (!uri) {
    console.error(JSON.stringify({ ok: false, error: 'Missing MONGODB_URI or db_MONGODB_URI', dbName }, null, 2));
    process.exit(2);
  }

  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
  await client.connect();
  const db = client.db(dbName);

  const report = {
    ok: true,
    dryRun,
    generatedAt: new Date().toISOString(),
    database: dbName,
    indexes: await createIndexes(db),
    orderTimeBackfill: await backfillOrderTimes(db),
  };

  await client.close();
  console.log(JSON.stringify(report, null, 2));
}

run().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
  process.exit(1);
});
