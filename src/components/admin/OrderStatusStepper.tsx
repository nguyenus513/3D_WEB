'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface OrderStatusStepperProps {
    orderType: 'ready_made' | 'custom' | 'printing';
    currentStatus: string;
    timestamps?: Record<string, string | null>;
    onStatusChange: (newStatus: string) => void;
    onShippingClick?: () => void;
    updating?: boolean;
}

// Status flows for different order types
const STATUS_FLOWS: Record<string, string[]> = {
    ready_made: ['confirmed', 'processing', 'shipping', 'delivered'],
    custom: ['confirmed', 'designing', 'review', 'approved', 'producing', 'shipping', 'delivered'],
    printing: ['confirmed', 'printing', 'shipping', 'delivered'],
};

// Labels for each status
const STATUS_LABELS: Record<string, string> = {
    confirmed: 'Xác nhận TT',
    processing: 'Đang xử lý',
    designing: 'Thiết kế',
    review: 'Chờ duyệt',
    revising: 'Chỉnh sửa',
    approved: 'Đã duyệt',
    producing: 'Sản xuất',
    printing: 'Đang in',
    shipping: 'Giao hàng',
    delivered: 'Hoàn thành',
};

// Colors for each status
const STATUS_COLORS: Record<string, { bg: string; text: string; glow: string }> = {
    confirmed: { bg: 'from-emerald-500 to-green-500', text: 'text-emerald-400', glow: 'shadow-emerald-500/30' },
    processing: { bg: 'from-yellow-500 to-amber-500', text: 'text-yellow-400', glow: 'shadow-yellow-500/30' },
    designing: { bg: 'from-pink-500 to-rose-500', text: 'text-pink-400', glow: 'shadow-pink-500/30' },
    review: { bg: 'from-cyan-500 to-blue-500', text: 'text-cyan-400', glow: 'shadow-cyan-500/30' },
    revising: { bg: 'from-orange-500 to-red-500', text: 'text-orange-400', glow: 'shadow-orange-500/30' },
    approved: { bg: 'from-blue-500 to-indigo-500', text: 'text-blue-400', glow: 'shadow-blue-500/30' },
    producing: { bg: 'from-purple-500 to-violet-500', text: 'text-purple-400', glow: 'shadow-purple-500/30' },
    printing: { bg: 'from-indigo-500 to-purple-500', text: 'text-indigo-400', glow: 'shadow-indigo-500/30' },
    shipping: { bg: 'from-orange-500 to-amber-500', text: 'text-orange-400', glow: 'shadow-orange-500/30' },
    delivered: { bg: 'from-green-500 to-emerald-500', text: 'text-green-400', glow: 'shadow-green-500/30' },
};

// Icons for each status
const StatusIcon = ({ status, size = 'md' }: { status: string; size?: 'sm' | 'md' | 'lg' }) => {
    const sizeClass = size === 'lg' ? 'w-6 h-6' : size === 'md' ? 'w-5 h-5' : 'w-4 h-4';

    const icons: Record<string, React.ReactNode> = {
        confirmed: (
            <svg className={sizeClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        ),
        processing: (
            <svg className={sizeClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.107-1.204l-.527-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
        ),
        designing: (
            <svg className={sizeClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
            </svg>
        ),
        review: (
            <svg className={sizeClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
        ),
        revising: (
            <svg className={sizeClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
        ),
        approved: (
            <svg className={sizeClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.633 10.5c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 012.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 00.322-1.672V3a.75.75 0 01.75-.75A2.25 2.25 0 0116.5 4.5c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 01-2.649 7.521c-.388.482-.987.729-1.605.729H13.48c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 00-1.423-.23H5.904M14.25 9h2.25M5.904 18.75c.083.205.173.405.27.602.197.4-.078.898-.523.898h-.908c-.889 0-1.713-.518-1.972-1.368a12 12 0 01-.521-3.507c0-1.553.295-3.036.831-4.398C3.387 10.006 4.337 9.75 5.25 9.75h.908c.445 0 .72.498.523.898-.197.4-.287.675-.27.602.27.598-.773 1.237-1.128 2.062-.322.754-.46 1.6-.46 2.438 0 1.038.26 2.013.731 2.905.2.375.418.733.66 1.072.121.17-.05.373-.25.373h-.3z" />
            </svg>
        ),
        producing: (
            <svg className={sizeClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
        ),
        printing: (
            <svg className={sizeClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" />
            </svg>
        ),
        shipping: (
            <svg className={sizeClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
            </svg>
        ),
        delivered: (
            <svg className={sizeClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
            </svg>
        ),
    };

    return icons[status] || icons.confirmed;
};

// Format timestamp
const formatTimestamp = (ts: string | null | undefined) => {
    if (!ts) return '';
    const d = new Date(ts);
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
};

export function OrderStatusStepper({
    orderType,
    currentStatus,
    timestamps = {},
    onStatusChange,
    onShippingClick,
    updating = false,
}: OrderStatusStepperProps) {
    const [showDropdown, setShowDropdown] = useState(false);

    const flow = STATUS_FLOWS[orderType] || STATUS_FLOWS.ready_made;
    const currentIdx = flow.indexOf(currentStatus);
    const progressPercent = currentIdx >= 0 ? ((currentIdx + 1) / flow.length) * 100 : 0;

    // Get next possible statuses
    const getNextStatuses = () => {
        const idx = flow.indexOf(currentStatus);
        if (idx === -1 || idx >= flow.length - 1) return [];
        return flow.slice(idx + 1);
    };

    const nextStatuses = getNextStatuses();

    return (
        <div className="space-y-6">
            {/* Current Status Card */}
            <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-r ${STATUS_COLORS[currentStatus]?.bg || 'from-gray-500 to-gray-600'} p-[1px]`}>
                <div className="bg-[#0D0D0F] rounded-2xl p-5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${STATUS_COLORS[currentStatus]?.bg || 'from-gray-500 to-gray-600'} flex items-center justify-center shadow-lg ${STATUS_COLORS[currentStatus]?.glow || ''}`}>
                                <span className="text-white">
                                    <StatusIcon status={currentStatus} size="lg" />
                                </span>
                            </div>
                            <div>
                                <p className="text-white/50 text-sm">Trạng thái hiện tại</p>
                                <h3 className={`text-xl font-bold ${STATUS_COLORS[currentStatus]?.text || 'text-white'}`}>
                                    {STATUS_LABELS[currentStatus] || currentStatus}
                                </h3>
                            </div>
                        </div>

                        {/* Quick Action Dropdown */}
                        {nextStatuses.length > 0 && (
                            <div className="relative">
                                <button
                                    onClick={() => setShowDropdown(!showDropdown)}
                                    disabled={updating}
                                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium transition-all disabled:opacity-50"
                                >
                                    {updating ? (
                                        <>
                                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            <span>Đang xử lý...</span>
                                        </>
                                    ) : (
                                        <>
                                            <span>Chuyển trạng thái</span>
                                            <svg className={`w-4 h-4 transition-transform ${showDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </>
                                    )}
                                </button>

                                <AnimatePresence>
                                    {showDropdown && !updating && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -10, scale: 0.95 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={{ opacity: 0, y: -10, scale: 0.95 }}
                                            transition={{ duration: 0.15 }}
                                            className="absolute right-0 mt-2 w-56 bg-[#1D1D1F] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50"
                                        >
                                            {nextStatuses.map((status, idx) => (
                                                <button
                                                    key={status}
                                                    onClick={() => {
                                                        setShowDropdown(false);
                                                        if (status === 'shipping' && onShippingClick) {
                                                            onShippingClick();
                                                        } else {
                                                            onStatusChange(status);
                                                        }
                                                    }}
                                                    className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-white/10 transition-colors ${idx === 0 ? 'bg-white/5' : ''}`}
                                                >
                                                    <span className={STATUS_COLORS[status]?.text || 'text-white'}>
                                                        <StatusIcon status={status} size="sm" />
                                                    </span>
                                                    <span className="text-white text-sm">{STATUS_LABELS[status]}</span>
                                                    {idx === 0 && (
                                                        <span className="ml-auto text-xs text-white/40">Tiếp theo</span>
                                                    )}
                                                </button>
                                            ))}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Progress Bar */}
            <div className="relative">
                {/* Background */}
                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    {/* Animated Progress */}
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${progressPercent}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                        className={`h-full bg-gradient-to-r ${STATUS_COLORS[currentStatus]?.bg || 'from-gray-500 to-gray-600'} rounded-full relative`}
                    >
                        {/* Shimmer effect */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
                    </motion.div>
                </div>

                {/* Step indicators */}
                <div className="flex justify-between mt-1">
                    <span className="text-xs text-white/40">0%</span>
                    <span className="text-xs text-white/40">{Math.round(progressPercent)}% hoàn thành</span>
                </div>
            </div>

            {/* Steps Timeline */}
            <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${flow.length}, 1fr)` }}>
                {flow.map((step, idx) => {
                    const isCompleted = idx < currentIdx;
                    const isCurrent = idx === currentIdx;
                    const isNext = idx === currentIdx + 1;
                    const timestamp = timestamps[step];

                    return (
                        <motion.button
                            key={step}
                            onClick={() => {
                                if (isNext && !updating) {
                                    if (step === 'shipping' && onShippingClick) {
                                        onShippingClick();
                                    } else {
                                        onStatusChange(step);
                                    }
                                }
                            }}
                            disabled={!isNext || updating}
                            whileHover={isNext ? { scale: 1.05 } : {}}
                            whileTap={isNext ? { scale: 0.95 } : {}}
                            className={`
                                relative flex flex-col items-center p-3 rounded-xl transition-all
                                ${isCompleted ? 'bg-gradient-to-b from-emerald-500/10 to-transparent border border-emerald-500/20' : ''}
                                ${isCurrent ? `bg-gradient-to-b ${STATUS_COLORS[step]?.bg?.replace('from-', 'from-').replace(' to-', '/20 to-')}/10 to-transparent border border-white/20 shadow-lg ${STATUS_COLORS[step]?.glow}` : ''}
                                ${isNext ? 'bg-white/5 border border-dashed border-white/20 hover:border-white/40 cursor-pointer' : ''}
                                ${!isCompleted && !isCurrent && !isNext ? 'bg-white/[0.02] border border-white/5' : ''}
                            `}
                        >
                            {/* Icon */}
                            <div className={`
                                w-10 h-10 rounded-full flex items-center justify-center mb-2 transition-all
                                ${isCompleted ? 'bg-emerald-500/20 text-emerald-400' : ''}
                                ${isCurrent ? `bg-gradient-to-br ${STATUS_COLORS[step]?.bg || 'from-gray-500 to-gray-600'} text-white` : ''}
                                ${isNext ? 'bg-white/10 text-white/60' : ''}
                                ${!isCompleted && !isCurrent && !isNext ? 'bg-white/5 text-white/20' : ''}
                            `}>
                                {isCompleted ? (
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                ) : (
                                    <StatusIcon status={step} />
                                )}
                            </div>

                            {/* Pulse animation for current */}
                            {isCurrent && (
                                <div className={`absolute top-3 left-1/2 -translate-x-1/2 w-10 h-10 rounded-full bg-gradient-to-br ${STATUS_COLORS[step]?.bg} opacity-30 animate-ping`} />
                            )}

                            {/* Label */}
                            <span className={`text-xs font-medium text-center ${isCompleted ? 'text-emerald-400' : isCurrent ? STATUS_COLORS[step]?.text : isNext ? 'text-white/60' : 'text-white/30'}`}>
                                {STATUS_LABELS[step]}
                            </span>

                            {/* Timestamp */}
                            {timestamp && (isCompleted || isCurrent) && (
                                <span className="text-[10px] text-white/30 mt-1">
                                    {formatTimestamp(timestamp)}
                                </span>
                            )}

                            {/* Next indicator */}
                            {isNext && (
                                <span className="text-[10px] text-cyan-400 mt-1 font-medium">Click →</span>
                            )}
                        </motion.button>
                    );
                })}
            </div>

            {/* Custom CSS for shimmer effect */}
            <style jsx>{`
                @keyframes shimmer {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(200%); }
                }
                .animate-shimmer {
                    animation: shimmer 2s infinite;
                }
            `}</style>
        </div>
    );
}
