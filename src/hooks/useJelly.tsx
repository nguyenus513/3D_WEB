"use client";

import { useEffect, useMemo, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { useMotionPreference } from "@/components/providers/MotionPreferenceProvider";

export type JellyIntensity = "low" | "normal" | "high" | number;

export interface JellyConfig {
    intensity?: JellyIntensity;
    hoverScale?: number;
    tapScale?: number;
    stiffness?: number;
    damping?: number;
    duration?: number;
    easing?: number[] | string;
    disabled?: boolean;
}

function resolveIntensity(value: JellyIntensity | undefined): number {
    if (typeof value === "number") return Math.max(0, Math.min(2, value));
    if (value === "low") return 0.6;
    if (value === "high") return 1.2;
    return 1;
}

function useViewportScale() {
    const [scale, setScale] = useState(1);

    useEffect(() => {
        const update = () => {
            const width = window.innerWidth;
            if (width < 768) {
                setScale(0.7);
            } else if (width < 1024) {
                setScale(0.85);
            } else {
                setScale(1);
            }
        };
        update();
        window.addEventListener("resize", update);
        return () => window.removeEventListener("resize", update);
    }, []);

    return scale;
}

export function useJelly(config: JellyConfig = {}) {
    const { motionEnabled, prefersReducedMotion } = useMotionPreference();
    const reducedMotion = useReducedMotion();
    const viewportScale = useViewportScale();

    const disabled = config.disabled || !motionEnabled || prefersReducedMotion || reducedMotion;
    const intensity = resolveIntensity(config.intensity) * viewportScale;

    const hoverScale = config.hoverScale ?? 1.03;
    const tapScale = config.tapScale ?? 0.97;

    const safeHover = 1 + (hoverScale - 1) * intensity;
    const safeTap = 1 - (1 - tapScale) * intensity;

    const transition = useMemo(() => ({
        type: "spring",
        stiffness: config.stiffness ?? 700,
        damping: config.damping ?? 28,
        duration: config.duration,
        ease: config.easing,
    }), [config.stiffness, config.damping, config.duration, config.easing]);

    if (disabled) {
        return {
            whileHover: undefined,
            whileTap: undefined,
            transition: undefined,
            enabled: false,
        };
    }

    return {
        whileHover: { scale: safeHover },
        whileTap: { scale: safeTap },
        transition,
        enabled: true,
    };
}

