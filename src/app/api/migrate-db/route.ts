
import { NextResponse } from 'next/server';
import { dbRequest } from '@/lib/db-direct';

export async function GET() {
    try {
        console.log('Starting migration via API...');
        const sql = `
            -- 1. Add missing colums
            ALTER TABLE public.orders 
            ADD COLUMN IF NOT EXISTS custom_config JSONB,
            ADD COLUMN IF NOT EXISTS printing_config JSONB,
            ADD COLUMN IF NOT EXISTS demo_image_url TEXT,
            ADD COLUMN IF NOT EXISTS review_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS revising_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS order_type TEXT DEFAULT 'ready_made';

            -- 2. Migrate custom_orders
            INSERT INTO public.orders (
                id, user_id, order_code, status, total_amount, subtotal, shipping_fee, deposit_amount, 
                shipping_address_snapshot, notes, admin_notes, created_at, updated_at, 
                custom_config, demo_image_url, review_at, approved_at, revising_at, order_type
            )
            SELECT 
                id, user_id, order_number, status::order_status, total, subtotal, shipping_fee, deposit_amount,
                shipping_address, customer_note, admin_note, created_at, updated_at,
                custom_config, demo_image_url, review_at, approved_at, revising_at, 'custom'
            FROM public.custom_orders
            ON CONFLICT (id) DO UPDATE SET
                custom_config = EXCLUDED.custom_config,
                demo_image_url = EXCLUDED.demo_image_url,
                order_type = 'custom';

            -- 3. Migrate print_orders
            INSERT INTO public.orders (
                id, user_id, order_code, status, total_amount, created_at, updated_at,
                printing_config, demo_image_url, notes, order_type
            )
            SELECT 
                id, user_id, order_number, status::order_status, total_price, created_at, updated_at,
                jsonb_build_object(
                    'type', print_type,
                    'color', color,
                    'quantity', quantity,
                    'files', files
                ), 
                demo_image_url, notes, 'printing'
            FROM public.print_orders
            ON CONFLICT (id) DO UPDATE SET
                printing_config = EXCLUDED.printing_config,
                demo_image_url = EXCLUDED.demo_image_url,
                order_type = 'printing';
        `;

        await dbRequest.query(sql);
        return NextResponse.json({ success: true, message: 'Migration completed' });
    } catch (error: any) {
        console.error('Migration API failed:', error);
        return NextResponse.json({ error: error.message, stack: error.stack }, { status: 500 });
    }
}
