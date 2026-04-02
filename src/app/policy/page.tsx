'use client';

import { AnimatedSection } from '@/components/ui/Animations';
import Link from 'next/link';

const sections = [
    {
        id: 'dieu-kien',
        title: 'Điều kiện đổi trả',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                <path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
            </svg>
        ),
        content: [
            {
                subtitle: 'Sản phẩm được đổi trả khi',
                items: [
                    'Sản phẩm bị lỗi do quá trình sản xuất (vết nứt, gãy vỡ, lỗi in)',
                    'Sản phẩm không đúng với mô tả hoặc thiết kế đã được duyệt',
                    'Sản phẩm bị hư hỏng trong quá trình vận chuyển',
                    'Sản phẩm giao sai mẫu, sai màu sắc so với đơn hàng',
                ],
            },
            {
                subtitle: 'Sản phẩm không được đổi trả khi',
                items: [
                    'Sản phẩm đã được sử dụng, lắp ráp hoặc có dấu hiệu tác động ngoại lực',
                    'Yêu cầu đổi trả được gửi sau 7 ngày kể từ ngày nhận hàng',
                    'Sản phẩm custom (in theo file khách cung cấp) — trừ trường hợp lỗi sản xuất',
                    'Thay đổi ý kiến sau khi đã xác nhận thiết kế và sản xuất',
                ],
            },
        ],
    },
    {
        id: 'thoi-han',
        title: 'Thời hạn & quy trình',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
            </svg>
        ),
        content: [
            {
                subtitle: 'Thời hạn yêu cầu',
                items: [
                    'Trong vòng 7 ngày kể từ ngày nhận hàng (theo dấu bưu điện hoặc biên nhận giao hàng)',
                    'Đối với lỗi ẩn (phát hiện sau khi sử dụng): trong vòng 14 ngày',
                ],
            },
            {
                subtitle: 'Quy trình thực hiện',
                items: [
                    'Bước 1 – Liên hệ: Gửi email hoặc nhắn tin qua Zalo/Facebook kèm mã đơn hàng và mô tả vấn đề',
                    'Bước 2 – Gửi ảnh/video: Chụp rõ lỗi sản phẩm, gửi cho bộ phận hỗ trợ để xác nhận',
                    'Bước 3 – Xác nhận: Chúng tôi phản hồi trong 1–2 ngày làm việc',
                    'Bước 4 – Hoàn tất: Sau khi xác nhận lỗi, chúng tôi sản xuất lại hoặc hoàn tiền trong 3–5 ngày',
                ],
            },
        ],
    },
    {
        id: 'hoan-tien',
        title: 'Chính sách hoàn tiền',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                <path d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
        ),
        content: [
            {
                subtitle: 'Hình thức hoàn tiền',
                items: [
                    'Hoàn tiền qua chuyển khoản ngân hàng — trong vòng 3–5 ngày làm việc sau khi xác nhận',
                    'Đổi sản phẩm mới tương đương — ưu tiên khi sản phẩm bị lỗi sản xuất',
                    'Phiếu tín dụng (store credit) — áp dụng cho đơn hàng tiếp theo theo yêu cầu',
                ],
            },
            {
                subtitle: 'Chi phí vận chuyển hoàn trả',
                items: [
                    'Lỗi do sản xuất hoặc vận chuyển: Miniver chịu toàn bộ phí vận chuyển hoàn trả',
                    'Trường hợp khác (theo thỏa thuận): phí vận chuyển do khách hàng chịu',
                ],
            },
        ],
    },
    {
        id: 'dat-coc',
        title: 'Chính sách đặt cọc',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                <path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        ),
        content: [
            {
                subtitle: 'Điều khoản đặt cọc',
                items: [
                    'Đặt cọc 50% giá trị đơn hàng khi xác nhận đặt hàng',
                    'Thanh toán phần còn lại khi nhận hàng hoặc trước khi giao',
                    'Tiền cọc sẽ được hoàn lại nếu chúng tôi không thể thực hiện đơn hàng',
                    'Tiền cọc không được hoàn lại nếu khách hàng hủy sau khi đã bắt đầu sản xuất',
                ],
            },
        ],
    },
    {
        id: 'lien-he',
        title: 'Liên hệ hỗ trợ',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
        ),
        content: [
            {
                subtitle: 'Kênh hỗ trợ',
                items: [
                    'Email: hello@miniver.lab — phản hồi trong 1–2 ngày làm việc',
                    'Zalo: Nhắn tin trực tiếp — phản hồi nhanh trong giờ làm việc (9:00–18:00)',
                    'Facebook: Miniver 3D Lab — inbox hoặc comment trên bài viết',
                ],
            },
        ],
    },
];

export default function PolicyPage() {
    return (
        <div className="min-h-screen bg-[#0a0a0a] pt-28 pb-20">
            <div className="max-w-[860px] mx-auto px-6">
                {/* Header */}
                <AnimatedSection className="text-center mb-14">
                    <span className="text-sm text-white/50 font-medium tracking-widest uppercase mb-4 block">
                        Hỗ trợ khách hàng
                    </span>
                    <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-4">
                        Chính Sách Đổi Trả
                    </h1>
                    <p className="text-white/50 max-w-lg mx-auto leading-relaxed">
                        Chúng tôi cam kết đảm bảo chất lượng sản phẩm và sự hài lòng của khách hàng.
                        Dưới đây là toàn bộ chính sách đổi trả và hoàn tiền của Miniver 3D Lab.
                    </p>
                    <p className="text-white/30 text-sm mt-4">
                        Cập nhật lần cuối: tháng 1, 2025
                    </p>
                </AnimatedSection>

                {/* Quick nav */}
                <AnimatedSection delay={0.05} className="mb-10">
                    <div className="flex flex-wrap gap-2 justify-center">
                        {sections.map(s => (
                            <a
                                key={s.id}
                                href={`#${s.id}`}
                                className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-white/60 text-sm hover:bg-white/10 hover:text-white transition-all"
                            >
                                {s.title}
                            </a>
                        ))}
                    </div>
                </AnimatedSection>

                {/* Sections */}
                <div className="space-y-6">
                    {sections.map((section, sIdx) => (
                        <AnimatedSection key={section.id} delay={0.05 + sIdx * 0.05}>
                            <div id={section.id} className="bg-[#1D1D1F] rounded-3xl p-8 scroll-mt-32">
                                {/* Section header */}
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-white/70 flex-shrink-0">
                                        {section.icon}
                                    </div>
                                    <h2 className="text-xl font-semibold text-white">{section.title}</h2>
                                </div>

                                <div className="space-y-6">
                                    {section.content.map((block, bIdx) => (
                                        <div key={bIdx}>
                                            <h3 className="text-white/70 text-sm font-medium uppercase tracking-wider mb-3">
                                                {block.subtitle}
                                            </h3>
                                            <ul className="space-y-2">
                                                {block.items.map((item, iIdx) => (
                                                    <li key={iIdx} className="flex items-start gap-3 text-white/60 leading-relaxed">
                                                        <svg
                                                            viewBox="0 0 6 6"
                                                            fill="currentColor"
                                                            className="w-1.5 h-1.5 mt-[0.45rem] flex-shrink-0 text-white/30"
                                                        >
                                                            <circle cx="3" cy="3" r="3" />
                                                        </svg>
                                                        <span>{item}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </AnimatedSection>
                    ))}
                </div>

                {/* CTA */}
                <AnimatedSection delay={0.4} className="mt-12">
                    <div className="bg-white/5 border border-white/10 rounded-3xl p-8 md:p-10 text-center">
                        <h2 className="text-2xl font-semibold text-white mb-3">
                            Cần hỗ trợ thêm?
                        </h2>
                        <p className="text-white/50 mb-6 max-w-md mx-auto">
                            Đội ngũ Miniver luôn sẵn sàng giải đáp mọi thắc mắc về đơn hàng và chính sách.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-3 justify-center">
                            <Link
                                href="/about"
                                className="px-7 py-3.5 rounded-full bg-white text-black font-medium text-sm hover:scale-105 transition-transform"
                            >
                                Liên hệ ngay
                            </Link>
                            <Link
                                href="/faq"
                                className="px-7 py-3.5 rounded-full border border-white/20 text-white/80 font-medium text-sm hover:bg-white/10 transition-colors"
                            >
                                Xem FAQ
                            </Link>
                        </div>
                    </div>
                </AnimatedSection>
            </div>
        </div>
    );
}
