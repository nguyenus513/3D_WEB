'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { AnimatedSection } from '@/components/ui/Animations';
import { Button } from '@/components/ui/Button';
import { generateId } from '@/lib/generateId';
import { AddressSelector, ShippingAddress } from '@/components/checkout/AddressSelector';
import { User, Users, UsersRound, Upload, Gift, UtensilsCrossed, Package, Camera, Palette, Glasses, ImagePlus, PenLine, X, Layers, Columns2, Ruler } from 'lucide-react';
import { useCart } from '@/lib/store/cart';

// ============================================================
// TYPES
// ============================================================

type OrderType = 'single' | 'couple' | 'group';
type SizeType = 'S' | 'M' | 'L';
type BaseType = 'single_base' | 'couple_base' | 'separate_base' | 'group_base';
type PackagingType = 'premium_box' | 'bento' | 'standard';

interface CharacterData {
    image: File | null;
    imagePreview: string;
    hasGlasses: boolean;
    glassesMode: 'upload' | 'text';
    glassesImage: File | null;
    glassesDescription: string;
    hasHat: boolean;
    hatMode: 'upload' | 'text';
    hatImage: File | null;
    hatDescription: string;
}

interface FileInfo {
    id: string;
    name: string;
    url: string;
    thumbnail: string;
}

// ============================================================
// CONSTANTS
// ============================================================

const ORDER_TYPE_CONFIG = [
    {
        id: 'single' as OrderType,
        name: 'Single',
        desc: '1 mô hình',
        price: 350000,
        count: 1,
        icon: <User size={40} strokeWidth={1.5} />,
    },
    {
        id: 'couple' as OrderType,
        name: 'Couple',
        desc: '2 mô hình',
        price: 550000,
        count: 2,
        icon: <Users size={40} strokeWidth={1.5} />,
    },
    {
        id: 'group' as OrderType,
        name: 'Group',
        desc: '3+ mô hình',
        price: 750000,
        count: 3,
        icon: <UsersRound size={40} strokeWidth={1.5} />,
    },
];

const SIZE_OPTIONS: { id: SizeType; name: string; desc: string; height: string }[] = [
    { id: 'S', name: 'Size S', desc: 'Nhỏ xinh', height: '60mm' },
    { id: 'M', name: 'Size M', desc: 'Tiêu chuẩn', height: '80mm' },
    { id: 'L', name: 'Size L', desc: 'Lớn, chi tiết', height: '100mm' },
];

const PACKAGING_OPTIONS: { id: PackagingType; name: string; desc: string; icon: React.ReactNode }[] = [
    { id: 'premium_box', name: 'Box Cao Cấp', desc: 'Hộp cứng thiết kế riêng, lót nhung', icon: <Gift size={40} strokeWidth={1.5} /> },
    { id: 'bento', name: 'Bento Style', desc: 'Hộp bento phong cách Nhật Bản', icon: <UtensilsCrossed size={40} strokeWidth={1.5} /> },
    { id: 'standard', name: 'Bình Thường', desc: 'Đóng gói tiêu chuẩn, an toàn', icon: <Package size={40} strokeWidth={1.5} /> },
];

const BASE_OPTIONS: { id: BaseType; name: string; desc: string }[] = [
    { id: 'couple_base', name: 'Đế đôi', desc: '1 khối chung cho 2 mô hình' },
    { id: 'separate_base', name: '2 đế riêng', desc: 'Mỗi mô hình 1 đế riêng biệt' },
];

function FashionHatIcon({ size = 24, strokeWidth = 1.5, className }: { size?: number | string; strokeWidth?: number | string; className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <path d="M6 16V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v10" />
            <path d="M2 16h20" />
        </svg>
    );
}

function createEmptyCharacter(): CharacterData {
    return {
        image: null,
        imagePreview: '',
        hasGlasses: false,
        glassesMode: 'text',
        glassesImage: null,
        glassesDescription: '',
        hasHat: false,
        hatMode: 'text',
        hatImage: null,
        hatDescription: '',
    };
}

// ============================================================
// STEP PHASES
// ============================================================

type StepPhase =
    | { type: 'order_type' }
    | { type: 'character'; index: number }
    | { type: 'base' }
    | { type: 'packaging' }
    | { type: 'confirm' };

function computeSteps(orderType: OrderType, characterCount: number): StepPhase[] {
    const steps: StepPhase[] = [{ type: 'order_type' }];

    for (let i = 0; i < characterCount; i++) {
        steps.push({ type: 'character', index: i });
    }

    // Base step: only for Couple
    if (orderType === 'couple') {
        steps.push({ type: 'base' });
    }

    steps.push({ type: 'packaging' });
    steps.push({ type: 'confirm' });

    return steps;
}

function getStepLabel(step: StepPhase, characterCount: number): string {
    switch (step.type) {
        case 'order_type': return 'Loại đơn';
        case 'character': return characterCount === 1 ? 'Mô hình' : `MH ${step.index + 1}`;
        case 'base': return 'Đế';
        case 'packaging': return 'Đóng gói';
        case 'confirm': return 'Xác nhận';
    }
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function CustomPage() {
    const router = useRouter();
    const { data: session, status } = useSession();
    const { addItem } = useCart();

    // Auth state
    const [user, setUser] = useState<{ id: string; email: string } | null>(null);
    const [customerCode, setCustomerCode] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    // Wizard state
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [orderType, setOrderType] = useState<OrderType>('single');
    const [size, setSize] = useState<SizeType>('M');
    const [groupCount, setGroupCount] = useState(3);
    const [characters, setCharacters] = useState<CharacterData[]>([createEmptyCharacter()]);
    const [baseType, setBaseType] = useState<BaseType>('couple_base');
    const [packaging, setPackaging] = useState<PackagingType>('premium_box');
    const [notes, setNotes] = useState('');
    const [shippingAddress, setShippingAddress] = useState<ShippingAddress | null>(null);

    // Computed
    const characterCount = orderType === 'single' ? 1 : orderType === 'couple' ? 2 : groupCount;
    const steps = useMemo(() => computeSteps(orderType, characterCount), [orderType, characterCount]);
    const currentPhase = steps[currentStepIndex] || steps[0];

    const basePrice = ORDER_TYPE_CONFIG.find(t => t.id === orderType)?.price || 350000;
    const totalPrice = orderType === 'group' ? Math.round(basePrice + (characterCount - 3) * 200000) : basePrice;
    const depositAmount = Math.round(totalPrice * 0.5);

    // Sync characters array with characterCount
    useEffect(() => {
        setCharacters(prev => {
            if (prev.length === characterCount) return prev;
            if (prev.length < characterCount) {
                return [...prev, ...Array(characterCount - prev.length).fill(null).map(() => createEmptyCharacter())];
            }
            // Shrinking: revoke blob URLs of removed characters
            for (let i = characterCount; i < prev.length; i++) {
                if (prev[i].imagePreview) URL.revokeObjectURL(prev[i].imagePreview);
            }
            return prev.slice(0, characterCount);
        });
    }, [characterCount]);

    // Clamp step index when steps change
    useEffect(() => {
        if (currentStepIndex >= steps.length) {
            setCurrentStepIndex(steps.length - 1);
        }
    }, [steps, currentStepIndex]);

    // Auth check
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
                    const response = await res.json();
                    const userData = response.data || response;
                    setUser({ id: userData.id, email: session.user.email });
                    setCustomerCode(userData.customer_code || generateId.user());
                }
            } catch (e) {
                console.error('Failed to fetch profile', e);
            }
            setLoading(false);
        };
        fetchUserData();
    }, [status, session, router]);

    // ============================================================
    // HANDLERS
    // ============================================================

    const updateCharacter = useCallback((index: number, updates: Partial<CharacterData>) => {
        setCharacters(prev => prev.map((c, i) => i === index ? { ...c, ...updates } : c));
    }, []);

    const handleCharacterImageUpload = useCallback((index: number, file: File) => {
        const preview = URL.createObjectURL(file);
        setCharacters(prev => prev.map((c, i) => {
            if (i !== index) return c;
            // Revoke old preview
            if (c.imagePreview) URL.revokeObjectURL(c.imagePreview);
            return { ...c, image: file, imagePreview: preview };
        }));
    }, []);

    const removeCharacterImage = useCallback((index: number) => {
        setCharacters(prev => prev.map((c, i) => {
            if (i !== index) return c;
            if (c.imagePreview) URL.revokeObjectURL(c.imagePreview);
            return { ...c, image: null, imagePreview: '' };
        }));
    }, []);

    const handleOrderTypeChange = (newType: OrderType) => {
        setOrderType(newType);
        // Reset step to 0 when type changes
        setCurrentStepIndex(0);
        // Auto-assign base
        if (newType === 'single') setBaseType('single_base');
        else if (newType === 'group') setBaseType('group_base');
        else setBaseType('couple_base');
    };

    const nextStep = () => {
        setError('');
        // Validation
        if (currentPhase.type === 'character') {
            const char = characters[currentPhase.index];
            if (!char?.image) {
                setError('Vui lòng upload ảnh mô hình trước khi tiếp tục');
                return;
            }
        }
        setCurrentStepIndex(prev => Math.min(prev + 1, steps.length - 1));
    };

    const prevStep = () => {
        setError('');
        setCurrentStepIndex(prev => Math.max(prev - 1, 0));
    };

    // Upload all images
    const uploadAllImages = async (orderCode: string): Promise<FileInfo[]> => {
        const uploaded: FileInfo[] = [];

        for (let i = 0; i < characters.length; i++) {
            const char = characters[i];
            if (!char.image) continue;

            const formData = new FormData();
            formData.append('file', char.image);
            formData.append('type', `custom_${orderType}`);
            formData.append('customerCode', customerCode);
            formData.append('orderCode', orderCode);
            formData.append('index', String(i + 1));
            formData.append('customType', orderType);
            formData.append('personCount', String(characterCount));
            formData.append('photoCategory', 'main');

            const res = await fetch('/api/upload', { method: 'POST', body: formData });
            const data = await res.json();

            if (!res.ok || data.success === false) {
                const errorMsg = data.error?.message || data.error || 'Upload failed';
                throw new Error(typeof errorMsg === 'object' ? JSON.stringify(errorMsg) : errorMsg);
            }

            const fileData = data.data?.file || data.file;
            if (!fileData) throw new Error('Invalid upload response');
            uploaded.push(fileData);

            // Upload glasses image if exists
            if (char.hasGlasses && char.glassesMode === 'upload' && char.glassesImage) {
                const gFormData = new FormData();
                gFormData.append('file', char.glassesImage);
                gFormData.append('type', `custom_${orderType}`);
                gFormData.append('customerCode', customerCode);
                gFormData.append('orderCode', orderCode);
                gFormData.append('index', String(i + 1));
                gFormData.append('photoCategory', 'glasses');

                const gRes = await fetch('/api/upload', { method: 'POST', body: gFormData });
                const gData = await gRes.json();
                if (gRes.ok && gData.success !== false) {
                    const gFile = gData.data?.file || gData.file;
                    if (gFile) uploaded.push(gFile);
                }
            }

            // Upload hat image if exists
            if (char.hasHat && char.hatMode === 'upload' && char.hatImage) {
                const hFormData = new FormData();
                hFormData.append('file', char.hatImage);
                hFormData.append('type', `custom_${orderType}`);
                hFormData.append('customerCode', customerCode);
                hFormData.append('orderCode', orderCode);
                hFormData.append('index', String(i + 1));
                hFormData.append('photoCategory', 'hat');

                const hRes = await fetch('/api/upload', { method: 'POST', body: hFormData });
                const hData = await hRes.json();
                if (hRes.ok && hData.success !== false) {
                    const hFile = hData.data?.file || hData.file;
                    if (hFile) uploaded.push(hFile);
                }
            }
        }

        return uploaded;
    };

    const handleSubmit = async () => {
        if (!user) return;

        if (!shippingAddress || !shippingAddress.full_name || !shippingAddress.phone || !shippingAddress.province) {
            setError('Vui lòng nhập đầy đủ thông tin địa chỉ giao hàng');
            return;
        }

        setSubmitting(true);
        setError('');

        try {
            const orderCode = generateId.custom();
            const images = await uploadAllImages(orderCode);

            const res = await fetch('/api/orders/custom', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: orderType,
                    size,
                    notes: notes || '',
                    characterCount,
                    baseType,
                    packaging,
                    characters: characters.map((c, i) => ({
                        index: i + 1,
                        hasGlasses: c.hasGlasses,
                        glassesDescription: c.hasGlasses && c.glassesMode === 'text' ? c.glassesDescription : '',
                        hasHat: c.hasHat,
                        hatDescription: c.hasHat && c.hatMode === 'text' ? c.hatDescription : '',
                    })),
                    shippingAddress: {
                        full_name: shippingAddress.full_name,
                        phone: shippingAddress.phone,
                        address_line: shippingAddress.address_line || '',
                        ward: shippingAddress.ward || '',
                        district: shippingAddress.district || '',
                        province: shippingAddress.province,
                    },
                    images: images.map(img => ({ id: img.id, name: img.name })),
                }),
            });

            const result = await res.json();
            if (!res.ok || !result.success) {
                throw new Error(result.error?.message || 'Không thể tạo đơn hàng');
            }

            sessionStorage.setItem('checkout_order_type', 'custom');
            sessionStorage.setItem('checkout_order_id', result.data.id);
            router.push('/checkout?orderId=' + result.data.id);
        } catch (err) {
            setError((err as Error).message);
            setSubmitting(false);
        }
    };

    const handleAddToCart = () => {
        if (!user) return;

        const missingImage = characters.some(c => !c.image);
        if (missingImage) {
            setError('Vui lòng upload ảnh cho tất cả mô hình');
            return;
        }

        const typeInfo = ORDER_TYPE_CONFIG.find(t => t.id === orderType);

        addItem({
            type: 'custom',
            name: `Custom ${typeInfo?.name || 'Single'} - ${characterCount} mô hình`,
            price: totalPrice,
            quantity: 1,
            description: `${characterCount} mô hình • ${PACKAGING_OPTIONS.find(p => p.id === packaging)?.name}`,
            notes,
            customConfig: {
                orderType,
                size: 'M',
                imageCount: characters.filter(c => c.image).length,
            },
        });

        alert('Đã thêm vào giỏ hàng!');
        router.push('/cart');
    };

    // ============================================================
    // LOADING
    // ============================================================

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

    // ============================================================
    // RENDER
    // ============================================================

    return (
        <div className="min-h-screen bg-[#0a0a0a] pt-28 pb-20">
            <div className="max-w-[900px] mx-auto px-6">
                {/* Header */}
                <AnimatedSection className="text-center mb-10">
                    <span className="text-sm text-white/70 font-medium tracking-widest uppercase mb-4 block">
                        Custom Order
                    </span>
                    <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-4">
                        Tạo Mô Hình Của Bạn
                    </h1>
                    <p className="text-white/50">
                        Upload ảnh → Custom phụ kiện → Chọn đế & đóng gói → Xác nhận
                    </p>
                </AnimatedSection>

                {/* ============ PROGRESS BAR ============ */}
                <ProgressBar
                    steps={steps}
                    currentIndex={currentStepIndex}
                    characterCount={characterCount}
                    onStepClick={(i) => {
                        // Only allow clicking completed steps
                        if (i < currentStepIndex) setCurrentStepIndex(i);
                    }}
                />

                {/* ============ STEP CONTENT ============ */}
                <div className="bg-[#1D1D1F] rounded-3xl p-8 md:p-12 mt-8">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={currentStepIndex}
                            initial={{ opacity: 0, x: 30 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -30 }}
                            transition={{ duration: 0.25 }}
                        >
                            {currentPhase.type === 'order_type' && (
                                <StepOrderType
                                    orderType={orderType}
                                    size={size}
                                    groupCount={groupCount}
                                    onTypeChange={handleOrderTypeChange}
                                    onSizeChange={setSize}
                                    onGroupCountChange={setGroupCount}
                                />
                            )}

                            {currentPhase.type === 'character' && (
                                <StepCharacter
                                    index={currentPhase.index}
                                    total={characterCount}
                                    character={characters[currentPhase.index]}
                                    onImageUpload={(file) => handleCharacterImageUpload(currentPhase.index, file)}
                                    onRemoveImage={() => removeCharacterImage(currentPhase.index)}
                                    onUpdate={(updates) => updateCharacter(currentPhase.index, updates)}
                                />
                            )}

                            {currentPhase.type === 'base' && (
                                <StepBase
                                    baseType={baseType}
                                    onChange={setBaseType}
                                />
                            )}

                            {currentPhase.type === 'packaging' && (
                                <StepPackaging
                                    packaging={packaging}
                                    onChange={setPackaging}
                                />
                            )}

                            {currentPhase.type === 'confirm' && (
                                <StepConfirm
                                    orderType={orderType}
                                    size={size}
                                    characters={characters}
                                    baseType={baseType}
                                    packaging={packaging}
                                    totalPrice={totalPrice}
                                    depositAmount={depositAmount}
                                    notes={notes}
                                    onNotesChange={setNotes}
                                    shippingAddress={shippingAddress}
                                    onAddressChange={setShippingAddress}
                                    userId={user?.id}
                                    submitting={submitting}
                                />
                            )}
                        </motion.div>
                    </AnimatePresence>

                    {/* Error */}
                    {error && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mt-6 bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm"
                        >
                            {error}
                        </motion.div>
                    )}

                    {/* Navigation */}
                    <div className="flex justify-between mt-8 pt-8 border-t border-white/10">
                        <Button
                            variant="outline"
                            onClick={prevStep}
                            disabled={currentStepIndex === 0 || submitting}
                            className={currentStepIndex === 0 ? 'opacity-50' : ''}
                        >
                            ← Quay lại
                        </Button>

                        {currentPhase.type !== 'confirm' ? (
                            <Button variant="primary" onClick={nextStep}>
                                {currentPhase.type === 'character'
                                    ? (currentPhase.index < characterCount - 1
                                        ? `Sang mô hình ${currentPhase.index + 2} →`
                                        : 'Tiếp tục →')
                                    : 'Tiếp tục →'
                                }
                            </Button>
                        ) : (
                            <div className="flex gap-3">
                                <Button
                                    variant="outline"
                                    onClick={handleAddToCart}
                                    disabled={submitting}
                                >
                                    🛒 Thêm vào giỏ
                                </Button>
                                <Button
                                    variant="primary"
                                    onClick={handleSubmit}
                                    disabled={submitting}
                                >
                                    {submitting ? (
                                        <span className="flex items-center gap-2">
                                            <span className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                                            Đang xử lý...
                                        </span>
                                    ) : (
                                        `Đặt hàng — ${depositAmount.toLocaleString('vi-VN')}đ`
                                    )}
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ============================================================
// SUB-COMPONENTS
// ============================================================

function ProgressBar({
    steps,
    currentIndex,
    characterCount,
    onStepClick,
}: {
    steps: StepPhase[];
    currentIndex: number;
    characterCount: number;
    onStepClick: (i: number) => void;
}) {
    return (
        <div className="flex justify-center">
            <div className="flex items-center gap-1 overflow-x-auto pb-2 max-w-full">
                {steps.map((step, i) => {
                    const label = getStepLabel(step, characterCount);
                    const isActive = i === currentIndex;
                    const isCompleted = i < currentIndex;
                    return (
                        <div key={i} className="flex items-center">
                            <button
                                onClick={() => onStepClick(i)}
                                className={`
                                    flex items-center gap-2 px-3 py-2 rounded-full text-xs font-medium transition-all whitespace-nowrap
                                    ${isActive
                                        ? 'bg-white text-black'
                                        : isCompleted
                                            ? 'bg-white/20 text-white cursor-pointer hover:bg-white/30'
                                            : 'bg-[#1D1D1F] text-white/40'
                                    }
                                `}
                            >
                                <span className={`
                                    w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold
                                    ${isActive ? 'bg-black text-white' : isCompleted ? 'bg-white/30 text-white' : 'bg-white/10 text-white/40'}
                                `}>
                                    {isCompleted ? '✓' : i + 1}
                                </span>
                                <span className="hidden sm:inline">{label}</span>
                            </button>
                            {i < steps.length - 1 && (
                                <div className={`w-4 h-px mx-0.5 ${isCompleted ? 'bg-white/40' : 'bg-white/10'}`} />
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ============ STEP 1: ORDER TYPE ============

function StepOrderType({
    orderType,
    size,
    groupCount,
    onTypeChange,
    onSizeChange,
    onGroupCountChange,
}: {
    orderType: OrderType;
    size: SizeType;
    groupCount: number;
    onTypeChange: (t: OrderType) => void;
    onSizeChange: (s: SizeType) => void;
    onGroupCountChange: (n: number) => void;
}) {
    return (
        <div>
            <h2 className="text-2xl font-semibold text-white mb-2">Chọn loại đơn hàng</h2>
            <p className="text-white/50 mb-8">Bạn muốn tạo mô hình cho bao nhiêu người?</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {ORDER_TYPE_CONFIG.map((type) => (
                    <button
                        key={type.id}
                        onClick={() => onTypeChange(type.id)}
                        className={`
                            p-6 rounded-2xl text-left transition-all
                            ${orderType === type.id
                                ? 'bg-white text-black ring-2 ring-white/30 ring-offset-2 ring-offset-[#1D1D1F]'
                                : 'bg-[#2D2D2F] text-white hover:bg-[#3D3D3F]'
                            }
                        `}
                        data-cursor
                    >
                        <div className={`mb-4 flex justify-center ${orderType === type.id ? 'text-black/70' : 'text-white/80'}`}>
                            {type.icon}
                        </div>
                        <h3 className="text-lg font-semibold text-center">{type.name}</h3>
                        <p className="text-sm opacity-70 text-center">{type.desc}</p>
                        <p className="text-lg font-semibold mt-2 text-center">
                            {type.price.toLocaleString('vi-VN')}đ
                        </p>
                    </button>
                ))}
            </div>

            {/* Size Selection */}
            <div className="mt-8">
                <h3 className="text-white/70 text-sm mb-3">Chọn kích thước</h3>
                <div className="grid grid-cols-3 gap-4">
                    {SIZE_OPTIONS.map((opt) => (
                        <button
                            key={opt.id}
                            onClick={() => onSizeChange(opt.id)}
                            className={`
                                p-4 rounded-xl text-center transition-all border
                                ${size === opt.id
                                    ? 'bg-white text-black border-white ring-2 ring-white/30 ring-offset-2 ring-offset-[#1D1D1F]'
                                    : 'bg-[#2D2D2F] text-white border-transparent hover:bg-[#3D3D3F]'
                                }
                            `}
                        >
                            <div className="flex justify-center mb-2">
                                <Ruler size={24} strokeWidth={1.5} className={size === opt.id ? 'text-black' : 'text-white/50'} />
                            </div>
                            <div className="font-bold text-lg">{opt.id}</div>
                            <div className="text-xs font-mono opacity-60 mt-0.5">{opt.height}</div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Group count input */}
            {orderType === 'group' && (
                <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-8"
                >
                    <div className="bg-[#2D2D2F] rounded-2xl p-6">
                        <label className="text-white/70 text-sm mb-3 block">Số lượng mô hình</label>
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => {
                                    if (groupCount > 3) {
                                        onGroupCountChange(groupCount - 1);
                                    } else {
                                        onTypeChange('couple');
                                    }
                                }}
                                className="w-12 h-12 rounded-xl bg-[#3D3D3F] text-white flex items-center justify-center text-xl hover:bg-[#4D4D4F] transition-colors"
                            >
                                −
                            </button>
                            <span className="text-3xl font-bold text-white w-16 text-center">{groupCount}</span>
                            <button
                                onClick={() => onGroupCountChange(Math.min(10, groupCount + 1))}
                                className="w-12 h-12 rounded-xl bg-[#3D3D3F] text-white flex items-center justify-center text-xl hover:bg-[#4D4D4F] transition-colors"
                            >
                                +
                            </button>
                        </div>
                        <p className="text-white/40 text-sm mt-3">
                            Giá: {(750000 + (groupCount - 3) * 200000).toLocaleString('vi-VN')}đ
                            {groupCount > 3 && <span className="text-white/30"> (+{((groupCount - 3) * 200000).toLocaleString('vi-VN')}đ)</span>}
                        </p>
                    </div>
                </motion.div>
            )}
        </div>
    );
}

// ============ STEP 2..N: CHARACTER ============

function StepCharacter({
    index,
    total,
    character,
    onImageUpload,
    onRemoveImage,
    onUpdate,
}: {
    index: number;
    total: number;
    character: CharacterData;
    onImageUpload: (file: File) => void;
    onRemoveImage: () => void;
    onUpdate: (updates: Partial<CharacterData>) => void;
}) {
    const [dragActive, setDragActive] = useState(false);

    const handleDrag = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
        else if (e.type === 'dragleave') setDragActive(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files?.[0]) {
            onImageUpload(e.dataTransfer.files[0]);
        }
    }, [onImageUpload]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            onImageUpload(e.target.files[0]);
        }
    };

    const inputId = `char-upload-${index}`;

    return (
        <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h2 className="text-2xl font-semibold text-white">
                        Mô hình {index + 1}
                    </h2>
                    {total > 1 && (
                        <p className="text-white/50 mt-1">
                            {index + 1} / {total} mô hình
                        </p>
                    )}
                </div>
                {/* Mini progress dots */}
                {total > 1 && (
                    <div className="flex gap-1.5">
                        {Array.from({ length: total }, (_, i) => (
                            <div
                                key={i}
                                className={`w-2.5 h-2.5 rounded-full transition-all ${i === index ? 'bg-white scale-125' : i < index ? 'bg-white/40' : 'bg-white/15'
                                    }`}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Upload Zone */}
            <div className="mb-8">
                <h3 className="text-white/70 text-sm font-medium mb-3 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center"><Camera size={14} strokeWidth={1.5} /></span>
                    Upload ảnh mô hình
                </h3>

                {!character.image ? (
                    <div
                        onDragEnter={handleDrag}
                        onDragLeave={handleDrag}
                        onDragOver={handleDrag}
                        onDrop={handleDrop}
                        className={`
                            border-2 border-dashed rounded-2xl p-12 text-center transition-all cursor-pointer
                            ${dragActive ? 'border-white/40 bg-white/10' : 'border-white/15 hover:border-white/30'}
                        `}
                    >
                        <input
                            type="file"
                            accept="image/*"
                            onChange={handleFileChange}
                            className="hidden"
                            id={inputId}
                        />
                        <label htmlFor={inputId} className="cursor-pointer">
                            <div className="mb-4 flex justify-center text-white/50">
                                <Upload size={56} strokeWidth={1.5} />
                            </div>
                            <p className="text-white font-medium">Kéo thả ảnh vào đây</p>
                            <p className="text-white/40 text-sm mt-2">hoặc click để chọn file • JPG, PNG</p>
                        </label>
                    </div>
                ) : (
                    <div className="flex items-center gap-4 bg-[#2D2D2F] rounded-2xl p-4">
                        <div className="w-24 h-24 rounded-xl overflow-hidden bg-[#3D3D3F] flex-shrink-0">
                            <img
                                src={character.imagePreview}
                                alt={`Mô hình ${index + 1}`}
                                className="w-full h-full object-cover"
                            />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-white font-medium truncate">{character.image.name}</p>
                            <p className="text-white/40 text-sm mt-1">
                                {(character.image.size / 1024 / 1024).toFixed(1)} MB
                            </p>
                        </div>
                        <button
                            onClick={onRemoveImage}
                            className="w-10 h-10 rounded-xl bg-red-500/10 text-red-400 flex items-center justify-center hover:bg-red-500/20 transition-colors flex-shrink-0"
                        >
                            <X size={18} strokeWidth={2} />
                        </button>
                    </div>
                )}
            </div>

            {/* Accessories - only show after image uploaded */}
            {character.image && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                >
                    <h3 className="text-white/70 text-sm font-medium mb-4 flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center"><Palette size={14} strokeWidth={1.5} /></span>
                        Tùy chọn phụ kiện
                    </h3>

                    <div className="space-y-4">
                        {/* Glasses */}
                        <AccessoryOption
                            label="Thêm kính"
                            icon={<Glasses size={20} strokeWidth={1.5} />}
                            enabled={character.hasGlasses}
                            mode={character.glassesMode}
                            image={character.glassesImage}
                            description={character.glassesDescription}
                            onToggle={(v) => onUpdate({ hasGlasses: v })}
                            onModeChange={(m) => onUpdate({ glassesMode: m })}
                            onImageChange={(f) => onUpdate({ glassesImage: f })}
                            onDescriptionChange={(d) => onUpdate({ glassesDescription: d })}
                            uploadId={`glasses-${index}`}
                        />

                        {/* Hat */}
                        <AccessoryOption
                            label="Thêm mũ"
                            icon={<FashionHatIcon size={20} strokeWidth={1.5} />}
                            enabled={character.hasHat}
                            mode={character.hatMode}
                            image={character.hatImage}
                            description={character.hatDescription}
                            onToggle={(v) => onUpdate({ hasHat: v })}
                            onModeChange={(m) => onUpdate({ hatMode: m })}
                            onImageChange={(f) => onUpdate({ hatImage: f })}
                            onDescriptionChange={(d) => onUpdate({ hatDescription: d })}
                            uploadId={`hat-${index}`}
                        />
                    </div>
                </motion.div>
            )}
        </div>
    );
}

// ============ ACCESSORY OPTION ============

function AccessoryOption({
    label,
    icon,
    enabled,
    mode,
    image,
    description,
    onToggle,
    onModeChange,
    onImageChange,
    onDescriptionChange,
    uploadId,
}: {
    label: string;
    icon: React.ReactNode;
    enabled: boolean;
    mode: 'upload' | 'text';
    image: File | null;
    description: string;
    onToggle: (v: boolean) => void;
    onModeChange: (m: 'upload' | 'text') => void;
    onImageChange: (f: File | null) => void;
    onDescriptionChange: (d: string) => void;
    uploadId: string;
}) {
    return (
        <div className={`rounded-2xl border transition-all ${enabled ? 'bg-[#2D2D2F] border-white/20' : 'bg-[#2D2D2F]/50 border-white/5'
            }`}>
            {/* Toggle header */}
            <button
                onClick={() => onToggle(!enabled)}
                className="w-full flex items-center gap-3 p-4"
            >
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${enabled ? 'bg-white border-white' : 'border-white/30'
                    }`}>
                    {enabled && <span className="text-black text-xs font-bold">✓</span>}
                </div>
                <span className="text-white/70">{icon}</span>
                <span className="text-white font-medium">{label}</span>
            </button>

            {/* Expanded content */}
            {enabled && (
                <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="px-4 pb-4"
                >
                    {/* Mode toggle */}
                    <div className="flex gap-2 mb-3">
                        <button
                            onClick={() => onModeChange('upload')}
                            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${mode === 'upload'
                                ? 'bg-white/15 text-white'
                                : 'bg-transparent text-white/50 hover:text-white/70'
                                }`}
                        >
                            <ImagePlus size={14} strokeWidth={1.5} className="inline mr-1" /> Upload ảnh
                        </button>
                        <button
                            onClick={() => onModeChange('text')}
                            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${mode === 'text'
                                ? 'bg-white/15 text-white'
                                : 'bg-transparent text-white/50 hover:text-white/70'
                                }`}
                        >
                            <PenLine size={14} strokeWidth={1.5} className="inline mr-1" /> Mô tả text
                        </button>
                    </div>

                    {mode === 'upload' ? (
                        <div>
                            <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => e.target.files?.[0] && onImageChange(e.target.files[0])}
                                className="hidden"
                                id={uploadId}
                            />
                            {image ? (
                                <div className="flex items-center gap-3 bg-[#3D3D3F] rounded-xl p-3">
                                    <span className="text-white/70 text-sm truncate flex-1">{image.name}</span>
                                    <button
                                        onClick={() => onImageChange(null)}
                                        className="text-red-400 text-sm hover:text-red-300"
                                    >
                                        Xóa
                                    </button>
                                </div>
                            ) : (
                                <label
                                    htmlFor={uploadId}
                                    className="block text-center py-4 border border-dashed border-white/15 rounded-xl text-white/40 text-sm cursor-pointer hover:border-white/30 transition-colors"
                                >
                                    Click để chọn ảnh {label.toLowerCase()}
                                </label>
                            )}
                        </div>
                    ) : (
                        <textarea
                            value={description}
                            onChange={(e) => onDescriptionChange(e.target.value)}
                            placeholder={`Mô tả ${label.toLowerCase()} bạn muốn...`}
                            className="w-full p-3 bg-[#3D3D3F] rounded-xl text-white text-sm placeholder:text-white/30 resize-none focus:outline-none focus:ring-1 focus:ring-white/20"
                            rows={2}
                        />
                    )}
                </motion.div>
            )}
        </div>
    );
}

// ============ STEP: BASE ============

function StepBase({
    baseType,
    onChange,
}: {
    baseType: BaseType;
    onChange: (t: BaseType) => void;
}) {
    return (
        <div>
            <h2 className="text-2xl font-semibold text-white mb-2">Chọn loại đế</h2>
            <p className="text-white/50 mb-8">Đế đôi hoặc 2 đế riêng cho mỗi mô hình</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {BASE_OPTIONS.map((opt) => (
                    <button
                        key={opt.id}
                        onClick={() => onChange(opt.id)}
                        className={`
                            p-8 rounded-2xl text-center transition-all
                            ${baseType === opt.id
                                ? 'bg-white text-black ring-2 ring-white/30 ring-offset-2 ring-offset-[#1D1D1F]'
                                : 'bg-[#2D2D2F] text-white hover:bg-[#3D3D3F]'
                            }
                        `}
                        data-cursor
                    >
                        <div className="flex justify-center mb-3">{opt.id === 'couple_base' ? <Layers size={36} strokeWidth={1.5} /> : <Columns2 size={36} strokeWidth={1.5} />}</div>
                        <h3 className="text-lg font-semibold">{opt.name}</h3>
                        <p className="text-sm opacity-60 mt-1">{opt.desc}</p>
                    </button>
                ))}
            </div>
        </div>
    );
}

// ============ STEP: PACKAGING ============

function StepPackaging({
    packaging,
    onChange,
}: {
    packaging: PackagingType;
    onChange: (t: PackagingType) => void;
}) {
    return (
        <div>
            <h2 className="text-2xl font-semibold text-white mb-2">Chọn đóng gói</h2>
            <p className="text-white/50 mb-8">Lựa chọn cách đóng gói phù hợp</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {PACKAGING_OPTIONS.map((opt) => (
                    <button
                        key={opt.id}
                        onClick={() => onChange(opt.id)}
                        className={`
                            p-6 rounded-2xl text-center transition-all
                            ${packaging === opt.id
                                ? 'bg-white text-black ring-2 ring-white/30 ring-offset-2 ring-offset-[#1D1D1F]'
                                : 'bg-[#2D2D2F] text-white hover:bg-[#3D3D3F]'
                            }
                        `}
                        data-cursor
                    >
                        <div className="flex justify-center mb-3">{opt.icon}</div>
                        <h3 className="text-lg font-semibold">{opt.name}</h3>
                        <p className="text-sm opacity-60 mt-1">{opt.desc}</p>
                    </button>
                ))}
            </div>
        </div>
    );
}

// ============ STEP: CONFIRM ============

function StepConfirm({
    orderType,
    size,
    characters,
    baseType,
    packaging,
    totalPrice,
    depositAmount,
    notes,
    onNotesChange,
    shippingAddress,
    onAddressChange,
    userId,
    submitting,
}: {
    orderType: OrderType;
    size: SizeType;
    characters: CharacterData[];
    baseType: BaseType;
    packaging: PackagingType;
    totalPrice: number;
    depositAmount: number;
    notes: string;
    onNotesChange: (v: string) => void;
    shippingAddress: ShippingAddress | null;
    onAddressChange: (v: ShippingAddress) => void;
    userId?: string;
    submitting: boolean;
}) {
    const baseLabel = baseType === 'couple_base' ? 'Đế đôi' : baseType === 'separate_base' ? '2 đế riêng' : baseType === 'group_base' ? 'Đế nhóm' : 'Đế đơn';
    const packagingLabel = PACKAGING_OPTIONS.find(p => p.id === packaging)?.name || packaging;
    const orderConfig = ORDER_TYPE_CONFIG.find((t) => t.id === orderType);
    const sizeConfig = SIZE_OPTIONS.find((s) => s.id === size);

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-semibold text-white mb-2">Xác nhận đơn hàng</h2>

            {/* Combined Summary */}
            <div className="bg-[#2D2D2F] rounded-2xl p-6">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h3 className="text-xl font-bold text-white">
                            {orderConfig?.name}
                            <span className="text-white/50 font-normal ml-2">x{characters.length}</span>
                        </h3>
                        <p className="text-white/50 text-sm mt-1">
                            {orderConfig?.desc} • {sizeConfig?.name} ({sizeConfig?.height})
                        </p>
                    </div>
                    <div className="text-right">
                        <p className="text-xl font-bold text-white">
                            {totalPrice.toLocaleString('vi-VN')}đ
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm border-t border-white/10 pt-4">
                    <div>
                        <span className="block text-white/40 mb-1">Loại đế</span>
                        <span className="text-white font-medium">{baseLabel}</span>
                    </div>
                    <div>
                        <span className="block text-white/40 mb-1">Đóng gói</span>
                        <span className="text-white font-medium">{packagingLabel}</span>
                    </div>
                </div>
            </div>

            {/* Characters review */}
            <div className="bg-[#2D2D2F] rounded-2xl p-6">
                <h3 className="text-white font-medium mb-4">Mô hình ({characters.length})</h3>
                <div className="space-y-3">
                    {characters.map((char, i) => (
                        <div key={i} className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-xl overflow-hidden bg-[#3D3D3F] flex-shrink-0">
                                {char.imagePreview ? (
                                    <img src={char.imagePreview} alt={`NV ${i + 1}`} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-white/20">?</div>
                                )}
                            </div>
                            <div className="flex-1">
                                <p className="text-white font-medium">Mô hình {i + 1}</p>
                                <div className="flex gap-3 mt-1">
                                    <span className={`text-xs ${char.image ? 'text-green-400' : 'text-red-400'}`}>
                                        {char.image ? '✓ Ảnh' : '✗ Ảnh'}
                                    </span>
                                    <span className={`text-xs ${char.hasGlasses ? 'text-green-400' : 'text-white/30'}`}>
                                        {char.hasGlasses ? '+ Kính' : '- Kính'}
                                    </span>
                                    <span className={`text-xs ${char.hasHat ? 'text-green-400' : 'text-white/30'}`}>
                                        {char.hasHat ? '+ Mũ' : '- Mũ'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Price Breakdown */}
            <div className="bg-[#2D2D2F] rounded-2xl p-6">
                <h3 className="text-white font-medium mb-4">Chi phí</h3>
                <div className="space-y-3">
                    <div className="flex justify-between text-white/70">
                        <span>Giá cơ bản ({orderConfig?.name})</span>
                        <span>{orderConfig?.price.toLocaleString('vi-VN')}đ</span>
                    </div>
                    {/* Add-on costs logic here if needed */}
                    <div className="flex justify-between items-center text-white pt-3 border-t border-white/10">
                        <span className="text-white font-medium">Tổng cộng</span>
                        <span className="text-white font-bold text-lg">{totalPrice.toLocaleString('vi-VN')}đ</span>
                    </div>
                    <div className="flex justify-between text-green-400">
                        <span>Cọc 50%</span>
                        <span className="font-bold">{depositAmount.toLocaleString('vi-VN')}đ</span>
                    </div>
                    <p className="text-white/40 text-xs mt-1">
                        Còn lại {(totalPrice - depositAmount).toLocaleString('vi-VN')}đ khi nhận hàng
                    </p>
                </div>
            </div>

            {/* Notes */}
            <div className="bg-[#2D2D2F] rounded-2xl p-6">
                <h3 className="text-white font-medium mb-3">📝 Ghi chú (tùy chọn)</h3>
                <textarea
                    value={notes}
                    onChange={(e) => onNotesChange(e.target.value)}
                    placeholder="Mô tả chi tiết yêu cầu thêm..."
                    className="w-full p-3 bg-[#3D3D3F] rounded-xl text-white text-sm placeholder:text-white/30 resize-none focus:outline-none focus:ring-1 focus:ring-white/20"
                    rows={3}
                    disabled={submitting}
                />
            </div>

            {/* Address */}
            <div className="bg-[#2D2D2F] rounded-2xl p-6">
                <h3 className="text-white font-medium mb-4">📍 Địa chỉ giao hàng</h3>
                <AddressSelector
                    userId={userId}
                    value={shippingAddress}
                    onChange={onAddressChange}
                    disabled={submitting}
                />
            </div>
        </div>
    );
}
