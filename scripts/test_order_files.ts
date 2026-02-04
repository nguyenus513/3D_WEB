
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

async function testOrderFiles() {
    console.log(`Checking order_files for ID: ${ORDER_ID}`);

    const { data, error } = await supabase
        .from('order_files')
        .select('*')
        .eq('order_id', ORDER_ID);

    if (error) {
        console.error('❌ Read Failed:', error);
    } else {
        console.log('✅ Read Success. Files found:', data?.length);
        console.log(data);
    }
}

testOrderFiles();
