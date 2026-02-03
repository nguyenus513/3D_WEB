import { Pool } from 'pg';

// Use DATABASE_URL (Transaction Pool) or DIRECT_URL (Session Pool)
// Prefer DIRECT_URL for migrations or schema changes, but DATABASE_URL is fine for this bypass
const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;

if (!connectionString) {
    console.error('[DB Direct] Missing DATABASE_URL or DIRECT_URL environment variable');
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
