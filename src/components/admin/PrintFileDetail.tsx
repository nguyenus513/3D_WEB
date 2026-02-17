'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { PrintFileCardData } from './PrintFileCard';

interface PrintFileDetailProps {
    file: PrintFileCardData | null;
    orderId: string;
    onClose: () => void;
}

/**
 * Slide-over drawer showing full details for a single print file.
 * Includes specs, analysis data, and a download button that triggers
 * the admin download API.
 */
export default function PrintFileDetail({ file, orderId, onClose }: PrintFileDetailProps) {
    const [downloading, setDownloading] = useState(false);
    const [downloadError, setDownloadError] = useState('');
    const isOpen = file !== null;

    // Close on Escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            document.body.style.overflow = 'hidden';
        }
        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = '';
        };
    }, [isOpen, onClose]);

    const formatPrice = (price: number) =>
        price.toLocaleString('vi-VN') + 'đ';

    /**
     * Download file via admin API.
     * Fetches signed URL, then triggers browser download.
     */
    const handleDownload = useCallback(async () => {
        if (!file?.orderFile?.id) {
            setDownloadError('Không tìm thấy file để tải');
            return;
        }

        setDownloading(true);
        setDownloadError('');

        try {
            const res = await fetch(
                `/api/admin/orders/${orderId}/files/${file.orderFile.id}/download`
            );

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Download failed');
            }

            const data = await res.json();
            const { url, fileName } = data.data;

            // Trigger browser download via hidden anchor
            const link = document.createElement('a');
            link.href = url;
            link.download = fileName || file.itemName || 'download.stl';
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (err) {
            console.error('[PrintFileDetail] Download error:', err);
            setDownloadError((err as Error).message);
        } finally {
            setDownloading(false);
        }
    }, [file, orderId]);

    if (!isOpen || !file) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity duration-300"
                onClick={onClose}
            />

            {/* Drawer */}
            <div className="
                fixed top-0 right-0 h-full w-full max-w-lg z-50
                bg-gradient-to-br from-[#0f0f1a] to-[#1a1a2e]
                border-l border-white/10
                shadow-2xl shadow-black/50
                overflow-y-auto
                animate-slide-in-right
            ">
                {/* Header */}
                <div className="sticky top-0 z-10 bg-[#0f0f1a]/95 backdrop-blur-md border-b border-white/10 p-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 flex items-center justify-center">
                                <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                </svg>
                            </div>
                            <div>
                                <h2 className="text-white font-semibold text-lg">Chi tiết file</h2>
                                <p className="text-white/40 text-xs">File Detail</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                        >
                            <svg className="w-5 h-5 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                <div className="p-6 space-y-6">
                    {/* File Name Card */}
                    <div className="p-5 rounded-2xl bg-gradient-to-br from-cyan-500/10 to-blue-600/10 border border-cyan-500/20">
                        <p className="text-white/50 text-xs uppercase tracking-wider mb-2">Tên file</p>
                        <p className="text-white font-bold text-lg break-all">{file.itemName}</p>
                        {file.orderFile?.file_type && (
                            <span className="inline-block mt-2 px-2.5 py-1 bg-cyan-500/15 text-cyan-400 text-xs rounded-full uppercase">
                                {file.orderFile.file_type}
                            </span>
                        )}
                    </div>

                    {/* Print Specs — technology-aware layout */}
                    <div className="p-5 rounded-2xl bg-white/5 border border-white/10">
                        <p className="text-white/50 text-xs uppercase tracking-wider mb-4">Thông số in</p>
                        {(() => {
                            const tech = file.spec.print_tech?.toLowerCase();
                            const isFdm = tech === 'fdm';
                            const isResin = tech === 'resin' || tech === 'sla';

                            return (
                                <div className="space-y-4">
                                    {/* Row 1: Công nghệ + Vật liệu */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <SpecItem
                                            label="Công nghệ"
                                            value={
                                                isFdm ? '🔧 FDM'
                                                    : isResin ? '✨ Resin (SLA)'
                                                        : tech?.toUpperCase() || '—'
                                            }
                                        />
                                        <SpecItem
                                            label="Vật liệu"
                                            value={
                                                file.spec.material
                                                    ? file.spec.material.replace(/_/g, ' ')
                                                    : isFdm ? 'PETG'
                                                        : isResin ? 'Standard Resin'
                                                            : '—'
                                            }
                                            capitalize
                                        />
                                    </div>

                                    {/* Row 2: Màu sắc + (FDM: Infill) */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <SpecItem
                                            label="Màu sắc"
                                            value={file.spec.color || '—'}
                                            capitalize
                                            colorPreview={file.spec.color}
                                        />
                                        {isFdm && (
                                            <SpecItem
                                                label="Mật độ đổ (Infill)"
                                                value={file.spec.infill ? `${file.spec.infill}%` : '—'}
                                            />
                                        )}
                                    </div>

                                    {/* Row 3: FDM-only: Layer Height */}
                                    {isFdm && (
                                        <div className="grid grid-cols-2 gap-4">
                                            <SpecItem
                                                label="Độ mịn (Layer Height)"
                                                value={file.spec.layer_height ? `${file.spec.layer_height}mm` : '—'}
                                            />
                                        </div>
                                    )}

                                </div>
                            );
                        })()}
                    </div>

                    {/* Analysis / Dimensions */}
                    {(file.spec.volume || file.spec.grams || file.spec.hours) && (
                        <div className="p-5 rounded-2xl bg-white/5 border border-white/10">
                            <p className="text-white/50 text-xs uppercase tracking-wider mb-4">Phân tích</p>
                            <div className="grid grid-cols-3 gap-4 text-center">
                                {file.spec.volume !== undefined && (
                                    <div>
                                        <p className="text-2xl font-bold text-white">{file.spec.volume}</p>
                                        <p className="text-white/40 text-xs mt-1">cm³</p>
                                    </div>
                                )}
                                {file.spec.grams !== undefined && (
                                    <div>
                                        <p className="text-2xl font-bold text-white">{file.spec.grams}</p>
                                        <p className="text-white/40 text-xs mt-1">gram</p>
                                    </div>
                                )}
                                {file.spec.hours !== undefined && (
                                    <div>
                                        <p className="text-2xl font-bold text-white">{file.spec.hours}</p>
                                        <p className="text-white/40 text-xs mt-1">giờ</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Pricing */}
                    <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-green-600/10 border border-emerald-500/20">
                        <p className="text-white/50 text-xs uppercase tracking-wider mb-4">Giá</p>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <span className="text-white/60 text-sm">Đơn giá</span>
                                <span className="text-white font-medium">{formatPrice(file.unitPrice)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-white/60 text-sm">Số lượng</span>
                                <span className="text-white font-medium">×{file.quantity}</span>
                            </div>
                            <div className="border-t border-white/10 pt-3 flex justify-between items-center">
                                <span className="text-white font-medium">Tổng</span>
                                <span className="text-emerald-400 font-bold text-xl">{formatPrice(file.totalPrice)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="space-y-3">
                        {file.orderFile?.id ? (
                            <button
                                onClick={handleDownload}
                                disabled={downloading}
                                className="
                                    w-full py-4 rounded-xl font-semibold
                                    bg-gradient-to-r from-cyan-500 to-blue-600
                                    hover:from-cyan-400 hover:to-blue-500
                                    disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed
                                    text-white transition-all duration-300
                                    flex items-center justify-center gap-3
                                    shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/30
                                "
                            >
                                {downloading ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Đang tải...
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                        </svg>
                                        Tải file xuống
                                    </>
                                )}
                            </button>
                        ) : (
                            <div className="w-full py-4 rounded-xl bg-white/5 border border-white/10 text-center">
                                <p className="text-white/40 text-sm">File chưa được upload lên hệ thống</p>
                                <p className="text-white/30 text-xs mt-1">Không có file để tải</p>
                            </div>
                        )}

                        {downloadError && (
                            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                                <p className="text-red-400 text-sm">{downloadError}</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Global animation styles */}
            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                .animate-slide-in-right {
                    animation: slideInRight 0.3s ease-out;
                }
            `}} />
        </>
    );
}

/**
 * Spec item row for the detail panel
 */
function SpecItem({ label, value, capitalize, colorPreview }: {
    label: string;
    value: string;
    capitalize?: boolean;
    colorPreview?: string;
}) {
    // Map common print color names to CSS colors
    const colorMap: Record<string, string> = {
        white: '#ffffff',
        black: '#1a1a1a',
        red: '#ef4444',
        blue: '#3b82f6',
        green: '#22c55e',
        yellow: '#eab308',
        orange: '#f97316',
        gray: '#9ca3af',
        grey: '#9ca3af',
        pink: '#ec4899',
        purple: '#a855f7',
        transparent: 'transparent',
    };

    const cssColor = colorPreview ? colorMap[colorPreview.toLowerCase()] : undefined;

    return (
        <div>
            <p className="text-white/40 text-xs mb-1">{label}</p>
            <div className="flex items-center gap-2">
                {cssColor && (
                    <span
                        className="w-3.5 h-3.5 rounded-full border border-white/20 flex-shrink-0"
                        style={{
                            backgroundColor: cssColor,
                            ...(cssColor === 'transparent' ? { background: 'repeating-conic-gradient(#808080 0% 25%, transparent 0% 50%) 50% / 6px 6px' } : {}),
                        }}
                    />
                )}
                <p className={`text-white font-medium text-sm ${capitalize ? 'capitalize' : ''}`}>{value}</p>
            </div>
        </div>
    );
}
