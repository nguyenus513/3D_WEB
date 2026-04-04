# Đồng bộ UI Customer với Admin (Flat Monochrome)

## What & Why
Khu vực `/account` của khách hàng đang có phong cách visual không đồng nhất với trang admin. Cụ thể: drawer "Chi tiết file" dùng gradient xanh/teal/emerald, status badge dùng nhiều màu sắc (vàng, tím, cam, đỏ...), trong khi toàn bộ admin panel đã thiết kế flat monochrome (trắng/xám trên nền đen, zero gradient màu). Mục tiêu: đưa toàn bộ customer-facing UI về cùng ngôn ngữ thiết kế với admin.

**Design language chuẩn (theo admin):**
- Card: `bg-[#1D1D1F]` hoặc `bg-white/[0.04]`, border `border-white/[0.06]`
- Icon: Lucide, `strokeWidth={1.5}`, màu `text-white/40`–`text-white/60`
- Badge trạng thái: flat monochrome `bg-white/8 text-white/40` (dim) → `bg-white/15 text-white/80` (active) → `bg-white/20 text-white` (done)
- Nút primary: `bg-white text-black hover:bg-white/90`
- Không dùng gradient màu, không dùng emoji trong label

## Done looks like
- Drawer "Chi tiết file" (`PrintFileDetail`) không còn gradient xanh/cyan/emerald; background đồng nhất với admin card style
- Badge công nghệ in (FDM/Resin) hiển thị bằng icon Lucide thay emoji
- File type badge, giá "Tổng", nút tải file đều flat monochrome
- Danh sách đơn hàng (`/account/orders`) — status badge một màu duy nhất, phân biệt bằng opacity (dim/active/done), không dùng màu vàng/tím/đỏ
- Trang tổng quan (`/account`) — status badge đồng nhất với trang danh sách
- Sidebar tài khoản gọn hơn: bỏ `backdrop-blur` thừa, active state rõ ràng hơn

## Out of scope
- Thay đổi layout tổng thể hoặc cấu trúc route
- Thay đổi admin panel
- Responsive/mobile layout
- Các trang `/checkout`, `/products`, `/custom`

## Tasks
1. **Refactor PrintFileDetail drawer** — Xóa toàn bộ gradient màu trong drawer (bg, card tiêu đề, card giá), thay badge cyan/emerald bằng monochrome, thay emoji tech label bằng Lucide icon, thay nút tải gradient bằng `bg-white text-black`.

2. **Monochrome status badges trên orders list và dashboard** — Thay thế `statusColors` map nhiều màu trong `account/orders/page.tsx` và `account/page.tsx` bằng scale monochrome thống nhất: dim (`bg-white/8 text-white/40`) cho trạng thái chờ, mid (`bg-white/15 text-white/70`) cho đang xử lý, bright (`bg-white/20 text-white`) cho hoàn thành/giao, và fade (`bg-white/5 text-white/25`) cho đã hủy.

3. **AccountSidebar polish** — Bỏ `backdrop-blur-xl` thừa trên card info và nav, làm rõ active nav item (thêm left border `border-l-2 border-white` hoặc tăng bg lên `bg-white/10`), đồng nhất với admin sidebar style.

## Relevant files
- `src/components/admin/PrintFileDetail.tsx`
- `src/app/account/orders/page.tsx:47-76`
- `src/app/account/page.tsx:25-41`
- `src/components/account/AccountSidebar.tsx:50-96`
- `src/components/admin/AdminSidebar.tsx:86-218`
- `src/app/account/orders/[id]/page.tsx:124-140`
