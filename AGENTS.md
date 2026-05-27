# Repository Agent Instructions

## Database Work

- Follow `docs/agent-db-design.md` for any database, upload, order, payment, admin, migration, or schema work.
- Do not add runtime writes to legacy collections: `master_orders`, `order_parent`, `order_child`, `order_files`, `custom_orders`, `print_orders`, `payment`, `_backup_*`.
- Prefer canonical collections: `orders`, `order_items`, `files`, `file_links`, `payments`, `notifications`, `profiles`.
- Run `npm run mongo:audit`, `npx tsc --noEmit --pretty false`, and `npm run build` after DB-impacting changes when feasible.

