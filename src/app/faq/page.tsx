'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AnimatedSection } from '@/components/ui/Animations';
import Link from 'next/link';

const faqs = [
    {
        question: 'Thời gian sản xuất mất bao lâu?',
        answer: 'Thời gian sản xuất thông thường từ 5-7 ngày làm việc đối với sản phẩm có sẵn, và 7-14 ngày với đơn hàng custom. Chúng tôi sẽ gửi ảnh demo trước khi giao hàng để bạn duyệt.',
    },
    {
        question: 'Tôi cần chuẩn bị gì để đặt hàng custom?',
        answer: 'Bạn chỉ cần upload ảnh chất lượng cao (tối thiểu 1-2 ảnh rõ mặt). Đối với đơn Couple hoặc Group, vui lòng gửi ảnh riêng từng người để đạt kết quả tốt nhất.',
    },
    {
        question: 'Chính sách đổi trả như thế nào?',
        answer: 'Chúng tôi hỗ trợ đổi trả trong vòng 7 ngày nếu sản phẩm bị lỗi do sản xuất. Với đơn hàng custom, bạn sẽ được duyệt ảnh demo trước khi chúng tôi tiến hành hoàn thiện.',
    },
    {
        question: 'Hình thức thanh toán nào được chấp nhận?',
        answer: 'Chúng tôi chấp nhận chuyển khoản ngân hàng, ví điện tử (MoMo, ZaloPay), và thanh toán qua PayOS. Đặt cọc 50% khi đặt hàng, thanh toán phần còn lại khi nhận hàng.',
    },
    {
        question: 'Có giao hàng toàn quốc không?',
        answer: 'Có, chúng tôi giao hàng toàn quốc qua các đơn vị vận chuyển uy tín như GHN, GHTK, J&T. Phí ship tùy theo địa chỉ, miễn phí với đơn hàng trên 500.000đ.',
    },
    {
        question: 'File 3D cần định dạng gì để in?',
        answer: 'Chúng tôi hỗ trợ các định dạng STL, OBJ, 3MF. File cần đảm bảo kín (watertight) và không có lỗi mesh. Nếu file có vấn đề, đội ngũ kỹ thuật sẽ liên hệ hỗ trợ sửa.',
    },
];

export default function FAQPage() {
    const [openIndex, setOpenIndex] = useState<number | null>(0);

    return (
        <div className="min-h-screen bg-[#0a0a0a] pt-28 pb-20">
            <div className="max-w-[800px] mx-auto px-6">
                {/* Header */}
                <AnimatedSection className="text-center mb-12">
                    <span className="text-sm text-[#0071E3] font-medium tracking-widest uppercase mb-4 block">
                        Hỗ Trợ
                    </span>
                    <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-4">
                        Câu Hỏi Thường Gặp
                    </h1>
                    <p className="text-white/50">
                        Giải đáp các thắc mắc phổ biến về dịch vụ của chúng tôi
                    </p>
                </AnimatedSection>

                {/* FAQ Accordion */}
                <div className="space-y-4">
                    {faqs.map((faq, index) => (
                        <AnimatedSection key={index} delay={index * 0.05}>
                            <div className="bg-[#1D1D1F] rounded-2xl overflow-hidden">
                                <button
                                    onClick={() => setOpenIndex(openIndex === index ? null : index)}
                                    className="w-full flex items-center justify-between p-6 text-left"
                                    data-cursor
                                >
                                    <span className="text-white font-medium pr-4">{faq.question}</span>
                                    <motion.span
                                        animate={{ rotate: openIndex === index ? 45 : 0 }}
                                        className="text-[#0071E3] text-2xl flex-shrink-0"
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
                                className="px-8 py-4 rounded-full bg-[#0071E3] text-white font-medium hover:scale-105 transition-transform"
                                data-cursor
                            >
                                Liên hệ ngay
                            </Link>
                            <a
                                href="tel:0123456789"
                                className="px-8 py-4 rounded-full border border-white/20 text-white font-medium hover:bg-white/10 transition-colors"
                                data-cursor
                            >
                                📞 0123 456 789
                            </a>
                        </div>
                    </div>
                </AnimatedSection>
            </div>
        </div>
    );
}
