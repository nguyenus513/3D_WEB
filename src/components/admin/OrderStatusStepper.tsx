'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getFlowByType, getStepIndex, normalizeOrderFlowType, type FlowStep } from '@/lib/utils/orderFlows';

interface OrderStatusStepperProps {
    currentStatus: string;
    className?: string;
    orderType?: string;
    onStatusChange?: (newStatus: string) => void;
    onShippingClick?: () => void;
    updating?: boolean;
}

export function OrderStatusStepper({
    currentStatus,
    className,
    orderType = 'custom',
    onStatusChange,
    onShippingClick,
    updating = false
}: OrderStatusStepperProps) {
    // Get flow steps from centralized config
    const normalizedOrderType = normalizeOrderFlowType(orderType);
    const flowSteps: FlowStep[] = getFlowByType(normalizedOrderType);

    // Find current step index
    const currentStepIndex = getStepIndex(flowSteps, currentStatus);

    return (
        <div className={cn("w-full py-4", className)}>
            <div className="relative flex items-center justify-between w-full">
                {/* Line background */}
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-[var(--material-glass)] -z-10 rounded-full" />

                {/* Line active */}
                <div
                    className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-white -z-10 rounded-full transition-all duration-500"
                    style={{
                        width: `${Math.max(0, (currentStepIndex / (flowSteps.length - 1)) * 100)}%`
                    }}
                />

                {flowSteps.map((step, index) => {
                    const Icon = step.icon;
                    const isCompleted = index < currentStepIndex;
                    const isCurrent = index === currentStepIndex;
                    const isNext = index === currentStepIndex + 1;
                    const canClick = isNext && !updating && onStatusChange;

                    return (
                        <div key={step.status} className="flex flex-col items-center group relative" style={{ flex: 1 }}>
                            <button
                                onClick={() => {
                                    if (canClick) {
                                        if (step.status === 'shipping' && onShippingClick) {
                                            onShippingClick();
                                        } else if (onStatusChange) {
                                            onStatusChange(step.status);
                                        }
                                    }
                                }}
                                disabled={!canClick}
                                className={cn(
                                    "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300",
                                    isCompleted ? "bg-white text-black border-white" : "",
                                    isCurrent ? "bg-white text-black border-white scale-110" : "",
                                    isNext ? "bg-transparent text-[var(--text-primary)] border-[var(--border-color)] hover:border-[var(--text-primary)] hover:bg-[var(--material-glass)] cursor-pointer" : "",
                                    !isCompleted && !isCurrent && !isNext ? "bg-transparent text-[var(--text-tertiary)] border-[var(--border-color)]" : "",
                                    updating && isNext ? "opacity-50" : ""
                                )}
                            >
                                {isCompleted ? <Check size={18} /> : <Icon size={18} />}
                            </button>

                            <span className={cn(
                                "mt-2 text-[10px] font-medium text-center whitespace-nowrap",
                                isCompleted || isCurrent ? "text-[var(--text-primary)]" : "text-[var(--text-tertiary)]"
                            )}>
                                {step.adminLabel}
                            </span>

                            {isNext && onStatusChange && (
                                <span className="text-[8px] text-[var(--text-secondary)] mt-0.5">click</span>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Status text */}
            <div className="flex items-center justify-between text-xs mt-6">
                <span className="text-[var(--text-secondary)]">{Math.max(0, currentStepIndex + 1)} / {flowSteps.length}</span>
                <span className="text-[var(--text-primary)] font-medium">
                    {flowSteps[currentStepIndex]?.adminLabel || currentStatus}
                </span>
            </div>
        </div>
    );
}
