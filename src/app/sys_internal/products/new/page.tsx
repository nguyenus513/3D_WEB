'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Switch } from '@/components/ui/custom-switch';
import { generateId } from '@/lib/generateId';
import { useAdminPath } from '@/hooks/useAdminPath';

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
}

export default function AdminProductNewPage() {
    const router = useRouter();
    const { adminRoot } = useAdminPath();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');
    const [uploadingImage, setUploadingImage] = useState(false);
    const [pricingMode, setPricingMode] = useState<PricingMode>('original');
    const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
    const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
    const [formData, setFormData] = useState({
        name: '',
        sku: '',
        status: 'draft',
        basePrice: '',
        stock: '0',
        images: [] as FormImage[],
        sizes: [] as SizeVariant[],
    });

    useEffect(() => {
        setFormData(prev => ({ ...prev, sku: generateId.sku() }));
        fetchCategories();
    }, []);

    const fetchCategories = async () => {
        try {
            const response = await fetch('/api/admin/categories');
            const data = await response.json();
            setCategories(data.categories || []);
        } catch (err) {
            console.error('Error fetching categories:', err);
        }
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

    const generateSlug = (name: string) => {
        return name
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/ VND/g, 'd')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
    };

    const getVariantBasePrice = () => {
        const prices = formData.sizes
            .map((size) => parseInt(size.price) || 0)
            .filter((price) => price > 0);
        return prices.length > 0 ? Math.min(...prices) : 0;
    };

    const getVariantStock = () => formData.sizes.reduce((sum, size) => sum + (parseInt(size.stock) || 0), 0);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        setError('');

        try {
            const productData = {
                sku: formData.sku,
                name: formData.name,
                slug: generateSlug(formData.name) + '-' + Date.now(),
                status: formData.status,
                base_price: pricingMode === 'original' ? parseInt(formData.basePrice) || 0 : getVariantBasePrice(),
                sale_price: null,
                stock: pricingMode === 'original' ? parseInt(formData.stock) || 0 : getVariantStock(),
                images: formData.images.map((img, i) => ({ url: img.url, is_main: i === 0 })),
                variants: pricingMode === 'multi_size' ? formData.sizes.map(s => ({
                    name: s.name,
                    price: parseInt(s.price) || 0,
                    stock: parseInt(s.stock) || 0,
                    enabled: true,
                    image_url: s.image_url || null,
                    sku: s.sku,
                })) : [],
                tags: [],
                is_featured: false,
                category_id: selectedCategoryId || null,
            };

            // Use API endpoint instead of direct Supabase
            console.log('[NewProduct] Sending request to /api/admin/products...');
            const res = await fetch('/api/admin/products', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(productData),
            });

            console.log('[NewProduct] Response status:', res.status);
            const data = await res.json();
            console.log('[NewProduct] Response data:', data);

            if (!res.ok) {
                console.error('[NewProduct] Error response:', data);
                setError('Không thể tạo sản phẩm: ' + (data.error?.message || data.error || 'Unknown error'));
                return;
            }

            console.log('[NewProduct] Success! Redirecting to:', `${adminRoot}/products`);
            alert('Tạo sản phẩm thành công!'); // Temporary feedback
            router.push(`${adminRoot}/products`);
        } catch (err) {
            console.error('[NewProduct] Caught exception:', err);
            setError('Đã có lỗi xảy ra: ' + (err as Error).message);
        } finally {
            setIsSaving(false);
        }
    };

    // Image upload
    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setUploadingImage(true);
        let currentIndex = formData.images.length;

        for (const file of Array.from(files)) {
            currentIndex++;
            const formDataUpload = new FormData();
            formDataUpload.append('file', file);
            formDataUpload.append('type', 'product');
            formDataUpload.append('sku', formData.sku || 'PROD-TEMP');
            formDataUpload.append('index', String(currentIndex));

            try {
                const res = await fetch('/api/upload', {
                    method: 'POST',
                    body: formDataUpload,
                });
                const result = await res.json();

                if (result.success && result.data?.file?.url) {
                    setFormData(prev => ({
                        ...prev,
                        images: [...prev.images, { url: result.data.file.url }]
                    }));
                } else {
                    setError('Upload thất bại: ' + (result.error?.message || result.data?.error || 'Không có URL'));
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
            sizes: [...prev.sizes, { name: '', price: '', stock: '0', sku: newSku, image_url: undefined, uploading: false }]
        }));
    };

    const updateSize = (index: number, field: keyof SizeVariant, value: string | boolean | undefined) => {
        setFormData(prev => {
            const newSizes = [...prev.sizes];
            newSizes[index] = { ...newSizes[index], [field]: value };
            return { ...prev, sizes: newSizes };
        });
    };

    const removeSize = (index: number) => {
        setFormData(prev => ({
            ...prev,
            sizes: prev.sizes.filter((_, i) => i !== index)
        }));
    };

    // Upload image for a specific size
    const uploadSizeImage = async (index: number, file: File) => {
        updateSize(index, 'uploading', true);

        const formDataUpload = new FormData();
        formDataUpload.append('file', file);
        formDataUpload.append('type', 'product-size');
        formDataUpload.append('sku', formData.sku || 'PROD-TEMP');
        formDataUpload.append('index', String(formData.images.length + index + 1));

        try {
            const res = await fetch('/api/upload', {
                method: 'POST',
                body: formDataUpload,
            });
            const result = await res.json();

            if (result.success && result.data?.file?.url) {
                updateSize(index, 'image_url', result.data.file.url);
            } else {
                setError('Upload ảnh size thất bại');
            }
        } catch (err) {
            setError('Lỗi upload: ' + (err as Error).message);
        } finally {
            updateSize(index, 'uploading', false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href={`${adminRoot}/products`} className="p-2 rounded-xl hover:bg-[var(--material-glass)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Thêm sản phẩm</h1>
                        <p className="text-[var(--text-secondary)] mt-1">Tạo sản phẩm mới</p>
                    </div>
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
                        className="bg-[var(--material-panel)] rounded-2xl border border-[var(--border-color)] p-6 space-y-5"
                    >
                        <h2 className="text-lg font-semibold text-[var(--text-primary)]">Thông tin cơ bản</h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2">
                                <label className="text-[var(--text-secondary)] text-sm mb-2 block">Tên sản phẩm *</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="VD: Dragon Figure"
                                    className="w-full px-4 py-3 bg-[var(--bg-void)] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-white/30"
                                    required
                                />
                            </div>
                            <div>
                                <label className="text-[var(--text-secondary)] text-sm mb-2 block">SKU</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={formData.sku}
                                        onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                                        className="flex-1 px-4 py-3 bg-[var(--bg-void)] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-white/30"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, sku: generateId.sku() })}
                                        className="px-4 py-3 bg-[var(--material-glass)] rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-sm"
                                    >
                                        Tạo mã
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className="text-[var(--text-secondary)] text-sm mb-2 block">Danh mục</label>
                                <select
                                    value={selectedCategoryId}
                                    onChange={(e) => setSelectedCategoryId(e.target.value)}
                                    className="w-full px-4 py-3 bg-[var(--bg-void)] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-white/30"
                                >
                                    <option value="">-- Chọn danh mục --</option>
                                    {categories.map((cat) => (
                                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </motion.div>

                    {/* Pricing Mode Selection */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.05 }}
                        className="bg-[var(--material-panel)] rounded-2xl border border-[var(--border-color)] p-6 space-y-5"
                    >
                        <h2 className="text-lg font-semibold text-[var(--text-primary)]">Cách tính giá</h2>

                        <div className="grid grid-cols-2 gap-4">
                            <button
                                type="button"
                                onClick={() => handlePricingModeChange('original')}
                                className={`p-4 rounded-xl border-2 text-left transition-all ${pricingMode === 'original'
                                    ? 'border-white bg-[var(--material-glass)]'
                                    : 'border-[var(--border-color)] hover:border-white/30'
                                    }`}
                            >
                                <div className="flex items-center gap-3 mb-2">
                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${pricingMode === 'original' ? 'border-white' : 'border-white/30'
                                        }`}>
                                        {pricingMode === 'original' && (
                                            <div className="w-2.5 h-2.5 rounded-full bg-white" />
                                        )}
                                    </div>
                                    <span className="text-[var(--text-primary)] font-medium">Giá gốc</span>
                                </div>
                                <p className="text-[var(--text-secondary)] text-sm pl-8">Một giá duy nhất cho sản phẩm</p>
                            </button>

                            <button
                                type="button"
                                onClick={() => handlePricingModeChange('multi_size')}
                                className={`p-4 rounded-xl border-2 text-left transition-all ${pricingMode === 'multi_size'
                                    ? 'border-white bg-[var(--material-glass)]'
                                    : 'border-[var(--border-color)] hover:border-white/30'
                                    }`}
                            >
                                <div className="flex items-center gap-3 mb-2">
                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${pricingMode === 'multi_size' ? 'border-white' : 'border-white/30'
                                        }`}>
                                        {pricingMode === 'multi_size' && (
                                            <div className="w-2.5 h-2.5 rounded-full bg-white" />
                                        )}
                                    </div>
                                    <span className="text-[var(--text-primary)] font-medium">Nhiều size</span>
                                </div>
                                <p className="text-[var(--text-secondary)] text-sm pl-8">Giá theo từng size</p>
                            </button>
                        </div>

                        {/* Original pricing */}
                        {pricingMode === 'original' && (
                            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-[var(--border-color)]">
                                <div>
                                    <label className="text-[var(--text-secondary)] text-sm mb-2 block">Giá *</label>
                                    <input
                                        type="number"
                                        value={formData.basePrice}
                                        onChange={(e) => setFormData({ ...formData, basePrice: e.target.value })}
                                        placeholder="350000"
                                        className="w-full px-4 py-3 bg-[var(--bg-void)] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
                                        required={pricingMode === 'original'}
                                    />
                                </div>
                                <div>
                                    <label className="text-[var(--text-secondary)] text-sm mb-2 block">Số lượng tồn kho *</label>
                                    <input
                                        type="number"
                                        value={formData.stock}
                                        onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                                        placeholder="10"
                                        className="w-full px-4 py-3 bg-[var(--bg-void)] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
                                        required={pricingMode === 'original'}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Multi-size pricing */}
                        {pricingMode === 'multi_size' && (
                            <div className="space-y-4 pt-4 border-t border-[var(--border-color)]">
                                <div className="flex items-center justify-between">
                                    <span className="text-[var(--text-secondary)] text-sm">Danh sách size</span>
                                    <button
                                        type="button"
                                        onClick={addSize}
                                        className="px-3 py-1.5 bg-[var(--material-glass)] rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-sm transition-colors"
                                    >
                                        + Thêm size
                                    </button>
                                </div>

                                <div className="space-y-4">
                                    {formData.sizes.map((size, index) => (
                                        <div key={index} className="flex flex-col md:flex-row gap-4 p-4 rounded-xl bg-[var(--material-glass)] border border-[var(--border-color)] hover:border-[var(--border-color)] transition-colors">
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
                                                                    className="p-1.5 bg-red-500/80 hover:bg-red-500 rounded-full text-[var(--text-primary)] transition-colors"
                                                                    title="Xóa ảnh"
                                                                >
                                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                                    </svg>
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <label className="w-full h-full rounded-lg border-2 border-dashed border-[var(--border-color)] hover:border-[var(--color-accent)] hover:bg-[var(--material-glass)] flex flex-col items-center justify-center cursor-pointer transition-all group">
                                                            {size.uploading ? (
                                                                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                            ) : (
                                                                <>
                                                                    <svg className="w-6 h-6 text-[var(--text-tertiary)] group-hover:text-[var(--color-accent)] transition-colors mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                                    </svg>
                                                                    <span className="text-[10px] text-[var(--text-tertiary)] group-hover:text-[var(--text-secondary)] text-center px-1">Upload ảnh</span>
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
                                                        <label className="text-xs text-[var(--text-secondary)] mb-1 block">Tên size</label>
                                                        <input
                                                            type="text"
                                                            value={size.name}
                                                            onChange={(e) => updateSize(index, 'name', e.target.value)}
                                                            placeholder="S, M, L..."
                                                            className="w-full px-3 py-2 bg-[var(--bg-void)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] text-sm focus:border-white/40 focus:outline-none"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-xs text-[var(--text-secondary)] mb-1 block">Giá (VND)</label>
                                                        <input
                                                            type="number"
                                                            value={size.price}
                                                            onChange={(e) => updateSize(index, 'price', e.target.value)}
                                                            placeholder="0"
                                                            className="w-full px-3 py-2 bg-[var(--bg-void)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] text-sm focus:border-white/40 focus:outline-none text-right"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="flex items-end gap-3">
                                                    <div className="flex-1">
                                                        <label className="text-xs text-[var(--text-secondary)] mb-1 block">Tồn kho</label>
                                                        <input
                                                            type="number"
                                                            value={size.stock}
                                                            onChange={(e) => updateSize(index, 'stock', e.target.value)}
                                                            placeholder="0"
                                                            className="w-full px-3 py-2 bg-[var(--bg-void)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] text-sm focus:border-white/40 focus:outline-none"
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
                                                    <label className="text-xs text-[var(--text-secondary)] mb-1 block">SKU Size</label>
                                                    <div className="flex gap-2">
                                                        <input
                                                            type="text"
                                                            value={size.sku || ''}
                                                            readOnly
                                                            className="w-full px-3 py-2 bg-[var(--bg-void)] border border-[var(--border-color)] rounded-lg text-[var(--text-secondary)] text-sm focus:outline-none cursor-default"
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
                                                                    // Retry once if duplicate (rare)
                                                                    updateSize(index, 'sku', generateId.skuVariant(formData.sku));
                                                                }
                                                            }}
                                                            className="p-2 bg-[var(--material-glass)] hover:bg-[var(--material-glass)] rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
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
                                        <div className="text-center py-8 bg-[var(--material-glass)] rounded-xl border border-dashed border-[var(--border-color)]">
                                            <p className="text-[var(--text-tertiary)] mb-3 block">Chưa có size nào</p>
                                            <button
                                                type="button"
                                                onClick={addSize}
                                                className="px-4 py-2 bg-[var(--material-glass)] hover:bg-[var(--material-glass)] rounded-lg text-[var(--text-primary)] text-sm font-medium transition-colors"
                                            >
                                                + Thêm size đầu tiên
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </motion.div>

                    {/* Images */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="bg-[var(--material-panel)] rounded-2xl border border-[var(--border-color)] p-6 space-y-5"
                    >
                        <h2 className="text-lg font-semibold text-[var(--text-primary)]">Hình ảnh chung</h2>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {formData.images.map((img, index) => (
                                <div key={index} className="aspect-square rounded-xl relative group overflow-hidden bg-[var(--material-glass)]">
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
                                                <svg className="w-4 h-4 text-[var(--text-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                                </svg>
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => removeImage(index)}
                                            className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center"
                                        >
                                            <svg className="w-4 h-4 text-[var(--text-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            ))}

                            <label className="aspect-square rounded-xl border-2 border-dashed border-[var(--border-color)] flex flex-col items-center justify-center cursor-pointer hover:border-white/40 transition-colors bg-[var(--material-glass)] hover:bg-[var(--material-glass)]">
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    onChange={handleImageUpload}
                                    className="hidden"
                                />
                                {uploadingImage ? (
                                    <div className="w-8 h-8 border-2 border-[var(--border-color)] border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <svg className="w-8 h-8 text-[var(--text-tertiary)] mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                                        </svg>
                                        <span className="text-[var(--text-secondary)] text-sm">Thêm ảnh</span>
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
                        className="bg-[var(--material-panel)] rounded-2xl border border-[var(--border-color)] p-6 space-y-3"
                    >
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="w-full py-3 rounded-xl bg-white text-black font-medium hover:bg-[var(--material-glass)] disabled:opacity-50 shadow-lg shadow-white/10"
                        >
                            {isSaving ? 'Đang lưu...' : 'Lưu sản phẩm'}
                        </button>
                        <button
                            type="button"
                            onClick={() => router.push(`${adminRoot}/products`)}
                            className="w-full py-3 rounded-xl border border-[var(--border-color)] bg-[var(--material-glass)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--material-glass)] transition-colors"
                        >
                            Hủy
                        </button>
                    </motion.div>

                    {/* Summary */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="bg-[var(--material-panel)] rounded-2xl border border-[var(--border-color)] p-6"
                    >
                        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Tóm tắt</h2>

                        {/* Status Toggle */}
                        <div className="mb-6 p-4 rounded-xl bg-[var(--material-glass)] border border-[var(--border-color)]">
                            <div className="flex items-center justify-between">
                                <span className={formData.status === 'active' ? "text-green-400 font-medium" : "text-[var(--text-secondary)]"}>
                                    {formData.status === 'active' ? 'Đang bán' : 'Bản nháp'}
                                </span>
                                <Switch
                                    checked={formData.status === 'active'}
                                    onCheckedChange={(checked) => setFormData({ ...formData, status: checked ? 'active' : 'draft' })}
                                />
                            </div>
                        </div>

                        <div className="space-y-3 text-sm">
                            <div className="flex justify-between py-2 border-b border-[var(--border-color)]">
                                <span className="text-[var(--text-secondary)]">Ảnh:</span>
                                <span className="text-[var(--text-primary)] font-medium">{formData.images.length}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-[var(--border-color)]">
                                <span className="text-[var(--text-secondary)]">Loại giá:</span>
                                <span className="text-[var(--text-primary)] font-medium">{pricingMode === 'original' ? 'Giá đơn' : 'Đa dạng size'}</span>
                            </div>
                            {pricingMode === 'original' ? (
                                <>
                                    <div className="flex justify-between py-2 border-b border-[var(--border-color)]">
                                        <span className="text-[var(--text-secondary)]">Giá bán:</span>
                                        <span className="text-[var(--text-primary)] font-medium">
                                            {formData.basePrice ? parseInt(formData.basePrice).toLocaleString('vi-VN') + ' VND' : '-'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between py-2">
                                        <span className="text-[var(--text-secondary)]">Tồn kho:</span>
                                        <span className="text-[var(--text-primary)] font-medium">{formData.stock || 0}</span>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="flex justify-between py-2 border-b border-[var(--border-color)]">
                                        <span className="text-[var(--text-secondary)]">Số lượng size:</span>
                                        <span className="text-[var(--text-primary)] font-medium">{formData.sizes.length}</span>
                                    </div>
                                    <div className="flex justify-between py-2 border-b border-[var(--border-color)]">
                                        <span className="text-[var(--text-secondary)]">Tổng tồn kho:</span>
                                        <span className="text-[var(--text-primary)] font-medium">
                                            {formData.sizes.reduce((acc, curr) => acc + (parseInt(curr.stock) || 0), 0)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between py-2">
                                        <span className="text-[var(--text-secondary)]">Khoảng giá:</span>
                                        <span className="text-[var(--text-primary)] font-medium">
                                            {formData.sizes.length > 0
                                                ? `${Math.min(...formData.sizes.map(s => parseInt(s.price) || 0)).toLocaleString('vi-VN')} VND - ${Math.max(...formData.sizes.map(s => parseInt(s.price) || 0)).toLocaleString('vi-VN')} VND`
                                                : '-'
                                            }
                                        </span>
                                    </div>
                                </>
                            )}
                        </div>
                    </motion.div>
                </div>
            </form>
        </div>
    );
}
