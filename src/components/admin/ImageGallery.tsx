'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Filter, Download } from 'lucide-react';

// =============================================================================
// Types
// =============================================================================

export interface OrderImage {
    id: string;
    name: string;
    url: string;
    thumbnail: string | null;
    category: 'main' | 'glasses' | 'hat' | string;
    characterIndex: number;
}

export interface CharacterInfo {
    index: number;
    hasGlasses: boolean;
    glassesDescription?: string;
    hasHat: boolean;
    hatDescription?: string;
}

interface ImageGalleryProps {
    images: OrderImage[];
    characters?: CharacterInfo[];
    onClose: () => void;
}

interface ImageStackProps {
    images: OrderImage[];
    onOpen: () => void;
    maxPreview?: number;
}

// =============================================================================
// Category Labels & Colors
// =============================================================================

const CATEGORY_CONFIG: Record<string, { label: string; icon: string; color: string; bg: string }> = {
    main: { label: 'Ảnh gốc', icon: '🖼', color: 'text-blue-400', bg: 'bg-blue-500/20' },
    glasses: { label: 'Kính', icon: '🕶', color: 'text-amber-400', bg: 'bg-amber-500/20' },
    hat: { label: 'Mũ', icon: '🎩', color: 'text-purple-400', bg: 'bg-purple-500/20' },
};

const getCategoryStyle = (cat: string) =>
    CATEGORY_CONFIG[cat] || { label: cat, icon: '📎', color: 'text-[var(--text-secondary)]', bg: 'bg-[var(--material-glass)]' };

// =============================================================================
// ImageStack — Compact preview for table view
// =============================================================================

export function ImageStack({ images, onOpen, maxPreview = 3 }: ImageStackProps) {
    const preview = images.slice(0, maxPreview);
    const remaining = images.length - maxPreview;

    if (images.length === 0) {
        return (
            <span className="text-[var(--text-tertiary)] text-sm italic">Chưa có ảnh</span>
        );
    }

    return (
        <button
            onClick={onOpen}
            className="flex -space-x-2 items-center group cursor-pointer transition-transform hover:scale-105"
            title={`Xem ${images.length} ảnh`}
        >
            {preview.map((img, i) => (
                <div
                    key={img.id}
                    className="w-10 h-10 rounded-lg border-2 border-[#111] overflow-hidden shadow-lg transition-transform group-hover:translate-x-0.5"
                    style={{ zIndex: 10 - i }}
                >
                    <img
                        src={img.thumbnail || img.url}
                        alt={img.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onError={(e) => {
                            (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIGZpbGw9IiMxYTFhMWEiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iIGZpbGw9IiM1NTUiIGZvbnQtc2l6ZT0iMTIiPj88L3RleHQ+PC9zdmc+';
                        }}
                    />
                </div>
            ))}
            {remaining > 0 && (
                <div
                    className="w-10 h-10 bg-[var(--material-glass)] text-[var(--text-secondary)] text-xs font-medium flex items-center justify-center rounded-lg border-2 border-[#111] shadow-lg"
                    style={{ zIndex: 0 }}
                >
                    +{remaining}
                </div>
            )}
        </button>
    );
}

// =============================================================================
// Lightbox — Full-screen single image view (click from grid)
// =============================================================================

function Lightbox({
    image,
    onClose,
    onPrev,
    onNext,
    hasPrev,
    hasNext,
}: {
    image: OrderImage;
    onClose: () => void;
    onPrev: () => void;
    onNext: () => void;
    hasPrev: boolean;
    hasNext: boolean;
}) {
    const [isZoomed, setIsZoomed] = useState(false);
    const [zoomPos, setZoomPos] = useState({ x: 50, y: 50 });
    const imgRef = useRef<HTMLImageElement>(null);

    const handleMouseMove = useCallback(
        (e: React.MouseEvent<HTMLDivElement>) => {
            if (!isZoomed || !imgRef.current) return;
            const rect = imgRef.current.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * 100;
            const y = ((e.clientY - rect.top) / rect.height) * 100;
            setZoomPos({ x, y });
        },
        [isZoomed],
    );

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (isZoomed) setIsZoomed(false);
                else onClose();
            }
            if (e.key === 'ArrowLeft' && hasPrev) {
                e.preventDefault();
                onPrev();
                setIsZoomed(false);
            }
            if (e.key === 'ArrowRight' && hasNext) {
                e.preventDefault();
                onNext();
                setIsZoomed(false);
            }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [isZoomed, onClose, onPrev, onNext, hasPrev, hasNext]);

    const catStyle = getCategoryStyle(image.category);

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-black/95 z-[60] flex items-center justify-center"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            {/* Top bar */}
            <div className="absolute top-0 left-0 right-0 px-6 py-4 flex items-center justify-between z-10">
                <div className="flex items-center gap-3">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${catStyle.bg} ${catStyle.color}`}>
                        {catStyle.icon} {catStyle.label}
                    </span>
                    <span className="text-[var(--text-tertiary)] text-xs">
                        👤 Nhân vật #{image.characterIndex}
                    </span>
                    <span className="text-[var(--text-tertiary)] text-xs truncate max-w-xs">
                        {image.name}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <a
                        href={image.url}
                        download={image.name}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--material-glass)] hover:bg-[var(--material-glass)] rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs transition-colors"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <Download className="w-3.5 h-3.5" />
                        Tải xuống
                    </a>
                    <button
                        onClick={onClose}
                        className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-[var(--material-glass)] transition-colors group"
                    >
                        <kbd className="text-[10px] text-white/20 group-hover:text-[var(--text-tertiary)] font-mono">ESC</kbd>
                        <X className="w-4 h-4 text-[var(--text-tertiary)] group-hover:text-[var(--text-secondary)]" />
                    </button>
                </div>
            </div>

            {/* Main Image */}
            <div
                className={`relative max-w-[90vw] max-h-[85vh] ${isZoomed ? 'cursor-zoom-out' : 'cursor-zoom-in'}`}
                onClick={() => setIsZoomed(!isZoomed)}
                onMouseMove={handleMouseMove}
            >
                <div className={`overflow-hidden rounded-2xl shadow-2xl transition-all duration-200 ${isZoomed ? 'ring-2 ring-white/20' : ''}`}>
                    <img
                        ref={imgRef}
                        src={image.url}
                        alt={image.name}
                        className="max-h-[85vh] max-w-[90vw] object-contain"
                        style={
                            isZoomed
                                ? { transform: 'scale(2.5)', transformOrigin: `${zoomPos.x}% ${zoomPos.y}%` }
                                : {}
                        }
                        draggable={false}
                    />
                </div>
                {/* Zoom hint */}
                <div className="absolute top-3 right-3 opacity-0 hover:opacity-100 transition-opacity pointer-events-none">
                    {isZoomed ? <ZoomOut className="w-5 h-5 text-[var(--text-secondary)]" /> : <ZoomIn className="w-5 h-5 text-[var(--text-secondary)]" />}
                </div>
            </div>

            {/* Nav arrows */}
            {hasPrev && (
                <button
                    onClick={(e) => { e.stopPropagation(); onPrev(); setIsZoomed(false); }}
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-[var(--material-glass)] hover:bg-[var(--material-glass)] rounded-full flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all"
                >
                    <ChevronLeft className="w-5 h-5" />
                </button>
            )}
            {hasNext && (
                <button
                    onClick={(e) => { e.stopPropagation(); onNext(); setIsZoomed(false); }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-[var(--material-glass)] hover:bg-[var(--material-glass)] rounded-full flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all"
                >
                    <ChevronRight className="w-5 h-5" />
                </button>
            )}
        </motion.div>
    );
}

// =============================================================================
// TextCard — Display text-only character descriptions
// =============================================================================

function TextCard({ character }: { character: CharacterInfo }) {
    const descriptions: string[] = [];
    if (character.glassesDescription) {
        descriptions.push(`🕶 Kính: ${character.glassesDescription}`);
    }
    if (character.hatDescription) {
        descriptions.push(`🎩 Mũ: ${character.hatDescription}`);
    }

    if (descriptions.length === 0) {
        return (
            <div className="bg-[var(--material-glass)] rounded-2xl p-6 text-center">
                <p className="text-[var(--text-tertiary)] text-sm">Không có ảnh hoặc mô tả</p>
            </div>
        );
    }

    return (
        <div className="bg-[var(--material-panel)] rounded-2xl p-5 border border-[var(--border-color)]">
            <div className="flex items-center gap-2 mb-3">
                <span className="text-base">📝</span>
                <p className="text-[var(--text-secondary)] text-xs font-medium uppercase tracking-wider">
                    Mô tả khách hàng
                </p>
            </div>
            <div className="space-y-2.5">
                {descriptions.map((desc, i) => (
                    <p key={i} className="text-[var(--text-primary)] text-sm leading-relaxed">
                        {desc}
                    </p>
                ))}
            </div>
        </div>
    );
}

// =============================================================================
// ImageGallery — Full-screen modal with grid layout
// =============================================================================

export function ImageGallery({ images, characters, onClose }: ImageGalleryProps) {
    // State
    const [activeCharIndex, setActiveCharIndex] = useState<number>(
        images.length > 0 ? images[0].characterIndex : 1,
    );
    const [filter, setFilter] = useState<'all' | 'main' | 'glasses' | 'hat'>('all');
    const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

    // Unique character indices (combine from both images and characters)
    const characterIndices = useMemo(() => {
        const fromImages = images.map((i) => i.characterIndex);
        const fromChars = (characters || []).map((c) => c.index);
        return [...new Set([...fromImages, ...fromChars])].sort((a, b) => a - b);
    }, [images, characters]);

    // Filtered images for active character
    const filtered = useMemo(() => {
        return images.filter(
            (img) =>
                img.characterIndex === activeCharIndex &&
                (filter === 'all' || img.category === filter),
        );
    }, [images, activeCharIndex, filter]);

    // Available categories for current character
    const availableCategories = useMemo(() => {
        const cats = new Set(
            images
                .filter((img) => img.characterIndex === activeCharIndex)
                .map((img) => img.category),
        );
        return ['all', ...Array.from(cats)] as ('all' | 'main' | 'glasses' | 'hat')[];
    }, [images, activeCharIndex]);

    // Count images per category for active character
    const categoryCounts = useMemo(() => {
        const charImages = images.filter((img) => img.characterIndex === activeCharIndex);
        const counts: Record<string, number> = { all: charImages.length };
        for (const img of charImages) {
            counts[img.category] = (counts[img.category] || 0) + 1;
        }
        return counts;
    }, [images, activeCharIndex]);

    // Character info for text card
    const activeCharacter = useMemo(
        () => (characters || []).find((c) => c.index === activeCharIndex),
        [characters, activeCharIndex],
    );

    // Reset filter when switching characters
    useEffect(() => {
        setFilter('all');
        setLightboxIdx(null);
    }, [activeCharIndex]);

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (lightboxIdx !== null) return; // Lightbox handles its own keys
            if (e.key === 'Escape') onClose();
            if (e.key >= '1' && e.key <= '9') {
                const idx = parseInt(e.key);
                if (characterIndices.includes(idx)) setActiveCharIndex(idx);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [lightboxIdx, onClose, characterIndices]);

    // Prevent body scroll
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, []);

    // Does this character have images?
    const charHasImages = images.some((img) => img.characterIndex === activeCharIndex);

    return (
        <>
            <AnimatePresence>
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="fixed inset-0 bg-black/95 z-50 flex"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) onClose();
                    }}
                >
                    {/* ============================================== */}
                    {/* LEFT PANEL: Character Selector */}
                    {/* ============================================== */}
                    <div className="w-52 bg-[var(--bg-void)] border-r border-[var(--border-color)] flex flex-col">
                        <div className="p-4 border-b border-[var(--border-color)]">
                            <h3 className="text-[var(--text-secondary)] text-sm font-semibold tracking-wide uppercase">
                                Nhân vật
                            </h3>
                            <p className="text-[var(--text-tertiary)] text-xs mt-1">
                                {images.length} ảnh tổng cộng
                            </p>
                        </div>

                        <div className="flex-1 overflow-y-auto p-3 space-y-1">
                            {characterIndices.map((charIdx) => {
                                const charImages = images.filter(
                                    (img) => img.characterIndex === charIdx,
                                );
                                const charInfo = (characters || []).find((c) => c.index === charIdx);
                                const isActive = charIdx === activeCharIndex;
                                const hasImages = charImages.length > 0;

                                return (
                                    <button
                                        key={charIdx}
                                        onClick={() => setActiveCharIndex(charIdx)}
                                        className={`w-full text-left p-3 rounded-xl transition-all duration-200 group ${isActive
                                            ? 'bg-[var(--material-glass)] ring-1 ring-white/20'
                                            : 'hover:bg-[var(--material-glass)]'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-lg overflow-hidden bg-[var(--material-glass)] shrink-0 flex items-center justify-center">
                                                {hasImages && charImages[0] ? (
                                                    <img
                                                        src={charImages[0].thumbnail || charImages[0].url}
                                                        alt=""
                                                        className="w-full h-full object-cover"
                                                        loading="lazy"
                                                    />
                                                ) : (
                                                    <span className="text-lg">📝</span>
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <p className={`text-sm font-medium truncate ${isActive ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
                                                    👤 Nhân vật {charIdx}
                                                </p>
                                                <p className="text-[var(--text-tertiary)] text-xs">
                                                    {hasImages ? `📸 ${charImages.length} ảnh` : '📝 Mô tả'}
                                                </p>
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Keyboard hints */}
                        <div className="p-3 border-t border-[var(--border-color)]">
                            <div className="space-y-1.5">
                                <div className="flex items-center gap-2 text-[var(--text-tertiary)] text-[10px]">
                                    <kbd className="px-1.5 py-0.5 bg-[var(--material-glass)] rounded text-[var(--text-tertiary)] font-mono">1-9</kbd>
                                    <span>Đổi nhân vật</span>
                                </div>
                                <div className="flex items-center gap-2 text-[var(--text-tertiary)] text-[10px]">
                                    <kbd className="px-1.5 py-0.5 bg-[var(--material-glass)] rounded text-[var(--text-tertiary)] font-mono">ESC</kbd>
                                    <span>Đóng</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ============================================== */}
                    {/* CENTER: Grid Gallery / Text Card */}
                    {/* ============================================== */}
                    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                        {/* Title + Filters */}
                        <div className="px-6 pt-5 pb-4 border-b border-[var(--border-color)]">
                            <div className="flex items-center justify-between mb-3">
                                <h2 className="text-[var(--text-primary)] text-base font-semibold">
                                    Ảnh tham khảo — 👤 Nhân vật {activeCharIndex}
                                </h2>
                                <button
                                    onClick={onClose}
                                    className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-[var(--material-glass)] transition-colors group"
                                    title="Đóng (ESC)"
                                >
                                    <kbd className="text-[10px] text-white/20 group-hover:text-[var(--text-tertiary)] font-mono">ESC</kbd>
                                    <X className="w-4 h-4 text-[var(--text-tertiary)] group-hover:text-[var(--text-secondary)]" />
                                </button>
                            </div>

                            {/* Filter pills */}
                            {charHasImages && (
                                <div className="flex flex-wrap gap-1.5">
                                    {availableCategories.map((f) => {
                                        const isActive = filter === f;
                                        const label = f === 'all' ? 'Tất cả' : getCategoryStyle(f).label;
                                        const count = categoryCounts[f] || 0;
                                        return (
                                            <button
                                                key={f}
                                                onClick={() => setFilter(f)}
                                                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${isActive
                                                    ? 'bg-white text-black shadow-lg'
                                                    : 'bg-[var(--material-glass)] text-[var(--text-secondary)] hover:bg-[var(--material-glass)] hover:text-[var(--text-secondary)]'
                                                    }`}
                                            >
                                                {label} ({count})
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Content area */}
                        <div className="flex-1 overflow-y-auto p-6">
                            {charHasImages ? (
                                /* ── Image Grid ── */
                                filtered.length > 0 ? (
                                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                                        {filtered.map((img, i) => {
                                            const catStyle = getCategoryStyle(img.category);
                                            return (
                                                <div
                                                    key={img.id}
                                                    className="group relative rounded-2xl overflow-hidden bg-[var(--material-glass)] aspect-square cursor-pointer border border-[var(--border-color)] hover:border-[var(--border-color)] transition-all duration-200"
                                                    onClick={() => setLightboxIdx(i)}
                                                >
                                                    {/* Image */}
                                                    <img
                                                        src={img.thumbnail || img.url}
                                                        alt={img.name}
                                                        className="w-full h-full object-cover"
                                                        loading="lazy"
                                                    />

                                                    {/* Hover overlay */}
                                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center gap-3">
                                                        <button className="flex items-center gap-2 px-4 py-2 bg-white text-black rounded-xl text-xs font-semibold hover:bg-[var(--material-glass)] transition-colors">
                                                            <ZoomIn className="w-3.5 h-3.5" />
                                                            Xem ảnh
                                                        </button>
                                                        <a
                                                            href={img.url}
                                                            download={img.name}
                                                            className="flex items-center gap-2 px-4 py-2 bg-[var(--material-glass)] text-[var(--text-secondary)] rounded-xl text-xs hover:bg-[var(--material-glass)] transition-colors"
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            <Download className="w-3.5 h-3.5" />
                                                            Tải xuống
                                                        </a>
                                                    </div>

                                                    {/* Category badge */}
                                                    <div className="absolute top-2 left-2">
                                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-medium ${catStyle.bg} ${catStyle.color} backdrop-blur-sm`}>
                                                            {catStyle.icon} {catStyle.label}
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full text-center">
                                        <p className="text-[var(--text-tertiary)] text-sm mb-1">Không có ảnh phù hợp</p>
                                        <p className="text-[var(--text-tertiary)] text-xs">Thử đổi bộ lọc</p>
                                    </div>
                                )
                            ) : (
                                /* ── Text-only character ── */
                                <div className="max-w-md mx-auto mt-8">
                                    <div className="flex items-center gap-2 mb-4">
                                        <span className="text-lg">⚠️</span>
                                        <p className="text-[var(--text-secondary)] text-sm">Không có ảnh — hiển thị mô tả</p>
                                    </div>
                                    {activeCharacter ? (
                                        <TextCard character={activeCharacter} />
                                    ) : (
                                        <div className="bg-[var(--material-glass)] rounded-2xl p-6 text-center">
                                            <p className="text-[var(--text-tertiary)] text-sm">Không có thông tin</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ============================================== */}
                    {/* RIGHT PANEL: Tree View + Info */}
                    {/* ============================================== */}
                    <div className="w-56 bg-[var(--bg-void)] border-l border-[var(--border-color)] flex flex-col">
                        <div className="p-4 border-b border-[var(--border-color)]">
                            <h3 className="text-[var(--text-secondary)] text-sm font-semibold tracking-wide uppercase">
                                Cấu trúc ảnh
                            </h3>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {characterIndices.map((charIdx) => {
                                const charImages = images.filter(
                                    (img) => img.characterIndex === charIdx,
                                );
                                const isActiveChar = charIdx === activeCharIndex;
                                const charInfo = (characters || []).find((c) => c.index === charIdx);

                                return (
                                    <div key={charIdx} className={`${isActiveChar ? 'opacity-100' : 'opacity-50'}`}>
                                        <button
                                            onClick={() => setActiveCharIndex(charIdx)}
                                            className="text-[var(--text-secondary)] text-xs font-medium mb-1.5 hover:text-[var(--text-primary)] transition-colors flex items-center gap-1"
                                        >
                                            👤 Nhân vật {charIdx}
                                            {charImages.length > 0 && (
                                                <span className="text-[var(--text-tertiary)]">({charImages.length})</span>
                                            )}
                                        </button>
                                        <div className="pl-3 border-l border-[var(--border-color)] space-y-0.5">
                                            {charImages.length > 0 ? (
                                                charImages.map((img) => {
                                                    const catStyle = getCategoryStyle(img.category);
                                                    return (
                                                        <p
                                                            key={img.id}
                                                            className={`text-[10px] ${catStyle.color} truncate`}
                                                        >
                                                            └ {catStyle.icon} {catStyle.label}
                                                        </p>
                                                    );
                                                })
                                            ) : (
                                                <p className="text-[10px] text-[var(--text-tertiary)]">└ 📝 Mô tả</p>
                                            )}
                                            {charInfo?.glassesDescription && (
                                                <p className="text-[10px] text-amber-400/50 truncate" title={charInfo.glassesDescription}>
                                                    └ 🕶 &quot;{charInfo.glassesDescription}&quot;
                                                </p>
                                            )}
                                            {charInfo?.hatDescription && (
                                                <p className="text-[10px] text-purple-400/50 truncate" title={charInfo.hatDescription}>
                                                    └ 🎩 &quot;{charInfo.hatDescription}&quot;
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </motion.div>
            </AnimatePresence>

            {/* Lightbox overlay */}
            <AnimatePresence>
                {lightboxIdx !== null && filtered[lightboxIdx] && (
                    <Lightbox
                        image={filtered[lightboxIdx]}
                        onClose={() => setLightboxIdx(null)}
                        onPrev={() => setLightboxIdx((prev) => (prev !== null && prev > 0 ? prev - 1 : filtered.length - 1))}
                        onNext={() => setLightboxIdx((prev) => (prev !== null && prev < filtered.length - 1 ? prev + 1 : 0))}
                        hasPrev={filtered.length > 1}
                        hasNext={filtered.length > 1}
                    />
                )}
            </AnimatePresence>
        </>
    );
}

// =============================================================================
// Default Export
// =============================================================================

export default ImageGallery;
