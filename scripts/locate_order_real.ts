
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);
const SEARCH_ID = 'ed390b80-f8ad-4128-b175-89f4c763a5c2';

async function locateOrder() {
    console.log(`Searching for ${SEARCH_ID} in project ${supabaseUrl}...`);

    // 1. Check custom_orders
    const { data: c1, error: e1 } = await supabase.from('custom_orders').select('id, order_number').eq('id', SEARCH_ID);
    if (c1?.length) console.log('FOUND in custom_orders (by id):', c1);
    if (e1) console.error('Error custom_orders (id):', e1.message);

    const { data: c2 } = await supabase.from('custom_orders').select('id, order_number').eq('order_number', SEARCH_ID);
    if (c2?.length) console.log('FOUND in custom_orders (by number):', c2);

    // 2. Check orders
    const { data: o1, error: e2 } = await supabase.from('orders').select('id, order_code').eq('id', SEARCH_ID);
    if (o1?.length) console.log('FOUND in orders (by id):', o1);
    if (e2) console.error('Error orders (id):', e2.message);

    const { data: o2 } = await supabase.from('orders').select('id, order_code').eq('order_code', SEARCH_ID);
    if (o2?.length) console.log('FOUND in orders (by code):', o2);

    // 3. Check print_orders
    const { data: p1, error: e3 } = await supabase.from('print_orders').select('id, order_number').eq('id', SEARCH_ID);
    if (p1?.length) console.log('FOUND in print_orders (by id):', p1);
    if (e3) console.error('Error print_orders (id):', e3.message);

    // 4. Check master_orders
    const { data: m1, error: e4 } = await supabase.from('master_orders').select('id, order_number').eq('id', SEARCH_ID);
    if (m1?.length) console.log('FOUND in master_orders (by id):', m1);
    if (e4) console.error('Error master_orders (id):', e4.message);
}

locateOrder();
