import Link from 'next/link';

const footerLinks = {
    products: [
        { name: 'Sản phẩm có sẵn', href: '/products' },
        { name: 'Custom theo yêu cầu', href: '/custom' },
        { name: 'Dịch vụ in 3D', href: '/printing' },
    ],
    support: [
        { name: 'FAQ', href: '/faq' },
        { name: 'Liên hệ', href: '/about' },
        { name: 'Chính sách đổi trả', href: '/policy' },
    ],
    account: [
        { name: 'Tài khoản', href: '/account' },
        { name: 'Đơn hàng của tôi', href: '/account/orders' },
        { name: 'Giỏ hàng', href: '/cart' },
    ],
};

export function Footer() {
    return (
        <footer
            className="relative backdrop-blur-xl border-t border-[var(--border-color)]"
            style={{
                background: 'linear-gradient(180deg, rgba(139, 92, 246, 0.08) 0%, rgba(168, 85, 247, 0.04) 30%, rgba(10, 10, 10, 0.95) 100%)'
            }}
        >
            <div className="max-w-[1200px] mx-auto px-6 py-12">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                    {/* Brand */}
                    <div className="space-y-4">
                        <Link href="/" className="text-xl font-semibold text-[var(--text-primary)]">
                            Miniver 3D Lab
                        </Link>
                        <p className="text-sm text-[var(--text-secondary)]">
                            Chuyên tạo mô hình 3D độc đáo, cá nhân hóa theo yêu cầu.
                        </p>
                    </div>

                    {/* Products */}
                    <div>
                        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Sản phẩm</h3>
                        <ul className="space-y-3">
                            {footerLinks.products.map((link) => (
                                <li key={link.name}>
                                    <Link href={link.href} className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                                        {link.name}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Support */}
                    <div>
                        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Hỗ trợ</h3>
                        <ul className="space-y-3">
                            {footerLinks.support.map((link) => (
                                <li key={link.name}>
                                    <Link href={link.href} className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                                        {link.name}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Account */}
                    <div>
                        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Tài khoản</h3>
                        <ul className="space-y-3">
                            {footerLinks.account.map((link) => (
                                <li key={link.name}>
                                    <Link href={link.href} className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                                        {link.name}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                {/* Bottom */}
                <div className="mt-12 pt-8 border-t border-[var(--border-color)]">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                        <p className="text-xs text-[var(--text-tertiary)]">
                            Copyright © 2026 Miniver 3D Lab. All rights reserved.
                        </p>
                        <div className="flex items-center gap-6">
                            <Link href="/privacy" className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors">
                                Chính sách bảo mật
                            </Link>
                            <Link href="/terms" className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors">
                                Điều khoản sử dụng
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    );
}
