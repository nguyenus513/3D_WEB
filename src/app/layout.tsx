import type { Metadata } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import "./globals.css";
import { LayoutWrapper } from "@/components/layout/LayoutWrapper";
import { AuthProvider } from "@/components/providers/AuthProvider";

const beVietnamPro = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-be-vietnam-pro",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  title: {
    default: 'Miniver 3D Lab - In 3D & Thiết kế Custom',
    template: '%s | Miniver 3D Lab',
  },
  description: 'Dịch vụ in 3D chuyên nghiệp, thiết kế mô hình theo yêu cầu, và sản phẩm độc đáo.',
  keywords: ["3D print", "mô hình 3D", "custom", "in 3D", "tượng 3D", "figure"],
  icons: {
    icon: '/globe.svg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body className={`${beVietnamPro.variable} antialiased font-sans`} style={{ background: 'var(--bg-void)', color: 'var(--text-primary)' }}>
        <AuthProvider>
          <LayoutWrapper>{children}</LayoutWrapper>
        </AuthProvider>
      </body>
    </html>
  );
}




