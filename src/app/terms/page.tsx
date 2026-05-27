import Link from 'next/link';

const sections = [
  {
    title: 'Tài khoản và thông tin đặt hàng',
    items: [
      'Khách hàng cần cung cấp thông tin chính xác để Miniver xử lý đơn hàng và giao hàng.',
      'Bạn chịu trách nhiệm bảo mật tài khoản và thông báo cho Miniver nếu phát hiện truy cập bất thường.',
      'Miniver có quyền từ chối hoặc tạm dừng xử lý đơn nếu thông tin không hợp lệ hoặc có dấu hiệu gian lận.',
    ],
  },
  {
    title: 'Thanh toán và xác nhận đơn',
    items: [
      'Giá hiển thị bằng VND và có thể bao gồm sản phẩm, custom, in 3D, phụ phí và vận chuyển tùy đơn.',
      'Đơn hàng chỉ được xử lý sau khi hệ thống hoặc admin xác nhận thanh toán thành công.',
      'Với đơn custom/in 3D, chi phí có thể thay đổi theo kích thước, vật liệu, độ phức tạp và yêu cầu chỉnh sửa.',
    ],
  },
  {
    title: 'Nội dung upload và quyền sử dụng',
    items: [
      'Bạn xác nhận có quyền sử dụng ảnh, mô tả, file STL/OBJ và tài liệu gửi cho Miniver.',
      'Miniver chỉ dùng nội dung upload để tư vấn, tạo demo, sản xuất và hỗ trợ đơn hàng của bạn.',
      'Không upload nội dung vi phạm pháp luật, xâm phạm quyền sở hữu trí tuệ hoặc chứa dữ liệu nhạy cảm không cần thiết.',
    ],
  },
  {
    title: 'Custom, demo và chỉnh sửa',
    items: [
      'Ảnh demo là hình mô phỏng để khách duyệt trước khi sản xuất.',
      'Nếu yêu cầu chỉnh sửa, khách cần ghi rõ phần cần sửa để Miniver xử lý đúng hướng.',
      'Sau khi khách duyệt demo, đơn hàng sẽ chuyển sang sản xuất và khả năng thay đổi có thể bị giới hạn.',
    ],
  },
  {
    title: 'Giao hàng, đổi trả và trách nhiệm',
    items: [
      'Thời gian sản xuất/giao hàng là ước tính và có thể thay đổi do file, vật liệu, vận chuyển hoặc yếu tố bất khả kháng.',
      'Chính sách đổi trả áp dụng theo trang Chính sách đổi trả của Miniver.',
      'Miniver không chịu trách nhiệm cho lỗi phát sinh từ file nguồn sai, thiếu dữ liệu hoặc yêu cầu không rõ ràng sau khi đã được xác nhận.',
    ],
  },
];

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-black text-white pt-28 pb-20 px-6">
      <div className="mx-auto max-w-4xl">
        <p className="text-white/45 text-sm uppercase tracking-[0.24em] mb-4">Miniver</p>
        <h1 className="text-4xl md:text-6xl font-semibold tracking-tight mb-5">Điều khoản sử dụng</h1>
        <p className="text-white/60 leading-7 max-w-2xl mb-10">
          Khi sử dụng website Miniver, bạn đồng ý với các điều khoản về tài khoản, đặt hàng, thanh toán, upload dữ liệu và quy trình xử lý đơn.
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
        <div className="mt-10 flex flex-col sm:flex-row gap-3">
          <Link href="/policy" className="inline-flex justify-center rounded-full bg-white px-5 py-3 text-sm font-semibold text-black hover:bg-white/85 transition-colors">Xem chính sách đổi trả</Link>
          <Link href="/privacy" className="inline-flex justify-center rounded-full border border-white/20 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-colors">Xem chính sách bảo mật</Link>
        </div>
      </div>
    </main>
  );
}
