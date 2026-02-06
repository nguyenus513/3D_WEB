'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useSession } from 'next-auth/react';
import { clsx } from 'clsx';
import { AnimatedSection } from '@/components/ui/Animations';
import { Button, buttonVariants, buttonBaseStyles, buttonSizes } from '@/components/ui/Button';
import { useCart, CartItem, CartItemType } from '@/lib/store/cart';

// Icons
const ProductIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
);

const PrintIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" />
    </svg>
);

const CustomIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
);

const TrashIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
);

type TabType = 'all' | CartItemType;

const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'all', label: 'Tất cả', icon: null },
    { id: 'product', label: 'Sản phẩm', icon: <ProductIcon /> },
    { id: 'print', label: 'In 3D', icon: <PrintIcon /> },
    { id: 'custom', label: 'Custom', icon: <CustomIcon /> },
];

// Cart item component
function CartItemRow({ item, onUpdate, onRemove }: {
    item: CartItem;
    onUpdate: (id: string, qty: number) => void;
    onRemove: (id: string) => void;
}) {
    const getTypeLabel = () => {
        switch (item.type) {
            case 'product': return 'Sản phẩm';
            case 'print': return 'In 3D';
            case 'custom': return 'Custom';
        }
    };

    const getTypeColor = () => {
        switch (item.type) {
            case 'product': return 'bg-blue-500/20 text-blue-400';
            case 'print': return 'bg-purple-500/20 text-purple-400';
            case 'custom': return 'bg-orange-500/20 text-orange-400';
        }
    };

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -100 }}
            className="bg-[#1D1D1F] rounded-2xl p-6 flex items-start gap-6"
        >
            {/* Image/Icon */}
            <div className="w-24 h-24 rounded-xl bg-white/10 flex items-center justify-center shrink-0 overflow-hidden">
                {item.image && !item.image.includes('[object Object]') ? (
                    <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                ) : item.type === 'print' ? (
                    <PrintIcon />
                ) : item.type === 'custom' ? (
                    <CustomIcon />
                ) : (
                    <ProductIcon />
                )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded text-xs ${getTypeColor()}`}>
                        {getTypeLabel()}
                    </span>
                </div>
                <h3 className="text-white font-semibold text-lg truncate">{item.name}</h3>

                {/* Type-specific details */}
                {item.type === 'product' && item.size && (
                    <p className="text-white/50 text-sm mt-1">Size: {item.size}</p>
                )}
                {item.type === 'print' && item.printOptions && (
                    <p className="text-white/50 text-sm mt-1">
                        {item.printOptions.type.toUpperCase()} • {item.printOptions.color} • {item.printOptions.infill}
                    </p>
                )}
                {item.type === 'custom' && item.description && (
                    <p className="text-white/50 text-sm mt-1 line-clamp-2">{item.description}</p>
                )}

                <p className="text-white font-medium mt-2">
                    {item.price.toLocaleString('vi-VN')}đ
                </p>
            </div>

            {/* Quantity */}
            <div className="flex items-center gap-3">
                <button
                    onClick={() => onUpdate(item.id, Math.max(1, item.quantity - 1))}
                    className="w-10 h-10 rounded-xl bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors cursor-pointer"
                >
                    -
                </button>
                <span className="text-white w-8 text-center">{item.quantity}</span>
                <button
                    onClick={() => onUpdate(item.id, item.quantity + 1)}
                    className="w-10 h-10 rounded-xl bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors cursor-pointer"
                >
                    +
                </button>
            </div>

            {/* Subtotal */}
            <div className="text-right min-w-[100px]">
                <p className="text-white font-semibold">
                    {(item.price * item.quantity).toLocaleString('vi-VN')}đ
                </p>
            </div>

            {/* Remove */}
            <button
                onClick={() => onRemove(item.id)}
                className="p-2 text-white/40 hover:text-red-400 transition-colors cursor-pointer"
            >
                <TrashIcon />
            </button>
        </motion.div>
    );
}

export default function CartPage() {
    const router = useRouter();
    const { data: session, status } = useSession();
    const { items, totalPrice, updateQuantity, removeItem, clearCart, groupedTotals, productItems, printItems, customItems } = useCart();
    const [activeTab, setActiveTab] = useState<TabType>('all');

    const [checkingOut, setCheckingOut] = useState(false);

    const handleCheckout = async () => {
        if (status === 'loading' || checkingOut) return;

        if (!session) {
            router.push('/login?redirect=/checkout');
            return;
        }

        // Go to checkout page which handles address + QR display
        router.push('/checkout');
    };

    // Filter items based on active tab
    const getFilteredItems = () => {
        switch (activeTab) {
            case 'product': return productItems;
            case 'print': return printItems;
            case 'custom': return customItems;
            default: return items;
        }
    };

    const filteredItems = getFilteredItems();

    if (items.length === 0) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] pt-32 pb-20 flex items-center justify-center px-6">
                <div className="text-center">
                    <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-6">
                        <svg className="w-10 h-10 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-4">Giỏ hàng trống</h2>
                    <p className="text-white/50 mb-8">Bạn chưa có sản phẩm nào trong giỏ hàng</p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <Link href="/products" className={clsx(buttonBaseStyles, buttonVariants.primary, buttonSizes.lg, "w-full sm:w-auto")}>
                            Xem sản phẩm
                        </Link>
                        <Link href="/printing" className={clsx(buttonBaseStyles, buttonVariants.secondary, buttonSizes.lg, "w-full sm:w-auto text-purple-400 border-purple-500/30 hover:bg-purple-500/10")}>
                            In 3D
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0a0a0a] pt-28 pb-20">
            <div className="max-w-[1200px] mx-auto px-6">
                {/* Header */}
                <AnimatedSection className="mb-8">
                    <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight">
                        Giỏ Hàng
                    </h1>
                    <p className="text-white/50 mt-2">{items.length} sản phẩm</p>
                </AnimatedSection>

                {/* Tabs */}
                <AnimatedSection delay={0.1} className="mb-6">
                    <div className="flex gap-2 overflow-x-auto pb-2">
                        {tabs.map((tab) => {
                            const count = tab.id === 'all' ? items.length :
                                tab.id === 'product' ? productItems.length :
                                    tab.id === 'print' ? printItems.length : customItems.length;

                            if (tab.id !== 'all' && count === 0) return null;

                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer whitespace-nowrap ${activeTab === tab.id
                                        ? 'bg-white text-black'
                                        : 'bg-white/10 text-white/70 hover:bg-white/20'
                                        }`}
                                >
                                    {tab.icon}
                                    {tab.label}
                                    <span className={`px-2 py-0.5 rounded-full text-xs ${activeTab === tab.id ? 'bg-black/10' : 'bg-white/10'
                                        }`}>
                                        {count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </AnimatedSection>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Items List */}
                    <div className="lg:col-span-2 space-y-4">
                        <AnimatePresence mode="popLayout">
                            {filteredItems.map((item) => (
                                <CartItemRow
                                    key={item.id}
                                    item={item}
                                    onUpdate={updateQuantity}
                                    onRemove={removeItem}
                                />
                            ))}
                        </AnimatePresence>

                        {filteredItems.length === 0 && (
                            <div className="text-center py-12 text-white/50">
                                Không có sản phẩm nào trong danh mục này
                            </div>
                        )}

                        {/* Clear cart */}
                        <button
                            onClick={clearCart}
                            className="text-red-400 text-sm hover:text-red-300 cursor-pointer"
                        >
                            Xóa tất cả
                        </button>
                    </div>

                    {/* Summary */}
                    <div className="lg:col-span-1">
                        <AnimatedSection delay={0.2}>
                            <div className="bg-[#1D1D1F] rounded-2xl p-6 sticky top-28">
                                <h2 className="text-xl font-semibold text-white mb-6">Tóm tắt đơn hàng</h2>

                                {/* Grouped totals */}
                                <div className="space-y-3 text-sm">
                                    {groupedTotals.products.count > 0 && (
                                        <div className="flex justify-between">
                                            <span className="text-white/60 flex items-center gap-2">
                                                <ProductIcon /> Sản phẩm ({groupedTotals.products.count})
                                            </span>
                                            <span className="text-white">{groupedTotals.products.total.toLocaleString('vi-VN')}đ</span>
                                        </div>
                                    )}
                                    {groupedTotals.prints.count > 0 && (
                                        <div className="flex justify-between">
                                            <span className="text-white/60 flex items-center gap-2">
                                                <PrintIcon /> In 3D ({groupedTotals.prints.count})
                                            </span>
                                            <span className="text-white">{groupedTotals.prints.total.toLocaleString('vi-VN')}đ</span>
                                        </div>
                                    )}
                                    {groupedTotals.customs.count > 0 && (
                                        <div className="flex justify-between">
                                            <span className="text-white/60 flex items-center gap-2">
                                                <CustomIcon /> Custom ({groupedTotals.customs.count})
                                            </span>
                                            <span className="text-white">{groupedTotals.customs.total.toLocaleString('vi-VN')}đ</span>
                                        </div>
                                    )}

                                    <div className="border-t border-white/10 my-3" />

                                    <div className="flex justify-between">
                                        <span className="text-white/60">Tạm tính</span>
                                        <span className="text-white">{totalPrice.toLocaleString('vi-VN')}đ</span>
                                    </div>
                                </div>

                                <div className="border-t border-white/10 my-4" />

                                <div className="flex justify-between mb-6">
                                    <span className="text-white font-medium">Tổng cộng</span>
                                    <span className="text-white text-xl font-bold">
                                        {totalPrice.toLocaleString('vi-VN')}đ
                                    </span>
                                </div>

                                <Button
                                    variant="primary"
                                    size="lg"
                                    className="w-full"
                                    onClick={handleCheckout}
                                    disabled={status === 'loading'}
                                >
                                    {status === 'loading' ? 'Đang kiểm tra...' :
                                        !session ? 'Đăng nhập để thanh toán' : 'Tiến hành thanh toán'}
                                </Button>

                                <Link href="/products" className="block text-center mt-4 text-white/50 text-sm hover:text-white">
                                    ← Tiếp tục mua sắm
                                </Link>
                            </div>
                        </AnimatedSection>
                    </div>
                </div>
            </div>
        </div>
    );
}
