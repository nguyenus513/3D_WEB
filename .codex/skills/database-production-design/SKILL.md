---
name: database-production-design
description: Use when changing MongoDB schema, collection ownership, indexes, migrations, upload/file persistence, order/payment data flow, or production DB cleanup in this repository.
---

# Database Production Design

Follow `docs/agent-db-design.md` as the source of truth.

## Workflow

1. Identify canonical collections touched by the change.
2. Reject new writes to legacy collections unless the task is a migration/archive script.
3. Define required fields, owner, allowed writers, indexes, and rollback.
4. Use expand-contract for migrations: add compatibility, backfill, verify, remove legacy.
5. Run `npm run mongo:audit`, `npx tsc --noEmit --pretty false`, and `npm run build` after implementation.

## Legacy Collections

Do not use these in runtime code: `master_orders`, `order_parent`, `order_child`, `order_files`, `custom_orders`, `print_orders`, `payment`, `_backup_*`.

## Required Response Shape

Return a concise section for schema impact, indexes, security/ownership, migration/backfill, tests, and rollback.

