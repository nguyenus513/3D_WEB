'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { AnimatedSection, Parallax } from '../ui/Animations';

const services = [
    {
        id: 'products',
        title: 'Sản Phẩm Có Sẵn',
        description: 'Khám phá bộ sưu tập mô hình 3D độc đáo, chất lượng cao.',
        icon: '🎭',
        href: '/products',
        gradient: 'from-[#FF6B6B]/20 to-[#FF8E53]/10',
        size: 'normal',
    },
    {
        id: 'custom',
        title: 'Tùy Biến Theo Yêu Cầu',
        description: 'Tạo mô hình từ ảnh của bạn. Single, Couple, Group.',
        icon: '✨',
        href: '/custom',
        gradient: 'from-[#4ECDC4]/20 to-[#44A08D]/10',
        size: 'normal',
    },
    {
        id: 'printing',
        title: 'Dịch Vụ In 3D',
        description: 'Upload file STL • Báo giá tự động • FDM & Resin',
        icon: '🖨️',
        href: '/printing',
        gradient: 'from-[#A855F7]/20 to-[#6366F1]/10',
        size: 'wide',
    },
];

export function BentoGrid() {
    return (
        <section className="py-24 md:py-32 px-6 bg-black">
            <div className="max-w-[1400px] mx-auto">
                {/* Section Header */}
                <AnimatedSection className="text-center mb-16">
                    <h2 className="text-4xl md:text-6xl font-bold text-white mb-4 tracking-tight">
                        Dịch Vụ Của Chúng Tôi
                    </h2>
                    <p className="text-lg text-white/50 max-w-xl mx-auto">
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
                    border border-white/5
                    p-8 md:p-12
                    ${service.size === 'wide' ? 'min-h-[280px]' : 'min-h-[360px]'}
                  `}
                                >
                                    {/* Icon with parallax */}
                                    <Parallax speed={-0.2}>
                                        <div className={`
                      text-7xl md:text-8xl mb-6
                      transform group-hover:scale-110 transition-transform duration-500
                      ${service.size === 'wide' ? 'absolute right-8 top-1/2 -translate-y-1/2' : ''}
                    `}>
                                            {service.icon}
                                        </div>
                                    </Parallax>

                                    {/* Content */}
                                    <div className={service.size === 'wide' ? 'max-w-md' : ''}>
                                        <h3 className="text-2xl md:text-3xl font-semibold text-white mb-3">
                                            {service.title}
                                        </h3>
                                        <p className="text-white/60 mb-6">
                                            {service.description}
                                        </p>

                                        {/* Arrow link */}
                                        <span className="inline-flex items-center gap-2 text-[#0071E3] font-medium group-hover:gap-4 transition-all">
                                            Tìm hiểu thêm
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                                            </svg>
                                        </span>
                                    </div>

                                    {/* Hover gradient overlay */}
                                    <div className="absolute inset-0 bg-gradient-to-br from-white/0 to-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                </motion.div>
                            </Link>
                        </AnimatedSection>
                    ))}
                </div>
            </div>
        </section>
    );
}
