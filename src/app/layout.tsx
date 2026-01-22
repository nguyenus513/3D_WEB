import type { Metadata } from "next";
import "./globals.css";
import { LayoutWrapper } from "@/components/layout/LayoutWrapper";
import { AuthProvider } from "@/components/providers/AuthProvider";

export const metadata: Metadata = {
  title: "3D Print | Sản Phẩm 3D Độc Đáo - Custom & In 3D Theo Yêu Cầu",
  description: "Chuyên tạo mô hình 3D độc đáo, cá nhân hóa theo yêu cầu. Sản phẩm có sẵn, custom theo ảnh, dịch vụ in 3D chuyên nghiệp.",
  keywords: ["3D print", "mô hình 3D", "custom", "in 3D", "tượng 3D", "figure"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body className="antialiased bg-[#0a0a0a] text-white">
        <AuthProvider>
          <LayoutWrapper>{children}</LayoutWrapper>
        </AuthProvider>
      </body>
    </html>
  );
}




