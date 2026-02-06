import { NextResponse } from 'next/server';
import { fetchCustomPricing, fetchPrintingPricing } from '@/lib/services/pricingService';

export async function GET() {
    try {
        const [custom, printing] = await Promise.all([
            fetchCustomPricing(),
            fetchPrintingPricing(),
        ]);

        return NextResponse.json({
            success: true,
            custom,
            printing,
        });
    } catch (error) {
        return NextResponse.json(
            { success: false, error: (error as Error).message },
            { status: 500 }
        );
    }
}

