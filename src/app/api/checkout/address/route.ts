import { NextRequest } from 'next/server';
import { checkoutController } from '@/controllers/CheckoutController';

export async function PATCH(request: NextRequest) {
    return checkoutController.updateAddress(request);
}
