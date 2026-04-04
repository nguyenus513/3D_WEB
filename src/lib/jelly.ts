import { useMemo } from 'react';
import { useReducedMotion, type TargetAndTransition, type Transition } from 'framer-motion';

export interface JellyMotionOptions {
    disabled?: boolean;
    hoverScale?: number;
    tapScale?: number;
    hoverY?: number;
    stiffness?: number;
    damping?: number;
    mass?: number;
}

export interface JellyMotionProps {
    whileHover?: TargetAndTransition;
    whileTap?: TargetAndTransition;
    transition?: Transition;
}

export function useJellyMotion(options: JellyMotionOptions = {}): JellyMotionProps {
    const reducedMotion = useReducedMotion();

    return useMemo(() => {
        if (reducedMotion || options.disabled) {
            return {};
        }

        const hoverScale = options.hoverScale ?? 1.02;
        const tapScale = options.tapScale ?? 0.98;
        const hoverY = options.hoverY ?? -1;

        return {
            whileHover: { scale: hoverScale, y: hoverY },
            whileTap: { scale: tapScale },
            transition: {
                type: 'spring',
                stiffness: options.stiffness ?? 320,
                damping: options.damping ?? 22,
                mass: options.mass ?? 0.6,
            },
        };
    }, [
        reducedMotion,
        options.disabled,
        options.hoverScale,
        options.tapScale,
        options.hoverY,
        options.stiffness,
        options.damping,
        options.mass,
    ]);
}
