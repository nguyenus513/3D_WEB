'use client';

import { motion } from 'framer-motion';

interface OrderStatusStepperProps {
    orderType: 'ready_made' | 'custom' | 'printing';
    currentStatus: string;
    onStatusChange: (newStatus: string) => void;
    onShippingClick?: () => void;
    updating?: boolean;
}

const STATUS_FLOWS: Record<string, string[]> = {
    ready_made: ['confirmed', 'processing', 'shipping', 'delivered'],
    custom: ['confirmed', 'designing', 'review', 'approved', 'producing', 'shipping', 'delivered'],
    printing: ['confirmed', 'printing', 'shipping', 'delivered'],
};

const STATUS_LABELS: Record<string, string> = {
    confirmed: 'Xác nhận',
    processing: 'Xử lý',
    designing: 'Thiết kế',
    review: 'Chờ duyệt',
    revising: 'Chỉnh sửa',
    approved: 'Đã duyệt',
    producing: 'Sản xuất',
    printing: 'Đang in',
    shipping: 'Giao hàng',
    delivered: 'Hoàn thành',
};

const STATUS_ICONS: Record<string, string> = {
    confirmed: '✓',
    processing: '⚙️',
    designing: '🎨',
    review: '👁️',
    revising: '🔄',
    approved: '👍',
    producing: '📦',
    printing: '🖨️',
    shipping: '🚚',
    delivered: '🏠',
};

export function OrderStatusStepper({
    orderType,
    currentStatus,
    onStatusChange,
    onShippingClick,
    updating = false,
}: OrderStatusStepperProps) {
    const flow = STATUS_FLOWS[orderType] || STATUS_FLOWS.ready_made;
    const currentIdx = flow.indexOf(currentStatus);

    return (
        <div className="space-y-4">
            {/* Square blocks grid */}
            <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${flow.length}, 1fr)` }}>
                {flow.map((step, idx) => {
                    const isCompleted = idx < currentIdx;
                    const isCurrent = idx === currentIdx;
                    const isNext = idx === currentIdx + 1;
                    const canClick = isNext && !updating;

                    return (
                        <motion.button
                            key={step}
                            onClick={() => {
                                if (canClick) {
                                    if (step === 'shipping' && onShippingClick) {
                                        onShippingClick();
                                    } else {
                                        onStatusChange(step);
                                    }
                                }
                            }}
                            disabled={!canClick}
                            whileHover={canClick ? { scale: 1.05 } : {}}
                            whileTap={canClick ? { scale: 0.95 } : {}}
                            className={`
                                aspect-square rounded-xl flex flex-col items-center justify-center gap-1 p-2
                                transition-all duration-200 relative overflow-hidden
                                ${isCompleted ? 'bg-emerald-500/20 border-2 border-emerald-500' : ''}
                                ${isCurrent ? 'bg-cyan-500/20 border-2 border-cyan-500 shadow-[0_0_20px_rgba(6,182,212,0.3)]' : ''}
                                ${isNext ? 'bg-white/5 border-2 border-dashed border-white/30 hover:border-white/60 cursor-pointer' : ''}
                                ${!isCompleted && !isCurrent && !isNext ? 'bg-white/[0.02] border border-white/10' : ''}
                                ${updating && isNext ? 'opacity-50' : ''}
                            `}
                        >
                            {/* Icon */}
                            <span className={`text-2xl ${isCompleted ? 'grayscale-0' : isCurrent ? '' : 'grayscale opacity-50'}`}>
                                {isCompleted ? '✓' : STATUS_ICONS[step]}
                            </span>

                            {/* Label */}
                            <span className={`text-[10px] font-medium text-center leading-tight ${isCompleted ? 'text-emerald-400' :
                                    isCurrent ? 'text-cyan-400' :
                                        isNext ? 'text-white/60' :
                                            'text-white/30'
                                }`}>
                                {STATUS_LABELS[step]}
                            </span>

                            {/* Click hint for next step */}
                            {isNext && (
                                <span className="absolute bottom-1 text-[8px] text-cyan-400 font-medium">
                                    Click →
                                </span>
                            )}

                            {/* Pulse for current */}
                            {isCurrent && (
                                <div className="absolute inset-0 bg-cyan-500/10 animate-pulse rounded-xl" />
                            )}
                        </motion.button>
                    );
                })}
            </div>

            {/* Progress indicator */}
            <div className="flex items-center gap-2">
                <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${((currentIdx + 1) / flow.length) * 100}%` }}
                        transition={{ duration: 0.5 }}
                        className="h-full bg-gradient-to-r from-cyan-500 to-emerald-500 rounded-full"
                    />
                </div>
                <span className="text-xs text-white/50">
                    {currentIdx + 1}/{flow.length}
                </span>
            </div>
        </div>
    );
}
