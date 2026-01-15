'use client';

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { AnimatedSection } from '@/components/ui/Animations';
import { Button } from '@/components/ui/Button';

type PrintType = 'fdm' | 'resin';

interface PrintOrder {
    files: File[];
    type: PrintType;
    color: string;
    quantity: number;
}

const printTypes = [
    {
        id: 'fdm' as PrintType,
        name: 'FDM',
        desc: 'Phổ biến, giá rẻ, bền',
        basePrice: 50000,
        icon: '🔧'
    },
    {
        id: 'resin' as PrintType,
        name: 'Resin',
        desc: 'Chi tiết cao, mịn màng',
        basePrice: 100000,
        icon: '✨'
    },
];

const colors = [
    { id: 'white', name: 'Trắng', hex: '#FFFFFF' },
    { id: 'black', name: 'Đen', hex: '#1D1D1F' },
    { id: 'gray', name: 'Xám', hex: '#6E6E73' },
    { id: 'blue', name: 'Xanh dương', hex: '#0071E3' },
    { id: 'red', name: 'Đỏ', hex: '#FF453A' },
    { id: 'green', name: 'Xanh lá', hex: '#30D158' },
];

export default function PrintingPage() {
    const [order, setOrder] = useState<PrintOrder>({
        files: [],
        type: 'fdm',
        color: 'white',
        quantity: 1,
    });
    const [dragActive, setDragActive] = useState(false);

    const basePrice = printTypes.find(t => t.id === order.type)?.basePrice || 50000;
    const estimatedPrice = basePrice * order.quantity * (order.files.length || 1);

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
            const files = Array.from(e.dataTransfer.files).filter(
                f => f.name.endsWith('.stl') || f.name.endsWith('.obj') || f.name.endsWith('.3mf')
            );
            setOrder(prev => ({ ...prev, files: [...prev.files, ...files] }));
        }
    }, []);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const files = Array.from(e.target.files);
            setOrder(prev => ({ ...prev, files: [...prev.files, ...files] }));
        }
    };

    const removeFile = (index: number) => {
        setOrder(prev => ({
            ...prev,
            files: prev.files.filter((_, i) => i !== index)
        }));
    };

    return (
        <div className="min-h-screen bg-[#0a0a0a] pt-28 pb-20">
            <div className="max-w-[1200px] mx-auto px-6">
                {/* Header */}
                <AnimatedSection className="text-center mb-12">
                    <span className="text-sm text-white/70 font-medium tracking-widest uppercase mb-4 block">
                        3D Printing Service
                    </span>
                    <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-4">
                        Dịch Vụ In 3D
                    </h1>
                    <p className="text-white/50 max-w-lg mx-auto">
                        Upload file STL/OBJ của bạn, nhận báo giá tự động và đặt in ngay
                    </p>
                </AnimatedSection>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left - Upload & Options */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* File Upload */}
                        <AnimatedSection delay={0.1}>
                            <div className="bg-[#1D1D1F] rounded-3xl p-8">
                                <h2 className="text-xl font-semibold text-white mb-6">Upload file 3D</h2>

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
                                        accept=".stl,.obj,.3mf"
                                        onChange={handleFileChange}
                                        className="hidden"
                                        id="file-upload"
                                    />
                                    <label htmlFor="file-upload" className="cursor-pointer">
                                        <span className="text-5xl mb-4 block">📦</span>
                                        <p className="text-white font-medium">Kéo thả file 3D vào đây</p>
                                        <p className="text-white/50 text-sm mt-2">Hỗ trợ: STL, OBJ, 3MF</p>
                                    </label>
                                </div>

                                {/* File List */}
                                {order.files.length > 0 && (
                                    <div className="mt-6 space-y-3">
                                        {order.files.map((file, index) => (
                                            <div
                                                key={index}
                                                className="flex items-center justify-between bg-[#2D2D2F] rounded-xl p-4"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <span className="text-2xl">📄</span>
                                                    <div>
                                                        <p className="text-white font-medium text-sm">{file.name}</p>
                                                        <p className="text-white/50 text-xs">
                                                            {(file.size / 1024 / 1024).toFixed(2)} MB
                                                        </p>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => removeFile(index)}
                                                    className="w-8 h-8 rounded-full bg-white/10 text-white hover:bg-red-500 transition-colors flex items-center justify-center"
                                                >
                                                    ×
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </AnimatedSection>

                        {/* Print Type */}
                        <AnimatedSection delay={0.2}>
                            <div className="bg-[#1D1D1F] rounded-3xl p-8">
                                <h2 className="text-xl font-semibold text-white mb-6">Loại in</h2>
                                <div className="grid grid-cols-2 gap-4">
                                    {printTypes.map((type) => (
                                        <button
                                            key={type.id}
                                            onClick={() => setOrder(prev => ({ ...prev, type: type.id }))}
                                            className={`
                        p-6 rounded-2xl text-left transition-all
                        ${order.type === type.id
                                                    ? 'bg-[#0071E3] text-white ring-2 ring-white/30 ring-offset-2 ring-offset-[#1D1D1F]'
                                                    : 'bg-[#2D2D2F] text-white hover:bg-[#3D3D3F]'
                                                }
                      `}
                                            data-cursor
                                        >
                                            <span className="text-3xl mb-3 block">{type.icon}</span>
                                            <h3 className="text-lg font-semibold">{type.name}</h3>
                                            <p className="text-sm opacity-70">{type.desc}</p>
                                            <p className="text-sm mt-2">
                                                Từ {type.basePrice.toLocaleString('vi-VN')}đ
                                            </p>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </AnimatedSection>

                        {/* Color Selection */}
                        <AnimatedSection delay={0.3}>
                            <div className="bg-[#1D1D1F] rounded-3xl p-8">
                                <h2 className="text-xl font-semibold text-white mb-6">Màu sắc</h2>
                                <div className="flex flex-wrap gap-3">
                                    {colors.map((color) => (
                                        <button
                                            key={color.id}
                                            onClick={() => setOrder(prev => ({ ...prev, color: color.id }))}
                                            className={`
                        flex items-center gap-3 px-4 py-3 rounded-full transition-all
                        ${order.color === color.id
                                                    ? 'bg-white/20 ring-2 ring-white'
                                                    : 'bg-[#2D2D2F] hover:bg-[#3D3D3F]'
                                                }
                      `}
                                            data-cursor
                                        >
                                            <span
                                                className="w-5 h-5 rounded-full border border-white/20"
                                                style={{ backgroundColor: color.hex }}
                                            />
                                            <span className="text-white text-sm">{color.name}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </AnimatedSection>
                    </div>

                    {/* Right - Order Summary */}
                    <div className="lg:col-span-1">
                        <AnimatedSection delay={0.4}>
                            <div className="bg-[#1D1D1F] rounded-3xl p-8 sticky top-28">
                                <h2 className="text-xl font-semibold text-white mb-6">Đơn hàng</h2>

                                {/* Quantity */}
                                <div className="mb-6">
                                    <label className="text-white/70 text-sm mb-2 block">Số lượng</label>
                                    <div className="inline-flex items-center bg-[#2D2D2F] rounded-full">
                                        <button
                                            onClick={() => setOrder(prev => ({ ...prev, quantity: Math.max(1, prev.quantity - 1) }))}
                                            className="w-12 h-12 flex items-center justify-center text-white hover:text-white/70 transition-colors"
                                            data-cursor
                                        >
                                            −
                                        </button>
                                        <span className="w-12 text-center text-white font-medium">{order.quantity}</span>
                                        <button
                                            onClick={() => setOrder(prev => ({ ...prev, quantity: prev.quantity + 1 }))}
                                            className="w-12 h-12 flex items-center justify-center text-white hover:text-white/70 transition-colors"
                                            data-cursor
                                        >
                                            +
                                        </button>
                                    </div>
                                </div>

                                {/* Summary */}
                                <div className="space-y-3 mb-6 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-white/60">Loại in</span>
                                        <span className="text-white">
                                            {printTypes.find(t => t.id === order.type)?.name}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-white/60">Màu sắc</span>
                                        <span className="text-white">
                                            {colors.find(c => c.id === order.color)?.name}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-white/60">Số file</span>
                                        <span className="text-white">{order.files.length || 0}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-white/60">Số lượng</span>
                                        <span className="text-white">x{order.quantity}</span>
                                    </div>
                                </div>

                                {/* Estimated Price */}
                                <div className="border-t border-white/10 pt-4 mb-6">
                                    <div className="flex justify-between items-baseline">
                                        <span className="text-white/60">Giá ước tính</span>
                                        <span className="text-2xl font-bold text-white/70">
                                            {estimatedPrice.toLocaleString('vi-VN')}đ
                                        </span>
                                    </div>
                                    <p className="text-white/40 text-xs mt-2">
                                        *Giá cuối cùng phụ thuộc vào kích thước file
                                    </p>
                                </div>

                                <Button
                                    variant="primary"
                                    size="lg"
                                    className="w-full"
                                    disabled={order.files.length === 0}
                                >
                                    {order.files.length === 0 ? 'Vui lòng upload file' : 'Đặt in ngay'}
                                </Button>

                                {/* Features */}
                                <div className="mt-8 space-y-3">
                                    <div className="flex items-center gap-3 text-sm text-white/60">
                                        <span>✅</span> Báo giá trong 30 phút
                                    </div>
                                    <div className="flex items-center gap-3 text-sm text-white/60">
                                        <span>🚚</span> Giao hàng 3-5 ngày
                                    </div>
                                    <div className="flex items-center gap-3 text-sm text-white/60">
                                        <span>🛡️</span> Bảo hành 30 ngày
                                    </div>
                                </div>
                            </div>
                        </AnimatedSection>
                    </div>
                </div>
            </div>
        </div>
    );
}
