import type { Metadata } from "next";
import "./globals.css";
import { NavLusion } from "@/components/layout/NavLusion";
import { Footer } from "@/components/layout/Footer";
import { FloatingDock } from "@/components/ui/FloatingDock";
import {
  IconHome,
  IconBox,
  IconPalette,
  IconPrinter,
  IconQuestionMark,
  IconInfoCircle,
  IconShoppingCart,
} from "@tabler/icons-react";

export const metadata: Metadata = {
  title: "3D Print | Sản Phẩm 3D Độc Đáo - Custom & In 3D Theo Yêu Cầu",
  description: "Chuyên tạo mô hình 3D độc đáo, cá nhân hóa theo yêu cầu. Sản phẩm có sẵn, custom theo ảnh, dịch vụ in 3D chuyên nghiệp.",
  keywords: ["3D print", "mô hình 3D", "custom", "in 3D", "tượng 3D", "figure"],
};

const dockItems = [
  {
    title: "Trang chủ",
    icon: <IconHome className="h-full w-full text-white" />,
    href: "/",
  },
  {
    title: "Sản phẩm",
    icon: <IconBox className="h-full w-full text-white" />,
    href: "/products",
  },
  {
    title: "Custom",
    icon: <IconPalette className="h-full w-full text-white" />,
    href: "/custom",
  },
  {
    title: "In 3D",
    icon: <IconPrinter className="h-full w-full text-white" />,
    href: "/printing",
  },
  {
    title: "FAQ",
    icon: <IconQuestionMark className="h-full w-full text-white" />,
    href: "/faq",
  },
  {
    title: "Liên hệ",
    icon: <IconInfoCircle className="h-full w-full text-white" />,
    href: "/about",
  },
  {
    title: "Giỏ hàng",
    icon: <IconShoppingCart className="h-full w-full text-white" />,
    href: "/cart",
  },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body className="antialiased bg-[#0a0a0a] text-white">
        <NavLusion />
        <main>
          {children}
        </main>
        <FloatingDock items={dockItems} />
        <Footer />
      </body>
    </html>
  );
}


