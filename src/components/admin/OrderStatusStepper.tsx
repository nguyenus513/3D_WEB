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
            {/* Horizontal Stepper */}
            <div className="flex items-center justify-between relative">
                {/* Background line */}
                <div className="absolute top-4 left-0 right-0 h-0.5 bg-white/10" />

                {/* Progress line */}
                <motion.div
                    className="absolute top-4 left-0 h-0.5 bg-white"
                    initial={{ width: 0 }}
                    animate={{ width: `${(currentIdx / (flow.length - 1)) * 100}%` }}
                    transition={{ duration: 0.5 }}
                />

                {flow.map((step, idx) => {
                    const isCompleted = idx < currentIdx;
                    const isCurrent = idx === currentIdx;
                    const isNext = idx === currentIdx + 1;
                    const canClick = isNext && !updating;

                    return (
                        <div key={step} className="flex flex-col items-center relative z-10" style={{ flex: 1 }}>
                            {/* Circle/Button */}
                            <button
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
                                className={`
                                    w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold
                                    transition-all duration-200 border-2
                                    ${isCompleted ? 'bg-white text-black border-white' : ''}
                                    ${isCurrent ? 'bg-white text-black border-white scale-110' : ''}
                                    ${isNext ? 'bg-transparent text-white border-white/50 hover:border-white hover:bg-white/10 cursor-pointer' : ''}
                                    ${!isCompleted && !isCurrent && !isNext ? 'bg-transparent text-white/30 border-white/20' : ''}
                                    ${updating && isNext ? 'opacity-50' : ''}
                                `}
                            >
                                {isCompleted ? '✓' : idx + 1}
                            </button>

                            {/* Label */}
                            <span className={`
                                mt-2 text-[10px] font-medium text-center whitespace-nowrap
                                ${isCompleted || isCurrent ? 'text-white' : 'text-white/40'}
                            `}>
                                {STATUS_LABELS[step]}
                            </span>

                            {/* Click hint */}
                            {isNext && (
                                <span className="text-[8px] text-white/50 mt-0.5">click</span>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Status text */}
            <div className="flex items-center justify-between text-xs">
                <span className="text-white/50">{currentIdx + 1} / {flow.length}</span>
                <span className="text-white font-medium">{STATUS_LABELS[currentStatus]}</span>
            </div>
        </div>
    );
}
