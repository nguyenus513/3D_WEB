'use client';

import { useEffect, useState, useRef } from 'react';

export function CustomCursor() {
    const cursorRef = useRef<HTMLDivElement>(null);
    const cursorDotRef = useRef<HTMLDivElement>(null);
    const [isHovering, setIsHovering] = useState(false);
    const [hoverText, setHoverText] = useState('');
    const [isVisible, setIsVisible] = useState(false);

    // Target position for smooth follow
    const mousePos = useRef({ x: 0, y: 0 });
    const currentPos = useRef({ x: 0, y: 0 });

    useEffect(() => {
        // Check if device has fine pointer (mouse)
        const hasPointer = window.matchMedia('(pointer: fine)').matches;
        if (!hasPointer) return;

        setIsVisible(true);

        const handleMouseMove = (e: MouseEvent) => {
            mousePos.current = { x: e.clientX, y: e.clientY };
        };

        const handleMouseEnter = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            const cursorType = target.closest('[data-cursor]');

            if (cursorType) {
                setIsHovering(true);
                const text = cursorType.getAttribute('data-cursor-text') || '';
                setHoverText(text);
            }
        };

        const handleMouseLeave = () => {
            setIsHovering(false);
            setHoverText('');
        };

        // Smooth cursor follow with lerp
        const animate = () => {
            const lerp = 0.15;
            currentPos.current.x += (mousePos.current.x - currentPos.current.x) * lerp;
            currentPos.current.y += (mousePos.current.y - currentPos.current.y) * lerp;

            if (cursorRef.current) {
                cursorRef.current.style.transform = `translate3d(${currentPos.current.x}px, ${currentPos.current.y}px, 0)`;
            }
            if (cursorDotRef.current) {
                cursorDotRef.current.style.transform = `translate3d(${mousePos.current.x}px, ${mousePos.current.y}px, 0)`;
            }

            requestAnimationFrame(animate);
        };

        animate();
        window.addEventListener('mousemove', handleMouseMove);

        // Add event delegation for hover effects
        document.addEventListener('mouseover', handleMouseEnter);
        document.addEventListener('mouseout', handleMouseLeave);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseover', handleMouseEnter);
            document.removeEventListener('mouseout', handleMouseLeave);
        };
    }, []);

    if (!isVisible) return null;

    return (
        <>
            {/* Main cursor circle */}
            <div
                ref={cursorRef}
                className={`
          fixed top-0 left-0 pointer-events-none z-[9999]
          w-12 h-12 -ml-6 -mt-6
          rounded-full border border-white/50
          mix-blend-difference
          transition-all duration-300 ease-out
          ${isHovering ? 'scale-150 bg-white/10' : 'scale-100'}
        `}
                style={{ willChange: 'transform' }}
            >
                {/* Hover text */}
                {hoverText && (
                    <span className="absolute inset-0 flex items-center justify-center text-[10px] font-medium text-white uppercase tracking-wider">
                        {hoverText}
                    </span>
                )}
            </div>

            {/* Small dot in center */}
            <div
                ref={cursorDotRef}
                className={`
          fixed top-0 left-0 pointer-events-none z-[9999]
          w-2 h-2 -ml-1 -mt-1
          rounded-full bg-white
          mix-blend-difference
          transition-opacity duration-300
          ${isHovering ? 'opacity-0' : 'opacity-100'}
        `}
                style={{ willChange: 'transform' }}
            />
        </>
    );
}
