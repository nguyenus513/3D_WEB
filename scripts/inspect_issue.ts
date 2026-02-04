
import dotenv from 'dotenv';
import path from 'path';

// Load env vars from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function inspectSchema() {
    console.log('--- Inspecting Orders Table Schema ---');
    // We can't easily query information_schema via supabase-js without direct SQL function usually,
    // but let's try to insert/select and see if we can infer or use a known RPC if exists.
    // Better strategy: Select a single row and look at the keys returned.

    const { data: order, error } = await supabase.from('orders').select('*').limit(1);

    if (error) {
        console.error('Error fetching order sample:', error);
    } else if (order && order.length > 0) {
        const keys = Object.keys(order[0]);
        console.log('Order Columns:', keys.join(', '));
        console.log('Has deposit_paid:', keys.includes('deposit_paid'));
    } else {
        console.log('No orders found to inspect schema from.');
    }

    console.log('\n--- Inspecting Products Status ---');
    const { data: products } = await supabase.from('products').select('id, name, is_active, status');
    if (products) {
        console.log('Total Products:', products.length);
        products.forEach(p => {
            console.log(`- ${p.name}: Active=${p.is_active}, Status=${p.status}`);
        });
    }
}

inspectSchema();
