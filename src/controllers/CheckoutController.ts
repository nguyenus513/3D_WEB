import { NextRequest } from 'next/server';
import { BaseController, UnauthorizedError } from '@/lib/core/BaseController';
import { auth } from '@/auth';
import { createClient } from '@supabase/supabase-js';
import { config } from '@/config/unifiedConfig';
import { CartRepository } from '@/repositories/CartRepository';
import { OrderRepository } from '@/repositories/OrderRepository';
import { CartService } from '@/services/CartService';
import { CheckoutService } from '@/services/CheckoutService';
import { addressSchema } from '@/lib/validations/checkout';

const supabaseAdmin = createClient(
    config.supabase.url,
    config.supabase.serviceRoleKey,
    { auth: { persistSession: false } }
);

export class CheckoutController extends BaseController {
    private readonly cartService: CartService;
    private readonly checkoutService: CheckoutService;

    constructor() {
        super();
        const cartRepo = new CartRepository(supabaseAdmin);
        const orderRepo = new OrderRepository(supabaseAdmin);
        this.cartService = new CartService(cartRepo);
        this.checkoutService = new CheckoutService(cartRepo, orderRepo);
    }

    async getCheckout(request: NextRequest) {
        return this.wrapHandler(async () => {
            const session = await auth();
            if (!session?.user?.id) throw new UnauthorizedError();

            const data = await this.checkoutService.getCheckout(session.user.id);
            if (!data) {
                return this.handleSuccess({ cart_code: null as string | null, items: [] as any[], subtotal: 0, total_amount: 0 });
            }

            const items = this.cartService.toClientFormat({
                ...data.cart,
                cart_items: data.items,
            } as any);

            return this.handleSuccess({
                cart_code: data.cart.cart_code,
                items,
                subtotal: data.cart.subtotal || 0,
                total_amount: data.cart.total_amount || 0,
                payment: data.payment,
                transfer_content: data.transfer_content,
            });
        }, 'CheckoutController.getCheckout');
    }

    async updateAddress(request: NextRequest) {
        return this.wrapHandler(async () => {
            const session = await auth();
            if (!session?.user?.id) throw new UnauthorizedError();

            const body = await request.json();
            const parsed = addressSchema.parse(body);

            const result = await this.checkoutService.updateAddress(session.user.id, parsed);
            return this.handleSuccess(result);
        }, 'CheckoutController.updateAddress');
    }

    async confirmCheckout(request: NextRequest) {
        return this.wrapHandler(async () => {
            const session = await auth();
            if (!session?.user?.id) throw new UnauthorizedError();

            const result = await this.checkoutService.confirmCheckout(session.user.id);
            return this.handleSuccess(result);
        }, 'CheckoutController.confirmCheckout');
    }
}

export const checkoutController = new CheckoutController();
