import { NextRequest } from 'next/server';
import { checkoutController } from '@/controllers/CheckoutController';

export async function GET(request: NextRequest) {
    return checkoutController.getCheckout(request);
}
