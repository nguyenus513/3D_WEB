'use client';

/**
 * Slider Component
 * 
 * Range slider input with single or range values.
 * Follows WAI-ARIA slider pattern.
 */

import { useState, useRef, useCallback, useEffect, type KeyboardEvent } from 'react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { useJellyMotion } from '@/lib/jelly';

// =============================================================================
// Types
// =============================================================================

interface SliderProps {
    value?: number;
    defaultValue?: number;
    min?: number;
    max?: number;
    step?: number;
    onChange?: (value: number) => void;
    onChangeEnd?: (value: number) => void;
    disabled?: boolean;
    showValue?: boolean;
    formatValue?: (value: number) => string;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
    'aria-label'?: string;
}

interface RangeSliderProps {
    value?: [number, number];
    defaultValue?: [number, number];
    min?: number;
    max?: number;
    step?: number;
    onChange?: (value: [number, number]) => void;
    onChangeEnd?: (value: [number, number]) => void;
    disabled?: boolean;
    showValue?: boolean;
    formatValue?: (value: number) => string;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
    'aria-label'?: string;
}

// =============================================================================
// Size Config
// =============================================================================

const sizeConfig = {
    sm: { track: 'h-1', thumb: 'w-3 h-3' },
    md: { track: 'h-1.5', thumb: 'w-4 h-4' },
    lg: { track: 'h-2', thumb: 'w-5 h-5' },
};

// =============================================================================
// Slider Component
// =============================================================================

export function Slider({
    value: controlledValue,
    defaultValue = 0,
    min = 0,
    max = 100,
    step = 1,
    onChange,
    onChangeEnd,
    disabled = false,
    showValue = false,
    formatValue = (v) => String(v),
    size = 'md',
    className,
    'aria-label': ariaLabel,
}: SliderProps) {
    const [internalValue, setInternalValue] = useState(defaultValue);
    const [isDragging, setIsDragging] = useState(false);
    const trackRef = useRef<HTMLDivElement>(null);
    const config = sizeConfig[size];
    const jellyThumb = useJellyMotion({ disabled, hoverScale: 1.05, tapScale: 0.97, hoverY: 0 });

    const value = controlledValue ?? internalValue;
    const percentage = ((value - min) / (max - min)) * 100;

    const updateValue = useCallback(
        (clientX: number) => {
            if (!trackRef.current || disabled) return;

            const rect = trackRef.current.getBoundingClientRect();
            const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
            const rawValue = min + percent * (max - min);
            const steppedValue = Math.round(rawValue / step) * step;
            const clampedValue = Math.max(min, Math.min(max, steppedValue));

            if (controlledValue === undefined) {
                setInternalValue(clampedValue);
            }
            onChange?.(clampedValue);
        },
        [min, max, step, disabled, controlledValue, onChange]
    );

    const handleMouseDown = (e: React.MouseEvent) => {
        if (disabled) return;
        e.preventDefault();
        setIsDragging(true);
        updateValue(e.clientX);
    };

    const handleMouseMove = useCallback(
        (e: MouseEvent) => {
            if (isDragging) {
                updateValue(e.clientX);
            }
        },
        [isDragging, updateValue]
    );

    const handleMouseUp = useCallback(() => {
        if (isDragging) {
            setIsDragging(false);
            onChangeEnd?.(value);
        }
    }, [isDragging, value, onChangeEnd]);

    useEffect(() => {
        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, handleMouseMove, handleMouseUp]);

    const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
        if (disabled) return;

        let newValue = value;
        switch (e.key) {
            case 'ArrowRight':
            case 'ArrowUp':
                newValue = Math.min(max, value + step);
                break;
            case 'ArrowLeft':
            case 'ArrowDown':
                newValue = Math.max(min, value - step);
                break;
            case 'Home':
                newValue = min;
                break;
            case 'End':
                newValue = max;
                break;
            case 'PageUp':
                newValue = Math.min(max, value + step * 10);
                break;
            case 'PageDown':
                newValue = Math.max(min, value - step * 10);
                break;
            default:
                return;
        }

        e.preventDefault();
        if (controlledValue === undefined) {
            setInternalValue(newValue);
        }
        onChange?.(newValue);
        onChangeEnd?.(newValue);
    };

    return (
        <div className={clsx('w-full', className)}>
            {showValue && (
                <div className="flex justify-between text-sm text-white/60 mb-2">
                    <span>{formatValue(min)}</span>
                    <span className="font-medium text-white">{formatValue(value)}</span>
                    <span>{formatValue(max)}</span>
                </div>
            )}
            <div
                ref={trackRef}
                className={clsx(
                    'relative w-full rounded-full bg-white/10 cursor-pointer',
                    config.track,
                    disabled && 'opacity-50 cursor-not-allowed'
                )}
                onMouseDown={handleMouseDown}
            >
                {/* Filled Track */}
                <div
                    className={clsx('absolute inset-y-0 left-0 rounded-full bg-[#0071E3]')}
                    style={{ width: `${percentage}%` }}
                />

                {/* Thumb */}
                <motion.div
                    role="slider"
                    tabIndex={disabled ? -1 : 0}
                    aria-valuemin={min}
                    aria-valuemax={max}
                    aria-valuenow={value}
                    aria-label={ariaLabel}
                    aria-disabled={disabled}
                    onKeyDown={handleKeyDown}
                    className={clsx(
                        'absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full',
                        'bg-white shadow-md',
                        'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]',
                        config.thumb,
                        isDragging && 'scale-110'
                    )}
                    style={{ left: `${percentage}%` }}
                    animate={{ scale: isDragging ? 1.1 : 1 }}
                    transition={{ duration: 0.1 }}
                    {...jellyThumb}
                />
            </div>
        </div>
    );
}

// =============================================================================
// Range Slider Component
// =============================================================================

export function RangeSlider({
    value: controlledValue,
    defaultValue = [25, 75],
    min = 0,
    max = 100,
    step = 1,
    onChange,
    onChangeEnd,
    disabled = false,
    showValue = false,
    formatValue = (v) => String(v),
    size = 'md',
    className,
    'aria-label': ariaLabel,
}: RangeSliderProps) {
    const [internalValue, setInternalValue] = useState(defaultValue);
    const [activeThumb, setActiveThumb] = useState<0 | 1 | null>(null);
    const trackRef = useRef<HTMLDivElement>(null);
    const config = sizeConfig[size];
    const jellyThumb = useJellyMotion({ disabled, hoverScale: 1.05, tapScale: 0.97, hoverY: 0 });

    const value = controlledValue ?? internalValue;
    const [minVal, maxVal] = value;
    const minPercent = ((minVal - min) / (max - min)) * 100;
    const maxPercent = ((maxVal - min) / (max - min)) * 100;

    const updateValue = useCallback(
        (clientX: number, thumbIndex: 0 | 1) => {
            if (!trackRef.current || disabled) return;

            const rect = trackRef.current.getBoundingClientRect();
            const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
            const rawValue = min + percent * (max - min);
            const steppedValue = Math.round(rawValue / step) * step;

            let newValue: [number, number];
            if (thumbIndex === 0) {
                newValue = [Math.min(steppedValue, value[1] - step), value[1]];
            } else {
                newValue = [value[0], Math.max(steppedValue, value[0] + step)];
            }

            newValue = [
                Math.max(min, Math.min(max, newValue[0])),
                Math.max(min, Math.min(max, newValue[1])),
            ];

            if (controlledValue === undefined) {
                setInternalValue(newValue);
            }
            onChange?.(newValue);
        },
        [min, max, step, value, disabled, controlledValue, onChange]
    );

    const handleMouseDown = (e: React.MouseEvent, thumbIndex: 0 | 1) => {
        if (disabled) return;
        e.preventDefault();
        e.stopPropagation();
        setActiveThumb(thumbIndex);
        updateValue(e.clientX, thumbIndex);
    };

    useEffect(() => {
        if (activeThumb === null) return;

        const handleMouseMove = (e: MouseEvent) => {
            updateValue(e.clientX, activeThumb);
        };

        const handleMouseUp = () => {
            setActiveThumb(null);
            onChangeEnd?.(value);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [activeThumb, updateValue, value, onChangeEnd]);

    return (
        <div className={clsx('w-full', className)}>
            {showValue && (
                <div className="flex justify-between text-sm text-white/60 mb-2">
                    <span className="font-medium text-white">{formatValue(minVal)}</span>
                    <span>-</span>
                    <span className="font-medium text-white">{formatValue(maxVal)}</span>
                </div>
            )}
            <div
                ref={trackRef}
                className={clsx(
                    'relative w-full rounded-full bg-white/10',
                    config.track,
                    disabled && 'opacity-50 cursor-not-allowed'
                )}
            >
                {/* Filled Track */}
                <div
                    className="absolute inset-y-0 rounded-full bg-[#0071E3]"
                    style={{ left: `${minPercent}%`, right: `${100 - maxPercent}%` }}
                />

                {/* Min Thumb */}
                <motion.div
                    role="slider"
                    tabIndex={disabled ? -1 : 0}
                    aria-valuemin={min}
                    aria-valuemax={value[1]}
                    aria-valuenow={minVal}
                    aria-label={`${ariaLabel} minimum`}
                    onMouseDown={(e) => handleMouseDown(e, 0)}
                    className={clsx(
                        'absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full',
                        'bg-white shadow-md cursor-grab',
                        'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3]',
                        config.thumb,
                        activeThumb === 0 && 'scale-110 cursor-grabbing'
                    )}
                    style={{ left: `${minPercent}%`, zIndex: activeThumb === 0 ? 10 : 1 }}
                    {...jellyThumb}
                />

                {/* Max Thumb */}
                <motion.div
                    role="slider"
                    tabIndex={disabled ? -1 : 0}
                    aria-valuemin={value[0]}
                    aria-valuemax={max}
                    aria-valuenow={maxVal}
                    aria-label={`${ariaLabel} maximum`}
                    onMouseDown={(e) => handleMouseDown(e, 1)}
                    className={clsx(
                        'absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full',
                        'bg-white shadow-md cursor-grab',
                        'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3]',
                        config.thumb,
                        activeThumb === 1 && 'scale-110 cursor-grabbing'
                    )}
                    style={{ left: `${maxPercent}%`, zIndex: activeThumb === 1 ? 10 : 1 }}
                    {...jellyThumb}
                />
            </div>
        </div>
    );
}

export default Slider;
