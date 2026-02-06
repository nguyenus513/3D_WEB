'use client';

import { Check, Clock, Package, Truck, PenTool, Image as ImageIcon, ThumbsUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OrderStatusStepperProps {
    currentStatus: string;
    className?: string;
    orderType?: 'custom' | 'printing' | 'ready_made';
    onStatusChange?: (newStatus: string) => void;
    onShippingClick?: () => void;
    updating?: boolean;
}

// Flow chuẩn cho đơn Custom
const CUSTOM_STEPS = [
    { value: 'confirmed', label: 'Xác nhận thanh toán', icon: Check },
    { value: 'designing', label: 'Đang thiết kế', icon: PenTool },
    { value: 'review', label: 'Chờ duyệt demo', icon: ImageIcon },
    { value: 'approved', label: 'Khách đã duyệt', icon: ThumbsUp },
    { value: 'production_pending', label: 'Chờ sản xuất', icon: Clock },
    { value: 'producing', label: 'Đang sản xuất', icon: Package },
    { value: 'shipping', label: 'Đang giao hàng', icon: Truck },
    { value: 'delivered', label: 'Hoàn thành', icon: Check }
];

// Flow cho đơn Printing
const PRINTING_STEPS = [
    { value: 'confirmed', label: 'Xác nhận', icon: Check },
    { value: 'printing', label: 'Đang in', icon: Package },
    { value: 'shipping', label: 'Đang giao hàng', icon: Truck },
    { value: 'delivered', label: 'Hoàn thành', icon: Check }
];

// Flow cho đơn Ready Made
const STANDARD_STEPS = [
    { value: 'confirmed', label: 'Đã xác nhận', icon: Check },
    { value: 'processing', label: 'Đang xử lý', icon: Package },
    { value: 'shipping', label: 'Đang giao hàng', icon: Truck },
    { value: 'delivered', label: 'Hoàn thành', icon: Check }
];

export function OrderStatusStepper({
    currentStatus,
    className,
    orderType = 'custom',
    onStatusChange,
    onShippingClick,
    updating = false
}: OrderStatusStepperProps) {
    const steps = orderType === 'custom' ? CUSTOM_STEPS :
        orderType === 'printing' ? PRINTING_STEPS : STANDARD_STEPS;

    const getCurrentStepIndex = (status: string) => {
        const index = steps.findIndex(s => s.value === status);
        if (index !== -1) return index;

        if (status === 'pending' || status === 'pending_confirmation') return -1;
        if (status === 'revising') {
            return steps.findIndex(s => s.value === 'designing');
        }

        return 0;
    };

    const currentStepIndex = getCurrentStepIndex(currentStatus);

    return (
        <div className={cn('w-full py-4', className)}>
            <div className="relative flex items-center justify-between w-full">
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-white/10 -z-10 rounded-full" />

                <div
                    className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-white -z-10 rounded-full transition-all duration-500"
                    style={{
                        width: `${Math.max(0, (currentStepIndex / (steps.length - 1)) * 100)}%`
                    }}
                />

                {steps.map((step, index) => {
                    const Icon = step.icon;
                    const isCompleted = index < currentStepIndex;
                    const isCurrent = index === currentStepIndex;
                    const isNext = index === currentStepIndex + 1;
                    const canClick = isNext && !updating && onStatusChange;

                    return (
                        <div key={step.value} className="flex flex-col items-center group relative" style={{ flex: 1 }}>
                            <button
                                onClick={() => {
                                    if (canClick) {
                                        if (step.value === 'shipping' && onShippingClick) {
                                            onShippingClick();
                                        } else if (onStatusChange) {
                                            onStatusChange(step.value);
                                        }
                                    }
                                }}
                                disabled={!canClick}
                                className={cn(
                                    'w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300',
                                    isCompleted ? 'bg-white text-black border-white' : '',
                                    isCurrent ? 'bg-white text-black border-white scale-110' : '',
                                    isNext ? 'bg-transparent text-white border-white/50 hover:border-white hover:bg-white/10 cursor-pointer' : '',
                                    !isCompleted && !isCurrent && !isNext ? 'bg-transparent text-white/30 border-white/20' : '',
                                    updating && isNext ? 'opacity-50' : ''
                                )}
                            >
                                {isCompleted ? <Check size={18} /> : <Icon size={18} />}
                            </button>

                            <span className={cn(
                                'mt-2 text-[10px] font-medium text-center whitespace-nowrap',
                                isCompleted || isCurrent ? 'text-white' : 'text-white/40'
                            )}>
                                {step.label}
                            </span>

                            {isNext && onStatusChange && (
                                <span className="text-[8px] text-white/50 mt-0.5">click</span>
                            )}
                        </div>
                    );
                })}
            </div>

            <div className="flex items-center justify-between text-xs mt-6">
                <span className="text-white/50">{Math.max(0, currentStepIndex + 1)} / {steps.length}</span>
                <span className="text-white font-medium">
                    {steps[currentStepIndex]?.label || currentStatus}
                </span>
            </div>
        </div>
    );
}
