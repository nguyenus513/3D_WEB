const { MongoClient } = require('mongodb');

const sourceUri = process.env.SOURCE_MONGODB_URI || process.env.LOCAL_MONGODB_URI;
const targetUri = process.env.TARGET_MONGODB_URI || process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME || process.env.ATLAS_DB_NAME || 'intelligentroutex';
const batchSize = Number(process.env.MONGO_COPY_BATCH_SIZE || 500);
const dropTarget = process.env.MONGO_COPY_DROP !== 'false';

if (!sourceUri) throw new Error('Missing SOURCE_MONGODB_URI or LOCAL_MONGODB_URI');
if (!targetUri) throw new Error('Missing TARGET_MONGODB_URI or MONGODB_URI');

function sanitizeIndex(index) {
  const { v, ns, ...rest } = index;
  return rest;
}

async function copyCollection(sourceDb, targetDb, name) {
  const source = sourceDb.collection(name);
  const target = targetDb.collection(name);

  if (dropTarget) {
    try { await target.drop(); } catch (error) { if (error.codeName !== 'NamespaceNotFound') throw error; }
  }

  const indexes = await source.indexes().catch(() => []);
  const nonIdIndexes = indexes.filter((idx) => idx.name !== '_id_').map(sanitizeIndex);

  let copied = 0;
  let batch = [];
  const cursor = source.find({}, { noCursorTimeout: true });
  try {
    for await (const doc of cursor) {
      batch.push(doc);
      if (batch.length >= batchSize) {
        await target.insertMany(batch, { ordered: false });
        copied += batch.length;
        batch = [];
      }
    }
    if (batch.length > 0) {
      await target.insertMany(batch, { ordered: false });
      copied += batch.length;
    }
  } finally {
    await cursor.close().catch(() => {});
  }

  for (const index of nonIdIndexes) {
    try {
      await target.createIndex(index.key, {
        name: index.name,
        unique: index.unique,
        sparse: index.sparse,
        expireAfterSeconds: index.expireAfterSeconds,
        partialFilterExpression: index.partialFilterExpression,
      });
    } catch (error) {
      console.warn(`[index-skip] ${name}.${index.name}: ${error.message}`);
    }
  }

  return { collection: name, documents: copied, indexes: nonIdIndexes.length };
}

async function main() {
  const sourceClient = new MongoClient(sourceUri);
  const targetClient = new MongoClient(targetUri);
  await sourceClient.connect();
  await targetClient.connect();

  const sourceDb = sourceClient.db(dbName);
  const targetDb = targetClient.db(dbName);
  const collections = (await sourceDb.listCollections().toArray()).map((c) => c.name).sort();
  const results = [];

  for (const name of collections) {
    const result = await copyCollection(sourceDb, targetDb, name);
    results.push(result);
    console.log(`[copied] ${name}: ${result.documents} docs, ${result.indexes} indexes`);
  }

  await sourceClient.close();
  await targetClient.close();

  const totalDocuments = results.reduce((sum, item) => sum + item.documents, 0);
  console.log(JSON.stringify({ ok: true, dbName, collections: results.length, totalDocuments, results }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
