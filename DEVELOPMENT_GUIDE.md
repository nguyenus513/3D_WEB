# 📘 Antigravity Implementation Playbook: Minwsun-3D_WEB

> **Quy trình Tác nghiệp Tiêu chuẩn (SOP)** cho development team.  
> Mọi feature mới phải tuân thủ playbook này.

---

## 🎯 Nguyên Tắc Cốt Lõi (7 Rules)

| Rule | Mô tả | ❌ Tránh | ✅ Đúng |
|------|-------|---------|---------|
| #1 | Routes chỉ routing | Logic trong route.ts | `controller.method(req)` |
| #2 | Controllers kế thừa BaseController | Response thủ công | `this.handleSuccess(data)` |
| #3 | Mọi lỗi → Sentry | `console.error` | `Sentry.captureException` |
| #4 | Config tập trung | `process.env.XXX` | `config.supabase.url` |
| #5 | Validate với Zod | Không validate | `schema.parse(input)` |
| #6 | Repository cho DB access | DB trong route | `repo.findById()` |
| #7 | Unit + Integration tests | Không test | Test mọi service |

---

## 🏗 Kiến Trúc Phân Lớp

```
HTTP Request
    ↓
┌─────────────────────────────────────────────┐
│  Route (src/app/api/xxx/route.ts)           │  → Chỉ routing
│  const controller = new XxxController();    │
│  export async function GET(req) { ... }     │
└─────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────┐
│  Controller (src/controllers/XxxController) │  → Request handling
│  extends BaseController                      │  → Auth, validate, response
└─────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────┐
│  Service (src/services/XxxService.ts)       │  → Business logic
│  Xử lý nghiệp vụ, gọi repo                  │
└─────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────┐
│  Repository (src/repositories/XxxRepo.ts)   │  → Data access
│  Chỉ nói chuyện với Database                │
└─────────────────────────────────────────────┘
    ↓
Database (Supabase)
```

---

## 📁 Cấu Trúc Thư Mục

```
src/
├── config/
│   └── unifiedConfig.ts     # Tất cả env vars
├── lib/
│   └── core/
│       └── BaseController.ts # Abstract controller
├── controllers/
│   ├── OrderController.ts
│   ├── ProfileController.ts
│   └── ...
├── services/
│   ├── OrderService.ts
│   └── ...
├── repositories/
│   ├── OrderRepository.ts
│   ├── ProfileRepository.ts
│   └── ...
├── validators/
│   ├── order.schema.ts
│   └── ...
└── app/api/
    └── [feature]/route.ts   # Chỉ routing!
```

---

## 🛠 Phase 1: Xây Dựng "Lõi" (The Core)

### 1.1 unifiedConfig.ts ✅

```typescript
// src/config/unifiedConfig.ts
import { z } from 'zod';

const envSchema = z.object({
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
    // ... tất cả env vars
});

const env = envSchema.parse(process.env);

export const config = {
    supabase: {
        url: env.NEXT_PUBLIC_SUPABASE_URL,
        serviceKey: env.SUPABASE_SERVICE_ROLE_KEY,
    },
    // ...
} as const;
```

### 1.2 BaseController.ts ✅

```typescript
// src/lib/core/BaseController.ts
export abstract class BaseController {
    protected handleSuccess<T>(data: T, status = 200) {
        return NextResponse.json({
            success: true,
            data,
            timestamp: new Date().toISOString()
        }, { status });
    }

    protected handleError(error: unknown) {
        Sentry.captureException(error);
        return NextResponse.json({
            success: false,
            error: 'Internal Server Error',
            requestId: crypto.randomUUID()
        }, { status: 500 });
    }
}
```

---

## 🏗 Phase 2: Refactoring Loop (Per Module)

### Bước 2.1: Tạo Repository

```typescript
// src/repositories/XxxRepository.ts
export class XxxRepository {
    constructor(private db: SupabaseClient) {}

    async findById(id: string) {
        const { data, error } = await this.db
            .from('xxx')
            .select('*')
            .eq('id', id)
            .single();
        if (error) throw error;
        return data;
    }
}
```

### Bước 2.2: Tạo Service

```typescript
// src/services/XxxService.ts
export class XxxService {
    constructor(private repo: XxxRepository) {}

    async getItem(id: string) {
        // Business logic here
        const item = await this.repo.findById(id);
        if (!item) throw new NotFoundError('Item not found');
        return item;
    }
}
```

### Bước 2.3: Tạo Controller

```typescript
// src/controllers/XxxController.ts
export class XxxController extends BaseController {
    private service: XxxService;

    async getItem(req: NextRequest, id: string) {
        return this.wrapHandler(async () => {
            const session = await auth();
            if (!session) throw new UnauthorizedError();
            
            const data = await this.service.getItem(id);
            return this.handleSuccess(data);
        }, 'XxxController.getItem');
    }
}
```

### Bước 2.4: Clean Route

```typescript
// src/app/api/xxx/[id]/route.ts
const controller = new XxxController();

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
    return controller.getItem(req, params.id);
}
```

---

## 🛡 Phase 3: Security Hardening

### 3.1 Database Tables

```sql
-- Run in Supabase SQL Editor
CREATE TABLE IF NOT EXISTS security_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type TEXT NOT NULL,
    details JSONB,
    severity TEXT CHECK (severity IN ('INFO', 'WARNING', 'CRITICAL')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_security_logs_created ON security_logs(created_at);
```

### 3.2 Rate Limiting Headers

```typescript
// Include in responses
return NextResponse.json(data, {
    headers: {
        'X-RateLimit-Limit': '100',
        'X-RateLimit-Remaining': remaining.toString(),
        'X-RateLimit-Reset': resetTime.toString(),
    }
});
```

---

## ✅ Definition of Done Checklist

Một feature chỉ được coi là "Done" khi thỏa mãn:

- [ ] **No process.env**: Tất cả config từ `unifiedConfig`
- [ ] **Controller based**: Logic trong Service/Controller, không trong route.ts
- [ ] **Typed**: Không dùng `any`. Input validate bằng Zod
- [ ] **Error Handled**: Lỗi đi qua `handleError()` (log Sentry)
- [ ] **Secure**: Bảng DB có RLS policy
- [ ] **Tested**: Unit test cho Service, Integration test cho Controller

---

## 📋 Module Refactoring Status

| Module | Repository | Service | Controller | Route | Status |
|--------|------------|---------|------------|-------|--------|
| Orders | ✅ | ✅ | ✅ | ✅ | ✅ Done |
| Profile | ✅ | ❌ | ❌ | ❌ | 🔄 Partial |
| Auth | ❌ | ❌ | ❌ | ❌ | ⏳ Pending |
| Admin | ❌ | ❌ | ❌ | ❌ | ⏳ Pending |
| Upload | ❌ | ❌ | ❌ | ❌ | ⏳ Pending |
