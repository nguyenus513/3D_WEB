'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Switch } from '@/components/ui/Switch';
import { getSupabase } from '@/lib/supabase/client';
import { useAdminPath } from '@/hooks/useAdminPath';
import type { Product } from '@/types/database';
import { generateId } from '@/lib/generateId';
import { addCsrfToRequest } from '@/lib/security/csrf-client';

type PricingMode = 'original' | 'multi_size';

interface SizeVariant {
    name: string;
    price: string;
    stock: string;
    sku?: string;
    image_url?: string;
    uploading?: boolean;
}

interface FormImage {
    url: string;
    is_main?: boolean;
}

export default function AdminProductEditPage() {
    const router = useRouter();
    const params = useParams();
    const { adminRoot } = useAdminPath();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');
    const [uploadingImage, setUploadingImage] = useState(false);
    const [pricingMode, setPricingMode] = useState<PricingMode>('original');

    const [formData, setFormData] = useState({
        name: '',
        sku: '',
        status: 'draft',
        basePrice: '',
        stock: '',
        images: [] as FormImage[],
        sizes: [] as SizeVariant[],
    });

    // Buyers who purchased this product
    interface Buyer {
        name: string;
        email: string;
        phone: string;
        order_code: string;
        quantity: number;
        purchased_at: string;
    }
    const [buyers, setBuyers] = useState<Buyer[]>([]);

    useEffect(() => {
        if (params.id) {
            fetchProduct(params.id as string);
            fetchBuyers(params.id as string);
        }
    }, [params.id]);

    const fetchProduct = async (id: string) => {
        const supabase = getSupabase();
        const { data, error: fetchError } = await supabase
            .from('products')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError || !data) {
            setError('Không tìm thấy sản phẩm');
            setLoading(false);
            return;
        }

        const product = data as Product;
        // Map images (string[] -> FormImage[])
        const images = Array.isArray(product.images)
            ? product.images.map((url: any, i: number) => ({ url: typeof url === 'string' ? url : url.url, is_main: i === 0 }))
            : [];

        // Map sizes (ensure array)
        const sizes = Array.isArray(product.sizes) ? product.sizes : [];

        setPricingMode(sizes.length > 0 ? 'multi_size' : 'original');
        setFormData({
            name: product.name,
            sku: product.sku || '',
            status: (product as any).is_active ? 'active' : 'draft',
            basePrice: String(product.base_price || 0),
            stock: String(product.stock || 0),
            images: images,
            sizes: sizes.map((s: any) => ({
                name: s.name || '',
                sku: s.sku || '',
                price: String(s.price || 0),
                stock: String(s.stock || 0),
                image_url: s.image_url,
            })),
        });
        setLoading(false);
    };

    const fetchBuyers = async (_productId: string) => {
        // Note: order_items query removed due to RLS restrictions
        // TODO: Create admin API endpoint for buyer stats if needed
        setBuyers([]);
    };

    // When pricing mode changes, clear the other mode's values
    const handlePricingModeChange = (mode: PricingMode) => {
        setPricingMode(mode);
        if (mode === 'original') {
            // Clear sizes when switching to original
            setFormData(prev => ({ ...prev, sizes: [] }));
        } else {
            // Clear basePrice and stock when switching to multi_size
            setFormData(prev => ({ ...prev, basePrice: '0', stock: '0' }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        setError('');

        try {
            const supabase = getSupabase();

            const productData = {
                name: formData.name,
                is_active: formData.status === 'active',
                base_price: pricingMode === 'original' ? parseInt(formData.basePrice) || 0 : 0,
                sale_price: null,
                stock: pricingMode === 'original' ? parseInt(formData.stock) || 0 : 0,
                images: formData.images.map((img, i) => ({ url: img.url, is_main: i === 0 })),
                sizes: pricingMode === 'multi_size' ? formData.sizes.map(s => ({
                    name: s.name,
                    sku: s.sku,
                    price: parseInt(s.price) || 0,
                    stock: parseInt(s.stock) || 0,
                    image_url: s.image_url,
                    enabled: true,
                })) : [],
            };

            const { error: updateError } = await supabase
                .from('products')
                .update(productData)
                .eq('id', params.id);

            if (updateError) {
                setError('Không thể cập nhật sản phẩm: ' + updateError.message);
                return;
            }

            router.push(`${adminRoot}/products`);
        } catch (err) {
            setError('Đã có lỗi xảy ra: ' + (err as Error).message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm('Bạn có chắc muốn xóa sản phẩm này?')) return;

        const supabase = getSupabase();
        const { error: deleteError } = await supabase
            .from('products')
            .delete()
            .eq('id', params.id);

        if (deleteError) {
            setError('Không thể xóa sản phẩm: ' + deleteError.message);
            return;
        }

        router.push(`${adminRoot}/products`);
    };

    // Image upload
    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setUploadingImage(true);
        let currentIndex = formData.images.length;
        const uploadSku = formData.sku || generateId.sku();
        if (!formData.sku) {
            setFormData(prev => ({ ...prev, sku: uploadSku }));
        }

        for (const file of Array.from(files)) {
            currentIndex++;
            const formDataUpload = new FormData();
            formDataUpload.append('file', file);
            formDataUpload.append('type', 'product');
            formDataUpload.append('sku', uploadSku);
            formDataUpload.append('index', String(currentIndex));

            try {
                const res = await fetch('/api/upload', {
                    method: 'POST',
                    headers: addCsrfToRequest(),
                    body: formDataUpload,
                });
                const result = await res.json();

                if (result.success && (result.data?.file?.url || result.file?.url)) {
                    const fileUrl = result.data?.file?.url || result.file?.url;
                    setFormData(prev => ({
                        ...prev,
                        images: [...prev.images, { url: fileUrl }]
                    }));
                } else {
                    setError('Upload thất bại: ' + result.error);
                }
            } catch (err) {
                setError('Lỗi upload: ' + (err as Error).message);
            }
        }

        setUploadingImage(false);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const removeImage = (index: number) => {
        setFormData(prev => ({
            ...prev,
            images: prev.images.filter((_, i) => i !== index)
        }));
    };

    const setMainImage = (index: number) => {
        setFormData(prev => {
            const newImages = [...prev.images];
            const [mainImage] = newImages.splice(index, 1);
            return { ...prev, images: [mainImage, ...newImages] };
        });
    };

    // Size management
    const addSize = () => {
        let newSku = generateId.skuVariant(formData.sku);
        // Ensure uniqueness
        let attempts = 0;
        while (formData.sizes.some(s => s.sku === newSku) && attempts < 10) {
            newSku = generateId.skuVariant(formData.sku);
            attempts++;
        }

        setFormData(prev => ({
            ...prev,
            sizes: [...prev.sizes, { name: '', price: '', stock: '0', sku: newSku }]
        }));
    };

    const updateSize = (index: number, field: keyof SizeVariant, value: string | undefined) => {
        const newSizes = [...formData.sizes];
        if (value === undefined && field === 'image_url') {
            delete newSizes[index].image_url;
        } else {
            (newSizes[index] as any)[field] = value;
        }
        setFormData({ ...formData, sizes: newSizes });
    };

    const uploadSizeImage = async (index: number, file: File) => {
        const newSizes = [...formData.sizes];
        newSizes[index].uploading = true;
        setFormData({ ...formData, sizes: newSizes });

        const uploadSku = formData.sku || generateId.sku();
        if (!formData.sku) {
            setFormData(prev => ({ ...prev, sku: uploadSku }));
        }
        const formDataUpload = new FormData();
        formDataUpload.append('file', file);
        formDataUpload.append('type', 'product-size');
        formDataUpload.append('sku', uploadSku);
        formDataUpload.append('index', String(index));

        try {
            const res = await fetch('/api/upload', {
                method: 'POST',
                headers: addCsrfToRequest(),
                body: formDataUpload,
            });
            const result = await res.json();

            if (result.success && (result.data?.file?.url || result.file?.url)) {
                const fileUrl = result.data?.file?.url || result.file?.url;
                updateSize(index, 'image_url', fileUrl);
            } else {
                setError('Upload ảnh size thất bại');
            }
        } catch (err) {
            setError('Lỗi upload ảnh size');
        }

        newSizes[index].uploading = false;
        setFormData({ ...formData, sizes: newSizes });
    };

    const removeSize = (index: number) => {
        setFormData(prev => ({
            ...prev,
            sizes: prev.sizes.filter((_, i) => i !== index)
        }));
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href={`${adminRoot}/products`} className="p-2 rounded-xl hover:bg-white/10 text-white/50 hover:text-white">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-white">Chỉnh sửa sản phẩm</h1>
                        <p className="text-white/50 mt-1">SKU: {formData.sku}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleDelete}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-red-400 hover:bg-red-500/20 transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Xóa
                    </button>
                </div>
            </div>

            {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main content */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Basic info */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-[#1D1D1F] rounded-2xl border border-white/10 p-6 space-y-5"
                    >
                        <h2 className="text-lg font-semibold text-white">Thông tin cơ bản</h2>

                        <div>
                            <label className="text-white/70 text-sm mb-2 block">Tên sản phẩm *</label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="VD: Dragon Figure"
                                className="w-full px-4 py-3 bg-[#0a0a0a] border border-white/20 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/30"
                                required
                            />
                        </div>
                    </motion.div>

                    {/* Pricing Mode Selection */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.05 }}
                        className="bg-[#1D1D1F] rounded-2xl border border-white/10 p-6 space-y-5"
                    >
                        <h2 className="text-lg font-semibold text-white">Cách tính giá</h2>

                        <div className="grid grid-cols-2 gap-4">
                            <button
                                type="button"
                                onClick={() => handlePricingModeChange('original')}
                                className={`p-4 rounded-xl border-2 text-left transition-all ${pricingMode === 'original'
                                    ? 'border-white bg-white/10'
                                    : 'border-white/10 hover:border-white/30'
                                    }`}
                            >
                                <div className="flex items-center gap-3 mb-2">
                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${pricingMode === 'original' ? 'border-white' : 'border-white/30'
                                        }`}>
                                        {pricingMode === 'original' && (
                                            <div className="w-2.5 h-2.5 rounded-full bg-white" />
                                        )}
                                    </div>
                                    <span className="text-white font-medium">Giá gốc</span>
                                </div>
                                <p className="text-white/50 text-sm pl-8">Một giá duy nhất cho sản phẩm</p>
                            </button>

                            <button
                                type="button"
                                onClick={() => handlePricingModeChange('multi_size')}
                                className={`p-4 rounded-xl border-2 text-left transition-all ${pricingMode === 'multi_size'
                                    ? 'border-white bg-white/10'
                                    : 'border-white/10 hover:border-white/30'
                                    }`}
                            >
                                <div className="flex items-center gap-3 mb-2">
                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${pricingMode === 'multi_size' ? 'border-white' : 'border-white/30'
                                        }`}>
                                        {pricingMode === 'multi_size' && (
                                            <div className="w-2.5 h-2.5 rounded-full bg-white" />
                                        )}
                                    </div>
                                    <span className="text-white font-medium">Nhiều size</span>
                                </div>
                                <p className="text-white/50 text-sm pl-8">Giá theo từng size</p>
                            </button>
                        </div>

                        {/* Original pricing */}
                        {pricingMode === 'original' && (
                            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
                                <div>
                                    <label className="text-white/70 text-sm mb-2 block">Giá *</label>
                                    <input
                                        type="number"
                                        value={formData.basePrice}
                                        onChange={(e) => setFormData({ ...formData, basePrice: e.target.value })}
                                        placeholder="350000"
                                        className="w-full px-4 py-3 bg-[#0a0a0a] border border-white/20 rounded-xl text-white placeholder:text-white/40"
                                        required={pricingMode === 'original'}
                                    />
                                </div>
                                <div>
                                    <label className="text-white/70 text-sm mb-2 block">Số lượng tồn kho *</label>
                                    <input
                                        type="number"
                                        value={formData.stock}
                                        onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                                        placeholder="10"
                                        className="w-full px-4 py-3 bg-[#0a0a0a] border border-white/20 rounded-xl text-white placeholder:text-white/40"
                                        required={pricingMode === 'original'}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Multi-size pricing */}
                        {pricingMode === 'multi_size' && (
                            <div className="space-y-4 pt-4 border-t border-white/10">
                                <div className="flex items-center justify-between">
                                    <span className="text-white/70 text-sm">Danh sách size</span>
                                    <button
                                        type="button"
                                        onClick={addSize}
                                        className="px-3 py-1.5 bg-white/10 rounded-lg text-white/70 hover:text-white text-sm"
                                    >
                                        + Thêm size
                                    </button>
                                </div>

                                <div className="space-y-4">
                                    {formData.sizes.map((size, index) => (
                                        <div key={index} className="flex flex-col md:flex-row gap-4 p-4 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors">
                                            {/* Left: Image Upload - Enhanced UI */}
                                            <div className="w-full md:w-32 flex-shrink-0">
                                                <div className="relative aspect-square">
                                                    {size.image_url ? (
                                                        <div className="w-full h-full rounded-lg overflow-hidden relative group">
                                                            <img
                                                                src={size.image_url}
                                                                alt={size.name || 'Size'}
                                                                className="w-full h-full object-cover"
                                                            />
                                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-2 transition-opacity p-2">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => updateSize(index, 'image_url', undefined)}
                                                                    className="p-1.5 bg-red-500/80 hover:bg-red-500 rounded-full text-white transition-colors"
                                                                    title="Xóa ảnh"
                                                                >
                                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                                    </svg>
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <label className="w-full h-full rounded-lg border-2 border-dashed border-white/20 hover:border-[var(--color-accent)] hover:bg-white/5 flex flex-col items-center justify-center cursor-pointer transition-all group">
                                                            {size.uploading ? (
                                                                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                            ) : (
                                                                <>
                                                                    <svg className="w-6 h-6 text-white/30 group-hover:text-[var(--color-accent)] transition-colors mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                                    </svg>
                                                                    <span className="text-[10px] text-white/30 group-hover:text-white/60 text-center px-1">Upload ảnh</span>
                                                                </>
                                                            )}
                                                            <input
                                                                type="file"
                                                                accept="image/*"
                                                                className="hidden"
                                                                onChange={(e) => {
                                                                    const file = e.target.files?.[0];
                                                                    if (file) uploadSizeImage(index, file);
                                                                }}
                                                            />
                                                        </label>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Right: Inputs */}
                                            <div className="flex-1 space-y-3">
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="text-xs text-white/50 mb-1 block">Tên size</label>
                                                        <input
                                                            type="text"
                                                            value={size.name}
                                                            onChange={(e) => updateSize(index, 'name', e.target.value)}
                                                            placeholder="S, M, L..."
                                                            className="w-full px-3 py-2 bg-[#0a0a0a] border border-white/20 rounded-lg text-white text-sm focus:border-white/40 focus:outline-none"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-xs text-white/50 mb-1 block">Giá (VNĐ)</label>
                                                        <input
                                                            type="number"
                                                            value={size.price}
                                                            onChange={(e) => updateSize(index, 'price', e.target.value)}
                                                            placeholder="0"
                                                            className="w-full px-3 py-2 bg-[#0a0a0a] border border-white/20 rounded-lg text-white text-sm focus:border-white/40 focus:outline-none text-right"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="flex items-end gap-3">
                                                    <div className="flex-1">
                                                        <label className="text-xs text-white/50 mb-1 block">Tồn kho</label>
                                                        <input
                                                            type="number"
                                                            value={size.stock}
                                                            onChange={(e) => updateSize(index, 'stock', e.target.value)}
                                                            placeholder="0"
                                                            className="w-full px-3 py-2 bg-[#0a0a0a] border border-white/20 rounded-lg text-white text-sm focus:border-white/40 focus:outline-none"
                                                        />
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => removeSize(index)}
                                                        className="px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-sm transition-colors flex items-center gap-1 h-[38px]"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                        </svg>
                                                        Xóa
                                                    </button>
                                                </div>
                                                <div>
                                                    <label className="text-xs text-white/50 mb-1 block">SKU Size</label>
                                                    <div className="flex gap-2">
                                                        <input
                                                            type="text"
                                                            value={size.sku || ''}
                                                            readOnly
                                                            className="w-full px-3 py-2 bg-[#0a0a0a] border border-white/20 rounded-lg text-white/70 text-sm focus:outline-none cursor-default"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                const newSku = generateId.skuVariant(formData.sku);
                                                                // Simple check for duplicates
                                                                const isDuplicate = formData.sizes.some((s, i) => i !== index && s.sku === newSku);
                                                                if (!isDuplicate) {
                                                                    updateSize(index, 'sku', newSku);
                                                                } else {
                                                                    // Retry once if duplicate
                                                                    updateSize(index, 'sku', generateId.skuVariant(formData.sku));
                                                                }
                                                            }}
                                                            className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-white/50 hover:text-white transition-colors"
                                                            title="Tạo lại SKU"
                                                        >
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                                            </svg>
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}

                                    {formData.sizes.length === 0 && (
                                        <div className="text-center py-8 bg-white/5 rounded-xl border border-dashed border-white/10">
                                            <p className="text-white/40 mb-3 block">Chưa có size nào</p>
                                            <button
                                                type="button"
                                                onClick={addSize}
                                                className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white text-sm font-medium transition-colors"
                                            >
                                                + Thêm size đầu tiên
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </motion.div>

                    {/* Images Section - Keeping existing logic but improving UI if needed, for now just keeping it standard */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="bg-[#1D1D1F] rounded-2xl border border-white/10 p-6 space-y-5"
                    >
                        <h2 className="text-lg font-semibold text-white">Hình ảnh chung</h2>
                        {/* Existing Image Grid Code - Implicitly retained or updated if I want to match New Product exactly. I will reuse the existing block for now to minimize diff risk, but the content replacement should cover it. */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {formData.images.map((img, index) => (
                                <div key={index} className="aspect-square rounded-xl relative group overflow-hidden bg-white/5">
                                    <img
                                        src={img.url}
                                        alt=""
                                        className="w-full h-full object-cover"
                                        loading="lazy"
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).src = '/placeholder.svg';
                                        }}
                                    />
                                    {index === 0 && (
                                        <span className="absolute bottom-2 left-2 text-xs bg-white text-black px-2 py-0.5 rounded">Chính</span>
                                    )}
                                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {index !== 0 && (
                                            <button
                                                type="button"
                                                onClick={() => setMainImage(index)}
                                                className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center"
                                                title="Đặt làm ảnh chính"
                                            >
                                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                                </svg>
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => removeImage(index)}
                                            className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center"
                                        >
                                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            ))}

                            <label className="aspect-square rounded-xl border-2 border-dashed border-white/20 flex flex-col items-center justify-center cursor-pointer hover:border-white/40 transition-colors bg-white/5 hover:bg-white/10">
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    onChange={handleImageUpload}
                                    className="hidden"
                                />
                                {uploadingImage ? (
                                    <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <svg className="w-8 h-8 text-white/30 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                                        </svg>
                                        <span className="text-white/50 text-sm">Thêm ảnh</span>
                                    </>
                                )}
                            </label>
                        </div>
                    </motion.div>
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    {/* Actions */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.15 }}
                        className="bg-[#1D1D1F] rounded-2xl border border-white/10 p-6 space-y-3"
                    >
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="w-full py-3 rounded-xl bg-white text-black font-medium hover:bg-white/90 disabled:opacity-50 shadow-lg shadow-white/10"
                        >
                            {isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
                        </button>
                        <button
                            type="button"
                            onClick={() => router.push(`${adminRoot}/products`)}
                            className="w-full py-3 rounded-xl border border-white/10 bg-white/5 text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                        >
                            Hủy
                        </button>
                    </motion.div>

                    {/* Summary */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="bg-[#1D1D1F] rounded-2xl border border-white/10 p-6"
                    >
                        <h2 className="text-lg font-semibold text-white mb-4">Tóm tắt</h2>

                        {/* Status Toggle */}
                        <div className="mb-6 p-4 rounded-xl bg-white/5 border border-white/5">
                            <div className="flex items-center justify-between">
                                <span className={formData.status === 'active' ? "text-green-400 font-medium" : "text-white/50"}>
                                    {formData.status === 'active' ? 'Đang bán' : 'Bản nháp/Ẩn'}
                                </span>
                                <Switch
                                    checked={formData.status === 'active'}
                                    onCheckedChange={(checked) => setFormData({ ...formData, status: checked ? 'active' : 'draft' })}
                                />
                            </div>
                        </div>

                        <div className="space-y-3 text-sm">
                            <div className="flex justify-between py-2 border-b border-white/5">
                                <span className="text-white/50">Ảnh:</span>
                                <span className="text-white font-medium">{formData.images.length}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-white/5">
                                <span className="text-white/50">Loại giá:</span>
                                <span className="text-white font-medium">{pricingMode === 'original' ? 'Giá đơn' : 'Đa dạng size'}</span>
                            </div>
                            {pricingMode === 'original' ? (
                                <>
                                    <div className="flex justify-between py-2 border-b border-white/5">
                                        <span className="text-white/50">Giá bán:</span>
                                        <span className="text-white font-medium">
                                            {formData.basePrice ? parseInt(formData.basePrice).toLocaleString('vi-VN') + 'đ' : '-'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between py-2">
                                        <span className="text-white/50">Tồn kho:</span>
                                        <span className="text-white font-medium">{formData.stock || 0}</span>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="flex justify-between py-2 border-b border-white/5">
                                        <span className="text-white/50">Số lượng size:</span>
                                        <span className="text-white font-medium">{formData.sizes.length}</span>
                                    </div>
                                    <div className="flex justify-between py-2 border-b border-white/5">
                                        <span className="text-white/50">Tổng tồn kho:</span>
                                        <span className="text-white font-medium">
                                            {formData.sizes.reduce((acc, curr) => acc + (parseInt(curr.stock) || 0), 0)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between py-2">
                                        <span className="text-white/50">Khoảng giá:</span>
                                        <span className="text-white font-medium">
                                            {formData.sizes.length > 0
                                                ? `${Math.min(...formData.sizes.map(s => parseInt(s.price) || 0)).toLocaleString('vi-VN')}đ - ${Math.max(...formData.sizes.map(s => parseInt(s.price) || 0)).toLocaleString('vi-VN')}đ`
                                                : '-'
                                            }
                                        </span>
                                    </div>
                                </>
                            )}
                        </div>
                    </motion.div>

                    {/* Buyers Section */}
                    {buyers.length > 0 && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            className="bg-[#1D1D1F] rounded-2xl border border-white/10 p-6"
                        >
                            <div className="flex items-center gap-2 mb-4">
                                <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                <h2 className="text-lg font-semibold text-white">Khách đã mua ({buyers.length})</h2>
                            </div>
                            <div className="space-y-3">
                                {buyers.map((buyer, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center text-white text-sm font-bold">
                                                {buyer.name[0].toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="text-white text-sm font-medium">{buyer.name}</p>
                                                <p className="text-white/50 text-xs">{buyer.order_code}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-white text-sm">×{buyer.quantity}</p>
                                            <p className="text-white/50 text-xs">
                                                {new Date(buyer.purchased_at).toLocaleDateString('vi-VN')}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </div>
            </form>
        </div>
    );
}
