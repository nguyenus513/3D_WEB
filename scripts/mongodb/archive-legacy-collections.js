/*
 * Archive or drop legacy MongoDB collections after runtime refs are removed.
 * Default is dry-run. Set APPLY=1 to rename/drop.
 * Set DROP_ARCHIVES=1 only after a verified archive window.
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || process.env.db_MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME || process.env.ATLAS_DB_NAME || 'intelligentroutex';
const apply = process.env.APPLY === '1';
const dropArchives = process.env.DROP_ARCHIVES === '1';
const suffix = process.env.ARCHIVE_SUFFIX || new Date().toISOString().slice(0, 10).replace(/-/g, '');

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

async function exists(db, name) {
  return (await db.listCollections({ name }).toArray()).length > 0;
}

async function run() {
  if (!uri) throw new Error('Missing MONGODB_URI or db_MONGODB_URI');
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
  await client.connect();
  const db = client.db(dbName);
  const actions = [];

  for (const name of legacyCollections) {
    const archivedName = `legacy_${name}_archived_${suffix}`;
    if (await exists(db, name)) {
      const count = await db.collection(name).countDocuments();
      if (dropArchives) {
        actions.push({ collection: name, action: 'skip_drop_live_legacy', count });
      } else {
        actions.push({ collection: name, archive: archivedName, action: apply ? 'rename' : 'dry_run_rename', count });
        if (apply) await db.collection(name).rename(archivedName, { dropTarget: false });
      }
    }

    if (dropArchives && await exists(db, archivedName)) {
      const count = await db.collection(archivedName).countDocuments();
      actions.push({ collection: archivedName, action: apply ? 'drop_archive' : 'dry_run_drop_archive', count });
      if (apply) await db.collection(archivedName).drop();
    }
  }

  await client.close();
  console.log(JSON.stringify({ ok: true, apply, dropArchives, suffix, actions }, null, 2));
}

run().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
  process.exit(1);
});

