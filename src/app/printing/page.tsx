'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { AnimatedSection } from '@/components/ui/Animations';
import { Button } from '@/components/ui/Button';
import { getSupabase } from '@/lib/supabase/client';
import { generateId } from '@/lib/generateId';
import { AddressSelector, ShippingAddress } from '@/components/checkout/AddressSelector';
import { useCart } from '@/lib/store/cart';

type PrintType = 'fdm' | 'resin';

interface FileInfo {
    id: string;
    name: string;
    url: string;
    thumbnail: string;
}

interface AnalysisResult {
    volume: number;
    grams: number;
    hours: number;
    price: number;
    boundingBox: { x: number; y: number; z: number };
}

interface FileItem {
    id: string;
    file: File;
    analysis: AnalysisResult | null;
    quantity: number;
    analyzing: boolean;
}

interface PrintOrder {
    items: FileItem[];
    type: PrintType;
    color: string;
    infill: string;
    layerHeight: string;
    notes: string;
}

const printTypes = [
    {
        id: 'fdm' as PrintType,
        name: 'FDM',
        desc: 'Nhựa PETG - Bền, chịu nhiệt tốt',
    },
    {
        id: 'resin' as PrintType,
        name: 'SLA (Resin)',
        desc: 'Chi tiết cao, mịn màng',
    },
];

// Colors per print type
const FDM_COLORS = [
    { id: 'white', name: 'Trắng', hex: '#FFFFFF' },
    { id: 'black', name: 'Đen', hex: '#1D1D1F' },
    { id: 'transparent', name: 'Trong suốt', hex: '#E5E5EA' },
];

const RESIN_COLORS = [
    { id: 'white', name: 'Trắng', hex: '#FFFFFF' },
];

// Constants for calculation
const DENSITY: Record<string, number> = {
    fdm: 1.24,

    resin: 1.1,
};

const PRINT_SPEED: Record<string, number> = {
    fdm: 12, // g/hour
    resin: 6,
};

const SHELL_FACTOR = 1.2;
const RESIN_FACTOR = 1.25; // 25% extra for supports and waste

const INFILL_FACTORS: Record<string, number> = {
    '15%': 0.15,
    '20%': 0.20,
    '30%': 0.30,
    '50%': 0.50,
};

const LAYER_TIME_MULT: Record<string, number> = {
    '0.2': 1,
    '0.12': 2,
    '0.08': 4,
};

export default function PrintingPage() {
    const router = useRouter();
    const { addItem, openCart } = useCart();
    const [user, setUser] = useState<{ id: string; email: string } | null>(null);
    const [customerCode, setCustomerCode] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const [order, setOrder] = useState<PrintOrder>({
        items: [],
        type: 'fdm',
        color: 'white',
        infill: '20%',
        layerHeight: '0.2',
        notes: '',
    });
    const [dragActive, setDragActive] = useState(false);
    const [shippingAddress, setShippingAddress] = useState<ShippingAddress | null>(null);

    // Calculate total price from all items
    const totalPrice = order.items.reduce((sum, item) => {
        return sum + (item.analysis ? item.analysis.price * item.quantity : 0);
    }, 0);
    const grandTotal = totalPrice;

    // Check if any item is analyzing
    const isAnalyzing = order.items.some(item => item.analyzing);

    const { data: session, status } = useSession();

    // Auth check on mount
    useEffect(() => {
        if (status === 'loading') return;

        if (status === 'unauthenticated') {
            router.push('/login?redirect=/printing');
            return;
        }

        const fetchUserData = async () => {
            if (!session?.user?.email) return;

            try {
                const res = await fetch('/api/profile');
                if (res.ok) {
                    const response = await res.json();
                    // API returns { success: true, data: profile }
                    const userData = response.data || response;
                    setUser({ id: userData.id, email: session.user.email } as any);
                    setCustomerCode(userData.customer_code || generateId.user());
                }
            } catch (e) {
                console.error('Failed to fetch profile', e);
            }
            setLoading(false);
        };

        fetchUserData();
    }, [status, session, router]);

    // Analyze a single file item
    const analyzeItem = async (itemId: string, file: File) => {
        // Set analyzing state for this item
        setOrder(prev => ({
            ...prev,
            items: prev.items.map(item =>
                item.id === itemId ? { ...item, analyzing: true } : item
            )
        }));

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('type', order.type);

            const res = await fetch('/api/analyze-stl', {
                method: 'POST',
                body: formData
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Analysis failed');
            }

            // Calculate initial metrics
            const metrics = calculateMetrics(
                data.volume,
                order.type,
                order.infill,
                order.layerHeight
            );

            // Update item with analysis result
            setOrder(prev => ({
                ...prev,
                items: prev.items.map(item =>
                    item.id === itemId ? {
                        ...item,
                        analyzing: false,
                        analysis: {
                            volume: data.volume,
                            boundingBox: data.boundingBox,
                            ...metrics
                        }
                    } : item
                )
            }));
        } catch (err) {
            setError((err as Error).message);
            // Clear analyzing state on error
            setOrder(prev => ({
                ...prev,
                items: prev.items.map(item =>
                    item.id === itemId ? { ...item, analyzing: false } : item
                )
            }));
        }
    };

    // Recalculate metrics based on current settings
    const calculateMetrics = useCallback((volume: number, type: PrintType, infill: string, layerHeight: string) => {
        const density = DENSITY[type];
        let grams = 0;

        if (type === 'fdm') {
            const infillPercent = INFILL_FACTORS[infill] || 0.20; // Default 20%
            // Formula: Vin = Vmodel * (shell_factor + infill)
            // Mass = Vin * density
            const vIn = volume * (SHELL_FACTOR + infillPercent);
            grams = vIn * density;
        } else {
            // Formula: Vreal = Vmodel * k (k=1.25 for standard supports/waste)
            // Mass = Vreal * density
            const vReal = volume * RESIN_FACTOR;
            grams = vReal * density;
        }

        const speed = PRINT_SPEED[type];
        let hours = grams / speed;

        if (type === 'fdm') {
            hours = hours * (LAYER_TIME_MULT[layerHeight] || 1);
        }

        let price = 0;
        if (type === 'fdm') {
            price = 600 * grams + 3000 * hours;
        } else {
            price = 3000 * hours + 3000 * grams;
        }

        return {
            grams: Math.round(grams),
            hours: Math.round(hours * 10) / 10,
            price: Math.round(price),
        };
    }, []);

    // Re-calculate all items when print settings change
    useEffect(() => {
        if (order.items.length > 0) {
            setOrder(prev => ({
                ...prev,
                items: prev.items.map(item => {
                    if (item.analysis) {
                        const metrics = calculateMetrics(
                            item.analysis.volume,
                            prev.type,
                            prev.infill,
                            prev.layerHeight
                        );
                        return {
                            ...item,
                            analysis: {
                                ...item.analysis,
                                ...metrics
                            }
                        };
                    }
                    return item;
                })
            }));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [order.type, order.infill, order.layerHeight, calculateMetrics]);

    // Upload files to Google Drive
    const uploadFiles = async (orderCode: string): Promise<FileInfo[]> => {
        const uploadedFiles: FileInfo[] = [];

        for (let i = 0; i < order.items.length; i++) {
            const item = order.items[i];
            const formData = new FormData();
            formData.append('file', item.file);
            formData.append('type', 'printing');
            formData.append('customerCode', customerCode);
            formData.append('orderCode', orderCode);
            formData.append('index', String(i + 1));
            // New naming convention parameters for printing
            formData.append('tech', order.type); // 'fdm' or 'resin'
            if (order.type === 'fdm') {
                formData.append('infill', order.infill.replace('%', '')); // '20%' -> '20'
                formData.append('layerHeight', order.layerHeight); // '0.2', '0.12', '0.08'
                formData.append('color', order.color); // 'white', 'black', 'transparent'
            }

            const res = await fetch('/api/upload', { method: 'POST', body: formData });
            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Upload failed');
            }

            uploadedFiles.push(data.file);
        }

        return uploadedFiles;
    };

    // Submit order
    const handleSubmit = async () => {
        // Must have at least one item with analysis
        const hasValidItem = order.items.some(item => item.analysis !== null);
        if (!user || !hasValidItem) return;

        // Validate shipping address
        if (!shippingAddress || !shippingAddress.full_name || !shippingAddress.phone || !shippingAddress.province) {
            setError('Vui lòng nhập đầy đủ thông tin địa chỉ giao hàng');
            return;
        }

        setSubmitting(true);
        setError('');

        try {
            const supabase = getSupabase();
            const orderCode = generateId.printing();

            // Upload files to Drive
            const files = await uploadFiles(orderCode);

            // Call API to create order (Bypasses RLS)
            const res = await fetch('/api/orders/printing', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    items: order.items.map(item => ({
                        quantity: item.quantity,
                        analysis: item.analysis
                    })),
                    files: files.map(f => ({ id: f.id, name: f.name })),
                    type: order.type,
                    color: order.color,
                    infill: order.infill,
                    layerHeight: order.layerHeight,
                    notes: order.notes,
                    shippingAddress: {
                        full_name: shippingAddress.full_name,
                        phone: shippingAddress.phone,
                        address_line: shippingAddress.address_line,
                        ward: shippingAddress.ward || '',
                        district: shippingAddress.district || '',
                        province: shippingAddress.province,
                    },
                    totalPrice: grandTotal
                })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Failed to create order');
            }

            const orderId = data.orderId;

            // Store order type for payment page
            sessionStorage.setItem('checkout_order_type', 'printing');
            sessionStorage.setItem('checkout_order_id', orderId);

            // Redirect to payment
            router.push('/checkout/payment?orderId=' + orderId);
        } catch (err) {
            console.error('Submit error:', err);
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

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const validFiles = Array.from(e.dataTransfer.files).filter(
                f => f.name.endsWith('.stl') || f.name.endsWith('.obj') || f.name.endsWith('.3mf')
            );

            // Create new FileItems for each file
            const newItems: FileItem[] = validFiles.map(file => ({
                id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                file,
                analysis: null,
                quantity: 1,
                analyzing: false,
            }));

            setOrder(prev => ({ ...prev, items: [...prev.items, ...newItems] }));

            // Trigger analysis for each new file
            newItems.forEach(item => {
                analyzeItem(item.id, item.file);
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [order.type, order.infill, order.layerHeight]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const validFiles = Array.from(e.target.files).filter(
                f => f.name.endsWith('.stl') || f.name.endsWith('.obj') || f.name.endsWith('.3mf')
            );

            // Create new FileItems for each file
            const newItems: FileItem[] = validFiles.map(file => ({
                id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                file,
                analysis: null,
                quantity: 1,
                analyzing: false,
            }));

            setOrder(prev => ({ ...prev, items: [...prev.items, ...newItems] }));

            // Trigger analysis for each new file
            newItems.forEach(item => {
                analyzeItem(item.id, item.file);
            });

            // Reset the input to allow re-selecting same file
            e.target.value = '';
        }
    };

    const removeItem = (itemId: string) => {
        setOrder(prev => ({
            ...prev,
            items: prev.items.filter(item => item.id !== itemId),
        }));
    };

    // Update item quantity
    const updateItemQuantity = (itemId: string, delta: number) => {
        setOrder(prev => ({
            ...prev,
            items: prev.items.map(item =>
                item.id === itemId
                    ? { ...item, quantity: Math.max(1, item.quantity + delta) }
                    : item
            ),
        }));
    };

    // Add to cart instead of direct order
    const handleAddToCart = () => {
        const hasValidItem = order.items.some(item => item.analysis !== null);
        if (!hasValidItem) return;

        // Add each item with analysis to cart
        order.items.forEach(item => {
            if (item.analysis) {
                addItem({
                    type: 'print',
                    name: item.file.name,
                    price: item.analysis.price,
                    quantity: item.quantity,
                    printOptions: {
                        type: order.type,
                        color: order.color,
                        infill: order.infill,
                        layerHeight: order.layerHeight,
                    },
                    printFiles: [{
                        id: item.id,
                        name: item.file.name,
                        analysis: item.analysis,
                    }],
                });
            }
        });

        // Clear the order items
        setOrder(prev => ({ ...prev, items: [] }));

        // Open cart to show added items
        openCart();
    };

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
                        Upload file STL/OBJ của bạn, hệ thống sẽ tự động tính giá
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
                                        accept=".stl,.obj"
                                        onChange={handleFileChange}
                                        className="hidden"
                                        id="file-upload"
                                    />
                                    <label htmlFor="file-upload" className="cursor-pointer">
                                        <div className="mb-4 flex justify-center text-white/70">
                                            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                            </svg>
                                        </div>
                                        <p className="text-white font-medium">Kéo thả file 3D vào đây</p>
                                        <p className="text-white/50 text-sm mt-2">Hỗ trợ: STL, OBJ</p>
                                    </label>
                                </div>

                                {/* File List with Individual Quantities */}
                                {order.items.length > 0 && (
                                    <div className="mt-6 space-y-4">
                                        {order.items.map((item) => (
                                            <div key={item.id} className="bg-gradient-to-br from-[#2D2D2F] to-[#1D1D1F] rounded-xl p-4 border border-white/10">
                                                <div className="flex items-center justify-between mb-3">
                                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                                        <div className="text-white/70 flex-shrink-0">
                                                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                            </svg>
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-white font-medium text-sm truncate">{item.file.name}</p>
                                                            <p className="text-white/50 text-xs">
                                                                {(item.file.size / 1024 / 1024).toFixed(2)} MB
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => removeItem(item.id)}
                                                        className="w-8 h-8 rounded-full bg-white/10 text-white hover:bg-red-500 transition-colors flex items-center justify-center flex-shrink-0"
                                                    >
                                                        ×
                                                    </button>
                                                </div>

                                                {/* Analysis Loading */}
                                                {item.analyzing && (
                                                    <div className="bg-[#2D2D2F] rounded-lg p-3 text-center">
                                                        <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-2" />
                                                        <p className="text-white/50 text-xs">Đang phân tích...</p>
                                                    </div>
                                                )}

                                                {/* Analysis Result */}
                                                {item.analysis && !item.analyzing && (
                                                    <div className="space-y-3">
                                                        <div className="grid grid-cols-4 gap-2 text-center">
                                                            <div>
                                                                <span className="text-white/50 text-xs block">Thể tích</span>
                                                                <span className="text-sm font-bold text-white">{item.analysis.volume}</span>
                                                                <span className="text-white/40 text-xs">cm³</span>
                                                            </div>
                                                            <div>
                                                                <span className="text-white/50 text-xs block">Khối lượng</span>
                                                                <span className="text-sm font-bold text-white">{item.analysis.grams}</span>
                                                                <span className="text-white/40 text-xs">g</span>
                                                            </div>
                                                            <div>
                                                                <span className="text-white/50 text-xs block">Thời gian</span>
                                                                <span className="text-sm font-bold text-white">{item.analysis.hours}</span>
                                                                <span className="text-white/40 text-xs">h</span>
                                                            </div>
                                                            <div>
                                                                <span className="text-white/50 text-xs block">Giá/cái</span>
                                                                <span className="text-sm font-bold text-white">{item.analysis.price.toLocaleString('vi-VN')}</span>
                                                                <span className="text-white/40 text-xs">đ</span>
                                                            </div>
                                                        </div>

                                                        {/* Quantity Controls */}
                                                        <div className="flex items-center justify-between pt-2 border-t border-white/10">
                                                            <span className="text-white/70 text-sm">Số lượng</span>
                                                            <div className="inline-flex items-center bg-[#2D2D2F] rounded-full">
                                                                <button
                                                                    onClick={() => updateItemQuantity(item.id, -1)}
                                                                    className="w-8 h-8 flex items-center justify-center text-white hover:text-white/70 transition-colors"
                                                                >
                                                                    −
                                                                </button>
                                                                <span className="w-8 text-center text-white font-medium text-sm">{item.quantity}</span>
                                                                <button
                                                                    onClick={() => updateItemQuantity(item.id, 1)}
                                                                    className="w-8 h-8 flex items-center justify-center text-white hover:text-white/70 transition-colors"
                                                                >
                                                                    +
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Global Analyzing Indicator */}
                                {isAnalyzing && (
                                    <div className="mt-4 text-center">
                                        <p className="text-white/40 text-xs">Đang xử lý file...</p>
                                    </div>
                                )}
                            </div>
                        </AnimatedSection>

                        {/* Print Type */}
                        <div className="mt-6">
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
                                            <h3 className="text-lg font-semibold">{type.name}</h3>
                                            <p className="text-sm opacity-70">{type.desc}</p>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Infill Selection (only for FDM) */}
                        {order.type === 'fdm' && (
                            <div className="mt-6">
                                <div className="bg-[#1D1D1F] rounded-3xl p-8">
                                    <h2 className="text-xl font-semibold text-white mb-6">Độ đậm đặc (Infill)</h2>
                                    <div className="flex flex-wrap gap-3">
                                        {['15%', '20%', '30%', '50%'].map((val) => (
                                            <button
                                                key={val}
                                                onClick={() => setOrder(prev => ({ ...prev, infill: val }))}
                                                className={`
                            px-6 py-3 rounded-full transition-all text-sm font-medium
                            ${order.infill === val
                                                        ? 'bg-white text-black'
                                                        : 'bg-[#2D2D2F] text-white hover:bg-[#3D3D3F]'
                                                    }
                          `}
                                            >
                                                {val}
                                            </button>
                                        ))}
                                    </div>
                                    <p className="text-white/40 text-sm mt-4">
                                        *Độ infill càng cao, vật thể càng đặc và cứng hơn
                                    </p>
                                </div>
                            </div>

                        )}

                        {/* Layer Height Selection (only for FDM) */}
                        {order.type === 'fdm' && (
                            <div className="mt-6">
                                <div className="bg-[#1D1D1F] rounded-3xl p-8">
                                    <h2 className="text-xl font-semibold text-white mb-6">Độ mịn (Layer Height)</h2>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                        {[
                                            { val: '0.2', label: '0.2mm - Chuẩn', time: 'x1' },
                                            { val: '0.12', label: '0.12mm - Mịn', time: 'x2' },
                                            { val: '0.08', label: '0.08mm - Siêu mịn', time: 'x4' }
                                        ].map((opt) => (
                                            <button
                                                key={opt.val}
                                                onClick={() => setOrder(prev => ({ ...prev, layerHeight: opt.val }))}
                                                className={`
                            p-4 rounded-xl text-left transition-all
                            ${order.layerHeight === opt.val
                                                        ? 'bg-white text-black'
                                                        : 'bg-[#2D2D2F] text-white hover:bg-[#3D3D3F]'
                                                    }
                          `}
                                            >
                                                <div className="font-semibold">{opt.label}</div>
                                                <div className="text-xs opacity-70 mt-1">{opt.time}</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Color Selection */}
                        <div className="mt-6">
                            <div className="bg-[#1D1D1F] rounded-3xl p-8">
                                <h2 className="text-xl font-semibold text-white mb-6">Màu sắc</h2>
                                <div className="flex flex-wrap gap-3">
                                    {(order.type === 'fdm' ? FDM_COLORS : RESIN_COLORS).map((color) => (
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
                        </div>

                        {/* Notes */}
                        <div className="mt-6">
                            <div className="bg-[#1D1D1F] rounded-3xl p-8">
                                <h2 className="text-xl font-semibold text-white mb-6">Ghi chú</h2>
                                <textarea
                                    value={order.notes}
                                    onChange={(e) => setOrder(prev => ({ ...prev, notes: e.target.value }))}
                                    placeholder="Yêu cầu thêm"
                                    className="w-full p-4 bg-[#2D2D2F] rounded-xl text-white placeholder:text-white/30 resize-none focus:outline-none focus:ring-2 focus:ring-white/30"
                                    rows={3}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Right - Order Summary */}
                    <div className="lg:col-span-1">
                        <AnimatedSection delay={0.4}>
                            <div className="bg-[#1D1D1F] rounded-3xl p-8 sticky top-28">
                                <h2 className="text-xl font-semibold text-white mb-6">Đơn hàng</h2>

                                {/* Items List */}
                                {order.items.length > 0 && (
                                    <div className="mb-6 space-y-2 max-h-60 overflow-y-auto">
                                        {order.items.map((item) => (
                                            <div key={item.id} className="flex justify-between items-center text-sm py-2 border-b border-white/5">
                                                <span className="text-white/80 truncate max-w-[150px]">{item.file.name}</span>
                                                <span className="text-white flex items-center gap-2">
                                                    <span className="text-white/50">x{item.quantity}</span>
                                                    {item.analysis && (
                                                        <span className="font-medium">{(item.analysis.price * item.quantity).toLocaleString('vi-VN')}đ</span>
                                                    )}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}

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
                                            {(order.type === 'fdm' ? FDM_COLORS : RESIN_COLORS).find(c => c.id === order.color)?.name}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-white/60">Số sản phẩm</span>
                                        <span className="text-white">{order.items.length}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-white/60">Tổng số lượng</span>
                                        <span className="text-white">
                                            {order.items.reduce((sum, item) => sum + item.quantity, 0)}
                                        </span>
                                    </div>
                                </div>

                                {/* Price */}
                                <div className="border-t border-white/10 pt-4 mb-6">
                                    {order.items.some(item => item.analysis) ? (
                                        <div className="space-y-2">
                                            <div className="flex justify-between">
                                                <span className="text-white/60">Tạm tính</span>
                                                <span className="text-white">
                                                    {totalPrice.toLocaleString('vi-VN')}đ
                                                    {order.type === 'fdm' && (
                                                        <div className="text-xs text-right text-white/40 mt-1 space-y-1">
                                                            <span className="block">Infill: {order.infill}</span>
                                                            <span className="block">Layer: {order.layerHeight}mm</span>
                                                        </div>
                                                    )}
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-baseline pt-2 border-t border-white/10">
                                                <span className="text-white font-medium">Tổng cộng</span>
                                                <span className="text-2xl font-bold text-white">
                                                    {grandTotal.toLocaleString('vi-VN')}đ
                                                </span>
                                            </div>
                                            <p className="text-amber-400 text-xs">
                                                *Thanh toán 100% cho dịch vụ in 3D
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="text-center py-4">
                                            <p className="text-white/40 text-sm">
                                                Upload file để xem giá ước tính
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* Shipping Address */}
                                <div className="border-t border-white/10 pt-4 mb-4">
                                    <h3 className="text-white font-medium mb-3">📍 Địa chỉ giao hàng</h3>
                                    <AddressSelector
                                        userId={user?.id}
                                        value={shippingAddress}
                                        onChange={setShippingAddress}
                                        disabled={submitting}
                                    />
                                </div>

                                {/* Error */}
                                {error && (
                                    <div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
                                        {error}
                                    </div>
                                )}

                                <div className="space-y-3">
                                    {/* Add to Cart button */}
                                    <Button
                                        variant="secondary"
                                        size="lg"
                                        className="w-full"
                                        disabled={order.items.length === 0 || !order.items.some(item => item.analysis) || isAnalyzing}
                                        onClick={handleAddToCart}
                                    >
                                        {order.items.length === 0 ? (
                                            'Vui lòng upload file'
                                        ) : isAnalyzing ? (
                                            'Đang phân tích...'
                                        ) : (
                                            <>
                                                <svg className="w-5 h-5 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                                                </svg>
                                                Thêm vào giỏ hàng
                                            </>
                                        )}
                                    </Button>

                                    {/* Direct order button */}
                                    <Button
                                        variant="primary"
                                        size="lg"
                                        className="w-full"
                                        disabled={order.items.length === 0 || !order.items.some(item => item.analysis) || submitting || isAnalyzing || !shippingAddress}
                                        onClick={handleSubmit}
                                    >
                                        {submitting ? (
                                            <span className="flex items-center gap-2">
                                                <span className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                                                Đang xử lý...
                                            </span>
                                        ) : order.items.length === 0 ? (
                                            'Vui lòng upload file'
                                        ) : isAnalyzing ? (
                                            'Đang phân tích...'
                                        ) : !shippingAddress ? (
                                            'Chọn địa chỉ để đặt in ngay'
                                        ) : (
                                            `Đặt in ngay - ${grandTotal.toLocaleString('vi-VN')}đ`
                                        )}
                                    </Button>
                                </div>


                            </div>
                        </AnimatedSection>
                    </div>
                </div>
            </div>
        </div >
    );
}
