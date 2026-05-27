'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Box, Printer, Sparkles } from 'lucide-react';

type ShowcaseImage = {
  src: string;
};

type CarouselRole = 'center' | 'left' | 'right' | 'back';

const IMAGES: ShowcaseImage[] = [
  { src: 'https://fifth-gentle-45902158.figma.site/_components/v2/4de492f6d9cf8244ad5293233e5c6f52407d42fc/1.02464a56.png' },
  { src: 'https://fifth-gentle-45902158.figma.site/_components/v2/4de492f6d9cf8244ad5293233e5c6f52407d42fc/2.b977faab.png' },
  { src: 'https://fifth-gentle-45902158.figma.site/_components/v2/4de492f6d9cf8244ad5293233e5c6f52407d42fc/3.4df853b4.png' },
  { src: 'https://fifth-gentle-45902158.figma.site/_components/v2/4de492f6d9cf8244ad5293233e5c6f52407d42fc/4.4457fbce.png' },
];

const ACTIONS = [
  { href: '/custom', label: 'Custom theo ảnh', icon: Sparkles },
  { href: '/products', label: 'Sản phẩm có sẵn', icon: Box },
  { href: '/printing', label: 'Dịch vụ in 3D', icon: Printer },
];

const EASE = 'cubic-bezier(0.4, 0, 0.2, 1)';
const DURATION_MS = 420;
const grainOverlay =
  'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\' opacity=\'0.055\'/%3E%3C/svg%3E")';

function getRole(index: number, activeIndex: number): CarouselRole {
  if (index === activeIndex) return 'center';
  if (index === (activeIndex + 3) % IMAGES.length) return 'left';
  if (index === (activeIndex + 1) % IMAGES.length) return 'right';
  return 'back';
}

function getRoleStyle(role: CarouselRole, isMobile: boolean): React.CSSProperties {
  if (role === 'center') {
    return {
      transform: 'translate3d(-50%, 0, 0) scale(1)',
      opacity: 1,
      zIndex: 20,
      height: isMobile ? '78%' : '104%',
      bottom: isMobile ? '11%' : '3%',
    };
  }

  if (role === 'left') {
    return {
      transform: `translate3d(calc(-50% - ${isMobile ? '38vw' : '20vw'}), 0, 0) scale(1)`,
      opacity: 0.7,
      zIndex: 10,
      height: isMobile ? '22%' : '34%',
      bottom: isMobile ? '31%' : '13%',
    };
  }

  if (role === 'right') {
    return {
      transform: `translate3d(calc(-50% + ${isMobile ? '38vw' : '20vw'}), 0, 0) scale(1)`,
      opacity: 0.7,
      zIndex: 10,
      height: isMobile ? '22%' : '34%',
      bottom: isMobile ? '31%' : '13%',
    };
  }

  return {
    transform: 'translate3d(-50%, 0, 0) scale(1)',
    opacity: 0.38,
    zIndex: 5,
    height: isMobile ? '18%' : '28%',
    bottom: isMobile ? '32%' : '13%',
  };
}

export function MiniVersionShowcase() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const isAnimatingRef = useRef(false);
  const touchStartRef = useRef({ x: 0, y: 0 });
  const animationTimerRef = useRef<number | null>(null);

  useEffect(() => {
    IMAGES.forEach((item) => {
      const img = new Image();
      img.src = item.src;
    });
  }, []);

  useEffect(() => {
    const updateMobileState = () => setIsMobile(window.innerWidth < 640);
    updateMobileState();
    window.addEventListener('resize', updateMobileState);
    return () => window.removeEventListener('resize', updateMobileState);
  }, []);

  const navigate = useCallback((direction: 'next' | 'prev') => {
    if (isAnimatingRef.current) return;

    isAnimatingRef.current = true;
    setActiveIndex((current) =>
      direction === 'next'
        ? (current + 1) % IMAGES.length
        : (current + IMAGES.length - 1) % IMAGES.length,
    );

    if (animationTimerRef.current) window.clearTimeout(animationTimerRef.current);
    animationTimerRef.current = window.setTimeout(() => {
      isAnimatingRef.current = false;
    }, DURATION_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (animationTimerRef.current) window.clearTimeout(animationTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') navigate('prev');
      if (event.key === 'ArrowRight') navigate('next');
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [navigate]);

  return (
    <section
      className="relative min-h-[900px] w-full overflow-hidden bg-black sm:min-h-screen"
      style={{ fontFamily: 'Inter, sans-serif', touchAction: 'pan-y' }}
      onTouchStart={(event) => {
        const touch = event.changedTouches[0];
        touchStartRef.current = { x: touch.screenX, y: touch.screenY };
      }}
      onTouchEnd={(event) => {
        const touch = event.changedTouches[0];
        const dx = touch.screenX - touchStartRef.current.x;
        const dy = touch.screenY - touchStartRef.current.y;
        if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
          navigate(dx < 0 ? 'next' : 'prev');
        }
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 z-[50] bg-repeat opacity-25"
        style={{ backgroundImage: grainOverlay, backgroundSize: '200px 200px' }}
      />

      <div
        className="pointer-events-none absolute inset-x-0 z-[2] flex select-none items-center justify-center whitespace-nowrap uppercase text-white"
        style={{
          top: '18%',
          fontFamily: 'Anton, sans-serif',
          fontSize: 'clamp(96px, 28vw, 400px)',
          fontWeight: 900,
          lineHeight: 1,
          letterSpacing: '-0.02em',
          opacity: 0.72,
        }}
      >
        MINIVER
      </div>

      <div className="absolute inset-0 z-[3]">
        {IMAGES.map((item, index) => {
          const role = getRole(index, activeIndex);
          return (
            <div
              key={item.src}
              className="absolute left-1/2"
              style={{
                width: isMobile ? '82vw' : 'min(44vw, 560px)',
                maxWidth: isMobile ? '520px' : '560px',
                transformOrigin: 'bottom center',
                willChange: 'transform, opacity, height, bottom',
                transition: [
                  `transform ${DURATION_MS}ms ${EASE}`,
                  `opacity ${DURATION_MS}ms ${EASE}`,
                  `bottom ${DURATION_MS}ms ${EASE}`,
                  `height ${DURATION_MS}ms ${EASE}`,
                ].join(', '),
                ...getRoleStyle(role, isMobile),
              }}
            >
              <img
                src={item.src}
                alt={`MINIVER figurine ${index + 1}`}
                draggable={false}
                className="h-full w-full select-none object-contain object-bottom drop-shadow-[0_34px_80px_rgba(0,0,0,0.75)]"
              />
            </div>
          );
        })}
      </div>

      <div className="absolute bottom-6 left-4 z-[60] max-w-[360px] sm:bottom-20 sm:left-24">
        <p
          className="mb-2 text-base font-bold uppercase text-white opacity-95 sm:mb-3 sm:text-[22px]"
          style={{ letterSpacing: '0.02em' }}
        >
          MINIVER FIGURINES
        </p>
        <p className="mb-4 hidden text-xs leading-[1.6] text-white opacity-85 sm:mb-5 sm:block sm:text-sm">
          Mô hình 3D cá nhân hoá từ ảnh thật, thiết kế theo phong cách riêng, hoàn thiện sắc nét và sẵn sàng đặt hàng.
        </p>
        <div className="mb-4 grid max-w-[360px] grid-cols-1 gap-2 sm:grid-cols-3">
          {ACTIONS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="group flex items-center justify-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold text-white backdrop-blur-md transition hover:border-white/55 hover:bg-white/20"
            >
              <Icon className="h-4 w-4 transition group-hover:scale-110" strokeWidth={1.8} />
              {label}
            </Link>
          ))}
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            aria-label="Previous"
            onClick={() => navigate('prev')}
            className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-white bg-transparent text-white outline-none transition-[transform,background-color] duration-150 hover:scale-[1.08] hover:bg-white/10 active:scale-95 sm:h-16 sm:w-16"
          >
            <ArrowLeft size={26} strokeWidth={2.25} />
          </button>
          <button
            type="button"
            aria-label="Next"
            onClick={() => navigate('next')}
            className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-white bg-transparent text-white outline-none transition-[transform,background-color] duration-150 hover:scale-[1.08] hover:bg-white/10 active:scale-95 sm:h-16 sm:w-16"
          >
            <ArrowRight size={26} strokeWidth={2.25} />
          </button>
        </div>
      </div>

      <Link
        href="/custom"
        className="absolute bottom-6 right-4 z-[60] hidden items-center gap-1.5 uppercase leading-none text-white no-underline opacity-95 transition-opacity duration-200 hover:opacity-100 sm:bottom-20 sm:right-10 sm:flex"
        style={{
          fontFamily: 'Anton, sans-serif',
          fontSize: 'clamp(20px, 4vw, 56px)',
          fontWeight: 400,
          letterSpacing: '-0.02em',
        }}
      >
        KHÁM PHÁ NGAY
        <ArrowRight className="h-5 w-5 sm:h-8 sm:w-8" strokeWidth={2.25} />
      </Link>

      <div className="pointer-events-none absolute bottom-[90px] left-1/2 z-[60] -translate-x-1/2 animate-pulse text-[11px] uppercase tracking-[0.1em] text-white/40 sm:hidden">
        ← Swipe →
      </div>
    </section>
  );
}


