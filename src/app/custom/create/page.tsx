'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { AnimatedSection } from '@/components/ui/Animations';
import { Button } from '@/components/ui/button';
import { useCart } from '@/lib/store/cart';

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
    { id: 1, title: 'Ch?n lo?i', desc: 'Single, Couple ho?c Group' },
    { id: 2, title: 'Upload ?nh', desc: 'T?i l n ?nh c?a b?n' },
    { id: 3, title: 'K ch thu?c', desc: 'Ch?n size mong mu?n' },
    { id: 4, title: 'X c nh?n', desc: 'Ki?m tra don h ng' },
];

const orderTypes = [
    {
        id: 'single' as OrderType,
        name: 'Single',
        desc: '1 ngu?i',
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
        desc: '2 ngu?i',
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
        desc: '3+ ngu?i',
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
    const { clearCart, addItem } = useCart();
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

    const basePrice = orderTypes.find(t => t.id === orderData.type)?.price || 350000;
    const sizeMultiplier = sizes.find(s => s.id === orderData.size)?.multiplier || 1;
    const totalPrice = Math.round(basePrice * sizeMultiplier);
    const { status } = useSession();

    // Auth check on mount
    useEffect(() => {
        if (status === 'loading') return;

        if (status === 'unauthenticated') {
            router.push('/login?redirect=/custom/create');
            return;
        }

        setLoading(false);
    }, [status, router]);

    // Sync cart from server - just refresh cart items
    const syncCart = async () => {
        const res = await fetch('/api/cart');
        if (!res.ok) throw new Error('Khong the dong bo gio hang');
        // Cart is managed server-side - local store updated via addItem below
    };

    // Upload images to R2 (temp) with cart/full codes
    const uploadImages = async (cartCode: string, fullCode: string): Promise<FileInfo[]> => {
        const uploadedImages: FileInfo[] = [];

        for (let i = 0; i < orderData.images.length; i++) {
            const formData = new FormData();
            formData.append('file', orderData.images[i]);
            const uploadType = orderData.type === 'single' ? 'custom_single'
                : orderData.type === 'couple' ? 'custom_couple'
                    : 'custom_group';
            formData.append('type', uploadType);
            formData.append('cartCode', cartCode);
            formData.append('fullCode', fullCode);
            formData.append('index', String(i + 1));
            formData.append('customType', orderData.type);
            const personCount = orderData.type === 'single' ? 1 : orderData.type === 'couple' ? 2 : 3;
            formData.append('personCount', String(personCount));
            formData.append('photoCategory', 'main');

            const res = await fetch('/api/upload', { method: 'POST', body: formData });
            const data = await res.json();

            if (!res.ok || data.success === false) {
                const errorMsg = data.error?.message || data.error || 'Upload failed';
                throw new Error(typeof errorMsg === 'object' ? JSON.stringify(errorMsg) : errorMsg);
            }

            const fileData = data.data?.file || data.file;
            if (!fileData) {
                throw new Error('Invalid upload response');
            }
            uploadedImages.push(fileData);
        }

        return uploadedImages;
    };

    const handleSubmit = async () => {
        if (orderData.images.length === 0) return;

        setSubmitting(true);
        setError('');

        try {
            const orderTypeName = orderTypes.find(t => t.id === orderData.type)?.name || 'Custom';
            const res = await fetch('/api/cart/items', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'custom',
                    name: 'Custom ' + orderTypeName,
                    price: totalPrice,
                    quantity: 1,
                    customType: orderData.type,
                    customSize: orderData.size,
                    notes: orderData.notes || '',
                }),
            });

            const data = await res.json();
            if (!res.ok || data.success === false) {
                const errorMsg = data.error?.message || data.error || 'Khong the them vao gio hang';
                throw new Error(typeof errorMsg === 'object' ? JSON.stringify(errorMsg) : errorMsg);
            }

            const created = data.data || data;
            const cartCode = created.cart_code;
            const fullCode = created.full_code;
            if (!cartCode || !fullCode) {
                throw new Error('Missing cart codes for upload');
            }

            await uploadImages(cartCode, fullCode);
            await syncCart();
            router.push('/custom');
        } catch (err) {
            console.error('Submit error:', err);
            setError((err as Error).message);
        } finally {
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
            <div className="min-h-screen bg-[var(--bg-void)] pt-28 pb-20 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-2 border-[var(--border-color)] border-t-white rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-[var(--text-secondary)]"> ang t?i...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[var(--bg-void)] pt-28 pb-20">
            <div className="max-w-[900px] mx-auto px-6">
                {/* Header */}
                <AnimatedSection className="text-center mb-12">
                    <span className="text-sm text-[var(--text-secondary)] font-medium tracking-widest uppercase mb-4 block">
                        Custom Order
                    </span>
                    <h1 className="text-4xl md:text-5xl font-bold text-[var(--text-primary)] tracking-tight mb-4">
                        T?o M  H nh C?a B?n
                    </h1>
                    <p className="text-[var(--text-secondary)]">
                        Ch? c?n upload ?nh, ch ng t i s? bi?n n  th nh m  h nh 3D
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
                                            : 'bg-[var(--material-panel)] text-[var(--text-secondary)]'
                                        }
                  `}
                                >
                                    {step.id}
                                </button>
                                {index < steps.length - 1 && (
                                    <div className={`w-12 h-0.5 mx-1 ${currentStep > step.id ? 'bg-white' : 'bg-[var(--material-panel)]'}`} />
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Step Content */}
                <div className="bg-[var(--material-panel)] rounded-3xl p-8 md:p-12">
                    <AnimatePresence mode="wait">
                        {/* Step 1: Order Type */}
                        {currentStep === 1 && (
                            <motion.div
                                key="step1"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                            >
                                <h2 className="text-2xl font-semibold text-[var(--text-primary)] mb-6">Ch?n lo?i don h ng</h2>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {orderTypes.map((type) => (
                                        <button
                                            key={type.id}
                                            onClick={() => setOrderData(prev => ({ ...prev, type: type.id }))}
                                            className={`
                        p-6 rounded-2xl text-left transition-all
                        ${orderData.type === type.id
                                                    ? 'bg-white text-black ring-2 ring-white/30 ring-offset-2 ring-offset-[#1D1D1F]'
                                                    : 'bg-[#2D2D2F] text-[var(--text-primary)] hover:bg-[#3D3D3F]'
                                                }
                      `}
                                            data-cursor
                                        >
                                            <div className="mb-4 flex justify-center text-[var(--text-primary)]/80">{type.icon}</div>
                                            <h3 className="text-lg font-semibold">{type.name}</h3>
                                            <p className="text-sm opacity-70">{type.desc}</p>
                                            <p className="text-lg font-semibold mt-2">
                                                {type.price.toLocaleString('vi-VN')}d
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
                                <h2 className="text-2xl font-semibold text-[var(--text-primary)] mb-6">Upload ?nh c?a b?n</h2>

                                {/* Drop Zone */}
                                <div
                                    onDragEnter={handleDrag}
                                    onDragLeave={handleDrag}
                                    onDragOver={handleDrag}
                                    onDrop={handleDrop}
                                    className={`
                    border-2 border-dashed rounded-2xl p-12 text-center transition-all cursor-pointer
                    ${dragActive
                                            ? 'border-white/30 bg-[var(--material-glass)]'
                                            : 'border-[var(--border-color)] hover:border-white/40'
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
                                        <div className="mb-4 flex justify-center text-[var(--text-secondary)]">
                                            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                            </svg>
                                        </div>
                                        <p className="text-[var(--text-primary)] font-medium">K o th? ?nh v o d y</p>
                                        <p className="text-[var(--text-secondary)] text-sm mt-2">ho?c click d? ch?n file</p>
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
                                                    className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/50 text-[var(--text-primary)] flex items-center justify-center hover:bg-red-500 transition-colors"
                                                >

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
                                <h2 className="text-2xl font-semibold text-[var(--text-primary)] mb-6">Ch?n k ch thu?c</h2>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                                    {sizes.map((size) => (
                                        <button
                                            key={size.id}
                                            onClick={() => setOrderData(prev => ({ ...prev, size: size.id }))}
                                            className={`
                        p-6 rounded-2xl text-center transition-all
                        ${orderData.size === size.id
                                                    ? 'bg-white text-black'
                                                    : 'bg-[#2D2D2F] text-[var(--text-primary)] hover:bg-[#3D3D3F]'
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
                                    <label className="text-[var(--text-secondary)] text-sm mb-2 block">Ghi ch  th m (t y ch?n)</label>
                                    <textarea
                                        value={orderData.notes}
                                        onChange={(e) => setOrderData(prev => ({ ...prev, notes: e.target.value }))}
                                        placeholder="M  t? chi ti?t y u c?u c?a b?n..."
                                        className="w-full p-4 bg-[#2D2D2F] rounded-xl text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] resize-none focus:outline-none focus:ring-2 focus:ring-white/30"
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
                                <h2 className="text-2xl font-semibold text-[var(--text-primary)] mb-6">X c nh?n don h ng</h2>

                                <div className="space-y-6">
                                    {/* Order Summary */}
                                    <div className="bg-[#2D2D2F] rounded-2xl p-6">
                                        <h3 className="text-[var(--text-primary)] font-medium mb-4">T m t?t don h ng</h3>
                                        <div className="space-y-3 text-sm">
                                            <div className="flex justify-between">
                                                <span className="text-[var(--text-secondary)]">Lo?i don</span>
                                                <span className="text-[var(--text-primary)]">{orderTypes.find(t => t.id === orderData.type)?.name}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-[var(--text-secondary)]">K ch thu?c</span>
                                                <span className="text-[var(--text-primary)]">{sizes.find(s => s.id === orderData.size)?.name}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-[var(--text-secondary)]">S? ?nh</span>
                                                <span className="text-[var(--text-primary)]">{orderData.images.length} ?nh</span>
                                            </div>
                                            {orderData.notes && (
                                                <div className="pt-3 border-t border-[var(--border-color)]">
                                                    <p className="text-[var(--text-secondary)]">Ghi ch </p>
                                                    <p className="text-[var(--text-primary)] mt-1">{orderData.notes}</p>
                                                </div>
                                            )}
                                            <div className="border-t border-[var(--border-color)] pt-3 flex justify-between">
                                                <span className="text-[var(--text-primary)] font-medium">T?ng c?ng</span>
                                                <span className="text-[var(--text-primary)] font-bold text-lg">
                                                    {totalPrice.toLocaleString('vi-VN')}d
                                                </span>
                                            </div>
                                            <p className="text-[var(--text-tertiary)] text-xs mt-2">
                                                Thanh to n t?i bu?c Checkout sau khi th m v o gi? h ng.
                                            </p>
                                        </div>
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
                    <div className="flex justify-between mt-8 pt-8 border-t border-[var(--border-color)]">
                        <Button
                            variant="outline"
                            onClick={prevStep}
                            disabled={currentStep === 1 || submitting}
                            className={currentStep === 1 ? 'opacity-50' : ''}
                        >
                            ? Quay l?i
                        </Button>

                        {currentStep < 4 ? (
                            <Button
                                variant="default"
                                onClick={nextStep}
                                disabled={currentStep === 2 && orderData.images.length === 0}
                            >
                                Ti?p t?c ?
                            </Button>
                        ) : (
                            <Button
                                variant="default"
                                onClick={handleSubmit}
                                disabled={submitting || orderData.images.length === 0}
                            >
                                {submitting ? (
                                    <span className="flex items-center gap-2">
                                        <span className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                                        ang x? l ...
                                    </span>
                                ) : (
                                    `Th m v o gi? h ng - ${totalPrice.toLocaleString('vi-VN')}d`
                                )}
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
