'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { AnimatedSection } from '@/components/ui/Animations';
import { useCart, CartItem } from '@/lib/store/cart';
import { AddressSelector, ShippingAddress } from '@/components/checkout/AddressSelector';
import { Box, Boxes, PenLine, ShoppingBag } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

function OrderItem({ item, onUpdateNotes }: { item: CartItem | any; onUpdateNotes?: (id: string, notes: string) => void }) {
    const getTypeIcon = () => {
        const type = item.type || item.order_type;
        switch (type) {
            case 'product': return <Box size={20} strokeWidth={1.5} />;
            case 'print': return <Boxes size={20} strokeWidth={1.5} />;
            case 'custom': return <PenLine size={20} strokeWidth={1.5} />;
            default: return <Box size={20} strokeWidth={1.5} />;
        }
    };

    return (
        <div className="py-3 border-b border-[var(--border-color)] last:border-b-0">
            <div className="flex justify-between items-start">
                <div className="flex items-start gap-3 flex-1">
                    <span className="text-[var(--text-secondary)] mt-0.5">{getTypeIcon()}</span>
                    <div>
                        <p className="text-[var(--text-primary)] font-medium line-clamp-1">{item.name || item.product_name || 'Sản phẩm'}</p>
                        <div className="text-[var(--text-secondary)] text-sm">
                            {item.size && <span>Size: {item.size} • </span>}
                            {item.quantity && <span>SL: {item.quantity}</span>}
                        </div>
                    </div>
                </div>
                <p className="text-[var(--text-primary)] font-medium whitespace-nowrap">
                    {((item.price || item.total || 0) * (item.quantity || 1)).toLocaleString('vi-VN')}đ
                </p>
            </div>
            {onUpdateNotes ? (
                <div className="mt-3 ml-8">
                    <textarea
                        value={item.notes || ''}
                        onChange={(e) => onUpdateNotes(item.id, e.target.value)}
                        placeholder="Ghi chú (tùy chọn)..."
                        className="w-full bg-[var(--material-glass)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-[var(--text-primary)] placeholder-[var(--text-tertiary)] text-sm resize-none focus:outline-none focus:border-[var(--border-color)]"
                        rows={2}
                    />
                </div>
            ) : item.notes ? (
                <div className="mt-2 ml-8 text-sm text-[var(--text-secondary)] bg-[var(--material-glass)] rounded-lg px-3 py-2">
                    <span className="text-[var(--text-tertiary)]">Ghi chú:</span> {item.notes}
                </div>
            ) : null}
        </div>
    );
}

export function CheckoutContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const orderIdParam = searchParams.get('orderId');

    const { items, totalPrice: cartTotal, clearCart, updateItem } = useCart();
    const { data: session } = useSession();

    const [shippingAddress, setShippingAddress] = useState<ShippingAddress | null>(null);
    const [isAddressValid, setIsAddressValid] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (orderIdParam) {
            router.replace('/checkout/success/' + orderIdParam);
        }
    }, [orderIdParam, router]);

    if (orderIdParam) {
        return (
            <div className="min-h-screen pt-24 pb-12 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-[var(--border-color)] border-t-white rounded-full animate-spin" />
            </div>
        );
    }

    const subtotal = cartTotal;
    const itemTypes = new Set(items.map(i => i.type || 'product'));
    const hasCustom = itemTypes.has('custom');
    const depositPercent = hasCustom ? 0.5 : 1;
    const depositAmount = Math.round(subtotal * depositPercent);

    const handleAddressChange = (address: ShippingAddress) => {
        setShippingAddress(address);
        const isValid = !!(address.full_name && address.phone && address.address_line && address.province);
        setIsAddressValid(isValid);
    };

    const handlePlaceOrder = async () => {
        if (!shippingAddress || !isAddressValid) {
            setError('Vui lòng chọn địa chỉ giao hàng hợp lệ');
            return;
        }

        if ((shippingAddress.address_line || '').length < 5) {
            setError('Địa chỉ giao hàng quá ngắn. Vui lòng nhập chi tiết hơn (tối thiểu 5 ký tự).');
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            const createRes = await fetch('/api/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    items: items.map(item => ({
                        product_id: item.productId || null,
                        product_name: item.name,
                        quantity: item.quantity,
                        price: item.price,
                        size: item.size || null,
                        item_type: item.type,
                        customization: {
                            ...((item as any).customization || {}),
                            size: item.size,
                            sku: item.sku,
                            printOptions: item.printOptions,
                            notes: item.notes,
                        }
                    })),
                    shipping_address: {
                        name: shippingAddress.full_name,
                        phone: shippingAddress.phone,
                        address: shippingAddress.address_line || '',
                        ward: shippingAddress.ward || '',
                        district: shippingAddress.district || '',
                        city: shippingAddress.province || '',
                        full_name: shippingAddress.full_name,
                        address_line: shippingAddress.address_line || '',
                        province: shippingAddress.province || '',
                    },
                    payment_method: 'bank_transfer',
                    notes: ''
                })
            });

            if (!createRes.ok) {
                const errData = await createRes.json();
                const errMsg = typeof errData.error === 'object'
                    ? JSON.stringify(errData.error)
                    : (errData.error || 'Không thể tạo đơn hàng');
                throw new Error(errMsg);
            }

            const { data: newOrder } = await createRes.json();

            clearCart();
            router.push('/checkout/success/' + newOrder.id);
        } catch (err) {
            console.error('Checkout failed:', err);
            let userMsg = (err as Error).message;
            if (userMsg.includes('[')) {
                try {
                    const parsed = JSON.parse(userMsg);
                    if (Array.isArray(parsed)) userMsg = parsed[0]?.message || 'Dữ liệu không hợp lệ';
                } catch { }
            }
            setError(userMsg);
            setIsSubmitting(false);
        }
    };

    if (items.length === 0) {
        return (
            <div className="min-h-screen pt-24 pb-12 text-center">
                <h1 className="text-2xl text-[var(--text-primary)] mb-4">Giỏ hàng trống</h1>
                <Link href="/products" className="text-blue-400 hover:underline">Tiếp tục mua sắm</Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen pt-24 pb-12 px-4 md:px-6">
            <div className="max-w-4xl mx-auto space-y-6">
                <AnimatedSection>
                    <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-6">Thanh Toán</h1>

                    <Card className="rounded-3xl bg-[var(--material-panel)] border-[var(--border-color)]">
                        <CardHeader>
                            <CardTitle className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2">
                                <span className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-xs">1</span>
                                Địa chỉ nhận hàng
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <AddressSelector
                                userId={session?.user?.id}
                                value={shippingAddress}
                                onChange={handleAddressChange}
                            />
                        </CardContent>
                    </Card>

                    <Separator className="my-6" />

                    <Card className="rounded-3xl bg-[var(--material-panel)] border-[var(--border-color)]">
                        <CardHeader>
                            <CardTitle className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2">
                                <span className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center text-xs">2</span>
                                Đơn hàng ({items.length} sản phẩm)
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-1">
                                {items.map((item, i) => (
                                    <OrderItem
                                        key={i}
                                        item={item}
                                        onUpdateNotes={(id, notes) => updateItem(id, { notes })}
                                    />
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    <Separator className="my-6" />

                    <Card className="rounded-3xl bg-[var(--material-panel)] border-[var(--border-color)]">
                        <CardHeader>
                            <CardTitle className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2">
                                <span className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-xs">3</span>
                                Tổng cộng
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3 text-sm">
                                <div className="flex justify-between text-[var(--text-secondary)]">
                                    <span>Tạm tính</span>
                                    <span>{subtotal.toLocaleString('vi-VN')}đ</span>
                                </div>
                                {hasCustom && (
                                    <div className="flex justify-between text-[var(--text-secondary)]">
                                        <span>Đặt cọc (50%)</span>
                                        <span>{depositAmount.toLocaleString('vi-VN')}đ</span>
                                    </div>
                                )}
                                <div className="pt-3 border-t border-[var(--border-color)] flex justify-between items-end">
                                    <span className="text-[var(--text-primary)] font-medium">
                                        {hasCustom ? 'Cần thanh toán' : 'Thành tiền'}
                                    </span>
                                    <span className="text-2xl font-bold text-green-400">
                                        {(hasCustom ? depositAmount : subtotal).toLocaleString('vi-VN')}đ
                                    </span>
                                </div>
                            </div>

                            {error && (
                                <Alert variant="destructive" className="mt-4">
                                    <AlertDescription>{error}</AlertDescription>
                                </Alert>
                            )}

                            <Button
                                onClick={handlePlaceOrder}
                                disabled={!isAddressValid || isSubmitting}
                                size="lg"
                                className="w-full mt-6 bg-white text-black hover:bg-white/90 rounded-2xl"
                            >
                                {isSubmitting ? (
                                    <>
                                        <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                        Đang tạo đơn hàng...
                                    </>
                                ) : (
                                    <>
                                        <ShoppingBag size={20} />
                                        Đặt hàng
                                    </>
                                )}
                            </Button>

                            {!isAddressValid && (
                                <p className="text-center text-[var(--text-tertiary)] text-sm mt-3">
                                    Vui lòng nhập địa chỉ giao hàng để tiếp tục
                                </p>
                            )}
                        </CardContent>
                    </Card>
                </AnimatedSection>
            </div>
        </div>
    );
}

export default function CheckoutPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen pt-24 pb-12 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-[var(--border-color)] border-t-white rounded-full animate-spin" />
            </div>
        }>
            <CheckoutContent />
        </Suspense>
    );
}
