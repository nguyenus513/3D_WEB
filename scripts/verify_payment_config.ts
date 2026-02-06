import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
    console.error('❌ Missing .env.local keys');
    process.exit(1);
}

const supabase = createClient(url, key);

async function main() {
    console.log('🔍 Checking payment_configs...');

    // 1. Check raw data
    const { data: all, error: rawError } = await supabase
        .from('payment_configs')
        .select('order_type, is_active');

    if (rawError) {
        console.error('❌ Raw Select Failed:', rawError.message);
        return;
    }

    console.log('Data found:', all);
    if (all && all.length > 0) {
        console.log('Type of is_active:', typeof all[0].is_active);
    }

    // 2. Test Query Logic
    const testType = 'ready_made';
    console.log(`\nTesting getPaymentConfig('${testType}')...`);

    const { data: config, error } = await supabase
        .from('payment_configs')
        .select('*')
        .eq('order_type', testType)
        .in('is_active', [true, 'true'])
        .maybeSingle();

    if (error) {
        console.error('❌ Query Error:', error.message);
    } else if (!config) {
        console.error('❌ Config NOT found!');
    } else {
        console.log('✅ Config FOUND:', config.id);
        console.log('Bank:', config.bank_code, config.account_no);
    }
}

main();
