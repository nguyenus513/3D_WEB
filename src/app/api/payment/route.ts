/**
 * Payment API Routes
 * 
 * POST /api/payment/create-intent - Create Stripe Payment Intent
 * POST /api/payment/bank-transfer - Get bank transfer info with QR
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { PaymentService } from '@/services/PaymentService';
import { z } from 'zod';

const paymentService = new PaymentService();

// Validation schemas
const createIntentSchema = z.object({
    orderId: z.string().uuid(),
    amount: z.number().min(1000), // Minimum 1000 VND
});

const bankTransferSchema = z.object({
    orderId: z.string().uuid(),
    amount: z.number().min(1000),
});

// POST /api/payment/create-intent
export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();

        // Determine action based on body
        if (body.action === 'bank-transfer') {
            // Bank transfer info
            const validated = bankTransferSchema.parse(body);
            const info = paymentService.getBankTransferInfo(validated.orderId, validated.amount);
            return NextResponse.json({ success: true, data: info });
        }

        // Default: Create Stripe Payment Intent
        const validated = createIntentSchema.parse(body);

        const result = await paymentService.createPaymentIntent({
            orderId: validated.orderId,
            amount: validated.amount,
            metadata: {
                userId: session.user.id,
            },
        });

        return NextResponse.json({
            success: true,
            clientSecret: result.clientSecret,
            paymentIntentId: result.paymentIntentId,
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { error: 'Validation failed', details: error.errors },
                { status: 400 }
            );
        }

        console.error('Payment API error:', error);
        return NextResponse.json(
            { error: 'Payment processing failed' },
            { status: 500 }
        );
    }
}
