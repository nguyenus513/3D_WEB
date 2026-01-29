'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { getSupabase } from '@/lib/supabase/client';
import { useAdminPath } from '@/hooks/useAdminPath';
import type { Product } from '@/types/database';

type PricingMode = 'original' | 'multi_size';

interface SizeVariant {
    name: string;
    price: string;
    stock: string;
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
        const hasSizes = product.sizes && product.sizes.length > 0;

        setPricingMode(hasSizes ? 'multi_size' : 'original');
        setFormData({
            name: product.name,
            sku: product.sku,
            status: product.status,
            basePrice: String(product.base_price),
            stock: String(product.stock),
            images: product.images || [],
            sizes: (product.sizes || []).map(s => ({
                name: s.name,
                price: String(s.price),
                stock: String(s.stock),
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
                status: formData.status,
                base_price: pricingMode === 'original' ? parseInt(formData.basePrice) || 0 : 0,
                sale_price: null,
                stock: pricingMode === 'original' ? parseInt(formData.stock) || 0 : 0,
                images: formData.images.map((img, i) => ({ url: img.url, is_main: i === 0 })),
                sizes: pricingMode === 'multi_size' ? formData.sizes.map(s => ({
                    name: s.name,
                    price: parseInt(s.price) || 0,
                    stock: parseInt(s.stock) || 0,
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

                if (result.success) {
                    setFormData(prev => ({
                        ...prev,
                        images: [...prev.images, { url: result.file.url }]
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
        setFormData(prev => ({
            ...prev,
            sizes: [...prev.sizes, { name: '', price: '', stock: '0' }]
        }));
    };

    const updateSize = (index: number, field: keyof SizeVariant, value: string) => {
        const newSizes = [...formData.sizes];
        newSizes[index][field] = value;
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
                    <select
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                        className="px-4 py-2 bg-[#1D1D1F] border border-white/10 rounded-xl text-white"
                    >
                        <option value="draft">Nháp</option>
                        <option value="active">Đang bán</option>
                        <option value="archived">Lưu trữ</option>
                    </select>
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

                                <div className="space-y-3">
                                    {formData.sizes.map((size, index) => (
                                        <div key={index} className="flex items-center gap-3 p-3 rounded-xl bg-white/5">
                                            <input
                                                type="text"
                                                value={size.name}
                                                onChange={(e) => updateSize(index, 'name', e.target.value)}
                                                placeholder="Tên size (S, M, L...)"
                                                className="flex-1 px-4 py-2 bg-[#0a0a0a] border border-white/20 rounded-xl text-white placeholder:text-white/40"
                                            />
                                            <input
                                                type="number"
                                                value={size.price}
                                                onChange={(e) => updateSize(index, 'price', e.target.value)}
                                                placeholder="Giá"
                                                className="w-32 px-4 py-2 bg-[#0a0a0a] border border-white/20 rounded-xl text-white placeholder:text-white/40"
                                            />
                                            <input
                                                type="number"
                                                value={size.stock}
                                                onChange={(e) => updateSize(index, 'stock', e.target.value)}
                                                placeholder="SL"
                                                className="w-20 px-4 py-2 bg-[#0a0a0a] border border-white/20 rounded-xl text-white placeholder:text-white/40"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => removeSize(index)}
                                                className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg"
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        </div>
                                    ))}

                                    {formData.sizes.length === 0 && (
                                        <p className="text-white/40 text-center py-4">Chưa có size. Click &quot;Thêm size&quot; để thêm.</p>
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
                        className="bg-[#1D1D1F] rounded-2xl border border-white/10 p-6 space-y-5"
                    >
                        <h2 className="text-lg font-semibold text-white">Hình ảnh</h2>

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

                            <label className="aspect-square rounded-xl border-2 border-dashed border-white/20 flex flex-col items-center justify-center cursor-pointer hover:border-white/40 transition-colors">
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
                            className="w-full py-3 rounded-xl bg-white text-black font-medium hover:bg-white/90 disabled:opacity-50"
                        >
                            {isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
                        </button>
                        <button
                            type="button"
                            onClick={() => router.push(`${adminRoot}/products`)}
                            className="w-full py-3 rounded-xl border border-white/20 text-white/70 hover:text-white"
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
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-white/50">Ảnh:</span>
                                <span className="text-white">{formData.images.length}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-white/50">Cách tính giá:</span>
                                <span className="text-white">{pricingMode === 'original' ? 'Giá gốc' : 'Nhiều size'}</span>
                            </div>
                            {pricingMode === 'original' ? (
                                <>
                                    <div className="flex justify-between">
                                        <span className="text-white/50">Giá:</span>
                                        <span className="text-white">
                                            {formData.basePrice ? parseInt(formData.basePrice).toLocaleString('vi-VN') + 'đ' : '-'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-white/50">Tồn kho:</span>
                                        <span className="text-white">{formData.stock || 0}</span>
                                    </div>
                                </>
                            ) : (
                                <div className="flex justify-between">
                                    <span className="text-white/50">Số size:</span>
                                    <span className="text-white">{formData.sizes.length}</span>
                                </div>
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
