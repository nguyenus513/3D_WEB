
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkColumn() {
    console.log(`Checking columns for custom_orders...`);

    // We can't query information_schema easily via JS client.
    // But we can try to select the column.

    const { data, error } = await supabase
        .from('custom_orders')
        .select('demo_image_url')
        .limit(1);

    if (error) {
        console.error('Column Missing or Cache Error:', error.message);
    } else {
        console.log('Column Exists (in select)!');
    }
}

checkColumn();
