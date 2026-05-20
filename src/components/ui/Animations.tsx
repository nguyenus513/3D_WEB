'use client';

import { ReactNode, useEffect, useRef } from 'react';

interface AnimatedSectionProps {
    children: ReactNode;
    className?: string;
    delay?: number;
    animation?: 'fadeInUp' | 'fadeIn' | 'scaleUp' | 'slideInLeft' | 'slideInRight';
}

export function AnimatedSection({
    children,
    className = '',
    delay: _delay = 0,
    animation: _animation = 'fadeInUp'
}: AnimatedSectionProps) {
    return (
        <div className={className}>
            {children}
        </div>
    );
}

// Text reveal animation (character by character)
interface TextRevealProps {
    text: string;
    className?: string;
    delay?: number;
}

export function TextReveal({ text, className = '', delay = 0 }: TextRevealProps) {
    void delay;
    return <span className={className}>{text}</span>;
}

// Parallax effect component
interface ParallaxProps {
    children: ReactNode;
    speed?: number; // -1 to 1, negative = opposite direction
    className?: string;
}

export function Parallax({ children, speed = 0.5, className = '' }: ParallaxProps) {
    void speed;
    return <div className={className}>{children}</div>;
}

// Magnetic button effect
interface MagneticProps {
    children: ReactNode;
    className?: string;
    strength?: number;
}

export function Magnetic({ children, className = '', strength = 0.3 }: MagneticProps) {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const element = ref.current;
        if (!element) return;

        const handleMouseMove = (e: MouseEvent) => {
            const rect = element.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            const deltaX = (e.clientX - centerX) * strength;
            const deltaY = (e.clientY - centerY) * strength;
            element.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
        };

        const handleMouseLeave = () => {
            element.style.transform = 'translate(0, 0)';
        };

        element.addEventListener('mousemove', handleMouseMove);
        element.addEventListener('mouseleave', handleMouseLeave);

        return () => {
            element.removeEventListener('mousemove', handleMouseMove);
            element.removeEventListener('mouseleave', handleMouseLeave);
        };
    }, [strength]);

    return (
        <div ref={ref} className={className} style={{ transition: 'transform 0.3s ease-out' }}>
            {children}
        </div>
    );
}
