
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

async function activateProducts() {
    const { data: products, error: fetchError } = await supabase.from('products').select('id');
    if (fetchError) {
        console.error('Error fetching products:', fetchError);
        return;
    }

    if (products.length === 0) {
        console.log('No products to update.');
        return;
    }

    console.log(`Found ${products.length} products. Activating...`);

    const { error: updateError } = await supabase
        .from('products')
        .update({ is_active: true })
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Update all

    if (updateError) {
        console.error('Error activating products:', updateError);
    } else {
        console.log('Successfully activated all products.');
    }
}

activateProducts();
