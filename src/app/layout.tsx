import type { Metadata } from "next";
import "./globals.css";
import { LayoutWrapper } from "@/components/layout/LayoutWrapper";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { QueryProvider } from "@/components/providers/query-provider";
import { Toaster } from "@/components/ui/sonner";

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  title: {
    default: 'Miniver 3D Lab - In 3D & Thiết kế Custom',
    template: '%s | Miniver 3D Lab',
  },
  description: 'Dịch vụ in 3D chuyên nghiệp, thiết kế mô hình theo yêu cầu, và sản phẩm độc đáo.',
  keywords: ['3D print', 'mô hình 3D', 'custom', 'in 3D', 'tượng 3D', 'figure'],
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/brand/miniver-icon-round.png', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
    apple: '/brand/miniver-icon-round.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className={`antialiased bg-[var(--bg-void)] text-[var(--text-primary)]`}>
        <ThemeProvider>
          <QueryProvider>
            <AuthProvider>
              <LayoutWrapper>{children}</LayoutWrapper>
              <Toaster richColors position="top-right" />
            </AuthProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
