'use client';

import { useEffect, useRef, ReactNode } from 'react';
import Lenis from '@studio-freight/lenis';

interface SmoothScrollProps {
    children: ReactNode;
}

export function SmoothScroll({ children }: SmoothScrollProps) {
    const lenisRef = useRef<Lenis | null>(null);

    useEffect(() => {
        // Initialize Lenis smooth scroll
        lenisRef.current = new Lenis({
            duration: 1.2,
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
            orientation: 'vertical',
            smoothWheel: true,
        });

        function raf(time: number) {
            lenisRef.current?.raf(time);
            requestAnimationFrame(raf);
        }

        requestAnimationFrame(raf);

        // Expose lenis to window for GSAP ScrollTrigger integration
        (window as unknown as { lenis: Lenis }).lenis = lenisRef.current;

        return () => {
            lenisRef.current?.destroy();
        };
    }, []);

    return <>{children}</>;
}
