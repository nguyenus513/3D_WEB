'use client';

import { useEffect, useRef, ReactNode } from 'react';
import { motion, useInView, useAnimation, Variant } from 'framer-motion';

interface AnimatedSectionProps {
    children: ReactNode;
    className?: string;
    delay?: number;
    animation?: 'fadeInUp' | 'fadeIn' | 'scaleUp' | 'slideInLeft' | 'slideInRight';
}

const animations: Record<string, { hidden: Variant; visible: Variant }> = {
    fadeInUp: {
        hidden: { opacity: 0, y: 60 },
        visible: { opacity: 1, y: 0 },
    },
    fadeIn: {
        hidden: { opacity: 0 },
        visible: { opacity: 1 },
    },
    scaleUp: {
        hidden: { opacity: 0, scale: 0.8 },
        visible: { opacity: 1, scale: 1 },
    },
    slideInLeft: {
        hidden: { opacity: 0, x: -60 },
        visible: { opacity: 1, x: 0 },
    },
    slideInRight: {
        hidden: { opacity: 0, x: 60 },
        visible: { opacity: 1, x: 0 },
    },
};

export function AnimatedSection({
    children,
    className = '',
    delay = 0,
    animation = 'fadeInUp'
}: AnimatedSectionProps) {
    const ref = useRef(null);
    const isInView = useInView(ref, { once: true, margin: '-100px' });
    const controls = useAnimation();

    useEffect(() => {
        if (isInView) {
            controls.start('visible');
        }
    }, [isInView, controls]);

    return (
        <motion.div
            ref={ref}
            initial="hidden"
            animate={controls}
            variants={animations[animation]}
            transition={{
                duration: 0.8,
                delay,
                ease: [0.25, 0.1, 0.25, 1], // Custom easing
            }}
            className={className}
        >
            {children}
        </motion.div>
    );
}

// Text reveal animation (character by character)
interface TextRevealProps {
    text: string;
    className?: string;
    delay?: number;
}

export function TextReveal({ text, className = '', delay = 0 }: TextRevealProps) {
    const ref = useRef(null);
    const isInView = useInView(ref, { once: true, margin: '-50px' });

    const words = text.split(' ');

    return (
        <span ref={ref} className={className}>
            {words.map((word, wordIndex) => (
                <span key={wordIndex} className="inline-block overflow-hidden mr-[0.25em]">
                    <motion.span
                        className="inline-block"
                        initial={{ y: '100%' }}
                        animate={isInView ? { y: 0 } : { y: '100%' }}
                        transition={{
                            duration: 0.6,
                            delay: delay + wordIndex * 0.1,
                            ease: [0.25, 0.1, 0.25, 1],
                        }}
                    >
                        {word}
                    </motion.span>
                </span>
            ))}
        </span>
    );
}

// Parallax effect component
interface ParallaxProps {
    children: ReactNode;
    speed?: number; // -1 to 1, negative = opposite direction
    className?: string;
}

export function Parallax({ children, speed = 0.5, className = '' }: ParallaxProps) {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const element = ref.current;
        if (!element) return;

        const handleScroll = () => {
            const rect = element.getBoundingClientRect();
            const scrolled = window.innerHeight - rect.top;
            const yOffset = scrolled * speed * 0.1;
            element.style.transform = `translateY(${yOffset}px)`;
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, [speed]);

    return (
        <div ref={ref} className={className} style={{ willChange: 'transform' }}>
            {children}
        </div>
    );
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
