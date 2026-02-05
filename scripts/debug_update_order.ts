
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

async function debugUpdate() {
    console.log(`Attempting to update custom_order ${ORDER_ID}...`);

    // Simulate the payload from AdminOrderController
    const updates = {
        status: 'paid', // Assuming confirm payment sets this
        admin_note: 'Debug note' // Simulate admin note being passed (SINGULAR)
    };

    const { data, error, count } = await supabase
        .from('custom_orders')
        .update(updates)
        .eq('id', ORDER_ID)
        .select('id');

    if (error) {
        console.error('❌ Update Failed:', error);
    } else {
        console.log('✅ Update Success!');
        console.log('Count:', count);
        console.log('Data:', data);
    }

    // Check visibility
    console.log('\nChecking row data...');
    const { data: row, error: readError } = await supabase
        .from('custom_orders')
        .select('*')
        .eq('id', ORDER_ID)
        .single();

    if (row) {
        console.log('Row Keys:', Object.keys(row).join(', '));
        console.log('admin_notes value:', row.admin_notes);
    } else {
        console.error('Read Error:', readError);
    }
}

debugUpdate();
