
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function inspectOrder(orderId) {
    console.log('Inspecting Order:', orderId);

    const tables = ['custom_orders', 'print_orders', 'orders'];

    for (const table of tables) {
        const { data, error } = await supabase
            .from(table)
            .select('*')
            .eq('id', orderId)
            .maybeSingle();

        if (data) {
            console.log(`FOUND in table: ${table}`);
            console.log('Status:', data.status);
            console.log('User ID:', data.user_id);
            console.log('Fields:', Object.keys(data));
            return;
        }
    }

    console.log('Order NOT FOUND in any table');
}

inspectOrder('ed390b80-f8ad-4128-b175-89f4c763a5c2');
