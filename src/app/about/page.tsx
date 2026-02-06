'use client';

import { motion } from 'framer-motion';
import { AnimatedSection } from '@/components/ui/Animations';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import Link from 'next/link';

const contactInfo = [
    { icon: '📍', label: 'Địa chỉ', value: 'Quận 1, TP. Hồ Chí Minh' },
    { icon: '📞', label: 'Hotline', value: '0123 456 789' },
    { icon: '✉️', label: 'Email', value: 'hello@miniver.lab' },
    { icon: '⏰', label: 'Giờ làm việc', value: '9:00 - 18:00, T2 - T7' },
];

const socialLinks = [
    { name: 'Facebook', url: 'https://facebook.com', icon: '📘' },
    { name: 'Instagram', url: 'https://instagram.com', icon: '📸' },
    { name: 'TikTok', url: 'https://tiktok.com', icon: '🎵' },
    { name: 'Zalo', url: 'https://zalo.me', icon: '💬' },
];

export default function AboutPage() {
    return (
        <div className="min-h-screen bg-[#0a0a0a] pt-28 pb-20">
            <div className="max-w-[1200px] mx-auto px-6">
                {/* Header */}
                <AnimatedSection className="text-center mb-16">
                    <span className="text-sm text-white/70 font-medium tracking-widest uppercase mb-4 block">
                        Về Chúng Tôi
                    </span>
                    <h1 className="text-4xl md:text-6xl font-bold text-white tracking-tight mb-6">
                        Miniver 3D Lab
                    </h1>
                    <p className="text-xl text-white/50 max-w-2xl mx-auto">
                        Chuyên tạo mô hình 3D độc đáo, cá nhân hóa hoàn toàn theo yêu cầu của bạn
                    </p>
                </AnimatedSection>

                {/* Story Section */}
                <AnimatedSection delay={0.1} className="mb-20">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                        <div>
                            <h2 className="text-3xl font-bold text-white mb-6">
                                Câu Chuyện Của Chúng Tôi
                            </h2>
                            <div className="space-y-4 text-white/60 leading-relaxed">
                                <p>
                                    Miniver 3D Lab được thành lập với niềm đam mê công nghệ in 3D và mong muốn
                                    mang đến những sản phẩm độc đáo, cá nhân hóa cho mọi người.
                                </p>
                                <p>
                                    Với đội ngũ kỹ thuật giàu kinh nghiệm và trang thiết bị hiện đại, chúng tôi
                                    tự hào là địa chỉ tin cậy cho các dịch vụ in 3D và chế tác mô hình theo yêu cầu.
                                </p>
                                <p>
                                    Mỗi sản phẩm đều được chế tác thủ công tỉ mỉ, đảm bảo chất lượng cao nhất
                                    và sự hài lòng tuyệt đối của khách hàng.
                                </p>
                            </div>
                        </div>
                        <div className="aspect-video bg-[#1D1D1F] rounded-3xl flex items-center justify-center">
                            <span className="text-8xl">🖨️</span>
                        </div>
                    </div>
                </AnimatedSection>

                {/* Stats */}
                <AnimatedSection delay={0.2} className="mb-20">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        {[
                            { value: '500+', label: 'Khách hàng' },
                            { value: '1000+', label: 'Sản phẩm' },
                            { value: '4.9★', label: 'Đánh giá' },
                            { value: '3 năm', label: 'Kinh nghiệm' },
                        ].map((stat, index) => (
                            <motion.div
                                key={stat.label}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3 + index * 0.1 }}
                                className="bg-[#1D1D1F] rounded-2xl p-6 text-center"
                            >
                                <p className="text-3xl md:text-4xl font-bold text-white/70">{stat.value}</p>
                                <p className="text-white/60 mt-2">{stat.label}</p>
                            </motion.div>
                        ))}
                    </div>
                </AnimatedSection>

                {/* Contact Section */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                    {/* Contact Info */}
                    <AnimatedSection delay={0.3}>
                        <div className="bg-[#1D1D1F] rounded-3xl p-8 md:p-10 h-full">
                            <h2 className="text-2xl font-bold text-white mb-8">
                                Thông Tin Liên Hệ
                            </h2>

                            <div className="space-y-6 mb-8">
                                {contactInfo.map((info) => (
                                    <div key={info.label} className="flex items-start gap-4">
                                        <span className="text-2xl">{info.icon}</span>
                                        <div>
                                            <p className="text-white/50 text-sm">{info.label}</p>
                                            <p className="text-white font-medium">{info.value}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Social Links */}
                            <h3 className="text-white font-medium mb-4">Theo dõi chúng tôi</h3>
                            <div className="flex gap-3">
                                {socialLinks.map((social) => (
                                    <a
                                        key={social.name}
                                        href={social.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="w-12 h-12 rounded-full bg-[#2D2D2F] flex items-center justify-center text-xl hover:bg-white text-black transition-colors"
                                        data-cursor
                                    >
                                        {social.icon}
                                    </a>
                                ))}
                            </div>
                        </div>
                    </AnimatedSection>

                    {/* Contact Form */}
                    <AnimatedSection delay={0.4}>
                        <div className="bg-[#1D1D1F] rounded-3xl p-8 md:p-10">
                            <h2 className="text-2xl font-bold text-white mb-8">
                                Gửi Tin Nhắn
                            </h2>

                            <form className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Input placeholder="Họ tên" />
                                    <Input placeholder="Số điện thoại" />
                                </div>
                                <Input placeholder="Email" type="email" />
                                <textarea
                                    placeholder="Nội dung tin nhắn..."
                                    className="w-full p-4 bg-[#2D2D2F] rounded-xl text-white placeholder:text-white/30 resize-none focus:outline-none focus:ring-2 focus:ring-white/30 border border-white/5"
                                    rows={5}
                                />
                                <Button variant="primary" size="lg" className="w-full">
                                    Gửi tin nhắn
                                </Button>
                            </form>
                        </div>
                    </AnimatedSection>
                </div>

                {/* Map Placeholder */}
                <AnimatedSection delay={0.5} className="mt-12">
                    <div className="bg-[#1D1D1F] rounded-3xl h-[300px] flex items-center justify-center">
                        <div className="text-center">
                            <span className="text-5xl mb-4 block">🗺️</span>
                            <p className="text-white/50">Google Maps sẽ được tích hợp tại đây</p>
                        </div>
                    </div>
                </AnimatedSection>
            </div>
        </div>
    );
}
