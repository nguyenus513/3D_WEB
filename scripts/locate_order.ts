
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
const ORDER_ID = 'ed390b80-f8ad-4128-b175-89f4c763a5c2';

async function locateOrder() {
    console.log(`Searching for Order ID: ${ORDER_ID}`);

    const tables = ['orders', 'custom_orders', 'print_orders', 'master_orders', 'order_child'];

    for (const table of tables) {
        const { data, error } = await supabase
            .from(table)
            .select('id, status')
            .eq('id', ORDER_ID)
            .maybeSingle();

        if (data) {
            console.log(`✅ FOUND in table: '${table}'`);
            console.log('Data:', data);
            return;
        } else if (error) {
            console.error(`Error searching table '${table}':`, error.message);
        } else {
            console.log(`❌ Not found in '${table}'`);
        }
    }
    console.log('⚠️ Order ID not found in any checked table.');
}

locateOrder();
