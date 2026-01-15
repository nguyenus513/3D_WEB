'use client';

import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface NoiseBackgroundProps {
    children: React.ReactNode;
    containerClassName?: string;
    gradientColors?: string[];
}

export function NoiseBackground({
    children,
    containerClassName,
    gradientColors = ['rgb(0, 113, 227)', 'rgb(139, 92, 246)', 'rgb(0, 199, 190)'],
}: NoiseBackgroundProps) {
    return (
        <div className={cn('relative', containerClassName)}>
            {/* Animated gradient background */}
            <motion.div
                className="absolute inset-0 rounded-full opacity-80 blur-sm"
                style={{
                    background: `linear-gradient(135deg, ${gradientColors.join(', ')})`,
                    backgroundSize: '200% 200%',
                }}
                animate={{
                    backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
                }}
                transition={{
                    duration: 5,
                    repeat: Infinity,
                    ease: 'linear',
                }}
            />

            {/* Noise overlay */}
            <div
                className="absolute inset-0 rounded-full opacity-20"
                style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
                }}
            />

            {/* Content */}
            <div className="relative z-10">{children}</div>
        </div>
    );
}

// Pre-built Order Button with NoiseBackground
export function OrderButton({
    children = 'Đặt hàng ngay',
    onClick,
    className,
}: {
    children?: React.ReactNode;
    onClick?: () => void;
    className?: string;
}) {
    return (
        <NoiseBackground
            containerClassName="w-fit p-[3px] rounded-full"
            gradientColors={['rgb(0, 113, 227)', 'rgb(139, 92, 246)', 'rgb(0, 199, 190)']}
        >
            <button
                onClick={onClick}
                className={cn(
                    'cursor-pointer rounded-full bg-[#0a0a0a] px-6 py-3 text-white font-medium',
                    'shadow-[0px_1px_0px_0px_rgba(255,255,255,0.1)_inset]',
                    'transition-all duration-200 hover:bg-[#1D1D1F] active:scale-[0.98]',
                    'flex items-center gap-2',
                    className
                )}
            >
                {children}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
            </button>
        </NoiseBackground>
    );
}
