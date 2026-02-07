import { NextRequest } from 'next/server';
import { checkoutController } from '@/controllers/CheckoutController';

export async function POST(request: NextRequest) {
    return checkoutController.confirmCheckout(request);
}
