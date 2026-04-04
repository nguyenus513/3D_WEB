# Admin order type filter fix

## What & Why
The admin orders list has 3 separate pages (Tất cả / Custom / In 3D), and `OrderList` already
passes `?type=custom` or `?type=printing` to the backend API. However, `AdminOrderController.listOrders()`
reads only `?status` and silently ignores `?type`. This means all three pages display identical
full-order lists — filtering by order type does nothing.

The `orders` table already has an `order_type` column (`product | custom | print_3d | mixed`).
The fix is entirely backend: wire up the existing `?type` param to a Supabase `.eq('order_type', ...)` filter.

## Done looks like
- `/sys_internal/orders/` shows all order types (no type filter)
- `/sys_internal/orders/custom/` shows only `order_type = 'custom'` orders
- `/sys_internal/orders/printing/` shows only `order_type = 'print_3d'` orders (normalized from 'printing' input)
- Status tab counts reflect only the filtered order type, not the full table
- No changes to the DB schema or frontend pages — the three nav pages already exist

## Out of scope
- Changing navigation structure or merging the three pages into one
- Adding in-page type-filter tabs inside the `OrderList` component
- Changing how orders are stored or classified

## Tasks
1. **Backend: handle `?type` param** — In `AdminOrderController.listOrders()`, read the `type`
   searchParam and apply `.eq('order_type', ...)` when provided. Normalize the input so that
   `printing` maps to `print_3d` (the DB value), and `product` maps to `product`. When `type=all`
   or omitted, no filter is applied. Support `mixed` as-is.

## Relevant files
- `src/controllers/AdminOrderController.ts:80-132`
- `src/app/sys_internal/orders/page.tsx`
- `src/app/sys_internal/orders/custom/page.tsx`
- `src/app/sys_internal/orders/printing/page.tsx`
- `src/components/admin/OrderList.tsx`
