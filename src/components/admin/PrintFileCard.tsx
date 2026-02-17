'use client';

import React from 'react';

/**
 * Order file record from the order_files table
 */
export interface OrderFileRecord {
    id: string;
    order_item_id: string | null;
    file_name: string;
    file_key: string | null;
    file_type: string | null;
    file_url: string | null;
    category: string | null;
    storage_provider: 'r2' | 'drive' | null;
    size_bytes: number | null;
    created_at: string | null;
}

/**
 * Matched file card data combining order_item + order_file
 */
export interface PrintFileCardData {
    orderFile: OrderFileRecord | null;
    itemName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    spec: {
        print_tech?: string;
        material?: string;
        color?: string;
        infill?: string;
        layer_height?: string;
        volume?: number;
        grams?: number;
        hours?: number;
    };
}

interface PrintFileCardProps {
    file: PrintFileCardData;
    index: number;
    onClick: () => void;
}

/**
 * Minimal Apple-style file row for admin print order overview.
 * Shows file name, size, quantity × price, and a click→detail CTA.
 */
export default function PrintFileCard({ file, onClick }: PrintFileCardProps) {
    const formatPrice = (price: number): string =>
        price.toLocaleString('vi-VN') + 'đ';

    const formatFileSize = (bytes: number | null): string => {
        if (!bytes) return '';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    };

    const sizeText = formatFileSize(file.orderFile?.size_bytes ?? null);

    return (
        <button
            onClick={onClick}
            className="
                w-full text-left px-4 py-3
                bg-white/[0.03] rounded-xl
                border border-white/[0.06]
                hover:bg-white/[0.06] hover:border-white/[0.12]
                transition-colors duration-200
                group cursor-pointer
            "
        >
            <div className="flex items-center gap-3">
                {/* File icon — simple, muted */}
                <div className="w-9 h-9 rounded-lg bg-white/[0.05] flex items-center justify-center flex-shrink-0">
                    <svg className="w-4.5 h-4.5 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                </div>

                {/* Name + meta */}
                <div className="flex-1 min-w-0">
                    <p className="text-white/90 text-sm font-medium truncate">
                        {file.itemName}
                    </p>
                    <p className="text-white/40 text-xs mt-0.5">
                        ×{file.quantity} · {formatPrice(file.unitPrice)}
                        {sizeText && ` · ${sizeText}`}
                    </p>
                    {/* Per-item print spec summary */}
                    {file.spec && (file.spec.print_tech || file.spec.color) && (
                        <p className="text-white/30 text-[11px] mt-1">
                            {[
                                file.spec.print_tech?.toUpperCase(),
                                file.spec.color,
                                file.spec.infill && `Infill ${file.spec.infill}%`,
                                file.spec.layer_height && `Layer ${file.spec.layer_height}mm`,
                            ].filter(Boolean).join(' · ')}
                        </p>
                    )}
                </div>

                {/* Price + arrow */}
                <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-white/70 text-sm font-medium">
                        {formatPrice(file.totalPrice)}
                    </span>
                    <svg className="w-4 h-4 text-white/20 group-hover:text-white/40 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                </div>
            </div>
        </button>
    );
}
