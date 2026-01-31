import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getPaymentConfig, getDefaultPaymentConfig, getCustomerCode, generateFallbackCustomerCode } from '@/lib/services/paymentConfigService';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        // 1. Get Payment Config
        const config = await getPaymentConfig('ready_made');
        const finalConfig = config || getDefaultPaymentConfig();

        // 2. Get Customer Code (if logged in)
        const session = await auth();
        let customerCode = null;

        if (session?.user?.id) {
            customerCode = await getCustomerCode(session.user.id, session.user.email);
            if (!customerCode) {
                customerCode = generateFallbackCustomerCode(session.user.id);
            }
        }

        return NextResponse.json({
            ...finalConfig,
            customer_code: customerCode
        });
    } catch (error) {
        console.error('[API] Error fetching payment config:', error);
        return NextResponse.json(
            { error: 'Failed to fetch payment config' },
            { status: 500 }
        );
    }
}
