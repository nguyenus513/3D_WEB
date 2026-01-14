import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { NavbarLusion } from "@/components/layout/NavbarLusion";
import { Footer } from "@/components/layout/Footer";
import { CustomCursor } from "@/components/ui/CustomCursor";
import { SmoothScroll } from "@/components/ui/SmoothScroll";

const inter = Inter({
  subsets: ["latin", "vietnamese"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "3D Print | Mô hình 3D Độc Đáo - Custom & In 3D Theo Yêu Cầu",
  description: "Chuyên tạo mô hình 3D độc đáo, cá nhân hóa theo yêu cầu. Sản phẩm có sẵn, custom theo ảnh, dịch vụ in 3D chuyên nghiệp.",
  keywords: ["3D print", "mô hình 3D", "custom", "in 3D", "tượng 3D", "figure"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className={inter.variable} style={{ cursor: 'none' }}>
      <body className="antialiased bg-black text-white" style={{ cursor: 'none' }}>
        <SmoothScroll>
          <CustomCursor />
          <NavbarLusion />
          <main>
            {children}
          </main>
          <Footer />
        </SmoothScroll>
      </body>
    </html>
  );
}
