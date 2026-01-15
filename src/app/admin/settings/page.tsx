'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';

// Mock FAQ data
const initialFaqs = [
    { id: 1, question: 'Thời gian sản xuất là bao lâu?', answer: 'Thời gian sản xuất từ 5-7 ngày làm việc tùy thuộc vào độ phức tạp của sản phẩm.' },
    { id: 2, question: 'Có ship toàn quốc không?', answer: 'Có, chúng tôi giao hàng toàn quốc qua Viettel Post với thời gian 2-5 ngày.' },
    { id: 3, question: 'Có thể đổi trả không?', answer: 'Sản phẩm custom không hỗ trợ đổi trả. Sản phẩm có sẵn đổi trả trong 7 ngày nếu lỗi sản xuất.' },
];

export default function AdminSettingsPage() {
    const [activeTab, setActiveTab] = useState('faq');
    const [faqs, setFaqs] = useState(initialFaqs);
    const [aboutContent, setAboutContent] = useState({
        title: '3D Print Studio',
        description: 'Chúng tôi chuyên thiết kế và sản xuất các sản phẩm in 3D chất lượng cao.',
        email: 'hello@3dprint.vn',
        phone: '0901234567',
        address: '123 Nguyễn Văn Linh, Quận 7, TP.HCM',
    });

    const tabs = [
        {
            key: 'faq', label: 'FAQ', icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            )
        },
        {
            key: 'about', label: 'About / Contact', icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            )
        },
        {
            key: 'general', label: 'Cài đặt chung', icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
            )
        },
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-white">Cài đặt</h1>
                <p className="text-white/50 mt-1">Quản lý nội dung và cấu hình website</p>
            </div>

            {/* Tabs */}
            <div className="flex gap-2">
                {tabs.map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${activeTab === tab.key
                                ? 'bg-white text-black'
                                : 'bg-[#1D1D1F] text-white/70 hover:text-white border border-white/10'
                            }`}
                    >
                        {tab.icon}
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* FAQ Tab */}
            {activeTab === 'faq' && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-[#1D1D1F] rounded-2xl border border-white/10 p-6"
                >
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg font-semibold text-white">Câu hỏi thường gặp</h2>
                        <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-black text-sm font-medium">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Thêm FAQ
                        </button>
                    </div>
                    <div className="space-y-4">
                        {faqs.map((faq) => (
                            <div key={faq.id} className="p-4 bg-white/5 rounded-xl">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1">
                                        <h3 className="text-white font-medium mb-2">{faq.question}</h3>
                                        <p className="text-white/60 text-sm">{faq.answer}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button className="p-2 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                            </svg>
                                        </button>
                                        <button className="p-2 rounded-lg hover:bg-red-500/20 text-white/50 hover:text-red-400 transition-colors">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </motion.div>
            )}

            {/* About Tab */}
            {activeTab === 'about' && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-[#1D1D1F] rounded-2xl border border-white/10 p-6"
                >
                    <h2 className="text-lg font-semibold text-white mb-6">Thông tin liên hệ</h2>
                    <form className="space-y-5">
                        <div>
                            <label className="text-white/70 text-sm mb-2 block">Tên công ty</label>
                            <input
                                type="text"
                                value={aboutContent.title}
                                onChange={(e) => setAboutContent({ ...aboutContent, title: e.target.value })}
                                className="w-full px-4 py-3 bg-[#0a0a0a] border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-white/30"
                            />
                        </div>
                        <div>
                            <label className="text-white/70 text-sm mb-2 block">Mô tả</label>
                            <textarea
                                rows={3}
                                value={aboutContent.description}
                                onChange={(e) => setAboutContent({ ...aboutContent, description: e.target.value })}
                                className="w-full px-4 py-3 bg-[#0a0a0a] border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-white/30 resize-none"
                            />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div>
                                <label className="text-white/70 text-sm mb-2 block">Email</label>
                                <input
                                    type="email"
                                    value={aboutContent.email}
                                    onChange={(e) => setAboutContent({ ...aboutContent, email: e.target.value })}
                                    className="w-full px-4 py-3 bg-[#0a0a0a] border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-white/30"
                                />
                            </div>
                            <div>
                                <label className="text-white/70 text-sm mb-2 block">Điện thoại</label>
                                <input
                                    type="tel"
                                    value={aboutContent.phone}
                                    onChange={(e) => setAboutContent({ ...aboutContent, phone: e.target.value })}
                                    className="w-full px-4 py-3 bg-[#0a0a0a] border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-white/30"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-white/70 text-sm mb-2 block">Địa chỉ</label>
                            <input
                                type="text"
                                value={aboutContent.address}
                                onChange={(e) => setAboutContent({ ...aboutContent, address: e.target.value })}
                                className="w-full px-4 py-3 bg-[#0a0a0a] border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-white/30"
                            />
                        </div>
                        <button
                            type="submit"
                            className="px-6 py-3 rounded-xl bg-white text-black font-medium hover:bg-white/90 transition-colors"
                        >
                            Lưu thay đổi
                        </button>
                    </form>
                </motion.div>
            )}

            {/* General Tab */}
            {activeTab === 'general' && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-[#1D1D1F] rounded-2xl border border-white/10 p-6"
                >
                    <h2 className="text-lg font-semibold text-white mb-6">Cài đặt chung</h2>
                    <div className="space-y-6">
                        <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                            <div>
                                <h3 className="text-white font-medium">Chế độ bảo trì</h3>
                                <p className="text-white/50 text-sm">Tạm ngừng website để bảo trì</p>
                            </div>
                            <button className="w-12 h-6 rounded-full bg-white/20 relative transition-colors">
                                <span className="absolute left-1 top-1 w-4 h-4 rounded-full bg-white transition-transform" />
                            </button>
                        </div>
                        <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                            <div>
                                <h3 className="text-white font-medium">Nhận thông báo email</h3>
                                <p className="text-white/50 text-sm">Gửi email khi có đơn hàng mới</p>
                            </div>
                            <button className="w-12 h-6 rounded-full bg-white relative transition-colors">
                                <span className="absolute right-1 top-1 w-4 h-4 rounded-full bg-black transition-transform" />
                            </button>
                        </div>
                    </div>
                </motion.div>
            )}
        </div>
    );
}
