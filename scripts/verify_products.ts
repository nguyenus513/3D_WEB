
import dotenv from 'dotenv';
import path from 'path';

// Load env vars from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing env vars:', { supabaseUrl: !!supabaseUrl, serviceRoleKey: !!serviceRoleKey });
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkProducts() {
    const { data, error } = await supabase.from('products').select('*');
    if (error) {
        console.error('Error fetching products:', error);
        return;
    }
    console.log('Total Products:', data.length);
    if (data.length > 0) {
        console.log('Sample Product (first item):', JSON.stringify({
            id: data[0].id,
            name: data[0].name,
            is_active: data[0].is_active,
            status: data[0].status,
            deleted_at: data[0].deleted_at
        }, null, 2));

        const activeCount = data.filter(p => p.is_active).length;
        const inactiveCount = data.filter(p => !p.is_active).length;
        console.log(`Active: ${activeCount}, Inactive: ${inactiveCount}`);

        // Check if map logic is flawed
        console.log('All IDs + Active Status:', data.map(p => ({ id: p.id, active: p.is_active })));
    } else {
        console.log('No products found in DB.');
    }
}

checkProducts();
