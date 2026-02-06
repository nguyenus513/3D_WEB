'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AnimatedSection } from '@/components/ui/Animations';
import Link from 'next/link';
import { getSupabase } from '@/lib/supabase/client';
import type { FAQ } from '@/types/database';
import { useContent } from '@/hooks/useContent';
import { useUiLabels } from '@/hooks/useUiLabels';

interface HeaderBlockData {
    kicker?: string;
    title?: string;
    subtitle?: string;
}

interface CtaBlockData {
    title?: string;
    subtitle?: string;
    primaryLabel?: string;
    primaryHref?: string;
}

export default function FAQPage() {
    const [faqs, setFaqs] = useState<FAQ[]>([]);
    const [loading, setLoading] = useState(true);
    const [openIndex, setOpenIndex] = useState<number | null>(0);
    const { getBlock } = useContent('faq');
    const { t } = useUiLabels(['public.faq', 'common']);

    const header = (getBlock('header')?.data ?? {}) as HeaderBlockData;
    const cta = (getBlock('cta')?.data ?? {}) as CtaBlockData;
    const emptyLabel = t('empty', '') as string;

    useEffect(() => {
        fetchFaqs();
    }, []);

    const fetchFaqs = async () => {
        const supabase = getSupabase();
        const { data, error } = await supabase
            .from('faqs')
            .select('*')
            .eq('is_active', true)
            .order('sort_order', { ascending: true });

        if (!error && data) {
            setFaqs(data);
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-[#0a0a0a] pt-28 pb-20">
            <div className="max-w-[800px] mx-auto px-6">
                {/* Header */}
                <AnimatedSection className="text-center mb-12">
                    <span className="text-sm text-white/70 font-medium tracking-widest uppercase mb-4 block">
                        {header.kicker}
                    </span>
                    <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-4">
                        {header.title}
                    </h1>
                    <p className="text-white/50">
                        {header.subtitle}
                    </p>
                </AnimatedSection>

                {/* Loading */}
                {loading && (
                    <div className="text-center py-12">
                        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto" />
                    </div>
                )}

                {/* FAQ Accordion */}
                {!loading && faqs.length > 0 && (
                    <div className="space-y-4">
                        {faqs.map((faq, index) => (
                            <AnimatedSection key={faq.id} delay={index * 0.05}>
                                <div className="bg-white/5 backdrop-blur-xl rounded-2xl overflow-hidden border border-white/10">
                                    <button
                                        onClick={() => setOpenIndex(openIndex === index ? null : index)}
                                        className="w-full flex items-center justify-between p-6 text-left"
                                    >
                                        <span className="text-white font-medium pr-4">{faq.question}</span>
                                        <motion.span
                                            animate={{ rotate: openIndex === index ? 45 : 0 }}
                                            className="text-white/70 text-2xl flex-shrink-0"
                                        >
                                            +
                                        </motion.span>
                                    </button>

                                    <AnimatePresence>
                                        {openIndex === index && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                transition={{ duration: 0.3 }}
                                            >
                                                <p className="px-6 pb-6 text-white/60 leading-relaxed">
                                                    {faq.answer}
                                                </p>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </AnimatedSection>
                        ))}
                    </div>
                )}

                {!loading && faqs.length === 0 && (
                    <div className="text-center py-12 text-white/50">
                        {emptyLabel}
                    </div>
                )}

                {/* Contact CTA */}
                <AnimatedSection delay={0.4} className="mt-16 text-center">
                    <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-8 md:p-12 border border-white/10">
                        <h2 className="text-2xl font-semibold text-white mb-4">
                            {cta.title}
                        </h2>
                        <p className="text-white/50 mb-6">
                            {cta.subtitle}
                        </p>
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                            <Link
                                href={cta.primaryHref || '/about'}
                                className="px-8 py-4 rounded-full bg-white text-black font-medium hover:scale-105 transition-transform"
                            >
                                {cta.primaryLabel}
                            </Link>
                        </div>
                    </div>
                </AnimatedSection>
            </div>
        </div>
    );
}
