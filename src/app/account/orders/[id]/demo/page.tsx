'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useSession } from 'next-auth/react';

interface DemoImage {
    url: string;
    label: string;
    uploaded_at: string;
}

interface DesignImage {
    id: string;
    image_url: string;
    label: string;
    sort_order: number;
    created_at: string;
}

interface DesignVersion {
    id: string;
    version_number: number;
    status: 'pending_review' | 'approved' | 'rejected';
    admin_note: string | null;
    user_feedback: string | null;
    created_at: string;
    reviewed_at: string | null;
    design_images: DesignImage[];
}

interface DemoOrder {
    id: string;
    order_code: string;
    status: string;
    demo_images: DemoImage[];
    demo_image_url?: string;
    revision_count: number;
    revision_feedback: string | null;
}

export default function DemoReviewPage() {
    const params = useParams();
    const router = useRouter();
    const { data: session, status: authStatus } = useSession();

    const [order, setOrder] = useState<DemoOrder | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedImage, setSelectedImage] = useState(0);
    const [submitting, setSubmitting] = useState(false);
    const [showRevisionModal, setShowRevisionModal] = useState(false);
    const [revisionFeedback, setRevisionFeedback] = useState('');
    // Design versioning
    const [designVersions, setDesignVersions] = useState<DesignVersion[]>([]);
    const [showHistory, setShowHistory] = useState(false);

    useEffect(() => {
        if (authStatus === 'authenticated' && session?.user?.email) {
            fetchOrder();
            fetchDesignVersions();
        } else if (authStatus === 'unauthenticated') {
            router.push('/login?redirect=/account/orders');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [authStatus, session, params.id]);

    const fetchOrder = async () => {
        try {
            const res = await fetch(`/api/orders/lookup?id=${params.id}`, { cache: 'no-store' });
            const response = await res.json();

            if (!res.ok || !response.success) {
                setError('Không tìm thấy đơn hàng');
                setLoading(false);
                return;
            }

            const data = response.data;
            setOrder({
                id: data.id,
                order_code: data.order_code,
                status: data.status,
                demo_images: data.demo_images || [],
                demo_image_url: data.demo_image_url,
                revision_count: data.revision_count || 0,
                revision_feedback: data.revision_feedback || null,
            });
            setLoading(false);
        } catch {
            setError('Lỗi kết nối');
            setLoading(false);
        }
    };

    const fetchDesignVersions = async () => {
        try {
            const res = await fetch(`/api/orders/${params.id}/design-versions`);
            const data = await res.json();
            if (data.success && data.versions) {
                setDesignVersions(data.versions);
            }
        } catch {
            // Silent fail — versions are supplementary
        }
    };

    const handleApprove = async () => {
        if (!order) return;
        setSubmitting(true);

        try {
            const res = await fetch(`/api/orders/${order.id}/approve-demo`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            router.push(`/account/orders/${order.id}`);
        } catch (err) {
            alert('Lỗi: ' + (err as Error).message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleSubmitRevision = async () => {
        if (!order || !revisionFeedback.trim()) return;
        setSubmitting(true);

        try {
            const res = await fetch(`/api/orders/${order.id}/approve-demo`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ feedback: revisionFeedback }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            router.push(`/account/orders/${order.id}`);
        } catch (err) {
            alert('Lỗi: ' + (err as Error).message);
        } finally {
            setSubmitting(false);
        }
    };

    // Get latest version's images, fallback to legacy
    const latestVersion = designVersions.length > 0
        ? designVersions[designVersions.length - 1]
        : null;

    const images: { url: string; label: string }[] = latestVersion
        ? latestVersion.design_images.map(img => ({ url: img.image_url, label: img.label || 'Demo' }))
        : order?.demo_images?.length
            ? order.demo_images.map(img => ({ url: img.url, label: img.label }))
            : order?.demo_image_url
                ? [{ url: order.demo_image_url, label: 'Demo' }]
                : [];

    const versionNumber = latestVersion?.version_number || (order?.revision_count ? order.revision_count + 1 : 1);

    // ─── LOADING ───
    if (loading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            </div>
        );
    }

    // ─── ERROR ───
    if (error || !order) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center p-6">
                <div className="text-center space-y-4">
                    <p className="text-white/60">{error || 'Không tìm thấy đơn hàng'}</p>
                    <Link href="/account/orders" className="text-white/40 hover:text-white underline text-sm">
                        ← Về danh sách đơn
                    </Link>
                </div>
            </div>
        );
    }

    // ─── NOT IN REVIEW STATUS ───
    if (order.status !== 'review') {
        const statusMessages: Record<string, { icon: string; title: string; desc: string }> = {
            revising: {
                icon: '✏️',
                title: 'Đang chờ bản thiết kế mới',
                desc: 'Chúng tôi đang cập nhật thiết kế theo yêu cầu của bạn.',
            },
            approved: {
                icon: '✓',
                title: 'Thiết kế đã được duyệt',
                desc: 'Đơn hàng đang được sản xuất.',
            },
            producing: {
                icon: '⚙️',
                title: 'Đang sản xuất',
                desc: 'Thiết kế đã được duyệt. Sản phẩm đang được thực hiện.',
            },
        };

        const msg = statusMessages[order.status] || {
            icon: '📋',
            title: 'Demo chưa sẵn sàng',
            desc: 'Thiết kế đang được chuẩn bị.',
        };

        return (
            <div className="min-h-screen bg-black flex items-center justify-center p-6">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center space-y-6 max-w-md"
                >
                    <span className="text-5xl">{msg.icon}</span>
                    <h1 className="text-2xl font-semibold text-white">{msg.title}</h1>
                    <p className="text-white/50">{msg.desc}</p>
                    <Link
                        href={`/account/orders/${order.id}`}
                        className="inline-block px-6 py-3 border border-white/20 text-white/70 hover:text-white hover:border-white/40 rounded-full text-sm transition-all"
                    >
                        ← Xem chi tiết đơn hàng
                    </Link>
                </motion.div>
            </div>
        );
    }

    // ─── MAIN REVIEW UI ───
    return (
        <div className="min-h-screen bg-black">
            {/* Header */}
            <header className="border-b border-white/[0.06] bg-black/80 backdrop-blur-xl sticky top-0 z-30">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <Link
                        href={`/account/orders/${order.id}`}
                        className="text-white/40 hover:text-white transition-colors text-sm flex items-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
                        </svg>
                        Quay lại
                    </Link>
                    <div className="text-center">
                        <p className="text-white/40 text-xs tracking-wider uppercase">Đơn hàng</p>
                        <p className="text-white font-mono text-sm">#{order.order_code}</p>
                    </div>
                    <div className="text-right">
                        <span className="text-xs text-white/30 tracking-wider uppercase">Design Preview</span>
                        <p className="text-cyan-400/80 text-xs font-medium">Version {versionNumber}</p>
                    </div>
                </div>
            </header>

            {/* Two-column layout */}
            <div className="max-w-7xl mx-auto px-6 py-8 lg:py-12">
                <div className="grid grid-cols-1 lg:grid-cols-[1fr,380px] gap-8 lg:gap-12">

                    {/* ─── LEFT: Image Gallery ─── */}
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="space-y-4"
                    >
                        {/* Main image */}
                        {images.length > 0 && (
                            <div className="relative aspect-square lg:aspect-[4/3] rounded-2xl overflow-hidden bg-[#111] border border-white/[0.06] group">
                                <img
                                    src={images[selectedImage]?.url}
                                    alt={images[selectedImage]?.label || 'Demo Preview'}
                                    className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105"
                                />
                                {/* Image counter */}
                                {images.length > 1 && (
                                    <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-full">
                                        <span className="text-white/80 text-xs font-mono">
                                            {selectedImage + 1} / {images.length}
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Thumbnails */}
                        {images.length > 1 && (
                            <div className="flex gap-3 overflow-x-auto pb-2">
                                {images.map((img, i) => (
                                    <button
                                        key={i}
                                        onClick={() => setSelectedImage(i)}
                                        className={`relative flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden border-2 transition-all ${i === selectedImage
                                            ? 'border-white ring-1 ring-white/20'
                                            : 'border-white/[0.06] opacity-50 hover:opacity-80'
                                            }`}
                                    >
                                        <img src={img.url} alt={img.label || `Angle ${i + 1}`} className="w-full h-full object-cover" />
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* No images fallback */}
                        {images.length === 0 && (
                            <div className="aspect-square rounded-2xl bg-[#111] border border-white/[0.06] flex items-center justify-center">
                                <p className="text-white/20 text-lg">Chưa có ảnh demo</p>
                            </div>
                        )}
                    </motion.div>

                    {/* ─── RIGHT: Review Panel ─── */}
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 }}
                        className="space-y-8 lg:sticky lg:top-24 lg:self-start"
                    >
                        {/* Review message */}
                        <div className="space-y-3">
                            <h1 className="text-2xl font-semibold text-white leading-tight">
                                Xác nhận thiết kế
                            </h1>
                            <p className="text-white/50 text-sm leading-relaxed">
                                Vui lòng xem kỹ thiết kế 3D của bạn. Sau khi duyệt, sản phẩm sẽ được đưa vào sản xuất và không thể thay đổi.
                            </p>
                        </div>

                        {/* Version & Admin Note */}
                        {latestVersion && (
                            <div className="space-y-3">
                                {/* Version badge */}
                                <div className="flex items-center gap-2">
                                    <span className="text-xs bg-cyan-500/10 text-cyan-400 px-2.5 py-1 rounded-full border border-cyan-500/20">
                                        Version {latestVersion.version_number}
                                    </span>
                                    <span className="text-white/20 text-xs">
                                        {new Date(latestVersion.created_at).toLocaleDateString('vi-VN')}
                                    </span>
                                </div>

                                {/* Admin note */}
                                {latestVersion.admin_note && (
                                    <div className="p-3 bg-cyan-500/5 border border-cyan-500/10 rounded-xl">
                                        <p className="text-cyan-400/60 text-[10px] font-medium mb-1 uppercase tracking-wider">Ghi chú từ designer</p>
                                        <p className="text-white/60 text-sm">{latestVersion.admin_note}</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Revision info (if applicable) */}
                        {versionNumber > 1 && (
                            <div className="p-4 bg-amber-500/5 border border-amber-500/10 rounded-xl">
                                <p className="text-amber-400/80 text-xs font-medium mb-1">
                                    Lần chỉnh sửa thứ {versionNumber - 1}
                                </p>
                                {order.revision_feedback && (
                                    <p className="text-white/40 text-xs">{order.revision_feedback}</p>
                                )}
                            </div>
                        )}

                        {/* Action buttons */}
                        <div className="space-y-3">
                            <button
                                onClick={handleApprove}
                                disabled={submitting || images.length === 0}
                                className="w-full py-4 bg-white text-black font-semibold rounded-xl hover:bg-white/90 transition-all disabled:opacity-30 disabled:cursor-not-allowed text-sm tracking-wide"
                            >
                                {submitting ? 'Đang xử lý...' : 'Duyệt thiết kế'}
                            </button>

                            <button
                                onClick={() => setShowRevisionModal(true)}
                                disabled={submitting || images.length === 0}
                                className="w-full py-4 border border-white/20 text-white/70 font-medium rounded-xl hover:border-white/40 hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed text-sm"
                            >
                                Yêu cầu chỉnh sửa
                            </button>
                        </div>

                        {/* Version history link */}
                        {designVersions.length > 1 && (
                            <button
                                onClick={() => setShowHistory(true)}
                                className="w-full text-center text-white/30 hover:text-white/60 text-xs transition-colors"
                            >
                                📋 Xem lịch sử thiết kế ({designVersions.length} versions)
                            </button>
                        )}

                        {/* Fine print */}
                        <p className="text-white/20 text-xs leading-relaxed text-center">
                            Sau khi duyệt, đơn hàng sẽ chuyển sang giai đoạn sản xuất. Mọi thay đổi sau thời điểm này sẽ không được chấp nhận.
                        </p>
                    </motion.div>
                </div>
            </div>

            {/* ─── Revision Modal ─── */}
            <AnimatePresence>
                {showRevisionModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6"
                        onClick={() => !submitting && setShowRevisionModal(false)}
                    >
                        <motion.div
                            initial={{ opacity: 0, y: 20, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 20, scale: 0.98 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-[#1D1D1F] rounded-2xl border border-white/10 p-8 w-full max-w-lg space-y-6"
                        >
                            <div>
                                <h2 className="text-xl font-semibold text-white">Yêu cầu chỉnh sửa</h2>
                                <p className="text-white/40 text-sm mt-1">Mô tả những thay đổi bạn muốn</p>
                            </div>

                            <textarea
                                value={revisionFeedback}
                                onChange={(e) => setRevisionFeedback(e.target.value)}
                                placeholder="Ví dụ: Muốn thay đổi góc đặt tay, chỉnh kích thước nhỏ hơn..."
                                rows={5}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:border-white/30 resize-none text-sm"
                                autoFocus
                            />

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowRevisionModal(false)}
                                    disabled={submitting}
                                    className="flex-1 py-3 border border-white/10 text-white/50 rounded-xl hover:border-white/20 hover:text-white/70 transition-all text-sm"
                                >
                                    Hủy
                                </button>
                                <button
                                    onClick={handleSubmitRevision}
                                    disabled={submitting || !revisionFeedback.trim()}
                                    className="flex-1 py-3 bg-white text-black font-medium rounded-xl hover:bg-white/90 transition-all disabled:opacity-30 text-sm"
                                >
                                    {submitting ? 'Đang gửi...' : 'Gửi yêu cầu'}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ─── Version History Modal ─── */}
            <AnimatePresence>
                {showHistory && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6"
                        onClick={() => setShowHistory(false)}
                    >
                        <motion.div
                            initial={{ opacity: 0, y: 20, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 20, scale: 0.98 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-[#1D1D1F] rounded-2xl border border-white/10 p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto space-y-4"
                        >
                            <div className="flex items-center justify-between">
                                <h2 className="text-lg font-semibold text-white">Lịch sử thiết kế</h2>
                                <button
                                    onClick={() => setShowHistory(false)}
                                    className="text-white/30 hover:text-white/60 transition-colors"
                                >
                                    ✕
                                </button>
                            </div>

                            <div className="space-y-4">
                                {designVersions.slice().reverse().map(ver => (
                                    <div
                                        key={ver.id}
                                        className={`p-4 rounded-xl border ${ver.status === 'approved'
                                                ? 'border-emerald-500/20 bg-emerald-500/5'
                                                : ver.status === 'rejected'
                                                    ? 'border-pink-500/20 bg-pink-500/5'
                                                    : 'border-cyan-500/20 bg-cyan-500/5'
                                            }`}
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-white font-medium text-sm">
                                                Version {ver.version_number}
                                            </span>
                                            <span className={`text-xs px-2 py-0.5 rounded-full ${ver.status === 'approved'
                                                    ? 'bg-emerald-500/20 text-emerald-400'
                                                    : ver.status === 'rejected'
                                                        ? 'bg-pink-500/20 text-pink-400'
                                                        : 'bg-orange-500/20 text-orange-400'
                                                }`}>
                                                {ver.status === 'approved' ? 'Đã duyệt' : ver.status === 'rejected' ? 'Yêu cầu chỉnh sửa' : 'Đang chờ duyệt'}
                                            </span>
                                        </div>

                                        {/* Thumbnails */}
                                        {ver.design_images.length > 0 && (
                                            <div className="flex gap-2 mb-2">
                                                {ver.design_images.slice(0, 4).map(img => (
                                                    <img
                                                        key={img.id}
                                                        src={img.image_url}
                                                        alt={img.label}
                                                        className="w-12 h-12 rounded-lg object-cover border border-white/10"
                                                    />
                                                ))}
                                                {ver.design_images.length > 4 && (
                                                    <div className="w-12 h-12 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                                                        <span className="text-white/40 text-xs">+{ver.design_images.length - 4}</span>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Admin note */}
                                        {ver.admin_note && (
                                            <p className="text-white/40 text-xs mt-1">💬 {ver.admin_note}</p>
                                        )}

                                        {/* User feedback */}
                                        {ver.user_feedback && (
                                            <p className="text-pink-400/60 text-xs mt-1">✏️ {ver.user_feedback}</p>
                                        )}

                                        <p className="text-white/20 text-[10px] mt-2">
                                            {new Date(ver.created_at).toLocaleString('vi-VN')}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
