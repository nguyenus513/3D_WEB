'use client';

import { cn } from '@/lib/utils';
import {
    AnimatePresence,
    MotionValue,
    motion,
    useMotionValue,
    useSpring,
    useTransform,
} from 'framer-motion';
import Link from 'next/link';
import { useRef, useState } from 'react';

export interface DockItem {
    title: string;
    icon: React.ReactNode;
    href: string;
}

export function FloatingDock({
    items,
    desktopClassName,
    mobileClassName,
}: {
    items: DockItem[];
    desktopClassName?: string;
    mobileClassName?: string;
}) {
    return (
        <>
            <FloatingDockDesktop items={items} className={desktopClassName} />
            <FloatingDockMobile items={items} className={mobileClassName} />
        </>
    );
}

function FloatingDockMobile({
    items,
    className,
}: {
    items: DockItem[];
    className?: string;
}) {
    const [open, setOpen] = useState(false);

    return (
        <div className={cn('fixed bottom-6 right-6 md:hidden z-[100]', className)}>
            <AnimatePresence>
                {open && (
                    <motion.div
                        layoutId="nav"
                        className="absolute bottom-full mb-2 inset-x-0 flex flex-col gap-2"
                    >
                        {items.map((item, idx) => (
                            <motion.div
                                key={item.title}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 10, transition: { delay: idx * 0.05 } }}
                                transition={{ delay: (items.length - 1 - idx) * 0.05 }}
                            >
                                <Link
                                    href={item.href}
                                    className="h-12 w-12 rounded-full bg-[#1D1D1F] flex items-center justify-center border border-white/10"
                                >
                                    <div className="h-5 w-5">{item.icon}</div>
                                </Link>
                            </motion.div>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
            <button
                onClick={() => setOpen(!open)}
                className="h-14 w-14 rounded-full bg-[#1D1D1F] flex items-center justify-center border border-white/10"
            >
                <svg
                    className="w-6 h-6 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    {open ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    )}
                </svg>
            </button>
        </div>
    );
}

function FloatingDockDesktop({
    items,
    className,
}: {
    items: DockItem[];
    className?: string;
}) {
    const mouseX = useMotionValue(Infinity);

    return (
        <motion.div
            onMouseMove={(e) => mouseX.set(e.pageX)}
            onMouseLeave={() => mouseX.set(Infinity)}
            className={cn(
                'fixed bottom-6 left-1/2 -translate-x-1/2 z-[100]',
                'hidden md:flex items-end gap-3 px-4 py-3',
                'bg-[#1D1D1F]/80 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl',
                className
            )}
        >
            {items.map((item) => (
                <IconContainer key={item.title} mouseX={mouseX} {...item} />
            ))}
        </motion.div>
    );
}

function IconContainer({
    mouseX,
    title,
    icon,
    href,
}: {
    mouseX: MotionValue;
    title: string;
    icon: React.ReactNode;
    href: string;
}) {
    const ref = useRef<HTMLDivElement>(null);

    const distance = useTransform(mouseX, (val) => {
        const bounds = ref.current?.getBoundingClientRect() ?? { x: 0, width: 0 };
        return val - bounds.x - bounds.width / 2;
    });

    const widthTransform = useTransform(distance, [-150, 0, 150], [48, 72, 48]);
    const heightTransform = useTransform(distance, [-150, 0, 150], [48, 72, 48]);
    const iconSizeTransform = useTransform(distance, [-150, 0, 150], [20, 32, 20]);

    const width = useSpring(widthTransform, { mass: 0.1, stiffness: 150, damping: 12 });
    const height = useSpring(heightTransform, { mass: 0.1, stiffness: 150, damping: 12 });
    const iconSize = useSpring(iconSizeTransform, { mass: 0.1, stiffness: 150, damping: 12 });

    const [hovered, setHovered] = useState(false);

    return (
        <Link href={href}>
            <motion.div
                ref={ref}
                style={{ width, height }}
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
                className="relative flex items-center justify-center rounded-full bg-[#2D2D2F] cursor-pointer hover:bg-[#3D3D3F] transition-colors"
            >
                <AnimatePresence>
                    {hovered && (
                        <motion.div
                            initial={{ opacity: 0, y: 10, x: '-50%' }}
                            animate={{ opacity: 1, y: 0, x: '-50%' }}
                            exit={{ opacity: 0, y: 2, x: '-50%' }}
                            className="absolute -top-10 left-1/2 px-3 py-1.5 whitespace-nowrap rounded-md bg-[#1D1D1F] border border-white/10 text-white text-xs font-medium"
                        >
                            {title}
                        </motion.div>
                    )}
                </AnimatePresence>
                <motion.div
                    style={{ width: iconSize, height: iconSize }}
                    className="flex items-center justify-center"
                >
                    {icon}
                </motion.div>
            </motion.div>
        </Link>
    );
}
