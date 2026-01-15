'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AnimatedSection } from '@/components/ui/Animations';
import Link from 'next/link';
import { getSupabase } from '@/lib/supabase/client';
import type { FAQ } from '@/types/database';

export default function FAQPage() {
    const [faqs, setFaqs] = useState<FAQ[]>([]);
    const [loading, setLoading] = useState(true);
    const [openIndex, setOpenIndex] = useState<number | null>(0);

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

    // Fallback FAQs if none in database
    const defaultFaqs = [
        { id: '1', question: 'Thời gian sản xuất mất bao lâu?', answer: 'Thời gian sản xuất thông thường từ 5-7 ngày làm việc đối với sản phẩm có sẵn, và 7-14 ngày với đơn hàng custom.' },
        { id: '2', question: 'Tôi cần chuẩn bị gì để đặt hàng custom?', answer: 'Bạn chỉ cần upload ảnh chất lượng cao (tối thiểu 1-2 ảnh rõ mặt).' },
        { id: '3', question: 'Chính sách đổi trả như thế nào?', answer: 'Chúng tôi hỗ trợ đổi trả trong vòng 7 ngày nếu sản phẩm bị lỗi do sản xuất.' },
        { id: '4', question: 'Hình thức thanh toán nào được chấp nhận?', answer: 'Chúng tôi chấp nhận chuyển khoản ngân hàng qua mã QR VietQR. Đặt cọc 50% khi đặt hàng.' },
        { id: '5', question: 'Có giao hàng toàn quốc không?', answer: 'Có, chúng tôi giao hàng toàn quốc qua các đơn vị vận chuyển uy tín.' },
    ];

    const displayFaqs = faqs.length > 0 ? faqs : defaultFaqs;

    return (
        <div className="min-h-screen bg-[#0a0a0a] pt-28 pb-20">
            <div className="max-w-[800px] mx-auto px-6">
                {/* Header */}
                <AnimatedSection className="text-center mb-12">
                    <span className="text-sm text-white/70 font-medium tracking-widest uppercase mb-4 block">
                        Hỗ Trợ
                    </span>
                    <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-4">
                        Câu Hỏi Thường Gặp
                    </h1>
                    <p className="text-white/50">
                        Giải đáp các thắc mắc phổ biến về dịch vụ của chúng tôi
                    </p>
                </AnimatedSection>

                {/* Loading */}
                {loading && (
                    <div className="text-center py-12">
                        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto" />
                    </div>
                )}

                {/* FAQ Accordion */}
                {!loading && (
                    <div className="space-y-4">
                        {displayFaqs.map((faq, index) => (
                            <AnimatedSection key={faq.id} delay={index * 0.05}>
                                <div className="bg-[#1D1D1F] rounded-2xl overflow-hidden">
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

                {/* Contact CTA */}
                <AnimatedSection delay={0.4} className="mt-16 text-center">
                    <div className="bg-[#1D1D1F] rounded-3xl p-8 md:p-12">
                        <h2 className="text-2xl font-semibold text-white mb-4">
                            Không tìm thấy câu trả lời?
                        </h2>
                        <p className="text-white/50 mb-6">
                            Liên hệ trực tiếp với chúng tôi để được hỗ trợ nhanh nhất
                        </p>
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                            <Link
                                href="/about"
                                className="px-8 py-4 rounded-full bg-white text-black font-medium hover:scale-105 transition-transform"
                            >
                                Liên hệ ngay
                            </Link>
                        </div>
                    </div>
                </AnimatedSection>
            </div>
        </div>
    );
}
