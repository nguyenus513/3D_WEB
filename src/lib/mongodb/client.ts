import { MongoClient, type Db } from 'mongodb';

const DEFAULT_DB_NAME = 'intelligentroutex';

declare global {
  // eslint-disable-next-line no-var
  var __mongoClientPromise: Promise<MongoClient> | undefined;
}

function getMongoUri(): string {
  const uri = process.env.MONGODB_URI || process.env.db_MONGODB_URI;

  if (!uri) {
    throw new Error('MongoDB URI is not configured. Set MONGODB_URI or Vercel db_MONGODB_URI');
  }

  return uri;
}

function getMongoDbName(): string {
  return process.env.MONGODB_DB_NAME || DEFAULT_DB_NAME;
}

export function getMongoClient(): Promise<MongoClient> {
  if (!globalThis.__mongoClientPromise) {
    const client = new MongoClient(getMongoUri(), {
      appName: 'miniver-3d-web',
      maxPoolSize: 10,
      minPoolSize: 0,
      serverSelectionTimeoutMS: 10_000,
    });

    globalThis.__mongoClientPromise = client.connect();
  }

  return globalThis.__mongoClientPromise;
}

export async function getMongoDb(dbName = getMongoDbName()): Promise<Db> {
  const client = await getMongoClient();
  return client.db(dbName);
}

export async function pingMongoDb(): Promise<{ ok: number; db: string }> {
  const db = await getMongoDb();
  const result = await db.command({ ping: 1 });

  return {
    ok: result.ok,
    db: db.databaseName,
  };
}



