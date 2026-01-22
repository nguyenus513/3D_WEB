import { NextRequest, NextResponse } from 'next/server';
import {
    sendPaymentConfirmationEmail,
    sendCompletionEmail,
    sendShippingEmail
} from '@/lib/email/sendEmail';

/**
 * API endpoint to send order notification emails
 * 
 * POST /api/send-email
 * Body: { type, data }
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { type, data } = body;

        let success = false;

        switch (type) {
            case 'payment':
                success = await sendPaymentConfirmationEmail({
                    customerName: data.customerName,
                    customerEmail: data.customerEmail,
                    orderCode: data.orderCode,
                    orderType: data.orderType,
                    total: data.total,
                    depositAmount: data.depositAmount,
                });
                break;

            case 'completion':
                success = await sendCompletionEmail({
                    customerName: data.customerName,
                    customerEmail: data.customerEmail,
                    orderCode: data.orderCode,
                    demoImageUrl: data.demoImageUrl,
                });
                break;

            case 'shipping':
                success = await sendShippingEmail({
                    customerName: data.customerName,
                    customerEmail: data.customerEmail,
                    orderCode: data.orderCode,
                    shippingCode: data.shippingCode,
                    carrier: data.carrier,
                });
                break;

            default:
                return NextResponse.json(
                    { error: 'Invalid email type' },
                    { status: 400 }
                );
        }

        if (success) {
            return NextResponse.json({ success: true });
        } else {
            return NextResponse.json(
                { error: 'Failed to send email (check BREVO_API_KEY)' },
                { status: 500 }
            );
        }
    } catch (error) {
        console.error('[API/send-email] Error:', error);
        return NextResponse.json(
            { error: (error as Error).message },
            { status: 500 }
        );
    }
}
