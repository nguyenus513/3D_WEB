'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { AnimatedSection, Magnetic } from '../ui/Animations';

interface FeatureItem {
    title: string;
    description?: string;
}

interface FeaturesBlockData {
    heading?: string;
    items?: FeatureItem[];
}

interface CtaBlockData {
    title?: string;
    highlight?: string;
    description?: string;
    primaryLabel?: string;
    primaryHref?: string;
    secondaryLabel?: string;
    secondaryHref?: string;
}

const featureIcons = [
    (
        <svg className="w-8 h-8 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
        </svg>
    ),
    (
        <svg className="w-8 h-8 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
    ),
    (
        <svg className="w-8 h-8 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
    ),
];

export function WhyUs({ data }: { data?: FeaturesBlockData }) {
    const heading = data?.heading || '';
    const items = data?.items || [];

    return (
        <section className="py-24 md:py-32 px-6 bg-black">
            <div className="max-w-[1200px] mx-auto">
                {/* Section Header */}
                <AnimatedSection className="text-center mb-20">
                    <h2 className="text-4xl md:text-6xl font-bold text-white mb-4 tracking-tight">
                        {heading}
                    </h2>
                </AnimatedSection>

                {/* Features Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
                    {items.map((feature, index) => (
                        <AnimatedSection
                            key={`${feature.title}-${index}`}
                            delay={index * 0.15}
                            animation="fadeInUp"
                        >
                            <div className="text-center group">
                                {/* Icon */}
                                <motion.div
                                    whileHover={{ scale: 1.1, rotate: 5 }}
                                    className="
                    w-20 h-20 mx-auto mb-6 rounded-2xl
                    bg-gradient-to-br from-white/10 to-transparent
                    flex items-center justify-center
                    border border-white/10
                  "
                                >
                                    {featureIcons[index % featureIcons.length]}
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

export function CTASection({ data }: { data?: CtaBlockData }) {
    const title = data?.title || '';
    const highlight = data?.highlight || '';
    const description = data?.description || '';
    const primaryLabel = data?.primaryLabel || '';
    const primaryHref = data?.primaryHref || '/custom';
    const secondaryLabel = data?.secondaryLabel || '';
    const secondaryHref = data?.secondaryHref || '/products';

    return (
        <section className="py-32 md:py-40 px-6 bg-gradient-to-b from-[#1D1D1F] via-black to-black relative overflow-hidden">
            {/* Background decorations */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
            </div>

            <div className="max-w-[900px] mx-auto text-center relative z-10">
                <AnimatedSection>
                    <h2 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-6 tracking-tight leading-tight">
                        {title}
                        {highlight && (
                            <>
                                <br />
                                <span className="text-white/70">{highlight}</span>
                            </>
                        )}
                    </h2>
                </AnimatedSection>

                <AnimatedSection delay={0.2}>
                    <p className="text-xl text-white/50 mb-12 max-w-lg mx-auto">
                        {description}
                    </p>
                </AnimatedSection>

                <AnimatedSection delay={0.4}>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <Magnetic>
                            <Link
                                href={primaryHref}
                                className="px-10 py-5 rounded-full bg-white text-black font-medium text-lg hover:scale-105 transition-transform"
                                data-cursor
                                data-cursor-text="Start"
                            >
                                {primaryLabel}
                            </Link>
                        </Magnetic>
                        <Magnetic>
                            <Link
                                href={secondaryHref}
                                className="px-10 py-5 rounded-full border border-white/30 text-white font-medium text-lg hover:bg-white/10 transition-colors"
                                data-cursor
                                data-cursor-text="View"
                            >
                                {secondaryLabel}
                            </Link>
                        </Magnetic>
                    </div>
                </AnimatedSection>
            </div>
        </section>
    );
}
