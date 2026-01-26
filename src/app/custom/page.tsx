'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { AnimatedSection } from '@/components/ui/Animations';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { getSupabase } from '@/lib/supabase/client';
import { generateId } from '@/lib/generateId';
import { AddressSelector, ShippingAddress } from '@/components/checkout/AddressSelector';

type OrderType = 'single' | 'couple' | 'group';

interface FileInfo {
    id: string;
    name: string;
    url: string;
    thumbnail: string;
}

interface OrderData {
    type: OrderType;
    images: File[];
    size: string;
    notes: string;
}

const steps = [
    { id: 1, title: 'Chọn loại', desc: 'Single, Couple hoặc Group' },
    { id: 2, title: 'Upload ảnh', desc: 'Tải lên ảnh của bạn' },
    { id: 3, title: 'Kích thước', desc: 'Chọn size mong muốn' },
    { id: 4, title: 'Xác nhận', desc: 'Kiểm tra đơn hàng' },
];

const orderTypes = [
    {
        id: 'single' as OrderType,
        name: 'Single',
        desc: '1 người',
        price: 350000,
        icon: (
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
        )
    },
    {
        id: 'couple' as OrderType,
        name: 'Couple',
        desc: '2 người',
        price: 550000,
        icon: (
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
        )
    },
    {
        id: 'group' as OrderType,
        name: 'Group',
        desc: '3+ người',
        price: 750000,
        icon: (
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
        )
    },
];

const sizes = [
    { id: 'S', name: 'S (10cm)', multiplier: 1 },
    { id: 'M', name: 'M (15cm)', multiplier: 1.3 },
    { id: 'L', name: 'L (20cm)', multiplier: 1.6 },
    { id: 'XL', name: 'XL (25cm)', multiplier: 2 },
];

export default function CustomPage() {
    const router = useRouter();
    const [user, setUser] = useState<{ id: string; email: string } | null>(null);
    const [customerCode, setCustomerCode] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const [currentStep, setCurrentStep] = useState(1);
    const [orderData, setOrderData] = useState<OrderData>({
        type: 'single',
        images: [],
        size: 'M',
        notes: '',
    });
    const [dragActive, setDragActive] = useState(false);
    const [shippingAddress, setShippingAddress] = useState<ShippingAddress | null>(null);

    const basePrice = orderTypes.find(t => t.id === orderData.type)?.price || 350000;
    const sizeMultiplier = sizes.find(s => s.id === orderData.size)?.multiplier || 1;
    const totalPrice = Math.round(basePrice * sizeMultiplier);
    const depositAmount = Math.round(totalPrice * 0.5); // 50% deposit for custom

    const { data: session, status } = useSession();

    // Auth check on mount
    useEffect(() => {
        if (status === 'loading') return;

        if (status === 'unauthenticated') {
            router.push('/login?redirect=/custom');
            return;
        }

        const fetchUserData = async () => {
            if (!session?.user?.email) return;

            try {
                const res = await fetch('/api/profile');
                if (res.ok) {
                    const user = await res.json();
                    setUser({ id: user.id, email: session.user.email });
                    setCustomerCode(user.customer_code || generateId.user());
                }
            } catch (e) {
                console.error('Failed to fetch profile', e);
            }
            setLoading(false);
        };

        fetchUserData();
    }, [status, session, router]);

    // Upload images to Drive
    const uploadImages = async (orderCode: string): Promise<FileInfo[]> => {
        const uploadedImages: FileInfo[] = [];

        for (let i = 0; i < orderData.images.length; i++) {
            const formData = new FormData();
            formData.append('file', orderData.images[i]);
            formData.append('type', 'custom_main');
            formData.append('customerCode', customerCode);
            formData.append('orderCode', orderCode);
            formData.append('index', String(i + 1));
            // New naming convention parameters
            formData.append('customType', orderData.type);
            // For group orders, use 3 as default (or could count from images.length)
            const personCount = orderData.type === 'single' ? 1 : orderData.type === 'couple' ? 2 : 3;
            formData.append('personCount', String(personCount));
            formData.append('photoCategory', 'main');

            const res = await fetch('/api/upload', { method: 'POST', body: formData });
            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Upload failed');
            }

            uploadedImages.push(data.file);
        }

        return uploadedImages;
    };

    // Submit order
    const handleSubmit = async () => {
        if (!user) return;

        // Validate shipping address
        if (!shippingAddress || !shippingAddress.full_name || !shippingAddress.phone || !shippingAddress.province) {
            setError('Vui lòng nhập đầy đủ thông tin địa chỉ giao hàng');
            return;
        }

        setSubmitting(true);
        setError('');

        try {
            const supabase = getSupabase();
            const orderCode = generateId.custom();

            // Upload images to Drive
            const images = await uploadImages(orderCode);

            // Create order in Supabase with shipping_address
            const { data: order, error: orderError } = await supabase
                .from('orders')
                .insert({
                    order_code: orderCode,
                    user_id: user.id,
                    order_type: 'custom',
                    status: 'pending',
                    subtotal: totalPrice,
                    shipping_fee: 0,
                    total: totalPrice,
                    deposit_amount: depositAmount,
                    shipping_address: {
                        full_name: shippingAddress.full_name,
                        phone: shippingAddress.phone,
                        address_line: shippingAddress.address_line,
                        ward: shippingAddress.ward || '',
                        district: shippingAddress.district || '',
                        province: shippingAddress.province,
                    },
                })
                .select()
                .single();

            if (orderError) {
                throw new Error(orderError.message);
            }

            // Insert into order_configs (normalized)
            await supabase.from('order_configs').insert({
                order_id: order.id,
                custom_type: orderData.type,
                custom_size: orderData.size,
            });

            // Insert files into order_files (normalized)
            if (images && images.length > 0) {
                const orderFiles = images.map((img: FileInfo) => ({
                    order_id: order.id,
                    file_id: img.id,
                    file_type: 'photo',
                    file_name: img.name || null,
                }));
                await supabase.from('order_files').insert(orderFiles);
            }

            // Store notes in customer_note field
            if (orderData.notes) {
                await supabase.from('orders').update({ customer_note: orderData.notes }).eq('id', order.id);
            }

            // Store order type for payment page
            sessionStorage.setItem('checkout_order_type', 'custom');
            sessionStorage.setItem('checkout_order_id', order.id);

            // Redirect to payment
            router.push('/checkout/payment?orderId=' + order.id);
        } catch (err) {
            setError((err as Error).message);
            setSubmitting(false);
        }
    };

    const handleDrag = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const files = Array.from(e.dataTransfer.files);
            setOrderData(prev => ({ ...prev, images: [...prev.images, ...files] }));
        }
    }, []);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const files = Array.from(e.target.files);
            setOrderData(prev => ({ ...prev, images: [...prev.images, ...files] }));
        }
    };

    const removeImage = (index: number) => {
        setOrderData(prev => ({
            ...prev,
            images: prev.images.filter((_, i) => i !== index)
        }));
    };

    const nextStep = () => setCurrentStep(prev => Math.min(prev + 1, 4));
    const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 1));

    // Loading state
    if (loading) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] pt-28 pb-20 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-white/50">Đang tải...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0a0a0a] pt-28 pb-20">
            <div className="max-w-[900px] mx-auto px-6">
                {/* Header */}
                <AnimatedSection className="text-center mb-12">
                    <span className="text-sm text-white/70 font-medium tracking-widest uppercase mb-4 block">
                        Custom Order
                    </span>
                    <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-4">
                        Tạo Mô Hình Của Bạn
                    </h1>
                    <p className="text-white/50">
                        Chỉ cần upload ảnh, chúng tôi sẽ biến nó thành mô hình 3D
                    </p>
                </AnimatedSection>

                {/* Progress Steps */}
                <div className="flex justify-center mb-12">
                    <div className="flex items-center gap-2">
                        {steps.map((step, index) => (
                            <div key={step.id} className="flex items-center">
                                <button
                                    onClick={() => setCurrentStep(step.id)}
                                    className={`
                    w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all
                    ${currentStep >= step.id
                                            ? 'bg-white text-black'
                                            : 'bg-[#1D1D1F] text-white/50'
                                        }
                  `}
                                >
                                    {step.id}
                                </button>
                                {index < steps.length - 1 && (
                                    <div className={`w-12 h-0.5 mx-1 ${currentStep > step.id ? 'bg-white' : 'bg-[#1D1D1F]'}`} />
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Step Content */}
                <div className="bg-[#1D1D1F] rounded-3xl p-8 md:p-12">
                    <AnimatePresence mode="wait">
                        {/* Step 1: Order Type */}
                        {currentStep === 1 && (
                            <motion.div
                                key="step1"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                            >
                                <h2 className="text-2xl font-semibold text-white mb-6">Chọn loại đơn hàng</h2>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {orderTypes.map((type) => (
                                        <button
                                            key={type.id}
                                            onClick={() => setOrderData(prev => ({ ...prev, type: type.id }))}
                                            className={`
                        p-6 rounded-2xl text-left transition-all
                        ${orderData.type === type.id
                                                    ? 'bg-white text-black ring-2 ring-white/30 ring-offset-2 ring-offset-[#1D1D1F]'
                                                    : 'bg-[#2D2D2F] text-white hover:bg-[#3D3D3F]'
                                                }
                      `}
                                            data-cursor
                                        >
                                            <div className="mb-4 flex justify-center text-white/80">{type.icon}</div>
                                            <h3 className="text-lg font-semibold">{type.name}</h3>
                                            <p className="text-sm opacity-70">{type.desc}</p>
                                            <p className="text-lg font-semibold mt-2">
                                                {type.price.toLocaleString('vi-VN')}đ
                                            </p>
                                        </button>
                                    ))}
                                </div>
                            </motion.div>
                        )}

                        {/* Step 2: Upload Images */}
                        {currentStep === 2 && (
                            <motion.div
                                key="step2"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                            >
                                <h2 className="text-2xl font-semibold text-white mb-6">Upload ảnh của bạn</h2>

                                {/* Drop Zone */}
                                <div
                                    onDragEnter={handleDrag}
                                    onDragLeave={handleDrag}
                                    onDragOver={handleDrag}
                                    onDrop={handleDrop}
                                    className={`
                    border-2 border-dashed rounded-2xl p-12 text-center transition-all cursor-pointer
                    ${dragActive
                                            ? 'border-white/30 bg-white/10'
                                            : 'border-white/20 hover:border-white/40'
                                        }
                  `}
                                >
                                    <input
                                        type="file"
                                        multiple
                                        accept="image/*"
                                        onChange={handleFileChange}
                                        className="hidden"
                                        id="file-upload"
                                    />
                                    <label htmlFor="file-upload" className="cursor-pointer">
                                        <div className="mb-4 flex justify-center text-white/70">
                                            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                            </svg>
                                        </div>
                                        <p className="text-white font-medium">Kéo thả ảnh vào đây</p>
                                        <p className="text-white/50 text-sm mt-2">hoặc click để chọn file</p>
                                    </label>
                                </div>

                                {/* Image Preview */}
                                {orderData.images.length > 0 && (
                                    <div className="mt-6 grid grid-cols-3 gap-4">
                                        {orderData.images.map((file, index) => (
                                            <div key={index} className="relative aspect-square rounded-xl overflow-hidden bg-[#2D2D2F]">
                                                <img
                                                    src={URL.createObjectURL(file)}
                                                    alt={`Upload ${index + 1}`}
                                                    className="w-full h-full object-cover"
                                                />
                                                <button
                                                    onClick={() => removeImage(index)}
                                                    className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-red-500 transition-colors"
                                                >
                                                    ×
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </motion.div>
                        )}

                        {/* Step 3: Size Selection */}
                        {currentStep === 3 && (
                            <motion.div
                                key="step3"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                            >
                                <h2 className="text-2xl font-semibold text-white mb-6">Chọn kích thước</h2>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                                    {sizes.map((size) => (
                                        <button
                                            key={size.id}
                                            onClick={() => setOrderData(prev => ({ ...prev, size: size.id }))}
                                            className={`
                        p-6 rounded-2xl text-center transition-all
                        ${orderData.size === size.id
                                                    ? 'bg-white text-black'
                                                    : 'bg-[#2D2D2F] text-white hover:bg-[#3D3D3F]'
                                                }
                      `}
                                            data-cursor
                                        >
                                            <span className="text-2xl font-bold block">{size.id}</span>
                                            <span className="text-sm opacity-70">{size.name}</span>
                                        </button>
                                    ))}
                                </div>

                                <div className="mb-6">
                                    <label className="text-white/70 text-sm mb-2 block">Ghi chú thêm (tùy chọn)</label>
                                    <textarea
                                        value={orderData.notes}
                                        onChange={(e) => setOrderData(prev => ({ ...prev, notes: e.target.value }))}
                                        placeholder="Mô tả chi tiết yêu cầu của bạn..."
                                        className="w-full p-4 bg-[#2D2D2F] rounded-xl text-white placeholder:text-white/30 resize-none focus:outline-none focus:ring-2 focus:ring-white/30"
                                        rows={4}
                                    />
                                </div>
                            </motion.div>
                        )}

                        {/* Step 4: Confirmation */}
                        {currentStep === 4 && (
                            <motion.div
                                key="step4"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                            >
                                <h2 className="text-2xl font-semibold text-white mb-6">Xác nhận đơn hàng</h2>

                                <div className="space-y-6">
                                    {/* Order Summary */}
                                    <div className="bg-[#2D2D2F] rounded-2xl p-6">
                                        <h3 className="text-white font-medium mb-4">Tóm tắt đơn hàng</h3>
                                        <div className="space-y-3 text-sm">
                                            <div className="flex justify-between">
                                                <span className="text-white/60">Loại đơn</span>
                                                <span className="text-white">{orderTypes.find(t => t.id === orderData.type)?.name}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-white/60">Kích thước</span>
                                                <span className="text-white">{sizes.find(s => s.id === orderData.size)?.name}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-white/60">Số ảnh</span>
                                                <span className="text-white">{orderData.images.length} ảnh</span>
                                            </div>
                                            <div className="border-t border-white/10 pt-3 flex justify-between">
                                                <span className="text-white font-medium">Tổng cộng</span>
                                                <span className="text-white font-bold text-lg">
                                                    {totalPrice.toLocaleString('vi-VN')}đ
                                                </span>
                                            </div>
                                            <div className="flex justify-between text-green-400">
                                                <span>Cọc 50%</span>
                                                <span className="font-bold">{depositAmount.toLocaleString('vi-VN')}đ</span>
                                            </div>
                                            <p className="text-white/40 text-xs mt-2">
                                                Còn lại {(totalPrice - depositAmount).toLocaleString('vi-VN')}đ khi nhận hàng
                                            </p>
                                        </div>
                                    </div>

                                    {/* Shipping Address */}
                                    <div className="bg-[#2D2D2F] rounded-2xl p-6">
                                        <h3 className="text-white font-medium mb-4">📍 Địa chỉ giao hàng</h3>
                                        <AddressSelector
                                            userId={user?.id}
                                            value={shippingAddress}
                                            onChange={setShippingAddress}
                                            disabled={submitting}
                                        />
                                    </div>

                                    {/* Error message */}
                                    {error && (
                                        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
                                            {error}
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Navigation Buttons */}
                    <div className="flex justify-between mt-8 pt-8 border-t border-white/10">
                        <Button
                            variant="outline"
                            onClick={prevStep}
                            disabled={currentStep === 1 || submitting}
                            className={currentStep === 1 ? 'opacity-50' : ''}
                        >
                            ← Quay lại
                        </Button>

                        {currentStep < 4 ? (
                            <Button
                                variant="primary"
                                onClick={nextStep}
                                disabled={currentStep === 2 && orderData.images.length === 0}
                            >
                                Tiếp tục →
                            </Button>
                        ) : (
                            <Button
                                variant="primary"
                                onClick={handleSubmit}
                                disabled={submitting || orderData.images.length === 0}
                            >
                                {submitting ? (
                                    <span className="flex items-center gap-2">
                                        <span className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                                        Đang xử lý...
                                    </span>
                                ) : (
                                    `Đặt hàng - ${depositAmount.toLocaleString('vi-VN')}đ`
                                )}
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
