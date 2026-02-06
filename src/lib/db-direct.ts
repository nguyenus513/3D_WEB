import { Pool } from 'pg';

// Use DATABASE_URL (Transaction Pool) or DIRECT_URL (Session Pool)
// Prefer DIRECT_URL for migrations or schema changes, but DATABASE_URL is fine for this bypass
// FIX: Prioritize DIRECT_URL to avoid "Tenant or user not found" errors with Transaction Pooler + pg Pool
const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!connectionString) {
    console.error('[DB Direct] Missing DIRECT_URL or DATABASE_URL environment variable');
} else {
    // Mask sensitive info
    const masked = connectionString.substring(0, 25) + '...';
    console.log(`[DB Direct] Initializing pool with: ${process.env.DIRECT_URL ? 'DIRECT_URL' : 'DATABASE_URL'} (${masked})`);
}

const pool = new Pool({
    connectionString,
    ssl: {
        rejectUnauthorized: false
    }
});

export const dbRequest = {
    query: (text: string, params?: any[]) => pool.query(text, params),
};
