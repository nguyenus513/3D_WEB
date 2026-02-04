
import dotenv from 'dotenv';
import path from 'path';

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

async function debugRpcUpdate() {
    console.log(`Testing RPC update_order_demo_image for ID: ${ORDER_ID}`);

    const { data, error } = await supabase.rpc('update_order_demo_image', {
        p_table_name: 'custom_orders',
        p_order_id: ORDER_ID,
        p_demo_image_url: 'https://test.example.com/demo.jpg',
        p_status: 'review',
        p_review_at: new Date().toISOString()
    });

    if (error) {
        console.error('❌ RPC Failed:', error);
    } else {
        console.log('✅ RPC Success!');
        console.log('Data:', data);
    }

    // Verify the update worked
    const { data: row } = await supabase
        .from('custom_orders')
        .select('demo_image_url, status, review_at')
        .eq('id', ORDER_ID)
        .single();

    console.log('\nVerification - Current Row Values:', row);
}

debugRpcUpdate();
