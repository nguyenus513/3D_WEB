import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(url, key);

async function checkOrder(orderId: string) {
    console.log(`🔍 Checking Order: ${orderId}`);

    // Check order_child
    const { data: child, error: childError } = await supabase
        .from('order_child')
        .select('*')
        .eq('id', orderId)
        .maybeSingle();

    if (child) {
        console.log('✅ Found in order_child:', {
            id: child.id,
            status: child.status,
            user_id: child.user_id
        });
        return;
    }

    // Check orders
    const { data: legacy, error: legacyError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .maybeSingle();

    if (legacy) {
        console.log('✅ Found in legacy orders:', {
            id: legacy.id,
            status: legacy.status
        });
        return;
    }

    console.error('❌ Order NOT found in any table.');
    if (childError) console.error('Child Error:', childError.message);
    if (legacyError) console.error('Legacy Error:', legacyError.message);
}

const targetId = process.argv[2];
if (!targetId) {
    console.error('Usage: npx tsx scripts/check_order.ts <ORDER_ID>');
} else {
    checkOrder(targetId);
}
