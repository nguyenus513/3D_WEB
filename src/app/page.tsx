import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export default function HomePage() {
  return (
    <div className="bg-black">
      {/* ========================================
          HERO SECTION - Full Screen
          ======================================== */}
      <section className="min-h-screen flex flex-col items-center justify-center px-6 relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-black via-black to-[#1D1D1F] pointer-events-none" />

        {/* 3D Model Placeholder */}
        <div className="relative z-10 w-full max-w-xl aspect-square mb-8 flex items-center justify-center">
          <div className="w-72 h-72 md:w-96 md:h-96 rounded-full bg-gradient-to-br from-[#0071E3]/20 to-transparent border border-white/10 flex items-center justify-center animate-float">
            <div className="w-48 h-48 md:w-64 md:h-64 rounded-full bg-gradient-to-br from-[#0071E3]/30 to-[#00C7BE]/20 flex items-center justify-center">
              <span className="text-6xl md:text-8xl">🎨</span>
            </div>
          </div>
        </div>

        {/* Hero Text */}
        <div className="relative z-10 text-center max-w-3xl">
          <h1 className="headline-hero text-[#F5F5F7] mb-6">
            Sản Phẩm 3D Độc Đáo
          </h1>
          <p className="body-large text-[#A1A1A6] mb-8">
            Chế tác thủ công. Cá nhân hóa hoàn toàn.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/products" className="link-more text-[#0071E3]">
              Tìm hiểu thêm
            </Link>
            <Button variant="primary" size="lg">
              Mua ngay
            </Button>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-[#6E6E73] animate-bounce">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </div>
      </section>

      {/* ========================================
          BENTO GRID - Services
          ======================================== */}
      <section className="py-20 px-6">
        <div className="max-w-[1200px] mx-auto">
          {/* Bento Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Card 1 - Products */}
            <Card variant="bento" className="p-8 md:p-12 group">
              <div className="aspect-square max-w-[200px] mx-auto mb-8 rounded-2xl bg-gradient-to-br from-[#FF6B6B]/20 to-transparent flex items-center justify-center group-hover:scale-105 transition-transform duration-500">
                <span className="text-7xl">🎭</span>
              </div>
              <h2 className="headline-card text-[#F5F5F7] mb-3">
                Sản Phẩm Có Sẵn
              </h2>
              <p className="body-default text-[#A1A1A6] mb-6">
                Khám phá bộ sưu tập độc đáo với chất lượng cao.
              </p>
              <Link href="/products" className="link-more text-[#0071E3]">
                Tìm hiểu thêm
              </Link>
            </Card>

            {/* Card 2 - Custom */}
            <Card variant="bento" className="p-8 md:p-12 group">
              <div className="aspect-square max-w-[200px] mx-auto mb-8 rounded-2xl bg-gradient-to-br from-[#4ECDC4]/20 to-transparent flex items-center justify-center group-hover:scale-105 transition-transform duration-500">
                <span className="text-7xl">✨</span>
              </div>
              <h2 className="headline-card text-[#F5F5F7] mb-3">
                Tùy Biến Theo Yêu Cầu
              </h2>
              <p className="body-default text-[#A1A1A6] mb-6">
                Tạo mô hình từ ảnh của bạn. Single, Couple, Group.
              </p>
              <Link href="/custom" className="link-more text-[#0071E3]">
                Bắt đầu
              </Link>
            </Card>

            {/* Card 3 - Printing (Full width) */}
            <Card variant="bento" className="md:col-span-2 p-8 md:p-12 group">
              <div className="flex flex-col md:flex-row items-center gap-8">
                <div className="w-full md:w-1/3 aspect-video rounded-2xl bg-gradient-to-br from-[#A855F7]/20 to-transparent flex items-center justify-center group-hover:scale-105 transition-transform duration-500">
                  <span className="text-7xl">🖨️</span>
                </div>
                <div className="flex-1 text-center md:text-left">
                  <h2 className="headline-card text-[#F5F5F7] mb-3">
                    Dịch Vụ In 3D
                  </h2>
                  <p className="body-default text-[#A1A1A6] mb-6">
                    Upload file STL · Báo giá tự động · FDM &amp; Resin
                  </p>
                  <Link href="/printing" className="link-more text-[#0071E3]">
                    Báo giá ngay
                  </Link>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* ========================================
          FEATURED PRODUCTS - Light Section
          ======================================== */}
      <section className="py-20 px-6 bg-[#F5F5F7]">
        <div className="max-w-[1200px] mx-auto">
          <h2 className="headline-section text-[#1D1D1F] text-center mb-4">
            Sản Phẩm Nổi Bật
          </h2>
          <p className="body-large text-[#6E6E73] text-center mb-12">
            Những sản phẩm được yêu thích nhất
          </p>

          {/* Product Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((item) => (
              <Link href={`/products/${item}`} key={item}>
                <Card variant="product" className="bg-white group">
                  <div className="aspect-square bg-[#F5F5F7] flex items-center justify-center overflow-hidden">
                    <div className="text-6xl group-hover:scale-110 transition-transform duration-500">
                      {item === 1 && '🦸'}
                      {item === 2 && '🐉'}
                      {item === 3 && '🦊'}
                      {item === 4 && '🎮'}
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="font-medium text-[#1D1D1F]">
                      Sản phẩm {item}
                    </h3>
                    <p className="text-[#6E6E73]">
                      {(250000 + item * 50000).toLocaleString('vi-VN')}đ
                    </p>
                  </div>
                </Card>
              </Link>
            ))}
          </div>

          {/* View all link */}
          <div className="text-center mt-12">
            <Link href="/products" className="link-more text-[#0071E3]">
              Xem tất cả sản phẩm
            </Link>
          </div>
        </div>
      </section>

      {/* ========================================
          WHY US - Features
          ======================================== */}
      <section className="py-20 px-6">
        <div className="max-w-[1200px] mx-auto">
          <h2 className="headline-section text-[#F5F5F7] text-center mb-16">
            Tại Sao Chọn Chúng Tôi?
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-[#0071E3]/20 flex items-center justify-center">
                <span className="text-3xl">🎨</span>
              </div>
              <h3 className="headline-card text-[#F5F5F7] mb-3">
                Thủ Công Tỉ Mỉ
              </h3>
              <p className="body-default text-[#A1A1A6]">
                Mỗi sản phẩm được chế tác thủ công với sự tỉ mỉ cao nhất.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-[#30D158]/20 flex items-center justify-center">
                <span className="text-3xl">⚡</span>
              </div>
              <h3 className="headline-card text-[#F5F5F7] mb-3">
                Giao Hàng Nhanh
              </h3>
              <p className="body-default text-[#A1A1A6]">
                Thời gian sản xuất 5-7 ngày, giao hàng toàn quốc.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-[#FF9500]/20 flex items-center justify-center">
                <span className="text-3xl">✅</span>
              </div>
              <h3 className="headline-card text-[#F5F5F7] mb-3">
                Xem Trước Sản Phẩm
              </h3>
              <p className="body-default text-[#A1A1A6]">
                Gửi ảnh demo trước khi giao, đảm bảo hài lòng 100%.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================
          CTA Section
          ======================================== */}
      <section className="py-20 px-6 bg-gradient-to-b from-[#1D1D1F] to-black">
        <div className="max-w-[800px] mx-auto text-center">
          <h2 className="headline-section text-[#F5F5F7] mb-6">
            Sẵn Sàng Tạo Mô Hình Của Bạn?
          </h2>
          <p className="body-large text-[#A1A1A6] mb-8">
            Chỉ cần upload ảnh, chúng tôi sẽ biến nó thành hiện thực.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button variant="primary" size="lg">
              <Link href="/custom">Bắt đầu Custom</Link>
            </Button>
            <Button variant="secondary" size="lg">
              <Link href="/products">Xem Sản Phẩm</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
