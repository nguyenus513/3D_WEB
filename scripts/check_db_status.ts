import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function checkOrderStatus() {
    const orderId = 'ed390b80-f8ad-4128-b175-89f4c763a5c2';

    console.log('=== DIRECT DATABASE CHECK ===');
    console.log('DATABASE_URL:', process.env.DATABASE_URL?.substring(0, 50) + '...');

    try {
        // Check custom_orders
        const result = await pool.query(
            `SELECT id, order_number, status, demo_image_url, updated_at 
             FROM custom_orders WHERE id = $1`,
            [orderId]
        );

        console.log('\n=== custom_orders table ===');
        if (result.rows.length > 0) {
            console.log('Order found:');
            console.log('  Status:', result.rows[0].status);
            console.log('  Demo URL:', result.rows[0].demo_image_url?.substring(0, 80));
            console.log('  Updated:', result.rows[0].updated_at);
        } else {
            console.log('Order NOT found in custom_orders');
        }

    } catch (error) {
        console.error('Database error:', error);
    } finally {
        await pool.end();
    }
}

checkOrderStatus();
