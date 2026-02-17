import { createClient } from '@supabase/supabase-js';
import { CartRepository } from '@/repositories/CartRepository';
import { OrderRepository } from '@/repositories/OrderRepository';
import { config } from '@/config/unifiedConfig';
import { generateId } from '@/lib/generateId';
import { buildTransferContent, getDefaultPaymentConfig, getPaymentConfig, type PaymentOrderType } from '@/lib/services/paymentConfigService';
import { migrateOrderToArchive } from '@/lib/storage/migrate-to-drive';
import { BadRequestError, NotFoundError } from '@/lib/core/BaseController';

const supabaseAdmin = createClient(
    config.supabase.url,
    config.supabase.serviceRoleKey,
    { auth: { persistSession: false } }
);

export class CheckoutService {
    constructor(
        private readonly cartRepo: CartRepository,
        private readonly orderRepo: OrderRepository
    ) { }

    private inferCartOrderType(items: { item_type?: string | null }[]): string {
        const types = new Set(items.map(i => i.item_type || 'ready_made'));
        if (types.size === 1) return Array.from(types)[0];
        return 'mixed';
    }

    private inferPaymentOrderType(items: { item_type?: string | null }[]): PaymentOrderType {
        const types = new Set(items.map(i => i.item_type || 'ready_made'));
        if (types.size === 1) {
            const t = Array.from(types)[0];
            if (t === 'custom' || t === 'printing' || t === 'ready_made') return t;
        }
        return 'ready_made';
    }

    async getCheckout(userId: string) {
        const cart = await this.cartRepo.getCartWithItems(userId);
        if (!cart) return null;

        const paymentType = this.inferPaymentOrderType(cart.cart_items);
        const paymentConfig = (await getPaymentConfig(paymentType)) || getDefaultPaymentConfig();

        return {
            cart,
            items: cart.cart_items,
            payment: paymentConfig,
            transfer_content: buildTransferContent(cart.cart_code),
        };
    }

    async updateAddress(userId: string, address: any) {
        const cart = await this.cartRepo.getOrCreateCart(userId);
        await this.cartRepo.updateShippingAddress(cart.id, address);
        return { cart_code: cart.cart_code };
    }

    async confirmCheckout(userId: string) {
        const cart = await this.cartRepo.getCartWithItems(userId);
        if (!cart) throw new NotFoundError('Cart not found');
        if (!cart.cart_items || cart.cart_items.length === 0) {
            throw new BadRequestError('Cart is empty');
        }
        if (!cart.shipping_address) {
            throw new BadRequestError('Missing shipping address');
        }

        const orderType = this.inferCartOrderType(cart.cart_items);
        const orderCode = generateId.order();

        const order = await this.orderRepo.create(
            {
                userId,
                orderCode,
                cartCode: cart.cart_code,
                orderType,
                subtotal: cart.subtotal || 0,
                discount: cart.discount || 0,
                totalAmount: cart.total_amount || 0,
                depositAmount: cart.total_amount || 0,
                depositPaid: false,
                shippingAddress: cart.shipping_address,
                notes: undefined,
            },
            cart.cart_items.map((item) => ({
                productId: item.product_id || undefined,
                name: item.name,
                sku: item.sku || undefined,
                quantity: item.quantity,
                unitPrice: item.unit_price,
                totalPrice: item.total_price,
                configuration: item.configuration || {},
                itemOrderCode: item.item_order_code,
                itemType: item.item_type,
                customType: item.custom_type || null,
                customSize: item.custom_size || null,
                printTech: item.print_tech || null,
                infill: item.infill || null,
                layerHeight: item.layer_height || null,
                color: item.color || null,
                material: item.material || null,
                notes: item.notes || null,
            }))
        );

        // Link uploaded files (order_files) to created order/items
        try {
            const itemsByFullCode = new Map(
                (order.items || []).map((item) => [item.full_code, item.id])
            );

            const updates = cart.cart_items.map((cartItem) => {
                const orderItemId = itemsByFullCode.get(cartItem.full_code);
                if (!orderItemId) return null;

                return supabaseAdmin
                    .from('order_files')
                    .update({
                        order_id: order.id,
                        order_item_id: orderItemId,
                        cart_id: cart.id,
                        cart_item_id: cartItem.id,
                        cart_code: cart.cart_code,
                        full_code: cartItem.full_code,
                        order_code: order.order_code,
                    })
                    .eq('cart_code', cart.cart_code)
                    .eq('full_code', cartItem.full_code);
            });

            await Promise.all(updates.filter(Boolean));

            // Attach any remaining cart-level files
            await supabaseAdmin
                .from('order_files')
                .update({
                    order_id: order.id,
                    cart_id: cart.id,
                    cart_code: cart.cart_code,
                    order_code: order.order_code,
                })
                .eq('cart_code', cart.cart_code)
                .is('order_id', null);
        } catch (err) {
            console.error('[CheckoutService] Failed to link order_files:', err);
        }

        // Create payment record (pending)
        await supabaseAdmin
            .from('payments')
            .insert({
                order_id: order.id,
                amount: order.total_amount || 0,
                method: 'bank_transfer',
                status: 'pending',
            });

        // Mark cart checked out
        await this.cartRepo.markCheckedOut(cart.id);

        // Trigger migration R2 -> Drive in background
        migrateOrderToArchive(order.id)
            .then(() => null)
            .catch(() => null);

        return {
            order_id: order.id,
            order_code: order.order_code,
            cart_code: cart.cart_code,
            order_type: orderType,
            total_amount: order.total_amount,
        };
    }
}
