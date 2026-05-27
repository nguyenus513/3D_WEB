import Link from 'next/link';

const sections = [
  {
    title: 'Thông tin chúng tôi thu thập',
    items: [
      'Thông tin tài khoản: họ tên, email, số điện thoại.',
      'Thông tin đơn hàng: sản phẩm, cấu hình mô hình, địa chỉ giao hàng, trạng thái thanh toán.',
      'Tệp do khách hàng cung cấp: ảnh tham khảo, ảnh phụ kiện, file in 3D STL/OBJ và mô tả yêu cầu.',
      'Dữ liệu kỹ thuật cần thiết để bảo mật, chống spam và vận hành website.',
    ],
  },
  {
    title: 'Mục đích sử dụng',
    items: [
      'Xử lý đơn hàng, tạo ảnh mô phỏng, in 3D, đóng gói và giao hàng.',
      'Liên hệ xác nhận thông tin, gửi email trạng thái và hỗ trợ khách hàng.',
      'Cải thiện chất lượng dịch vụ, kiểm tra lỗi file và bảo vệ hệ thống.',
      'Thực hiện nghĩa vụ kế toán, đối soát thanh toán và tuân thủ pháp luật.',
    ],
  },
  {
    title: 'Lưu trữ và bảo mật',
    items: [
      'Dữ liệu được lưu trên các dịch vụ hạ tầng có kiểm soát truy cập.',
      'File upload chỉ dùng cho xử lý đơn hàng và hiển thị cho đúng khách hàng/admin liên quan.',
      'Chúng tôi không bán dữ liệu cá nhân cho bên thứ ba.',
      'Một số đối tác thanh toán, email, lưu trữ và vận chuyển có thể xử lý dữ liệu theo phạm vi cần thiết.',
    ],
  },
  {
    title: 'Quyền của khách hàng',
    items: [
      'Yêu cầu xem, cập nhật hoặc chỉnh sửa thông tin cá nhân.',
      'Yêu cầu hỗ trợ xóa dữ liệu không còn cần thiết, trừ dữ liệu phải lưu theo quy định.',
      'Liên hệ Miniver khi phát hiện thông tin sai hoặc có nghi ngờ truy cập trái phép.',
    ],
  },
];

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-black text-white pt-28 pb-20 px-6">
      <div className="mx-auto max-w-4xl">
        <p className="text-white/45 text-sm uppercase tracking-[0.24em] mb-4">Miniver</p>
        <h1 className="text-4xl md:text-6xl font-semibold tracking-tight mb-5">Chính sách bảo mật</h1>
        <p className="text-white/60 leading-7 max-w-2xl mb-10">
          Chính sách này giải thích cách Miniver thu thập, sử dụng và bảo vệ dữ liệu khi bạn dùng website, đặt mô hình custom hoặc sử dụng dịch vụ in 3D.
        </p>
        <div className="space-y-5">
          {sections.map((section) => (
            <section key={section.title} className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:p-8">
              <h2 className="text-xl font-semibold mb-4">{section.title}</h2>
              <ul className="space-y-3 text-white/65 leading-7">
                {section.items.map((item) => (
                  <li key={item} className="flex gap-3">
                    <span className="mt-3 h-1.5 w-1.5 rounded-full bg-white/40 flex-none" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <div className="mt-10 rounded-3xl border border-white/10 bg-white p-6 text-black">
          <h2 className="text-xl font-semibold mb-2">Liên hệ</h2>
          <p className="text-black/65 leading-7">Nếu cần hỗ trợ về dữ liệu cá nhân, vui lòng liên hệ Miniver qua trang liên hệ hoặc email hỗ trợ trên website.</p>
          <Link href="/about" className="mt-5 inline-flex rounded-full border border-black px-5 py-2.5 text-sm font-semibold hover:bg-black hover:text-white transition-colors">Liên hệ Miniver</Link>
        </div>
      </div>
    </main>
  );
}
