import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
    return (
        <div className="min-h-screen flex items-center justify-center px-6 relative overflow-hidden" style={{ background: 'var(--bg-void)' }}>
            <div className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full blur-3xl opacity-20 pointer-events-none" style={{ background: 'radial-gradient(circle, #0071E3, transparent)' }} />
            <div className="absolute bottom-1/4 right-1/4 w-64 h-64 rounded-full blur-3xl opacity-20 pointer-events-none" style={{ background: 'radial-gradient(circle, #A855F7, transparent)' }} />

            <div className="text-center max-w-lg relative z-10 animate-fade-in-up">
                <h1
                    className="text-[120px] md:text-[180px] font-bold leading-none mb-2"
                    style={{
                        background: 'linear-gradient(135deg, #0071E3, #A855F7)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                    }}
                >
                    404
                </h1>

                <h2 className="text-2xl md:text-3xl font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
                    Trang không tồn tại
                </h2>
                <p className="mb-8" style={{ color: 'var(--text-secondary)' }}>
                    Xin lỗi, trang bạn đang tìm kiếm không tồn tại hoặc đã bị di chuyển.
                </p>

                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <Button size="lg" asChild>
                        <Link href="/">Về trang chủ</Link>
                    </Button>
                    <Button variant="outline" size="lg" asChild>
                        <Link href="/products">Xem sản phẩm</Link>
                    </Button>
                </div>
            </div>
        </div>
    );
}
