
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load env before anything else
const envPath = path.join(process.cwd(), '.env.local');
dotenv.config({ path: envPath });

async function migrate() {
    // Use DATABASE_URL from env but switch port 5432 -> 6543 (Session Mode)
    // 5432 is Transaction Mode (blocks DDL/Prepared Statements)
    // 6543 is Session Mode (allows everything like Direct)
    let connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
        console.error('Missing DATABASE_URL');
        process.exit(1);
    }

    if (connectionString.includes(':5432')) {
        console.log('Switching port 5432 -> 6543 for Session Mode...');
        connectionString = connectionString.replace(':5432', ':6543');
    }

    console.log('Connecting to database (Session Mode)...');
    const pool = new Pool({
        connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log('Starting migration...');

        // Read SQL file
        const sqlPath = path.join(process.cwd(), 'consolidate_orders.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('Executing SQL...');
        await pool.query(sql);

        console.log('Migration completed successfully.');
        await pool.end();
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        await pool.end();
        process.exit(1);
    }
}

migrate();
