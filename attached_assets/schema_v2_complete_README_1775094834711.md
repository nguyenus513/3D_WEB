
# schema_v2_complete.sql

Đây là bản schema PostgreSQL viết lại hoàn chỉnh cho mô hình:
- users / auth
- catalog / products / variants
- files
- orders / revisions / design versions
- payments
- notifications / audit / print jobs / settings

## Điểm đã nâng cấp so với schema cũ
- Naming thống nhất `snake_case`
- `email` dùng `citext`
- Password/session/verification token dùng hash / encrypted fields
- Bỏ `ref_type/ref_id` cho các bảng chính, thay bằng FK rõ ràng
- `total_price` là generated column
- `order_code` auto-generate bằng trigger
- `subtotal`, `total_amount`, `payment_status` đồng bộ bằng trigger
- `user_addresses` chỉ cho 1 default address / user
- Search index cơ bản với `pg_trgm`
- `updated_at` tự cập nhật bằng trigger

## Lưu ý triển khai
- Đây là schema cho cài đặt mới. Nếu bạn đang có dữ liệu cũ, nên migrate từng bước.
- Ứng dụng phải lưu:
  - `password_hash`: Argon2id hoặc bcrypt
  - `session_token_hash`: SHA-256 hoặc mạnh hơn
  - `verification_tokens.token_hash`: hash, không lưu raw token
  - OAuth token: mã hóa trước khi lưu vào `auth_accounts`

## Gợi ý bước tiếp theo
1. Tạo migration seed enum + tables
2. Tạo layer app validation
3. Thêm RLS / permission nếu dùng Supabase hoặc multi-tenant
4. Thêm background jobs để dọn token/session hết hạn
