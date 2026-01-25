'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/Button';

export default function CompleteProfilePage() {
    const { data: session, status, update } = useSession();
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        address_label: 'Nhà riêng',
        full_name: '',
        address_phone: '',
        address_line: '',
        province: '',
    });

    // Pre-fill name from Google profile
    useEffect(() => {
        if (session?.user?.name) {
            setFormData(prev => ({
                ...prev,
                name: session.user?.name || '',
                full_name: session.user?.name || '',
            }));
        }
    }, [session]);

    // Redirect if not authenticated or already has complete profile
    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/login');
        }
    }, [status, router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            // Update profile
            const profileRes = await fetch('/api/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: formData.name,
                    phone: formData.phone,
                }),
            });

            if (!profileRes.ok) {
                throw new Error('Không thể cập nhật hồ sơ');
            }

            // Create address
            if (formData.address_line) {
                const addressRes = await fetch('/api/addresses', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        label: formData.address_label,
                        full_name: formData.full_name,
                        phone: formData.address_phone || formData.phone,
                        address_line: formData.address_line,
                        province: formData.province,
                        is_default: true,
                    }),
                });

                if (!addressRes.ok) {
                    console.error('Address creation failed');
                }
            }

            // Update session to clear isNewUser flag
            await update();

            // Redirect to account
            router.push('/account');
            router.refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Đã có lỗi xảy ra');
        } finally {
            setLoading(false);
        }
    };

    if (status === 'loading') {
        return (
            <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-6 py-20">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="w-full max-w-lg"
            >
                {/* Header */}
                <div className="text-center mb-10">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white mb-6">
                        <svg className="w-8 h-8 text-black" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                        </svg>
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-2">Hoàn tất hồ sơ</h1>
                    <p className="text-white/50">Vui lòng điền thông tin để tiếp tục</p>
                </div>

                {/* Error */}
                {error && (
                    <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Personal Info Card */}
                    <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
                        <h2 className="text-lg font-semibold text-white mb-4">Thông tin cá nhân</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="text-white/70 text-sm mb-2 block">Họ tên *</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="Nguyễn Văn A"
                                    className="w-full px-4 py-3 bg-[#1D1D1F] rounded-xl text-white placeholder:text-white/30 border border-white/10 focus:outline-none focus:ring-2 focus:ring-white/30"
                                    required
                                />
                            </div>
                            <div>
                                <label className="text-white/70 text-sm mb-2 block">Số điện thoại *</label>
                                <input
                                    type="tel"
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    placeholder="0901234567"
                                    className="w-full px-4 py-3 bg-[#1D1D1F] rounded-xl text-white placeholder:text-white/30 border border-white/10 focus:outline-none focus:ring-2 focus:ring-white/30"
                                    required
                                />
                            </div>
                        </div>
                    </div>

                    {/* Address Card */}
                    <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
                        <h2 className="text-lg font-semibold text-white mb-4">Địa chỉ giao hàng (không bắt buộc)</h2>
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-white/70 text-sm mb-2 block">Tên địa chỉ</label>
                                    <select
                                        value={formData.address_label}
                                        onChange={(e) => setFormData({ ...formData, address_label: e.target.value })}
                                        className="w-full px-4 py-3 bg-[#1D1D1F] rounded-xl text-white border border-white/10 focus:outline-none focus:ring-2 focus:ring-white/30"
                                    >
                                        <option value="Nhà riêng">Nhà riêng</option>
                                        <option value="Văn phòng">Văn phòng</option>
                                        <option value="Khác">Khác</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-white/70 text-sm mb-2 block">Người nhận</label>
                                    <input
                                        type="text"
                                        value={formData.full_name}
                                        onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                        placeholder="Họ tên người nhận"
                                        className="w-full px-4 py-3 bg-[#1D1D1F] rounded-xl text-white placeholder:text-white/30 border border-white/10 focus:outline-none focus:ring-2 focus:ring-white/30"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-white/70 text-sm mb-2 block">Địa chỉ</label>
                                <textarea
                                    rows={2}
                                    value={formData.address_line}
                                    onChange={(e) => setFormData({ ...formData, address_line: e.target.value })}
                                    placeholder="Số nhà, đường, phường/xã, quận/huyện"
                                    className="w-full px-4 py-3 bg-[#1D1D1F] rounded-xl text-white placeholder:text-white/30 border border-white/10 focus:outline-none focus:ring-2 focus:ring-white/30 resize-none"
                                />
                            </div>
                            <div>
                                <label className="text-white/70 text-sm mb-2 block">Tỉnh/Thành phố</label>
                                <input
                                    type="text"
                                    value={formData.province}
                                    onChange={(e) => setFormData({ ...formData, province: e.target.value })}
                                    placeholder="VD: TP. Hồ Chí Minh"
                                    className="w-full px-4 py-3 bg-[#1D1D1F] rounded-xl text-white placeholder:text-white/30 border border-white/10 focus:outline-none focus:ring-2 focus:ring-white/30"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Submit */}
                    <Button
                        type="submit"
                        variant="primary"
                        size="lg"
                        className="w-full"
                        disabled={loading}
                    >
                        {loading ? 'Đang lưu...' : 'Hoàn tất'}
                    </Button>
                </form>
            </motion.div>
        </div>
    );
}
