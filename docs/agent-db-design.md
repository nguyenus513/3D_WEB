# Agent DB Design Rules — Miniver Production

Use this checklist before changing database code, schemas, migrations, upload storage, payment state, or admin/user data access.

## Canonical Model

- Use canonical collections only: `profiles`, `addresses`, `categories`, `products`, `product_variants`, `orders`, `order_items`, `files`, `file_links`, `payments`, `payment_configs`, `notifications`, `design_versions`, `design_images`, `print_jobs`, `sessions`, `user_sessions`, `refresh_tokens`, `verification_tokens`, `security_logs`, `admin_audit_log`, `settings`, `system_settings`, `faqs`.
- Do not add new collections unless one of the canonical collections cannot model the data cleanly.
- Do not write new runtime code against legacy collections: `master_orders`, `order_parent`, `order_child`, `order_files`, `custom_orders`, `print_orders`, `payment`, `_backup_*`.
- If legacy data is needed, migrate it into canonical collections first, then archive/drop the legacy collection.

## Required Fields

- New `orders` must include `order_code`, `order_type`, `status`, `payment_status`, `created_at`, `updated_at`.
- New `order_items` must include `order_id`, `name`, `quantity`, `unit_price`, `total_price`, `created_at`, `updated_at`.
- New uploads must create a `files` record and at least one `file_links` record.
- New `payments` must include `order_id`, `amount`, `status`, `method`, `created_at`, `updated_at`; paid payments must include `paid_at` or `confirmed_at`.
- Never invent timestamps for old records unless the source timestamp is traceable from a related canonical record.

## Ownership And Access

- User-owned reads must filter by `user_id` or through `file_links -> orders.user_id`.
- Admin APIs must use `requireAdmin()` and must write audit/security logs for sensitive changes.
- Payment status may only be changed by PayOS/webhook/admin payment confirmation flows.
- Private model files, STL/OBJ, customer images, and AI model images must be served through `/api/files` or admin signed download APIs.

## Index Rules

- Any list endpoint needs an index matching filters plus sort.
- Required production indexes: `orders(order_type,status,created_at)`, `orders(user_id,order_type,created_at)`, `orders(payment_status,created_at)`, `files(file_url)`, `files(object_key)`, `file_links(file_id)`, `file_links(ref_type,ref_id,tag)`, `payments(order_id,status)`, `payments(transaction_code)`, `notifications(user_id,is_read,created_at)`.
- Run `npm run mongo:audit` after DB changes.

## Migration Safety

- Use expand-contract migrations: add/read compatibility first, backfill, deploy, verify, then remove legacy.
- Every migration must have dry-run mode, counts before/after, and rollback/archive path.
- Never drop collections directly from app code.
- Drop legacy collections only after runtime references are gone and production audit passes.

## Agent Output Requirement

When proposing or implementing DB work, include: schema impact, indexes, ownership/security, migration/backfill, audit before/after, rollback.

