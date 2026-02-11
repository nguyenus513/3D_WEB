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
import { Box, Boxes, PenLine, Trash2, ShoppingBag } from 'lucide-react';

type TabType = 'all' | CartItemType;

const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'all', label: 'Tất cả', icon: null },
    { id: 'product', label: 'Sản phẩm', icon: <Box size={20} strokeWidth={1.5} /> },
    { id: 'print', label: 'In 3D', icon: <Boxes size={20} strokeWidth={1.5} /> },
    { id: 'custom', label: 'Custom', icon: <PenLine size={20} strokeWidth={1.5} /> },
];

// Cart item component
function CartItemRow({ item, onUpdate, onRemove, onUpdateItem }: {
    item: CartItem;
    onUpdate: (id: string, qty: number) => void;
    onRemove: (id: string) => void;
    onUpdateItem: (id: string, updates: Partial<CartItem>) => void;
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
            className="bg-[#1D1D1F] rounded-2xl p-6"
        >
            <div className="flex items-start gap-6">
                {/* Image/Icon */}
                <div className="w-24 h-24 rounded-xl bg-white/10 flex items-center justify-center shrink-0 overflow-hidden">
                    {item.image ? (
                        <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                    ) : item.type === 'print' ? (
                        <Boxes size={24} strokeWidth={1.5} className="text-white/50" />
                    ) : item.type === 'custom' ? (
                        <PenLine size={24} strokeWidth={1.5} className="text-white/50" />
                    ) : (
                        <Box size={24} strokeWidth={1.5} className="text-white/50" />
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
                    <Trash2 size={20} strokeWidth={1.5} />
                </button>
            </div>

            {/* Notes textarea */}
            <div className="mt-4 pt-4 border-t border-white/10">
                <textarea
                    value={item.notes || ''}
                    onChange={(e) => onUpdateItem(item.id, { notes: e.target.value })}
                    placeholder="Ghi chú cho sản phẩm này (tùy chọn)..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 text-sm resize-none focus:outline-none focus:border-white/30 transition-colors"
                    rows={2}
                />
            </div>
        </motion.div>
    );
}

export default function CartPage() {
    const router = useRouter();
    const { data: session, status } = useSession();
    const { items, totalPrice, updateQuantity, updateItem, removeItem, clearCart, groupedTotals, productItems, printItems, customItems } = useCart();
    const [activeTab, setActiveTab] = useState<TabType>('all');

    const [checkingOut, setCheckingOut] = useState(false);

    const handleCheckout = async () => {
        if (status === 'loading' || checkingOut) return;

        if (!session) {
            router.push('/login?redirect=/checkout');
            return;
        }

        // Go to checkout page which handles address + QR display
        router.push('/checkout?mode=cart');
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
                        <ShoppingBag size={40} className="text-white/30" strokeWidth={1.5} />
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
                                    onUpdateItem={updateItem}
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
                                                <Box size={20} strokeWidth={1.5} /> Sản phẩm ({groupedTotals.products.count})
                                            </span>
                                            <span className="text-white">{groupedTotals.products.total.toLocaleString('vi-VN')}đ</span>
                                        </div>
                                    )}
                                    {groupedTotals.prints.count > 0 && (
                                        <div className="flex justify-between">
                                            <span className="text-white/60 flex items-center gap-2">
                                                <Boxes size={20} strokeWidth={1.5} /> In 3D ({groupedTotals.prints.count})
                                            </span>
                                            <span className="text-white">{groupedTotals.prints.total.toLocaleString('vi-VN')}đ</span>
                                        </div>
                                    )}
                                    {groupedTotals.customs.count > 0 && (
                                        <div className="flex justify-between">
                                            <span className="text-white/60 flex items-center gap-2">
                                                <PenLine size={20} strokeWidth={1.5} /> Custom ({groupedTotals.customs.count})
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
