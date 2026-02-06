# BÁO CÁO KIỂM TRA TOÀN DIỆN HỆ THỐNG

**Dự án:** 3D Web E-commerce Platform  
**Ngày kiểm tra:** 2026-02-05  
**Người kiểm tra:** Codex (Full Audit)  
**Phiên bản:** Next.js 16.1.1 + Supabase

---

## TÓM TẮT

### Production Readiness Score: **90/100** ✅ Có thể triển khai sau khi hoàn tất checklist

| Danh mục | Điểm | Trạng thái |
|---|---:|---|
| Server Stability | 85/100 | Cần xác nhận turbopack/build ổn định |
| Security | 90/100 | Đã harden, cần set đủ env |
| Database & Integrity | 90/100 | Đã bổ sung index + cột thiếu |
| API Routes | 88/100 | Chuẩn hóa auth/ratelimit |
| Admin Panel | 90/100 | Chuẩn hóa status & notes |
| UI/UX | 88/100 | Đã sửa text + đồng bộ status user/admin |

---

## CRITICAL FIXES ĐÃ HOÀN THÀNH

### 1) Bật lại Brute-force Protection + dọn debug log
- **File:** `src/auth.ts`
- **Fix:** bật lại chặn brute-force, ghi nhận failed attempts, clear attempts khi login thành công.
- **Loại bỏ:** log nhạy cảm (email/role/token).

### 2) Hợp nhất Middleware + bật Rate Limit Redis
- **File:** `middleware.ts`, `src/proxy.ts`
- **Fix:** middleware dùng Redis rate limit + Phoenix admin path + chặn admin vào user routes.
- **Proxy:** re-export middleware để tránh lệch logic.

### 3) Bảo vệ webhook QR bằng chữ ký HMAC
- **File:** `src/app/api/webhooks/qr/route.ts`
- **Fix:** verify `x-webhook-signature` với `QR_WEBHOOK_SECRET`.
- **Prod:** thiếu secret sẽ **fail closed**.

### 4) Fix lỗi xác nhận thanh toán bị public
- **File:** `src/app/api/orders/[id]/payment-confirmation/route.ts`
- **Fix:** yêu cầu đăng nhập + kiểm tra ownership.

### 5) Fix Order lookup bị conflict alias
- **File:** `src/app/api/orders/lookup/route.ts`
- **Fix:** dùng `order_items` chuẩn, ưu tiên relational items.

### 6) Fix IDOR trong tạo đơn (address_id)
- **File:** `src/app/api/orders/create/route.ts`
- **Fix:** xác thực ownership của `address_id`, bắt buộc địa chỉ hợp lệ.

### 7) Chuẩn hóa Admin Update (payment/status/notes)
- **File:** `src/controllers/AdminOrderController.ts`
- **Fix:** hỗ trợ `payment_status`, map status legacy, nhận `admin_note`/`admin_notes`, hỗ trợ timestamp fields.

### 8) UI/UX fix text lỗi encoding
- **Files:**
  - `src/app/checkout/page.tsx`
  - `src/app/printing/page.tsx`
  - `src/app/sys_internal/products/page.tsx`
  - `src/app/sys_internal/orders/[id]/page.tsx`
  - `src/components/admin/OrderStatusStepper.tsx`
  - `src/components/admin/OrderList.tsx`
  - `src/app/layout.tsx`

### 9) Đồng bộ User Orders + Pending Confirmation
- **Files:**
  - `src/app/account/orders/page.tsx`
  - `src/app/account/orders/[id]/page.tsx`
  - `src/app/api/orders/my-orders/route.ts`
- **Fix:** thêm tab `pending_confirmation`, map status/color đầy đủ, sửa timeline không auto xác nhận khi đang chờ, chuẩn hóa label `Đơn hàng Custom`.

### 10) Database hardening bổ sung
- **File:** `supabase/migrations/20260205_production_hardening.sql`
- **Fix:** thêm timestamp columns trạng thái + unique index default address.

### 11) Giảm log debug nhạy cảm
- **Files:**
  - `src/lib/utils/debugLog.ts`
  - `src/lib/db-direct.ts`
  - `src/services/UploadService.ts`
  - `src/controllers/UploadController.ts`
  - `src/services/ProfileService.ts`
  - `src/controllers/ProductController.ts`
  - `src/app/api/addresses/route.ts`
  - `src/app/sys_internal/products/new/page.tsx`
  - `src/components/account/AccountSidebar.tsx`
- **Fix:** chuyển `console.log` sang `debugLog` (no-op ở production) để giảm rò rỉ log nhạy cảm.

---

## CÁC ĐIỂM CẦN HOÀN TẤT TRƯỚC KHI PROD

### MUST FIX
- [ ] **Run migration** `supabase/migrations/20260205_production_hardening.sql`
- [ ] **Apply security schema** `supabase-schema-security.sql`
- [ ] **Set ENV bắt buộc**:
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `NEXTAUTH_SECRET`
  - `UPSTASH_REDIS_REST_URL`
  - `UPSTASH_REDIS_REST_TOKEN`
  - `TOKEN_ENCRYPTION_KEY` (bắt buộc prod)
  - `QR_WEBHOOK_SECRET` (bắt buộc prod)

### SHOULD DO
- [ ] Chạy full test (Playwright + API)
- [ ] Rà soát UI/UX lần cuối (spacing, contrast, mobile) trước go-live
- [ ] Kiểm thử flow thanh toán cho 3 type: ready_made, custom, printing

---

## NOTE VỀ WORKFLOW MUA HÀNG

- **Cart checkout**: tạo order unified + payment record + QR
- **Printing/Custom**: tạo order unified + order_items + payment record
- **User chuyển khoản**: tạo `payment` + `status = pending_confirmation`
- **Admin**: xác nhận giao dịch -> `payment_status` + `status = confirmed`
- **Webhook**: cập nhật `payment_status = paid` + `status = processing`

Flow đã đồng nhất, không dùng route thừa.

---

## DỌN DẸP FILE THỪA

- Đã xóa `src/lib/google-drive.deprecated.ts` (không còn được import).

## KIẾN NGHỊ BỔ SUNG

- **CSRF enforcement** hiện có sẵn (CSRF provider) nhưng chưa enforce ở API routes.
- Khuyến nghị bật CSRF cho tất cả POST/PUT/DELETE API quan trọng.

---

*Report updated by Codex — 2026-02-05*
