'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { AnimatedSection, Parallax } from '../ui/Animations';

const services = [
    {
        id: 'products',
        title: 'Sản Phẩm Có Sẵn',
        description: 'Khám phá bộ sưu tập mô hình 3D độc đáo, chất lượng cao.',
        icon: (
            <svg className="w-16 h-16 md:w-20 md:h-20 text-[var(--text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
        ),
        href: '/products',
        gradient: 'from-[var(--material-glass)] to-transparent',
        size: 'normal',
    },
    {
        id: 'custom',
        title: 'Tùy Biến Theo Yêu Cầu',
        description: 'Tạo mô hình từ ảnh của bạn. Single, Couple, Group.',
        icon: (
            <svg className="w-16 h-16 md:w-20 md:h-20 text-[var(--text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
        ),
        href: '/custom',
        gradient: 'from-[var(--material-glass)] to-transparent',
        size: 'normal',
    },
    {
        id: 'printing',
        title: 'Dịch Vụ In 3D',
        description: 'Upload file STL • Báo giá tự động • FDM & Resin',
        icon: (
            <svg className="w-16 h-16 md:w-20 md:h-20 text-[var(--text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
        ),
        href: '/printing',
        gradient: 'from-[var(--material-glass)] to-transparent',
        size: 'wide',
    },
];

export function BentoGrid() {
    return (
        <section className="py-24 md:py-32 px-6 bg-black">
            <div className="max-w-[1400px] mx-auto">
                {/* Section Header */}
                <AnimatedSection className="text-center mb-16">
                    <h2 className="text-4xl md:text-6xl font-bold text-[var(--text-primary)] mb-4 tracking-tight">
                        Dịch Vụ Của Chúng Tôi
                    </h2>
                    <p className="text-lg text-[var(--text-secondary)] max-w-xl mx-auto">
                        Từ sản phẩm có sẵn đến custom hoàn toàn theo ý bạn
                    </p>
                </AnimatedSection>

                {/* Bento Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                    {services.map((service, index) => (
                        <AnimatedSection
                            key={service.id}
                            delay={index * 0.1}
                            animation="scaleUp"
                            className={service.size === 'wide' ? 'md:col-span-2' : ''}
                        >
                            <Link href={service.href} data-cursor data-cursor-text="View">
                                <motion.div
                                    whileHover={{ scale: 1.02 }}
                                    transition={{ duration: 0.3 }}
                                    className={`
                    group relative overflow-hidden rounded-3xl
                    bg-gradient-to-br ${service.gradient}
                    border border-[var(--border-color)]
                    p-8 md:p-12
                    ${service.size === 'wide' ? 'min-h-[280px]' : 'min-h-[360px]'}
                  `}
                                >
                                    {/* Icon with parallax */}
                                    <Parallax speed={-0.2}>
                                        <div className={`
                      mb-6
                      transform group-hover:scale-110 transition-transform duration-500
                      ${service.size === 'wide' ? 'absolute right-8 top-1/2 -translate-y-1/2' : ''}
                    `}>
                                            {service.icon}
                                        </div>
                                    </Parallax>

                                    {/* Content */}
                                    <div className={service.size === 'wide' ? 'max-w-md' : ''}>
                                        <h3 className="text-2xl md:text-3xl font-semibold text-[var(--text-primary)] mb-3">
                                            {service.title}
                                        </h3>
                                        <p className="text-[var(--text-secondary)] mb-6">
                                            {service.description}
                                        </p>

                                        {/* Arrow link */}
                                        <span className="inline-flex items-center gap-2 text-[var(--color-accent)] font-medium group-hover:gap-4 transition-all">
                                            Tìm hiểu thêm
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                                            </svg>
                                        </span>
                                    </div>

                                    {/* Hover gradient overlay */}
                                    <div className="absolute inset-0 bg-gradient-to-br from-transparent to-[var(--material-glass)] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                </motion.div>
                            </Link>
                        </AnimatedSection>
                    ))}
                </div>
            </div>
        </section>
    );
}
