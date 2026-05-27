'use client';

/**
 * VersionFeedbackCard — Reusable design version feedback display
 * 
 * Shows version number, status indicator, user feedback, admin note,
 * timestamps, and optional image thumbnails. Used in both admin order
 * detail and user demo review pages.
 */

interface DesignImagePreview {
    id: string;
    image_url: string;
    label: string;
}

type VersionStatus = 'pending_review' | 'approved' | 'rejected';

export interface VersionFeedbackCardProps {
    versionNumber: number;
    status: VersionStatus;
    userFeedback?: string | null;
    adminNote?: string | null;
    createdAt: string;
    reviewedAt?: string | null;
    images?: DesignImagePreview[];
    /** Highlight with ring when this version is selected */
    isActive?: boolean;
    /** Compact mode for history list items */
    compact?: boolean;
    /** Additional className */
    className?: string;
}

const STATUS_CONFIG: Record<VersionStatus, {
    emoji: string;
    label: string;
    border: string;
    bg: string;
    text: string;
    badgeBg: string;
    badgeText: string;
}> = {
    pending_review: {
        emoji: '🟡',
        label: 'Chờ duyệt',
        border: 'border-orange-500/20',
        bg: 'bg-orange-500/[0.03]',
        text: 'text-orange-400',
        badgeBg: 'bg-orange-500/15',
        badgeText: 'text-orange-400',
    },
    approved: {
        emoji: '🟢',
        label: 'Đã duyệt',
        border: 'border-emerald-500/20',
        bg: 'bg-emerald-500/[0.03]',
        text: 'text-emerald-400',
        badgeBg: 'bg-emerald-500/15',
        badgeText: 'text-emerald-400',
    },
    rejected: {
        emoji: '🔴',
        label: 'Yêu cầu chỉnh sửa',
        border: 'border-pink-500/20',
        bg: 'bg-pink-500/[0.03]',
        text: 'text-pink-400',
        badgeBg: 'bg-pink-500/15',
        badgeText: 'text-pink-400',
    },
};

function formatTimestamp(dateStr?: string | null): string {
    if (!dateStr) return 'Chưa có thời gian';
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return 'Chưa có thời gian';
    return date.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export default function VersionFeedbackCard({
    versionNumber,
    status,
    userFeedback,
    adminNote,
    createdAt,
    reviewedAt,
    images,
    isActive = false,
    compact = false,
    className = '',
}: VersionFeedbackCardProps) {
    const config = STATUS_CONFIG[status];
    const displayTime = reviewedAt || createdAt;

    return (
        <div
            className={`
                rounded-xl border p-4 transition-all duration-200
                ${config.border} ${config.bg}
                ${isActive ? 'ring-2 ring-blue-500/60 ring-offset-1 ring-offset-black' : ''}
                ${className}
            `.trim()}
        >
            {/* ─── Header ─── */}
            <div className="flex items-center justify-between mb-3">
                <div className={`flex items-center gap-2 font-semibold ${compact ? 'text-xs' : 'text-sm'}`}>
                    <span>{config.emoji}</span>
                    <span className={config.text}>
                        {config.label}
                    </span>
                    <span className="text-white/30">•</span>
                    <span className="text-white font-medium">V{versionNumber}</span>
                </div>

                <span className="text-white/30 text-[10px] tabular-nums">
                    {formatTimestamp(displayTime)}
                </span>
            </div>

            {/* ─── User Feedback ─── */}
            {userFeedback && (
                <div className={compact ? 'mb-2' : 'mb-3'}>
                    <p className="text-pink-400/60 text-[10px] font-medium mb-1 uppercase tracking-wider">
                        Phản hồi khách
                    </p>
                    <div className={`
                        text-white/70 bg-black/30 rounded-lg border border-white/[0.06]
                        ${compact ? 'text-xs p-2' : 'text-sm p-3'}
                    `}>
                        {userFeedback}
                    </div>
                </div>
            )}

            {/* ─── Admin Note ─── */}
            {adminNote && (
                <div className={compact ? 'mb-2' : 'mb-3'}>
                    <p className="text-cyan-400/60 text-[10px] font-medium mb-1 uppercase tracking-wider">
                        Ghi chú Admin
                    </p>
                    <div className={`
                        text-white/70 bg-black/30 rounded-lg border border-white/[0.06]
                        ${compact ? 'text-xs p-2' : 'text-sm p-3'}
                    `}>
                        {adminNote}
                    </div>
                </div>
            )}

            {/* ─── Image Thumbnails (optional) ─── */}
            {images && images.length > 0 && (
                <div className="flex gap-2 mt-2">
                    {images.slice(0, 4).map(img => (
                        <img
                            key={img.id}
                            src={img.image_url}
                            alt={img.label || 'Demo'}
                            className="w-12 h-12 rounded-lg object-cover border border-white/10"
                        />
                    ))}
                    {images.length > 4 && (
                        <div className="w-12 h-12 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                            <span className="text-white/40 text-xs">+{images.length - 4}</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

/** Skeleton loading placeholder */
export function VersionFeedbackCardSkeleton({ compact = false }: { compact?: boolean }) {
    return (
        <div className={`rounded-xl border border-white/10 bg-white/[0.02] ${compact ? 'p-3' : 'p-4'} animate-pulse`}>
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-white/10" />
                    <div className="w-24 h-3 rounded bg-white/10" />
                </div>
                <div className="w-20 h-2.5 rounded bg-white/5" />
            </div>
            <div className="w-full h-10 rounded-lg bg-white/5" />
        </div>
    );
}
