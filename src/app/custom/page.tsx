'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AnimatedSection } from '@/components/ui/Animations';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import Link from 'next/link';

type OrderType = 'single' | 'couple' | 'group';

interface OrderData {
    type: OrderType;
    images: File[];
    size: string;
    notes: string;
    name: string;
    phone: string;
}

const steps = [
    { id: 1, title: 'Chọn loại', desc: 'Single, Couple hoặc Group' },
    { id: 2, title: 'Upload ảnh', desc: 'Tải lên ảnh của bạn' },
    { id: 3, title: 'Kích thước', desc: 'Chọn size mong muốn' },
    { id: 4, title: 'Xác nhận', desc: 'Kiểm tra đơn hàng' },
];

const orderTypes = [
    { id: 'single' as OrderType, name: 'Single', desc: '1 người', price: 350000, emoji: '👤' },
    { id: 'couple' as OrderType, name: 'Couple', desc: '2 người', price: 550000, emoji: '👥' },
    { id: 'group' as OrderType, name: 'Group', desc: '3+ người', price: 750000, emoji: '👨‍👩‍👧‍👦' },
];

const sizes = [
    { id: 'S', name: 'S (10cm)', multiplier: 1 },
    { id: 'M', name: 'M (15cm)', multiplier: 1.3 },
    { id: 'L', name: 'L (20cm)', multiplier: 1.6 },
    { id: 'XL', name: 'XL (25cm)', multiplier: 2 },
];

export default function CustomPage() {
    const [currentStep, setCurrentStep] = useState(1);
    const [orderData, setOrderData] = useState<OrderData>({
        type: 'single',
        images: [],
        size: 'M',
        notes: '',
        name: '',
        phone: '',
    });
    const [dragActive, setDragActive] = useState(false);

    const basePrice = orderTypes.find(t => t.id === orderData.type)?.price || 350000;
    const sizeMultiplier = sizes.find(s => s.id === orderData.size)?.multiplier || 1;
    const totalPrice = Math.round(basePrice * sizeMultiplier);

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
                                            ? 'bg-white text-black text-white'
                                            : 'bg-[#1D1D1F] text-white/50'
                                        }
                  `}
                                >
                                    {step.id}
                                </button>
                                {index < steps.length - 1 && (
                                    <div className={`w-12 h-0.5 mx-1 ${currentStep > step.id ? 'bg-white text-black' : 'bg-[#1D1D1F]'}`} />
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
                                                    ? 'bg-white text-black text-white ring-2 ring-white/30 ring-offset-2 ring-offset-[#1D1D1F]'
                                                    : 'bg-[#2D2D2F] text-white hover:bg-[#3D3D3F]'
                                                }
                      `}
                                            data-cursor
                                        >
                                            <span className="text-4xl mb-4 block">{type.emoji}</span>
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
                                            ? 'border-white/30 bg-white text-black/10'
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
                                        <span className="text-5xl mb-4 block">📷</span>
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
                                                    ? 'bg-white text-black text-white'
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
                                                <span className="text-white/70 font-bold text-lg">
                                                    {totalPrice.toLocaleString('vi-VN')}đ
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Contact Info */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <Input
                                            label="Họ tên"
                                            placeholder="Nhập họ tên của bạn"
                                            value={orderData.name}
                                            onChange={(e) => setOrderData(prev => ({ ...prev, name: e.target.value }))}
                                        />
                                        <Input
                                            label="Số điện thoại"
                                            placeholder="Nhập số điện thoại"
                                            value={orderData.phone}
                                            onChange={(e) => setOrderData(prev => ({ ...prev, phone: e.target.value }))}
                                        />
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Navigation Buttons */}
                    <div className="flex justify-between mt-8 pt-8 border-t border-white/10">
                        <Button
                            variant="outline"
                            onClick={prevStep}
                            disabled={currentStep === 1}
                            className={currentStep === 1 ? 'opacity-50' : ''}
                        >
                            ← Quay lại
                        </Button>

                        {currentStep < 4 ? (
                            <Button variant="primary" onClick={nextStep}>
                                Tiếp tục →
                            </Button>
                        ) : (
                            <Button variant="primary">
                                Đặt hàng - {totalPrice.toLocaleString('vi-VN')}đ
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
