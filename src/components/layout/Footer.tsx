import Link from 'next/link';
import { useUiLabels } from '@/hooks/useUiLabels';

interface FooterLink {
    name: string;
    href: string;
}

interface FooterSection {
    title: string;
    links: FooterLink[];
}

interface FooterLabels {
    brand?: string;
    tagline?: string;
    sections?: {
        products?: FooterSection;
        support?: FooterSection;
        account?: FooterSection;
    };
    bottom?: {
        copyright?: string;
        links?: FooterLink[];
    };
}

export function Footer() {
    const { t } = useUiLabels(['public.footer', 'common']);
    const footer = t<FooterLabels>('footer', {}) as FooterLabels;

    const productsSection = footer.sections?.products;
    const supportSection = footer.sections?.support;
    const accountSection = footer.sections?.account;
    const bottomLinks = footer.bottom?.links || [];

    return (
        <footer
            className="relative backdrop-blur-xl border-t border-white/10"
            style={{
                background: 'linear-gradient(180deg, rgba(139, 92, 246, 0.08) 0%, rgba(168, 85, 247, 0.04) 30%, rgba(10, 10, 10, 0.95) 100%)'
            }}
        >
            <div className="max-w-[1200px] mx-auto px-6 py-12">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                    {/* Brand */}
                    <div className="space-y-4">
                        <Link href="/" className="text-xl font-semibold text-white">
                            {footer.brand}
                        </Link>
                        <p className="text-sm text-[#A1A1A6]">
                            {footer.tagline}
                        </p>
                    </div>

                    {/* Products */}
                    <div>
                        <h3 className="text-sm font-semibold text-white mb-4">{productsSection?.title}</h3>
                        <ul className="space-y-3">
                            {(productsSection?.links || []).map((link) => (
                                <li key={link.name}>
                                    <Link href={link.href} className="text-sm text-[#A1A1A6] hover:text-white transition-colors">
                                        {link.name}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Support */}
                    <div>
                        <h3 className="text-sm font-semibold text-white mb-4">{supportSection?.title}</h3>
                        <ul className="space-y-3">
                            {(supportSection?.links || []).map((link) => (
                                <li key={link.name}>
                                    <Link href={link.href} className="text-sm text-[#A1A1A6] hover:text-white transition-colors">
                                        {link.name}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Account */}
                    <div>
                        <h3 className="text-sm font-semibold text-white mb-4">{accountSection?.title}</h3>
                        <ul className="space-y-3">
                            {(accountSection?.links || []).map((link) => (
                                <li key={link.name}>
                                    <Link href={link.href} className="text-sm text-[#A1A1A6] hover:text-white transition-colors">
                                        {link.name}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                {/* Bottom */}
                <div className="mt-12 pt-8 border-t border-white/[0.08]">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                        <p className="text-xs text-[#6E6E73]">
                            {footer.bottom?.copyright}
                        </p>
                        <div className="flex items-center gap-6">
                            {bottomLinks.map((link) => (
                                <Link key={link.name} href={link.href} className="text-xs text-[#6E6E73] hover:text-white transition-colors">
                                    {link.name}
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    );
}
