'use client';

/**
 * Avatar Component
 * 
 * User avatar with image, initials, or icon fallback.
 * Supports various sizes and status indicators.
 */

import { useState, type ReactNode } from 'react';
import { clsx } from 'clsx';
import { IconUser } from '@tabler/icons-react';

// =============================================================================
// Types
// =============================================================================

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
type AvatarStatus = 'online' | 'offline' | 'away' | 'busy';

interface AvatarProps {
    src?: string | null;
    alt?: string;
    name?: string;
    size?: AvatarSize;
    status?: AvatarStatus;
    fallback?: ReactNode;
    className?: string;
}

interface AvatarGroupProps {
    children: ReactNode;
    max?: number;
    size?: AvatarSize;
    className?: string;
}

// =============================================================================
// Size Config
// =============================================================================

const sizeConfig = {
    xs: { container: 'w-6 h-6', text: 'text-[10px]', icon: 14, status: 'w-1.5 h-1.5' },
    sm: { container: 'w-8 h-8', text: 'text-xs', icon: 16, status: 'w-2 h-2' },
    md: { container: 'w-10 h-10', text: 'text-sm', icon: 20, status: 'w-2.5 h-2.5' },
    lg: { container: 'w-12 h-12', text: 'text-base', icon: 24, status: 'w-3 h-3' },
    xl: { container: 'w-16 h-16', text: 'text-lg', icon: 32, status: 'w-3.5 h-3.5' },
    '2xl': { container: 'w-20 h-20', text: 'text-xl', icon: 40, status: 'w-4 h-4' },
};

const statusConfig = {
    online: 'bg-green-500',
    offline: 'bg-gray-500',
    away: 'bg-yellow-500',
    busy: 'bg-red-500',
};

// =============================================================================
// Helper Functions
// =============================================================================

function getInitials(name: string): string {
    return name
        .split(' ')
        .map((word) => word[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
}

function getColorFromName(name: string): string {
    const colors = [
        'bg-blue-500',
        'bg-purple-500',
        'bg-pink-500',
        'bg-indigo-500',
        'bg-cyan-500',
        'bg-teal-500',
        'bg-green-500',
        'bg-orange-500',
    ];
    const index = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[index % colors.length];
}

// =============================================================================
// Avatar Component
// =============================================================================

export function Avatar({
    src,
    alt = '',
    name,
    size = 'md',
    status,
    fallback,
    className,
}: AvatarProps) {
    const [imageError, setImageError] = useState(false);
    const config = sizeConfig[size];

    const showImage = src && !imageError;
    const showInitials = !showImage && name;
    const showFallback = !showImage && !showInitials;

    return (
        <div className={clsx('relative inline-flex', className)}>
            <div
                className={clsx(
                    'relative flex items-center justify-center rounded-full overflow-hidden',
                    'ring-2 ring-[#0a0a0a]',
                    config.container,
                    !showImage && (name ? getColorFromName(name) : 'bg-white/10')
                )}
            >
                {showImage && (
                    <img
                        src={src}
                        alt={alt || name || 'Avatar'}
                        className="w-full h-full object-cover"
                        onError={() => setImageError(true)}
                    />
                )}
                {showInitials && (
                    <span className={clsx('font-medium text-white', config.text)}>
                        {getInitials(name)}
                    </span>
                )}
                {showFallback && (
                    fallback || <IconUser size={config.icon} className="text-white/60" />
                )}
            </div>

            {/* Status Indicator */}
            {status && (
                <span
                    className={clsx(
                        'absolute bottom-0 right-0 rounded-full ring-2 ring-[#0a0a0a]',
                        config.status,
                        statusConfig[status]
                    )}
                />
            )}
        </div>
    );
}

// =============================================================================
// Avatar Group
// =============================================================================

export function AvatarGroup({
    children,
    max = 5,
    size = 'md',
    className,
}: AvatarGroupProps) {
    const avatars = Array.isArray(children) ? children : [children];
    const displayAvatars = avatars.slice(0, max);
    const remaining = avatars.length - max;

    return (
        <div className={clsx('flex -space-x-2', className)}>
            {displayAvatars}
            {remaining > 0 && (
                <div
                    className={clsx(
                        'relative flex items-center justify-center rounded-full',
                        'bg-white/10 ring-2 ring-[#0a0a0a]',
                        sizeConfig[size].container
                    )}
                >
                    <span className={clsx('font-medium text-white', sizeConfig[size].text)}>
                        +{remaining}
                    </span>
                </div>
            )}
        </div>
    );
}

export default Avatar;
