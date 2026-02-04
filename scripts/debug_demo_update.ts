
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

async function debugDemoUpdate() {
    console.log(`Testing demo_image_url update on custom_orders for ID: ${ORDER_ID}`);

    const updates = {
        demo_image_url: 'https://test.example.com/demo.jpg',
        status: 'review',
        review_at: new Date().toISOString()
    };

    const { data, error } = await supabase
        .from('custom_orders')
        .update(updates)
        .eq('id', ORDER_ID)
        .select('id');

    if (error) {
        console.error('❌ Update Failed:', error);
    } else {
        console.log('✅ Update Success!');
        console.log('Data:', data);
    }
}

debugDemoUpdate();
