'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { AnimatedSection, Magnetic } from '../ui/Animations';

const features = [
    {
        icon: '🎨',
        title: 'Thủ Công Tỉ Mỉ',
        description: 'Mỗi sản phẩm được chế tác thủ công với sự tỉ mỉ cao nhất.',
        color: 'from-[#0071E3]/20 to-transparent',
    },
    {
        icon: '⚡',
        title: 'Giao Hàng Nhanh',
        description: 'Thời gian sản xuất 5-7 ngày, giao hàng toàn quốc.',
        color: 'from-[#30D158]/20 to-transparent',
    },
    {
        icon: '✅',
        title: 'Xem Trước Sản Phẩm',
        description: 'Gửi ảnh demo trước khi giao, đảm bảo hài lòng 100%.',
        color: 'from-[#FF9500]/20 to-transparent',
    },
];

export function WhyUs() {
    return (
        <section className="py-24 md:py-32 px-6 bg-black">
            <div className="max-w-[1200px] mx-auto">
                {/* Section Header */}
                <AnimatedSection className="text-center mb-20">
                    <h2 className="text-4xl md:text-6xl font-bold text-white mb-4 tracking-tight">
                        Tại Sao Chọn Chúng Tôi?
                    </h2>
                </AnimatedSection>

                {/* Features Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
                    {features.map((feature, index) => (
                        <AnimatedSection
                            key={feature.title}
                            delay={index * 0.15}
                            animation="fadeInUp"
                        >
                            <div className="text-center group">
                                {/* Icon */}
                                <motion.div
                                    whileHover={{ scale: 1.1, rotate: 5 }}
                                    className={`
                    w-20 h-20 mx-auto mb-6 rounded-2xl
                    bg-gradient-to-br ${feature.color}
                    flex items-center justify-center
                    border border-white/10
                  `}
                                >
                                    <span className="text-4xl">{feature.icon}</span>
                                </motion.div>

                                {/* Title */}
                                <h3 className="text-xl font-semibold text-white mb-3">
                                    {feature.title}
                                </h3>

                                {/* Description */}
                                <p className="text-white/50 leading-relaxed">
                                    {feature.description}
                                </p>
                            </div>
                        </AnimatedSection>
                    ))}
                </div>
            </div>
        </section>
    );
}

export function CTASection() {
    return (
        <section className="py-32 md:py-40 px-6 bg-gradient-to-b from-[#1D1D1F] via-black to-black relative overflow-hidden">
            {/* Background decorations */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#0071E3]/10 rounded-full blur-3xl" />
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#A855F7]/10 rounded-full blur-3xl" />
            </div>

            <div className="max-w-[900px] mx-auto text-center relative z-10">
                <AnimatedSection>
                    <h2 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-6 tracking-tight leading-tight">
                        Sẵn Sàng Tạo
                        <br />
                        <span className="text-[#0071E3]">Mô Hình Của Bạn?</span>
                    </h2>
                </AnimatedSection>

                <AnimatedSection delay={0.2}>
                    <p className="text-xl text-white/50 mb-12 max-w-lg mx-auto">
                        Chỉ cần upload ảnh, chúng tôi sẽ biến nó thành hiện thực.
                    </p>
                </AnimatedSection>

                <AnimatedSection delay={0.4}>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <Magnetic>
                            <Link
                                href="/custom"
                                className="px-10 py-5 rounded-full bg-[#0071E3] text-white font-medium text-lg hover:scale-105 transition-transform"
                                data-cursor
                                data-cursor-text="Start"
                            >
                                Bắt đầu Custom
                            </Link>
                        </Magnetic>
                        <Magnetic>
                            <Link
                                href="/products"
                                className="px-10 py-5 rounded-full border border-white/30 text-white font-medium text-lg hover:bg-white/10 transition-colors"
                                data-cursor
                                data-cursor-text="View"
                            >
                                Xem Sản Phẩm
                            </Link>
                        </Magnetic>
                    </div>
                </AnimatedSection>
            </div>
        </section>
    );
}
