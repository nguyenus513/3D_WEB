# Kiến Trúc Hệ Thống - Nền Tảng Thương Mại Điện Tử In 3D (v2)

> **Tài liệu đã cập nhật** theo yêu cầu: Phân biệt flow 3 loại đơn hàng, storage miễn phí, công thức giá mới

---

## 1. Tổng Quan Hệ Thống

### 1.1 Kiến Trúc Tổng Quan

```mermaid
graph TB
    subgraph Client Layer
        A[Next.js Frontend<br/>React Three Fiber]
        B[Admin Dashboard]
    end
    
    subgraph Edge Layer
        D[Cloudflare CDN]
        E[Vercel Edge Functions]
    end
    
    subgraph Gateway Layer
        F[API Gateway<br/>Kong/NGINX]
    end
    
    subgraph Service Layer
        G[User Service]
        H[Product Service]
        I[Order Service]
        J[Payment Service]
        K[Slicing Service]
        L[Logistics Service]
        M[Notification Service]
    end
    
    subgraph Data Layer
        N[PostgreSQL<br/>Supabase]
        O[Redis Cache]
        P[Elasticsearch]
    end
    
    subgraph Message Queue
        Q[RabbitMQ/Kafka]
    end
    
    subgraph External APIs
        R[PayOS]
        S[Viettel Post]
        T[Google Drive 2TB]
        U[SendGrid/SMTP]
    end
    
    A --> D --> E --> F
    B --> D
    F --> G & H & I & J & K & L & M
    G & H & I --> N & O
    H --> P
    J --> R
    K --> Q
    L --> S
    M --> Q & U
    I --> Q
    G & I & K --> T
```

### 1.2 Công Nghệ Sử Dụng

| Tầng | Công Nghệ | Lý Do Chọn |
|------|-----------|------------|
| **Frontend** | Next.js 14+, React Three Fiber, Zustand | SSR/SSG, 3D rendering |
| **Styling** | Tailwind CSS, Framer Motion | Responsive, animations |
| **Database** | PostgreSQL (Supabase) | ACID, RLS policies |
| **Cache** | Redis | Fast R/W, distributed lock |
| **Search** | Elasticsearch | Full-text search |
| **Storage** | **Google Drive 2TB** | **Có sẵn, API miễn phí, dung lượng lớn** |
| **Payment** | PayOS | Thanh toán nội địa VN |
| **Logistics** | Viettel Post API | Tracking, tạo vận đơn |
| **Queue** | RabbitMQ | Async processing |

---

## 2. Giải Pháp Storage - Google Drive 2TB

> [!IMPORTANT]
> Sử dụng **Google Drive 2TB có sẵn** với **Service Account API** - miễn phí, dung lượng lớn, giữ file vĩnh viễn

### 2.1 Tại Sao Chọn Google Drive 2TB?

| Tiêu chí | Google Drive 2TB |
|----------|------------------|
| **Dung lượng** | 2TB = ~100,000 đơn hàng (10+ năm) |
| **Chi phí API** | **Miễn phí hoàn toàn** |
| **Rate limit** | 12,000 queries/phút (rất nhiều) |
| **Upload limit** | 750 GB/ngày |
| **File size max** | 5 TB/file |
| **Xem file thủ công** | ✅ Có thể xem trực tiếp trên Drive |
| **Lưu trữ lâu dài** | ✅ Giữ vĩnh viễn để in/thiết kế |

### 2.2 Cách Setup Google Drive API

```yaml
Bước 1: Tạo Google Cloud Project (miễn phí)
  URL: console.cloud.google.com
  Action: Create new project → "3D-Print-Storage"

Bước 2: Enable Google Drive API
  Path: APIs & Services → Enable APIs
  Search: "Google Drive API" → Enable

Bước 3: Tạo Service Account
  Path: IAM & Admin → Service Accounts
  Action: Create Service Account
  Download: JSON key file (service-account.json)

Bước 4: Share folder trên Drive 2TB
  Action: Tạo folder "3D_Print_Business" trên Google Drive
  Share: Với email của Service Account (xxx@project.iam.gserviceaccount.com)
  Permission: Editor
```

### 2.3 Cấu Trúc Folder Trên Google Drive

```
📁 Google Drive (2TB)
└── 📁 3D_Print_Business/          ← Share folder này với Service Account
    ├── 📁 custom_orders/          ← Ảnh khách hàng (giữ vĩnh viễn)
    │   └── 📁 2026/
    │       └── 📁 01/
    │           └── 📁 order_123/
    │               ├── photo1.jpg
    │               └── photo2.jpg
    │
    ├── 📁 printing_orders/        ← File STL (giữ vĩnh viễn)
    │   └── 📁 2026/
    │       └── 📁 01/
    │           └── 📁 order_456/
    │               └── model.stl
    │
    └── 📁 demo_photos/            ← Ảnh demo sản phẩm
        └── 📁 2026/
            └── 📁 01/
                └── 📁 order_123/
                    └── demo_final.jpg
```

### 2.4 Code Implementation

```typescript
// Google Drive Service
import { google } from 'googleapis';
import { Readable } from 'stream';

const FOLDER_IDS = {
  custom: 'YOUR_CUSTOM_FOLDER_ID',
  printing: 'YOUR_PRINTING_FOLDER_ID',
  demo: 'YOUR_DEMO_FOLDER_ID',
};

class GoogleDriveStorage {
  private drive;
  
  constructor() {
    const auth = new google.auth.GoogleAuth({
      keyFile: 'service-account.json',
      scopes: ['https://www.googleapis.com/auth/drive.file'],
    });
    this.drive = google.drive({ version: 'v3', auth });
  }
  
  // Upload file cho Custom Order (ảnh khách hàng)
  async uploadCustomPhoto(orderId: string, file: Buffer, fileName: string) {
    const folderId = await this.getOrCreateFolder(
      FOLDER_IDS.custom, 
      `order_${orderId}`
    );
    
    return this.uploadFile(folderId, file, fileName);
  }
  
  // Upload file STL cho Printing Order
  async uploadSTL(orderId: string, file: Buffer, fileName: string) {
    const folderId = await this.getOrCreateFolder(
      FOLDER_IDS.printing,
      `order_${orderId}`
    );
    
    return this.uploadFile(folderId, file, fileName);
  }
  
  // Upload ảnh demo sản phẩm
  async uploadDemoPhoto(orderId: string, file: Buffer, fileName: string) {
    const folderId = await this.getOrCreateFolder(
      FOLDER_IDS.demo,
      `order_${orderId}`
    );
    
    return this.uploadFile(folderId, file, fileName);
  }
  
  private async uploadFile(folderId: string, file: Buffer, fileName: string) {
    const response = await this.drive.files.create({
      requestBody: {
        name: fileName,
        parents: [folderId],
      },
      media: {
        body: Readable.from(file),
      },
    });
    
    // Trả về info để lưu vào DB
    return {
      fileId: response.data.id,
      fileName: fileName,
      webViewLink: `https://drive.google.com/file/d/${response.data.id}/view`,
    };
  }
  
  // Lấy link download
  async getDownloadLink(fileId: string) {
    const response = await this.drive.files.get({
      fileId: fileId,
      fields: 'webContentLink',
    });
    return response.data.webContentLink;
  }
}

export const driveStorage = new GoogleDriveStorage();
```

### 2.5 Lưu Trữ Trong Database

```json
// order_items.configuration - Custom Order
{
  "type": "couple",
  "photos": [
    {
      "drive_file_id": "1abc123...",
      "file_name": "photo1.jpg",
      "web_view_link": "https://drive.google.com/file/d/1abc123.../view"
    }
  ],
  "demo_photo": {
    "drive_file_id": "1xyz789...",
    "file_name": "demo_final.jpg"
  }
}

// order_items.configuration - Printing Order  
{
  "stl_file": {
    "drive_file_id": "1def456...",
    "file_name": "model.stl",
    "web_view_link": "https://drive.google.com/file/d/1def456.../view"
  },
  "print_type": "FDM",
  "material": "PLA_RED",
  "calculated_price": 84000
}
```

---

## 3. UI/UX Design System (Apple x Lusion Pro)

> [!IMPORTANT]
> Design System kết hợp **Apple.com** (Clean, Minimal) + **Lusion.co** (Advanced WebGL Effects)
> Tham khảo: Luu Hoa (Creative Coder VN), Akella, Codrops Infinite Gallery

### 3.1 Design Style - Apple x Lusion Pro Blend

| Thuộc tính | Giá trị | Mô tả |
|------------|---------|-------|
| **Primary Style** | **Apple x Lusion Pro** | Clean Apple aesthetic + Lusion WebGL effects |
| **Landing Pattern** | **Infinite 3D Gallery** | Products floating in 3D space |
| **Hero Style** | **Jelly Distortion Canvas** | Full-screen với distortion shader |
| **Cursor** | **Custom Magnetic Cursor** | Dot with magnetic + text labels |
| **Scrolling** | **Smooth Inertial (Lenis)** | Scroll mượt + trigger distortion |
| **Distortion** | **Jelly Effect Shader** | Vertex shader cong khi drag/scroll |
| **Color Effect** | **RGB Shift** | Fragment shader tách màu khi move |
| **Navigation** | **Lusion Dropdown Menu** | Cards + Newsletter + External links |
| **Gallery** | **Infinite Cylinder Scroll** | 3D planes xoay vô hạn |
| **Dark Mode** | ✅ Default | Nền xanh dương đậm hoặc đen |

### 3.1.1 Libraries & Stack (Advanced)

| Thư viện | Mục đích |
|----------|----------|
| **React Three Fiber** | 3D WebGL Canvas |
| **@react-three/drei** | 3D helpers (Image, Text, useTexture) |
| **@react-three/postprocessing** | RGB Shift, Chromatic Aberration |
| **GSAP + ScrollTrigger** | Scroll-triggered animations |
| **Lenis** | Smooth scroll với velocity tracking |
| **Framer Motion** | Page transitions, menu animations |
| **Custom GLSL Shaders** | Jelly Distortion, RGB Shift |

### 3.1.2 Jelly Distortion Shader (Core Effect)

```glsl
// Vertex Shader - Jelly Distortion Effect
// Tạo hiệu ứng cong khi di chuyển nhanh (như Lusion.co)

uniform float uTime;
uniform float uSpeed;      // Scroll/drag velocity
uniform float uStrength;   // Distortion strength (0.0 - 1.0)

varying vec2 vUv;

void main() {
    vUv = uv;
    vec3 pos = position;
    
    // Distortion based on speed
    float distortion = sin(pos.y * 3.14159) * uSpeed * uStrength;
    pos.x += distortion * 0.3;
    pos.z += distortion * 0.1;
    
    // Wave effect
    pos.x += sin(pos.y * 5.0 + uTime) * uSpeed * 0.02;
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
```

### 3.1.3 RGB Shift Shader (Fragment)

```glsl
// Fragment Shader - RGB Shift / Chromatic Aberration
// Hiệu ứng tách màu khi di chuyển

uniform sampler2D uTexture;
uniform float uOffset;     // 0.0 - 0.02 based on velocity
varying vec2 vUv;

void main() {
    float r = texture2D(uTexture, vUv + vec2(uOffset, 0.0)).r;
    float g = texture2D(uTexture, vUv).g;
    float b = texture2D(uTexture, vUv - vec2(uOffset, 0.0)).b;
    
    gl_FragColor = vec4(r, g, b, 1.0);
}
```

### 3.1.4 Navigation - Lusion Style Dropdown

```
┌─────────────────────────────────────────────────────────────────────────┐
│  HEADER (Fixed, transparent)                                            │
│                                                                         │
│  [Logo Icon]  [LET'S TALK •]  [CLOSE :]                                │
│                     ↓ Opens Dropdown                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────┐                               │
│  │  DROPDOWN MENU (White card)         │                               │
│  │                                     │                               │
│  │  HOME                         •     │  ← Active indicator           │
│  │  ABOUT US                           │                               │
│  │  PROJECTS                           │                               │
│  │  CONTACT                            │                               │
│  │                                     │                               │
│  └─────────────────────────────────────┘                               │
│                                                                         │
│  ┌─────────────────────────────────────┐                               │
│  │  Subscribe to our newsletter        │                               │
│  │                                     │                               │
│  │  [ Your email             →]        │                               │
│  │                                     │                               │
│  └─────────────────────────────────────┘                               │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────┐         │
│  │ [Icon] LABS                                         ↗    │         │
│  └───────────────────────────────────────────────────────────┘         │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.1.5 Infinite 3D Cylinder Gallery

Tham khảo: Codrops "Infinite Circular Gallery"

```tsx
// Infinite Scroll Gallery với Three.js
// - Các image là Plane Mesh trong không gian 3D
// - Xoay vòng (Cylinder) hoặc trôi thẳng
// - Velocity-based distortion

interface GalleryConfig {
  items: GalleryItem[];
  layout: 'cylinder' | 'linear' | 'grid';
  distortion: boolean;       // Enable jelly effect
  rgbShift: boolean;         // Enable color separation
  infiniteScroll: boolean;   // Clone items for infinite
  physics: {
    friction: 0.9;           // Smooth stop
    velocity: number;        // Current speed
    maxVelocity: 10;
  };
}
```

### 3.1.6 Scroll Animation Patterns (Enhanced)

| Pattern | Trigger | Mô tả |
|---------|---------|-------|
| **Jelly Distortion** | Scroll velocity | Plane meshes cong theo hướng scroll |
| **RGB Shift** | Move velocity | Chromatic aberration khi di chuyển |
| **Scale Up** | Scroll into view | Text/Image scale từ 0.8 → 1 |
| **Fade In Up** | Scroll into view | Opacity 0→1, translateY 40px→0 |
| **Parallax Depth** | Scroll position | Different Z depths in 3D |
| **Text Reveal** | Scroll position | Clip-path hoặc mask reveal |
| **Section Pin** | Scroll through | Pin section, animate content |
| **3D Rotate** | Mouse position | Objects rotate toward cursor |
| **Infinite Loop** | Continuous scroll | Clone items, seamless loop |

### 3.2 Color Palette - Apple Style

```css
:root {
  /* === DARK MODE (Default - Giống Apple.com) === */
  
  /* Background */
  --bg-primary: #000000;       /* Pure black */
  --bg-secondary: #1D1D1F;     /* Apple gray dark */
  --bg-tertiary: #2D2D2F;      /* Card background */
  --bg-card: #F5F5F7;          /* Light card (contrast) */
  
  /* Text */
  --text-primary: #F5F5F7;     /* Almost white */
  --text-secondary: #86868B;   /* Apple gray text */
  --text-headline: #FFFFFF;    /* Pure white for headlines */
  
  /* Accent - Blue (Apple signature) */
  --color-accent: #0071E3;     /* Apple Blue */
  --color-accent-hover: #0077ED;
  
  /* CTA */
  --color-cta: #0071E3;        /* Blue CTA */
  --color-cta-secondary: #FFFFFF; /* White outline CTA */
  
  /* Borders */
  --border-color: rgba(255, 255, 255, 0.08);
  --border-light: #424245;
  
  /* Gradients */
  --gradient-hero: linear-gradient(180deg, #000 0%, #1D1D1F 100%);
  --gradient-card: linear-gradient(135deg, #2D2D2F 0%, #1D1D1F 100%);
  
  /* Status */
  --color-success: #30D158;    /* Apple green */
  --color-error: #FF453A;      /* Apple red */
  --color-warning: #FFD60A;    /* Apple yellow */
  
  /* === LIGHT MODE (Optional sections) === */
  --bg-light: #FFFFFF;
  --bg-light-secondary: #F5F5F7;
  --text-dark: #1D1D1F;
  --text-dark-secondary: #6E6E73;
}
```

### 3.3 Typography - Apple Style (SF Pro / Inter)

```css
/* Google Fonts Import - Inter (closest to SF Pro) */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');

/* Tailwind Config */
fontFamily: {
  sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif']
}

/* Apple-like letter-spacing */
.headline {
  letter-spacing: -0.02em;  /* Tight for headlines */
}
.body {
  letter-spacing: -0.01em;  /* Slightly tight for body */
}
```

| Sử dụng | Font | Weight | Size | Letter-spacing |
|---------|------|--------|------|----------------|
| **Hero Headline** | Inter | 700-800 | 56-96px | -0.03em |
| **Section Headline** | Inter | 600-700 | 40-56px | -0.02em |
| **Product Title** | Inter | 600 | 28-40px | -0.02em |
| **Card Title** | Inter | 600 | 21-24px | -0.01em |
| **Body** | Inter | 400 | 17-19px | -0.01em |
| **Caption** | Inter | 400 | 12-14px | 0 |
| **Button** | Inter | 500 | 14-17px | 0 |
| **Nav Link** | Inter | 400 | 12-14px | 0 |

### 3.4 Layout - Apple Full-Screen Product Hero

```
┌─────────────────────────────────────────────────────────────────────────┐
│  NAVBAR (Compact, backdrop-blur)                                        │
│  Logo      Sản phẩm  Custom  In 3D  FAQ  About       🛒  👤            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│                    HERO - FULL SCREEN (100vh)                           │
│                                                                         │
│              ╭─────────────────────────────────────╮                    │
│              │                                     │                    │
│              │         3D MODEL SHOWCASE           │                    │
│              │         (Large, centered)           │                    │
│              │                                     │                    │
│              ╰─────────────────────────────────────╯                    │
│                                                                         │
│                   "Sản Phẩm 3D Độc Đáo"                                │
│                   Chế tác thủ công • Cá nhân hóa                        │
│                                                                         │
│              [ Tìm hiểu thêm ]    [ Mua ngay ]                         │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│                    SECTION 2 - BENTO GRID (Dark bg)                     │
│                                                                         │
│   ┌────────────────────────────┐  ┌────────────────────────────┐       │
│   │                            │  │                            │       │
│   │     📦 SẢN PHẨM CÓ SẴN    │  │      🎨 TÙY BIẾN           │       │
│   │                            │  │                            │       │
│   │     Khám phá bộ sưu tập    │  │     Tạo mô hình của bạn   │       │
│   │     [3D Preview Image]     │  │     [3D Preview Image]     │       │
│   │                            │  │                            │       │
│   │     Tìm hiểu thêm →        │  │     Bắt đầu →             │       │
│   └────────────────────────────┘  └────────────────────────────┘       │
│                                                                         │
│   ┌──────────────────────────────────────────────────────────────────┐ │
│   │                                                                    │ │
│   │                    🖨️ DỊCH VỤ IN 3D                               │ │
│   │                                                                    │ │
│   │    Upload file • Báo giá tự động • FDM & Resin • Giao hàng       │ │
│   │                                                                    │ │
│   │                         [ Báo giá ngay ]                          │ │
│   └──────────────────────────────────────────────────────────────────┘ │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│                    SECTION 3 - FEATURED PRODUCTS (Light bg #F5F5F7)     │
│                                                                         │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
│   │    [3D]     │  │    [3D]     │  │    [3D]     │  │    [3D]     │   │
│   │             │  │             │  │             │  │             │   │
│   │  Sản phẩm A │  │  Sản phẩm B │  │  Sản phẩm C │  │  Sản phẩm D │   │
│   │  250,000đ   │  │  180,000đ   │  │  320,000đ   │  │  150,000đ   │   │
│   └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘   │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                    FOOTER (Minimal)                                     │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.5 Component Styles (Apple-Inspired)

#### Navbar (Compact, Blur)
```css
.navbar {
  position: fixed;
  top: 0;
  width: 100%;
  height: 48px;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: saturate(180%) blur(20px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  z-index: 100;
}

.nav-link {
  font-size: 12px;
  color: #F5F5F7;
  opacity: 0.8;
  transition: opacity 0.3s;
}

.nav-link:hover {
  opacity: 1;
}
```

#### Cards (Apple Bento Style)
```css
.card-bento {
  background: #1D1D1F;
  border-radius: 18px;
  padding: 40px;
  overflow: hidden;
  transition: transform 0.4s ease-out;
}

.card-bento:hover {
  transform: scale(1.02);
  cursor: pointer;
}

/* Light variant */
.card-light {
  background: #F5F5F7;
  color: #1D1D1F;
}
```

#### Buttons (Apple Style)
```css
/* Primary Button - Blue filled */
.btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 12px 22px;
  background: #0071E3;
  color: #FFFFFF;
  font-size: 17px;
  font-weight: 400;
  border-radius: 980px; /* Pill shape */
  transition: background 0.3s;
  cursor: pointer;
}

.btn-primary:hover {
  background: #0077ED;
}

/* Secondary Button - Outline */
.btn-secondary {
  padding: 12px 22px;
  background: transparent;
  color: #0071E3;
  font-size: 17px;
  border: none;
  cursor: pointer;
}

.btn-secondary:hover {
  text-decoration: underline;
}

/* Learn More Link */
.link-more {
  color: #0071E3;
  font-size: 21px;
}

.link-more::after {
  content: " >";
  transition: margin-left 0.3s;
}

.link-more:hover::after {
  margin-left: 4px;
}
```

#### Product Hero Section
```css
.hero-product {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #000000;
  padding-top: 48px; /* navbar height */
}

.hero-title {
  font-size: 56px;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: #FFFFFF;
  text-align: center;
  margin-bottom: 8px;
}

.hero-subtitle {
  font-size: 28px;
  font-weight: 400;
  color: #86868B;
  text-align: center;
  margin-bottom: 24px;
}

.hero-cta-group {
  display: flex;
  gap: 24px;
  margin-top: 16px;
}
```

#### 3D Showcase Area
```css
.showcase-3d {
  position: relative;
  width: 100%;
  max-width: 800px;
  aspect-ratio: 16/10;
  background: radial-gradient(
    ellipse at center,
    rgba(255, 255, 255, 0.03) 0%,
    transparent 70%
  );
}
```

### 3.6 Animation Guidelines (Apple-Style)

| Animation | Duration | Easing | Use For |
|-----------|----------|--------|---------|
| **Hover** | 300ms | ease-out | Cards, buttons |
| **Scale on Hover** | 400ms | cubic-bezier(0.4, 0, 0.2, 1) | Bento cards |
| **Page Elements** | 500-800ms | ease-out | Scroll-triggered fade-in |
| **3D Model** | Continuous | linear | Auto-rotate (slow: 20s) |
| **Link Arrow** | 300ms | ease-out | Arrow slide on hover |

```css
/* Apple-style scroll animations */
.fade-in-up {
  opacity: 0;
  transform: translateY(40px);
  transition: opacity 0.8s ease-out, transform 0.8s ease-out;
}

.fade-in-up.visible {
  opacity: 1;
  transform: translateY(0);
}

/* Respect user preferences */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

### 3.7 Responsive Breakpoints

```css
/* Tailwind default breakpoints */
sm: 640px   /* Mobile landscape */
md: 768px   /* Tablet */
lg: 1024px  /* Desktop */
xl: 1280px  /* Large desktop */
2xl: 1536px /* Ultra wide */

/* Mobile-first approach */
padding: px-4 sm:px-6 lg:px-8
grid: grid-cols-1 md:grid-cols-2 lg:grid-cols-3
```

### 3.8 Pre-Delivery Checklist

- [ ] No emojis as icons (use Heroicons/Lucide)
- [ ] All clickable elements have `cursor-pointer`
- [ ] Hover states provide visual feedback
- [ ] Transitions are 150-300ms
- [ ] Dark/Light mode contrast correct
- [ ] Responsive at 320px, 768px, 1024px, 1440px
- [ ] No horizontal scroll on mobile
- [ ] Images have alt text
- [ ] Form inputs have labels
- [ ] `prefers-reduced-motion` respected

### 3.9 UI Wireframes Chi Tiết (Apple-Style)

> [!NOTE]
> Design lấy cảm hứng từ **Apple.com** - Clean, Minimal, Product-Focused

#### 📄 TRANG CHỦ (Homepage - Apple Style)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   Logo    Sản phẩm   Custom   In 3D   FAQ   About              🛒    👤    │
│   ─────────────────────────────────────────────────────────────────────    │
│                         (Compact navbar, 44px, blur backdrop)               │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                                                                             │
│                                                                             │
│                                                                             │
│                         ╭─────────────────────────╮                         │
│                         │                         │                         │
│                         │                         │                         │
│                         │      3D MODEL           │                         │
│                         │      (Large, Center)    │                         │
│                         │                         │                         │
│                         │                         │                         │
│                         ╰─────────────────────────╯                         │
│                                                                             │
│                                                                             │
│                                                                             │
│                           Sản Phẩm 3D Độc Đáo                               │
│                                                                             │
│                   Chế tác thủ công. Cá nhân hóa hoàn toàn.                 │
│                                                                             │
│                                                                             │
│                   Tìm hiểu thêm >     Mua ngay                             │
│                   (Blue link)        (Blue pill button)                     │
│                                                                             │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                                                                             │
│                                                                             │
│     ┌───────────────────────────────┐   ┌───────────────────────────────┐   │
│     │                               │   │                               │   │
│     │                               │   │                               │   │
│     │        [3D Preview]           │   │        [3D Preview]           │   │
│     │                               │   │                               │   │
│     │                               │   │                               │   │
│     │   Sản Phẩm Có Sẵn            │   │   Tùy Biến Theo Yêu Cầu       │   │
│     │                               │   │                               │   │
│     │   Khám phá bộ sưu tập độc    │   │   Tạo mô hình từ ảnh của      │   │
│     │   đáo với chất lượng cao.    │   │   bạn. Single, Couple, Group. │   │
│     │                               │   │                               │   │
│     │   Tìm hiểu thêm >            │   │   Bắt đầu >                   │   │
│     │                               │   │                               │   │
│     └───────────────────────────────┘   └───────────────────────────────┘   │
│                                                                             │
│     ┌───────────────────────────────────────────────────────────────────┐   │
│     │                                                                   │   │
│     │                                                                   │   │
│     │                        [3D Printer Image]                         │   │
│     │                                                                   │   │
│     │                                                                   │   │
│     │                         Dịch Vụ In 3D                             │   │
│     │                                                                   │   │
│     │       Upload file STL · Báo giá tự động · FDM & Resin            │   │
│     │                                                                   │   │
│     │                         Báo giá ngay >                            │   │
│     │                                                                   │   │
│     └───────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                         (Light section: #F5F5F7)                            │
│                                                                             │
│                                                                             │
│                          Sản Phẩm Nổi Bật                                   │
│                                                                             │
│                                                                             │
│     ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐  │
│     │             │   │             │   │             │   │             │  │
│     │   [3D]      │   │   [3D]      │   │   [3D]      │   │   [3D]      │  │
│     │             │   │             │   │             │   │             │  │
│     │             │   │             │   │             │   │             │  │
│     │  Tên SP     │   │  Tên SP     │   │  Tên SP     │   │  Tên SP     │  │
│     │  250,000đ   │   │  180,000đ   │   │  320,000đ   │   │  150,000đ   │  │
│     │             │   │             │   │             │   │             │  │
│     └─────────────┘   └─────────────┘   └─────────────┘   └─────────────┘  │
│                                                                             │
│                                                                             │
│                          Xem tất cả sản phẩm >                             │
│                                                                             │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│    Sản phẩm       Dịch vụ         Về chúng tôi       Liên hệ               │
│                                                                             │
│    Có sẵn         In 3D FDM       Câu chuyện         0123.456.789          │
│    Custom         In 3D Resin     Quy trình          Zalo                  │
│    Phụ kiện       Báo giá         FAQ                Email                 │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│   Logo                                            VN | EN   Facebook  IG   │
│                                                                             │
│   Copyright © 2026 3D Print Shop. All rights reserved.                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### 📄 TRANG SẢN PHẨM (Products - Apple Style)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│   Logo    Sản phẩm   Custom   In 3D   FAQ   About              🛒    👤    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                                                                             │
│                           Khám Phá Sản Phẩm                                 │
│                                                                             │
│                                                                             │
│    Tất cả    Mô hình    Tượng    Đồ decor    Phụ kiện         [Lọc ▼]     │
│    ────                                                                     │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│    ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐         │
│    │                 │   │                 │   │                 │         │
│    │                 │   │                 │   │                 │         │
│    │     [3D]        │   │     [3D]        │   │     [3D]        │         │
│    │                 │   │                 │   │                 │         │
│    │                 │   │                 │   │                 │         │
│    │  Tên sản phẩm   │   │  Tên sản phẩm   │   │  Tên sản phẩm   │         │
│    │  250,000đ       │   │  180,000đ       │   │  320,000đ       │         │
│    │                 │   │                 │   │                 │         │
│    └─────────────────┘   └─────────────────┘   └─────────────────┘         │
│                                                                             │
│    ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐         │
│    │                 │   │                 │   │                 │         │
│    │                 │   │                 │   │                 │         │
│    │     [3D]        │   │     [3D]        │   │     [3D]        │         │
│    │                 │   │                 │   │                 │         │
│    │                 │   │                 │   │                 │         │
│    │  Tên sản phẩm   │   │  Tên sản phẩm   │   │  Tên sản phẩm   │         │
│    │  150,000đ       │   │  420,000đ       │   │  280,000đ       │         │
│    │                 │   │                 │   │                 │         │
│    └─────────────────┘   └─────────────────┘   └─────────────────┘         │
│                                                                             │
│                                                                             │
│                  Xem thêm (Load more on scroll)                            │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│   FOOTER (same as homepage)                                                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### 📄 CHI TIẾT SẢN PHẨM (Product Detail - Apple Style)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│   Logo    Sản phẩm   Custom   In 3D   FAQ   About              🛒    👤    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                                                                             │
│                                                                             │
│                        ╭─────────────────────────╮                          │
│                        │                         │                          │
│                        │                         │                          │
│                        │         3D MODEL        │                          │
│                        │      (Large View)       │                          │
│                        │     Rotate / Zoom       │                          │
│                        │                         │                          │
│                        │                         │                          │
│                        ╰─────────────────────────╯                          │
│                                                                             │
│                    ○   ○   ●   ○   ○  (thumbnail indicators)               │
│                                                                             │
│                                                                             │
│                          Tên Sản Phẩm                                       │
│                                                                             │
│                           250,000 đ                                         │
│                                                                             │
│                                                                             │
│         Màu sắc:     ⚫  ⚪  🔵  🔴  🟢                                    │
│                       ─                                                     │
│                                                                             │
│                                                                             │
│                      Thêm vào giỏ hàng                                     │
│                      (Blue pill button)                                     │
│                                                                             │
│                            Mua ngay                                         │
│                         (Outline button)                                    │
│                                                                             │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                         (Light section: #F5F5F7)                            │
│                                                                             │
│                                                                             │
│                             Chi Tiết                                        │
│                                                                             │
│                                                                             │
│     Chất liệu              Kích thước              Trọng lượng             │
│     ─────────              ──────────              ───────────             │
│     PLA cao cấp            15cm x 10cm             120g                    │
│                                                                             │
│                                                                             │
│     Mô tả                                                                   │
│     ─────                                                                   │
│     Sản phẩm được chế tác thủ công với độ chi tiết cao.                    │
│     Chất liệu PLA thân thiện với môi trường, bền màu theo thời gian...     │
│                                                                             │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                                                                             │
│                        Sản Phẩm Liên Quan                                   │
│                                                                             │
│                                                                             │
│    ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   │
│    │    [3D]     │   │    [3D]     │   │    [3D]     │   │    [3D]     │   │
│    │  Tên SP     │   │  Tên SP     │   │  Tên SP     │   │  Tên SP     │   │
│    │  180,000đ   │   │  220,000đ   │   │  150,000đ   │   │  280,000đ   │   │
│    └─────────────┘   └─────────────┘   └─────────────┘   └─────────────┘   │
│                                                                             │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│   FOOTER                                                                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### 📄 TRANG CUSTOM (Apple Style - Wizard)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│   Logo    Sản phẩm   Custom   In 3D   FAQ   About              🛒    👤    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                                                                             │
│                       Tạo Mô Hình Của Riêng Bạn                            │
│                                                                             │
│              Chỉ cần upload ảnh, chúng tôi sẽ tạo mô hình 3D              │
│                                                                             │
│                                                                             │
│                   ●────────○────────○────────○────────○                    │
│                 Loại      Ảnh    Style     Size    Tóm tắt                 │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                           Bạn muốn làm cho:                                │
│                                                                             │
│                                                                             │
│     ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────┐  │
│     │                     │  │                     │  │                 │  │
│     │                     │  │                     │  │                 │  │
│     │      Single         │  │      Couple         │  │     Group       │  │
│     │      1 người        │  │      2 người        │  │    3-5 người    │  │
│     │                     │  │                     │  │                 │  │
│     │     150,000đ        │  │     280,000đ        │  │    Liên hệ      │  │
│     │                     │  │                     │  │                 │  │
│     └─────────────────────┘  └─────────────────────┘  └─────────────────┘  │
│                                                                             │
│                                                                             │
│                              Tiếp tục                                      │
│                         (Blue pill button)                                  │
│                                                                             │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│   (STEP 2: Upload - Full screen dropzone, minimal)                          │
│                                                                             │
│                                                                             │
│                           Upload ảnh của bạn                               │
│                                                                             │
│                  Tối đa 5 ảnh · JPG/PNG · Chất lượng cao                  │
│                                                                             │
│                                                                             │
│                     ┌─────────────────────────────┐                        │
│                     │                             │                        │
│                     │                             │                        │
│                     │      Kéo thả ảnh vào đây    │                        │
│                     │           hoặc              │                        │
│                     │        Chọn file            │                        │
│                     │                             │                        │
│                     │                             │                        │
│                     └─────────────────────────────┘                        │
│                                                                             │
│                     ┌────┐  ┌────┐  ┌────┐                                 │
│                     │ ✕ │  │ ✕ │  │ +  │  (uploaded previews)             │
│                     └────┘  └────┘  └────┘                                 │
│                                                                             │
│                                                                             │
│                 ← Quay lại                 Tiếp tục                        │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│   (STEP 3: Style selection - Grid of options)                               │
│                                                                             │
│                           Chọn phong cách                                  │
│                                                                             │
│                                                                             │
│     ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│     │    [3D]     │  │    [3D]     │  │    [3D]     │  │    [3D]     │    │
│     │   Chibi     │  │  Realistic  │  │   Anime     │  │  Cartoon    │    │
│     │  +50,000đ   │  │  +100,000đ  │  │  +80,000đ   │  │  +60,000đ   │    │
│     └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│   (STEP 4: Size selection with visual comparison)                           │
│                                                                             │
│                               Chọn kích thước                              │
│                                                                             │
│         6cm          10cm          15cm          20cm          25cm        │
│          ○            ●             ○             ○             ○          │
│                                                                             │
│                         ┌─────────────────────┐                            │
│                         │                     │                            │
│                         │    [3D MODEL]       │   So sánh với              │
│                         │      10cm           │   lon nước 330ml           │
│                         │                     │   (cao ~12cm)              │
│                         └─────────────────────┘                            │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│   (STEP 5: Summary - Clean order review)                                    │
│                                                                             │
│                           Xác nhận đơn hàng                                │
│                                                                             │
│                                                                             │
│                           Loại: Couple              280,000 đ              │
│                           Style: Chibi              +50,000 đ              │
│                           Size: 10cm                +30,000 đ              │
│                           ─────────────────────────────────────            │
│                           Tổng cộng                 360,000 đ              │
│                                                                             │
│                           Cọc 50%                   180,000 đ              │
│                                                                             │
│                                                                             │
│                          Thêm vào giỏ hàng                                 │
│                                                                             │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│   FOOTER                                                                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### 📄 TRANG IN 3D (Printing - Apple Style)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│   Logo    Sản phẩm   Custom   In 3D   FAQ   About              🛒    👤    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                                                                             │
│                             Dịch Vụ In 3D                                   │
│                                                                             │
│              Upload file · Báo giá tự động · In chuyên nghiệp              │
│                                                                             │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│    ┌───────────────────────────────────────────────────────────────────┐   │
│    │                                                                   │   │
│    │                                                                   │   │
│    │                     Kéo thả file STL/OBJ vào đây                 │   │
│    │                              hoặc                                 │   │
│    │                          Chọn file                               │   │
│    │                                                                   │   │
│    │                      (Max 50MB per file)                         │   │
│    │                                                                   │   │
│    └───────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│   (After upload - Split view)                                               │
│                                                                             │
│    ┌──────────────────────────────┐  ┌──────────────────────────────────┐  │
│    │                              │  │                                  │  │
│    │        ╭────────────╮        │  │   Báo Giá Tự Động                │  │
│    │        │            │        │  │                                  │  │
│    │        │  3D MODEL  │        │  │   ─────────────────────────────  │  │
│    │        │  PREVIEW   │        │  │                                  │  │
│    │        │            │        │  │   Thể tích: 45.2 cm³             │  │
│    │        ╰────────────╯        │  │   Kích thước: 8 x 5 x 12 cm      │  │
│    │                              │  │                                  │  │
│    └──────────────────────────────┘  │   ─────────────────────────────  │  │
│                                      │                                  │  │
│    Loại in                          │   Loại in: FDM                   │  │
│    ─────                            │   Màu: Đỏ                         │  │
│      FDM        Resin               │   Infill: 15%                     │  │
│       ●          ○                  │                                  │  │
│                                      │   ─────────────────────────────  │  │
│    Màu nhựa                         │                                  │  │
│    ─────                            │   Giá                            │  │
│    ⚫  ⚪  🔴  🟢  🔵                │                                  │  │
│         ─                           │       84,000 đ                   │  │
│                                      │                                  │  │
│    Tùy chọn nâng cao ▼              │                                  │  │
│                                      │   Thêm vào giỏ hàng              │  │
│                                      │                                  │  │
│                                      └──────────────────────────────────┘  │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                         (Light section: #F5F5F7)                            │
│                                                                             │
│                            Dịch vụ bao gồm                                 │
│                                                                             │
│      In 3D theo file          QC & Hoàn thiện         Đóng gói cẩn thận   │
│      ───────────────          ─────────────────       ───────────────────  │
│      FDM hoặc Resin           Kiểm tra chất lượng     Bảo vệ khi vận      │
│      chất lượng cao           và làm sạch sản phẩm    chuyển               │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│   FOOTER                                                                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### 📄 ADMIN DASHBOARD (Apple Style)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   Logo Admin                                 Notifications  Profile ▼      │
│   ─────────────────────────────────────────────────────────────────────    │
│                                                                             │
├──────────────────────┬──────────────────────────────────────────────────────┤
│                      │                                                      │
│   Dashboard          │                                                      │
│   ─────────          │             Tổng Quan                                │
│                      │                                                      │
│   Đơn hàng           │                                                      │
│     Chờ xử lý  (5)   │    ┌────────────────┐  ┌────────────────┐           │
│     Đang làm   (3)   │    │                │  │                │           │
│     Hoàn thành       │    │   12.5M đ      │  │     48         │           │
│     Đã giao          │    │                │  │                │           │
│                      │    │   Doanh thu    │  │   Đơn hàng     │           │
│   Sản phẩm           │    │   +15% ↑       │  │   +8% ↑        │           │
│                      │    │                │  │                │           │
│   Khách hàng         │    └────────────────┘  └────────────────┘           │
│                      │                                                      │
│   FAQ                │    ┌────────────────┐  ┌────────────────┐           │
│                      │    │                │  │                │           │
│   Cài đặt            │    │     156        │  │     4.8 ⭐     │           │
│                      │    │                │  │                │           │
│                      │    │   Khách hàng   │  │   Đánh giá TB  │           │
│                      │    │   +12% ↑       │  │   +0.2 ↑       │           │
│                      │    │                │  │                │           │
│                      │    └────────────────┘  └────────────────┘           │
│                      │                                                      │
│                      ├──────────────────────────────────────────────────────┤
│                      │                                                      │
│                      │             Đơn Hàng Mới                             │
│                      │                                                      │
│                      │   ┌──────────────────────────────────────────────┐  │
│                      │   │                                              │  │
│                      │   │  #1234   Custom   Nguyễn Văn A    390,000đ  │  │
│                      │   │                                  5 phút trước│  │
│                      │   │                                              │  │
│                      │   ├──────────────────────────────────────────────┤  │
│                      │   │                                              │  │
│                      │   │  #1233   In 3D    Trần B          84,000đ   │  │
│                      │   │                                 10 phút trước│  │
│                      │   │                                              │  │
│                      │   ├──────────────────────────────────────────────┤  │
│                      │   │                                              │  │
│                      │   │  #1232   Có sẵn   Lê C           250,000đ   │  │
│                      │   │                                 15 phút trước│  │
│                      │   │                                              │  │
│                      │   └──────────────────────────────────────────────┘  │
│                      │                                                      │
│                      │                  Xem tất cả >                       │
│                      │                                                      │
└──────────────────────┴──────────────────────────────────────────────────────┘
```

#### 📄 ADMIN - CHI TIẾT ĐƠN HÀNG (Order Detail - Apple Style)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│   Logo Admin                                 Notifications  Profile ▼      │
├──────────────────────┬──────────────────────────────────────────────────────┤
│                      │                                                      │
│   ← Quay lại         │       Đơn hàng #1234                                │
│                      │                                                      │
│   Dashboard          │       ┌─────────────┐                               │
│   Đơn hàng           │       │  DESIGNING  │   Đang thiết kế               │
│   Sản phẩm           │       └─────────────┘                               │
│   Khách hàng         │                                                      │
│   FAQ                ├──────────────────────────────────────────────────────┤
│   Cài đặt            │                                                      │
│                      │   Thông tin khách hàng                              │
│                      │   ──────────────────────                            │
│                      │                                                      │
│                      │   Nguyễn Văn A                                      │
│                      │   0912.xxx.xxx                                      │
│                      │   email@gmail.com                                   │
│                      │   123 Đường ABC, Quận 1, TP.HCM                     │
│                      │                                                      │
│                      ├──────────────────────────────────────────────────────┤
│                      │                                                      │
│                      │   Chi tiết sản phẩm                                 │
│                      │   ─────────────────                                 │
│                      │                                                      │
│                      │   Loại           Couple                              │
│                      │   Style          Chibi                               │
│                      │   Size           10cm                                │
│                      │   Phụ kiện       Đế gỗ                               │
│                      │   ───────────────────────────────────               │
│                      │   Tổng           390,000 đ                          │
│                      │   Đã cọc         195,000 đ                          │
│                      │   Còn lại        195,000 đ                          │
│                      │                                                      │
│                      ├──────────────────────────────────────────────────────┤
│                      │                                                      │
│                      │   Ảnh khách hàng                                    │
│                      │   ─────────────────                                 │
│                      │                                                      │
│                      │   ┌────────┐  ┌────────┐                            │
│                      │   │  [📷]  │  │  [📷]  │    Xem trên Drive >       │
│                      │   └────────┘  └────────┘                            │
│                      │                                                      │
│                      ├──────────────────────────────────────────────────────┤
│                      │                        (Light section)               │
│                      │                                                      │
│                      │   Cập nhật trạng thái                               │
│                      │   ────────────────────                              │
│                      │                                                      │
│                      │   ┌──────────────────────────────────────────────┐  │
│                      │   │                                              │  │
│                      │   │   Upload ảnh demo                            │  │
│                      │   │                                              │  │
│                      │   │   ┌──────────────────────────────┐           │  │
│                      │   │   │                              │           │  │
│                      │   │   │   Kéo thả ảnh vào đây        │           │  │
│                      │   │   │   hoặc Chọn file             │           │  │
│                      │   │   │                              │           │  │
│                      │   │   └──────────────────────────────┘           │  │
│                      │   │                                              │  │
│                      │   │   ┌────┐  ┌────┐  ┌────┐                     │  │
│                      │   │   │ ✕ │  │ ✕ │  │ ✕ │  (preview)            │  │
│                      │   │   └────┘  └────┘  └────┘                     │  │
│                      │   │                                              │  │
│                      │   │                                              │  │
│                      │   │        Gửi ảnh demo cho khách                │  │
│                      │   │        (Blue pill button)                    │  │
│                      │   │                                              │  │
│                      │   └──────────────────────────────────────────────┘  │
│                      │                                                      │
└──────────────────────┴──────────────────────────────────────────────────────┘
```

#### 📄 ADMIN - DANH SÁCH ĐƠN HÀNG (Orders List - Apple Style)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│   Logo Admin                                 Notifications  Profile ▼      │
├──────────────────────┬──────────────────────────────────────────────────────┤
│                      │                                                      │
│   Dashboard          │             Đơn Hàng                                 │
│   ─────────          │                                                      │
│                      │   Tất cả   Chờ xử lý   Đang làm   Hoàn thành  Đã giao│
│   Đơn hàng           │             ─────────                                │
│   Sản phẩm           │                                                      │
│   Khách hàng         │   [ 🔍 Tìm kiếm... ]               [ Lọc ▼ ]        │
│   FAQ                │                                                      │
│   Cài đặt            ├──────────────────────────────────────────────────────┤
│                      │                                                      │
│                      │   #ID      Loại     Khách          Giá      Status  │
│                      │   ──────────────────────────────────────────────────│
│                      │                                                      │
│                      │   #1234    Custom   Nguyễn Văn A   390,000đ   ●     │
│                      │                                               ─     │
│                      │                                          DESIGNING  │
│                      │                                                      │
│                      │   ──────────────────────────────────────────────────│
│                      │                                                      │
│                      │   #1233    In 3D    Trần B          84,000đ   ●     │
│                      │                                               ─     │
│                      │                                            PAID     │
│                      │                                                      │
│                      │   ──────────────────────────────────────────────────│
│                      │                                                      │
│                      │   #1232    Có sẵn   Lê C           250,000đ   ●     │
│                      │                                               ─     │
│                      │                                          SHIPPED    │
│                      │                                                      │
│                      │   ──────────────────────────────────────────────────│
│                      │                                                      │
│                      │               ← 1  2  3  4  5 →                     │
│                      │                                                      │
└──────────────────────┴──────────────────────────────────────────────────────┘
```

#### 📄 ADMIN - QUẢN LÝ SẢN PHẨM (Products - Apple Style)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│   Logo Admin                                 Notifications  Profile ▼      │
├──────────────────────┬──────────────────────────────────────────────────────┤
│                      │                                                      │
│   Dashboard          │             Sản Phẩm               + Thêm mới       │
│                      │                                                      │
│   Đơn hàng           │   Tất cả   Mô hình   Tượng   Decor   Phụ kiện      │
│   ─────────          │   ─────                                              │
│   Sản phẩm           │                                                      │
│   Khách hàng         │   [ 🔍 Tìm kiếm... ]                                │
│   FAQ                │                                                      │
│   Cài đặt            ├──────────────────────────────────────────────────────┤
│                      │                                                      │
│                      │   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│                      │   │    [3D]     │  │    [3D]     │  │    [3D]     │ │
│                      │   │             │  │             │  │             │ │
│                      │   │  Sản phẩm A │  │  Sản phẩm B │  │  Sản phẩm C │ │
│                      │   │  250,000đ   │  │  180,000đ   │  │  320,000đ   │ │
│                      │   │  Stock: 12  │  │  Stock: 8   │  │  Stock: 5   │ │
│                      │   │             │  │             │  │             │ │
│                      │   │  [Sửa] [Xóa]│  │  [Sửa] [Xóa]│  │  [Sửa] [Xóa]│ │
│                      │   └─────────────┘  └─────────────┘  └─────────────┘ │
│                      │                                                      │
│                      │   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│                      │   │    [3D]     │  │    [3D]     │  │    [3D]     │ │
│                      │   │             │  │             │  │             │ │
│                      │   │  Sản phẩm D │  │  Sản phẩm E │  │  Sản phẩm F │ │
│                      │   │  150,000đ   │  │  280,000đ   │  │  420,000đ   │ │
│                      │   │  Stock: 20  │  │  Stock: 3   │  │  Stock: 15  │ │
│                      │   │             │  │             │  │             │ │
│                      │   │  [Sửa] [Xóa]│  │  [Sửa] [Xóa]│  │  [Sửa] [Xóa]│ │
│                      │   └─────────────┘  └─────────────┘  └─────────────┘ │
│                      │                                                      │
└──────────────────────┴──────────────────────────────────────────────────────┘
```

#### 📄 ADMIN - QUẢN LÝ KHÁCH HÀNG (Customers - Apple Style)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│   Logo Admin                                 Notifications  Profile ▼      │
├──────────────────────┬──────────────────────────────────────────────────────┤
│                      │                                                      │
│   Dashboard          │             Khách Hàng                               │
│                      │                                                      │
│   Đơn hàng           │   [ 🔍 Tìm kiếm theo tên, email, SĐT... ]           │
│   Sản phẩm           │                                                      │
│   ─────────          ├──────────────────────────────────────────────────────┤
│   Khách hàng         │                                                      │
│   FAQ                │   Tên              Email              SĐT      Đơn  │
│   Cài đặt            │   ──────────────────────────────────────────────────│
│                      │                                                      │
│                      │   Nguyễn Văn A     a@gmail.com       0912...   5    │
│                      │                                                      │
│                      │   ──────────────────────────────────────────────────│
│                      │                                                      │
│                      │   Trần Thị B       b@gmail.com       0987...   3    │
│                      │                                                      │
│                      │   ──────────────────────────────────────────────────│
│                      │                                                      │
│                      │   Lê Văn C         c@gmail.com       0903...   8    │
│                      │                                                      │
│                      │   ──────────────────────────────────────────────────│
│                      │                                                      │
│                      │               ← 1  2  3  4  5 →                     │
│                      │                                                      │
└──────────────────────┴──────────────────────────────────────────────────────┘
```

#### 📄 ADMIN - CHI TIẾT KHÁCH HÀNG (Customer Detail - Apple Style)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│   Logo Admin                                 Notifications  Profile ▼      │
├──────────────────────┬──────────────────────────────────────────────────────┤
│                      │                                                      │
│   ← Quay lại         │       Nguyễn Văn A                                  │
│                      │                                                      │
│   Dashboard          │       Khách hàng từ 15/01/2026                      │
│   Đơn hàng           │                                                      │
│   Sản phẩm           ├──────────────────────────────────────────────────────┤
│   Khách hàng         │                                                      │
│   FAQ                │   Thông tin liên hệ                                 │
│   Cài đặt            │   ────────────────────                              │
│                      │                                                      │
│                      │   Email          a@gmail.com                         │
│                      │   Điện thoại     0912.345.678                        │
│                      │   Instagram      @nguyenvana                         │
│                      │   Địa chỉ        123 Đường ABC, Q1, HCM             │
│                      │                                                      │
│                      ├──────────────────────────────────────────────────────┤
│                      │                                                      │
│                      │   Lịch sử đơn hàng (5 đơn)                          │
│                      │   ─────────────────────────                         │
│                      │                                                      │
│                      │   #1234   Custom   390,000đ   ●  DELIVERED          │
│                      │   #1198   Có sẵn   250,000đ   ●  DELIVERED          │
│                      │   #1156   In 3D     84,000đ   ●  DELIVERED          │
│                      │   #1089   Custom   520,000đ   ●  DELIVERED          │
│                      │   #1045   Có sẵn   180,000đ   ●  DELIVERED          │
│                      │                                                      │
│                      │   ───────────────────────────────────               │
│                      │   Tổng chi tiêu       1,424,000 đ                   │
│                      │                                                      │
└──────────────────────┴──────────────────────────────────────────────────────┘
```

#### 📄 ADMIN - QUẢN LÝ FAQ (FAQ - Apple Style)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│   Logo Admin                                 Notifications  Profile ▼      │
├──────────────────────┬──────────────────────────────────────────────────────┤
│                      │                                                      │
│   Dashboard          │             FAQ                      + Thêm mới     │
│                      │                                                      │
│   Đơn hàng           ├──────────────────────────────────────────────────────┤
│   Sản phẩm           │                                                      │
│   Khách hàng         │   ┌──────────────────────────────────────────────┐  │
│   ─────────          │   │                                              │  │
│   FAQ                │   │   Thời gian sản xuất sản phẩm custom?       │  │
│   Cài đặt            │   │   ──────────────────────────────────────    │  │
│                      │   │   Thời gian sản xuất từ 5-7 ngày làm việc   │  │
│                      │   │   sau khi khách hàng xác nhận ảnh demo.     │  │
│                      │   │                                              │  │
│                      │   │                          [Sửa]    [Xóa]     │  │
│                      │   │                                              │  │
│                      │   └──────────────────────────────────────────────┘  │
│                      │                                                      │
│                      │   ┌──────────────────────────────────────────────┐  │
│                      │   │                                              │  │
│                      │   │   Có hỗ trợ ship toàn quốc không?           │  │
│                      │   │   ──────────────────────────────────────    │  │
│                      │   │   Có, chúng tôi ship qua Viettel Post...    │  │
│                      │   │                                              │  │
│                      │   │                          [Sửa]    [Xóa]     │  │
│                      │   │                                              │  │
│                      │   └──────────────────────────────────────────────┘  │
│                      │                                                      │
│                      │   ┌──────────────────────────────────────────────┐  │
│                      │   │                                              │  │
│                      │   │   Chính sách đổi trả như thế nào?           │  │
│                      │   │   ──────────────────────────────────────    │  │
│                      │   │   Đổi trả trong vòng 7 ngày nếu sản phẩm... │  │
│                      │   │                                              │  │
│                      │   │                          [Sửa]    [Xóa]     │  │
│                      │   │                                              │  │
│                      │   └──────────────────────────────────────────────┘  │
│                      │                                                      │
└──────────────────────┴──────────────────────────────────────────────────────┘
```

#### 📄 ADMIN - CÀI ĐẶT (Settings - Apple Style)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│   Logo Admin                                 Notifications  Profile ▼      │
├──────────────────────┬──────────────────────────────────────────────────────┤
│                      │                                                      │
│   Dashboard          │             Cài Đặt                                  │
│                      │                                                      │
│   Đơn hàng           ├──────────────────────────────────────────────────────┤
│   Sản phẩm           │                                                      │
│   Khách hàng         │   Thông tin cửa hàng                                │
│   FAQ                │   ────────────────────                              │
│   ─────────          │                                                      │
│   Cài đặt            │   Tên cửa hàng     [                              ] │
│                      │   Email            [                              ] │
│                      │   Điện thoại       [                              ] │
│                      │   Địa chỉ          [                              ] │
│                      │   Instagram        [                              ] │
│                      │   Facebook         [                              ] │
│                      │                                                      │
│                      │                              Lưu thay đổi           │
│                      │                              (Blue pill button)     │
│                      │                                                      │
│                      ├──────────────────────────────────────────────────────┤
│                      │                                                      │
│                      │   Cài đặt thanh toán                                │
│                      │   ────────────────────                              │
│                      │                                                      │
│                      │   PayOS Client ID  [                              ] │
│                      │   PayOS API Key    [                              ] │
│                      │   % Cọc mặc định   [    50    ] %                   │
│                      │                                                      │
│                      │                              Lưu thay đổi           │
│                      │                                                      │
│                      ├──────────────────────────────────────────────────────┤
│                      │                                                      │
│                      │   Cài đặt giá                                       │
│                      │   ────────────────                                  │
│                      │                                                      │
│                      │   Giá base (6cm)   [  250000  ] đ                   │
│                      │   Hệ số 8cm        [    1.5   ]                     │
│                      │   Hệ số 10cm       [    2.0   ]                     │
│                      │   Hệ số 12cm       [    2.5   ]                     │
│                      │                                                      │
│                      │                              Lưu thay đổi           │
│                      │                                                      │
└──────────────────────┴──────────────────────────────────────────────────────┘
```

---

### 3.10 UI Wireframes - User Pages (Apple Style)

> [!NOTE]
> Các trang phía User: Login, Cart, Checkout, FAQ, About, Profile

#### 📄 ĐĂNG NHẬP / ĐĂNG KÝ (Auth - Apple Style)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   Logo    Sản phẩm   Custom   In 3D   FAQ   About              🛒    👤    │
│   ─────────────────────────────────────────────────────────────────────    │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                                                                             │
│                                                                             │
│                                                                             │
│                              Đăng Nhập                                      │
│                                                                             │
│                                                                             │
│                    ┌─────────────────────────────────┐                     │
│                    │  📧  Email                      │                     │
│                    └─────────────────────────────────┘                     │
│                                                                             │
│                    ┌─────────────────────────────────┐                     │
│                    │  🔒  Mật khẩu                   │                     │
│                    └─────────────────────────────────┘                     │
│                                                                             │
│                              Quên mật khẩu?                                │
│                              (Blue link)                                    │
│                                                                             │
│                    ┌─────────────────────────────────┐                     │
│                    │                                 │                     │
│                    │           Đăng nhập             │                     │
│                    │        (Blue pill button)       │                     │
│                    │                                 │                     │
│                    └─────────────────────────────────┘                     │
│                                                                             │
│                              ─────── hoặc ───────                          │
│                                                                             │
│                    ┌─────────────────────────────────┐                     │
│                    │                                 │                     │
│                    │  [G]  Đăng nhập với Google     │                     │
│                    │        (Outline button)         │                     │
│                    │                                 │                     │
│                    └─────────────────────────────────┘                     │
│                                                                             │
│                                                                             │
│                      Chưa có tài khoản? Đăng ký >                          │
│                                                                             │
│                                                                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### 📄 ĐĂNG KÝ (Register - Apple Style)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│   Logo                                                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                              Tạo Tài Khoản                                  │
│                                                                             │
│                    ┌─────────────────────────────────┐                     │
│                    │  📧  Email                      │                     │
│                    └─────────────────────────────────┘                     │
│                                                                             │
│                    ┌─────────────────────────────────┐                     │
│                    │  🔒  Mật khẩu                   │                     │
│                    └─────────────────────────────────┘                     │
│                                                                             │
│                    ┌─────────────────────────────────┐                     │
│                    │  🔒  Xác nhận mật khẩu          │                     │
│                    └─────────────────────────────────┘                     │
│                                                                             │
│                    ┌─────────────────────────────────┐                     │
│                    │           Đăng ký               │                     │
│                    └─────────────────────────────────┘                     │
│                                                                             │
│                              ─────── hoặc ───────                          │
│                                                                             │
│                    ┌─────────────────────────────────┐                     │
│                    │  [G]  Đăng ký với Google       │                     │
│                    └─────────────────────────────────┘                     │
│                                                                             │
│                      Đã có tài khoản? Đăng nhập >                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### 📄 HOÀN TẤT THÔNG TIN (Complete Profile - Apple Style)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│   Logo                                                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                        Hoàn Tất Thông Tin                                   │
│                                                                             │
│              Vui lòng điền đầy đủ để tiếp tục mua hàng                     │
│                                                                             │
│                                                                             │
│                    ┌─────────────────────────────────┐                     │
│                    │  👤  Họ và tên *                │                     │
│                    └─────────────────────────────────┘                     │
│                                                                             │
│                    ┌─────────────────────────────────┐                     │
│                    │  📱  Số điện thoại *            │                     │
│                    └─────────────────────────────────┘                     │
│                                                                             │
│                    ┌─────────────────────────────────┐                     │
│                    │  📍  Địa chỉ giao hàng *        │                     │
│                    │      (Số nhà, đường, phường)    │                     │
│                    └─────────────────────────────────┘                     │
│                                                                             │
│                    ┌────────────────┐ ┌──────────────┐                     │
│                    │  Tỉnh/Thành ▼  │ │ Quận/Huyện ▼ │                     │
│                    └────────────────┘ └──────────────┘                     │
│                                                                             │
│                    ┌─────────────────────────────────┐                     │
│                    │  📸  Instagram (tùy chọn)       │                     │
│                    └─────────────────────────────────┘                     │
│                                                                             │
│                    ┌─────────────────────────────────┐                     │
│                    │            Hoàn tất             │                     │
│                    └─────────────────────────────────┘                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### 📄 GIỎ HÀNG (Cart - Apple Style)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   Logo    Sản phẩm   Custom   In 3D   FAQ   About              🛒    👤    │
│   ─────────────────────────────────────────────────────────────────────    │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                              Giỏ Hàng                                       │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌────────────────────────────────────────────────────────────────────┐   │
│   │                                                                    │   │
│   │   ┌────────┐                                                       │   │
│   │   │  [3D]  │   Mô hình Custom - Couple                            │   │
│   │   │        │   Style: Chibi · Size: 10cm                          │   │
│   │   └────────┘   Phụ kiện: Đế gỗ (+30,000đ)                         │   │
│   │                                                                    │   │
│   │                                              390,000đ       [✕]   │   │
│   │                                                                    │   │
│   └────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│   ┌────────────────────────────────────────────────────────────────────┐   │
│   │                                                                    │   │
│   │   ┌────────┐                                                       │   │
│   │   │  [3D]  │   Sản phẩm có sẵn - Tượng Naruto                     │   │
│   │   │        │   Size: 15cm                                          │   │
│   │   └────────┘   Số lượng: 1                                         │   │
│   │                                                                    │   │
│   │                                              250,000đ       [✕]   │   │
│   │                                                                    │   │
│   └────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                           (Light section)                   │
│                                                                             │
│                    Tổng cộng                                640,000 đ      │
│                    ───────────────────────────────────────────────────     │
│                    Cọc (50%)                                320,000 đ      │
│                    Còn lại (thanh toán khi nhận hàng)       320,000 đ      │
│                                                                             │
│                                                                             │
│                    ┌─────────────────────────────────┐                     │
│                    │                                 │                     │
│                    │          Thanh toán             │                     │
│                    │        (Blue pill button)       │                     │
│                    │                                 │                     │
│                    └─────────────────────────────────┘                     │
│                                                                             │
│                           Tiếp tục mua sắm >                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### 📄 THANH TOÁN (Checkout - Apple Style)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│   Logo                                          Giỏ hàng (2)               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                              Thanh Toán                                     │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Thông tin giao hàng                                                      │
│   ────────────────────                                                     │
│                                                                             │
│   Nguyễn Văn A                                              [Sửa]         │
│   0912.345.678                                                             │
│   123 Đường ABC, Quận 1, TP.HCM                                            │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Đơn hàng của bạn                                                         │
│   ──────────────────                                                       │
│                                                                             │
│   Mô hình Custom - Couple                                    390,000đ     │
│   Tượng Naruto                                               250,000đ     │
│   ───────────────────────────────────────────────────────────────────     │
│   Tạm tính                                                   640,000đ     │
│   Phí vận chuyển                                              30,000đ     │
│   ───────────────────────────────────────────────────────────────────     │
│   Tổng cộng                                                  670,000đ     │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                            (Light section)                  │
│                                                                             │
│   Phương thức thanh toán                                                   │
│   ─────────────────────                                                    │
│                                                                             │
│   ┌───────────────────────────────────────────────────────────────────┐   │
│   │  ◉  Chuyển khoản ngân hàng (QR PayOS)                             │   │
│   └───────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│   ┌───────────────────────────────────────────────────────────────────┐   │
│   │  ○  Ví điện tử (MoMo, ZaloPay)                                    │   │
│   └───────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│                                                                             │
│              ⚠️  Bạn sẽ thanh toán 335,000đ (50% cọc)                      │
│                  Phần còn lại thanh toán khi nhận hàng.                    │
│                                                                             │
│                                                                             │
│                    ┌─────────────────────────────────┐                     │
│                    │                                 │                     │
│                    │    Thanh toán 335,000đ         │                     │
│                    │        (Blue pill button)       │                     │
│                    │                                 │                     │
│                    └─────────────────────────────────┘                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### 📄 THANH TOÁN THÀNH CÔNG (Payment Success - Apple Style)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│   Logo                                                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                                                                             │
│                                                                             │
│                                                                             │
│                              ✓                                              │
│                           (Green)                                           │
│                                                                             │
│                        Thanh Toán Thành Công!                               │
│                                                                             │
│              Cảm ơn bạn đã đặt hàng tại 3D Print Shop.                     │
│              Chúng tôi đã gửi email xác nhận đơn hàng.                     │
│                                                                             │
│                                                                             │
│              ┌─────────────────────────────────────────────┐               │
│              │                                             │               │
│              │  Mã đơn hàng:           #ORD-2026-001234   │               │
│              │  Số tiền đã thanh toán: 335,000đ           │               │
│              │  Còn lại:               335,000đ           │               │
│              │  Thời gian dự kiến:     5-7 ngày           │               │
│              │                                             │               │
│              └─────────────────────────────────────────────┘               │
│                                                                             │
│                                                                             │
│                    ┌─────────────────────────────────┐                     │
│                    │       Xem đơn hàng của tôi      │                     │
│                    └─────────────────────────────────┘                     │
│                                                                             │
│                         Tiếp tục mua sắm >                                 │
│                                                                             │
│                                                                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### 📄 TÀI KHOẢN CỦA TÔI (Profile - Apple Style)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   Logo    Sản phẩm   Custom   In 3D   FAQ   About              🛒    👤    │
│   ─────────────────────────────────────────────────────────────────────    │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                              Tài Khoản                                      │
│                                                                             │
│   Thông tin cá nhân   Đơn hàng của tôi                                     │
│   ─────────────────                                                         │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Thông tin cá nhân                                           [Sửa]       │
│   ────────────────────                                                     │
│                                                                             │
│   Họ tên          Nguyễn Văn A                                             │
│   Email           a@gmail.com                                              │
│   Điện thoại      0912.345.678                                             │
│   Instagram       @nguyenvana                                              │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Địa chỉ giao hàng                                          [Sửa]        │
│   ─────────────────                                                        │
│                                                                             │
│   123 Đường ABC, Phường XYZ                                                │
│   Quận 1, TP.Hồ Chí Minh                                                   │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                            (Light section)                  │
│                                                                             │
│   ┌─────────────────────────────────┐                                      │
│   │          Đổi mật khẩu           │                                      │
│   │        (Outline button)         │                                      │
│   └─────────────────────────────────┘                                      │
│                                                                             │
│   ┌─────────────────────────────────┐                                      │
│   │          Đăng xuất              │                                      │
│   │          (Red text)             │                                      │
│   └─────────────────────────────────┘                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### 📄 ĐƠN HÀNG CỦA TÔI (My Orders - Apple Style)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   Logo    Sản phẩm   Custom   In 3D   FAQ   About              🛒    👤    │
│   ─────────────────────────────────────────────────────────────────────    │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                              Tài Khoản                                      │
│                                                                             │
│   Thông tin cá nhân   Đơn hàng của tôi                                     │
│                       ─────────────────                                     │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌────────────────────────────────────────────────────────────────────┐   │
│   │                                                                    │   │
│   │   #ORD-2026-001234                                    ●  SHIPPED  │   │
│   │   15/01/2026                                                       │   │
│   │                                                                    │   │
│   │   Mô hình Custom - Couple                              390,000đ   │   │
│   │   Tượng Naruto                                         250,000đ   │   │
│   │   ─────────────────────────────────────────────────────────────   │   │
│   │   Tổng: 670,000đ (Đã cọc: 335,000đ)                               │   │
│   │                                                                    │   │
│   │   Mã vận đơn: VTP123456789              Theo dõi đơn hàng >       │   │
│   │                                                                    │   │
│   └────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│   ┌────────────────────────────────────────────────────────────────────┐   │
│   │                                                                    │   │
│   │   #ORD-2026-001198                                   ● DELIVERED  │   │
│   │   10/01/2026                                                       │   │
│   │                                                                    │   │
│   │   Sản phẩm có sẵn - Dragon Ball Set                    520,000đ   │   │
│   │   ─────────────────────────────────────────────────────────────   │   │
│   │   Tổng: 550,000đ (Đã thanh toán)                                  │   │
│   │                                                                    │   │
│   │                                                  Đánh giá sản phẩm │   │
│   │                                                                    │   │
│   └────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### 📄 CHI TIẾT ĐƠN HÀNG - USER (Order Detail - Apple Style)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│   Logo                                          ← Quay lại đơn hàng        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                       Đơn Hàng #ORD-2026-001234                             │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Trạng thái đơn hàng                                                      │
│   ────────────────────                                                     │
│                                                                             │
│   ●──────────●──────────●──────────○──────────○                           │
│   Đặt hàng   Đã cọc    Đang sản    Đang ship   Hoàn thành                 │
│   15/01      15/01     xuất                                                │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Sản phẩm                                                                 │
│   ────────                                                                 │
│                                                                             │
│   ┌────────┐                                                               │
│   │  [3D]  │   Mô hình Custom - Couple                        390,000đ    │
│   │        │   Style: Chibi · Size: 10cm · Đế gỗ                          │
│   └────────┘                                                               │
│                                                                             │
│   ┌────────┐                                                               │
│   │  [3D]  │   Tượng Naruto                                   250,000đ    │
│   │        │   Size: 15cm                                                  │
│   └────────┘                                                               │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Thanh toán                                                               │
│   ──────────                                                               │
│                                                                             │
│   Tạm tính                                                    640,000đ    │
│   Phí ship                                                     30,000đ    │
│   ─────────────────────────────────────────────────────────────────────   │
│   Tổng cộng                                                   670,000đ    │
│   Đã cọc (50%)                                               -335,000đ    │
│   ─────────────────────────────────────────────────────────────────────   │
│   Còn lại (COD)                                               335,000đ    │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Theo dõi vận chuyển                                                      │
│   ───────────────────                                                      │
│                                                                             │
│   Mã vận đơn: VTP123456789                                                 │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐ │
│   │  ● 16/01 10:30  Đang vận chuyển - TP.HCM → Hà Nội                  │ │
│   │  ● 15/01 18:00  Đã bàn giao cho đơn vị vận chuyển                  │ │
│   │  ● 15/01 12:00  Đã xác nhận thanh toán                             │ │
│   │  ● 15/01 11:30  Đặt hàng thành công                                │ │
│   └─────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│                    ┌─────────────────────────────────┐                     │
│                    │     Tracking Viettel Post >     │                     │
│                    │        (Outline button)         │                     │
│                    └─────────────────────────────────┘                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### 📄 FAQ (FAQ Page - Apple Style)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   Logo    Sản phẩm   Custom   In 3D   FAQ   About              🛒    👤    │
│   ─────────────────────────────────────────────────────────────────────    │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                                                                             │
│                        Câu Hỏi Thường Gặp                                   │
│                                                                             │
│              Tìm câu trả lời cho những câu hỏi phổ biến                    │
│                                                                             │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │                                                                     │  │
│   │   Thời gian sản xuất sản phẩm custom?                          ▼   │  │
│   │                                                                     │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │                                                                     │  │
│   │   Có hỗ trợ ship toàn quốc không?                              ▲   │  │
│   │   ─────────────────────────────────────────────────────────────    │  │
│   │                                                                     │  │
│   │   Có, chúng tôi giao hàng toàn quốc qua Viettel Post.             │  │
│   │   Thời gian giao hàng từ 2-5 ngày tùy khu vực.                    │  │
│   │   - Nội thành HCM: 1-2 ngày                                        │  │
│   │   - Các tỉnh thành khác: 3-5 ngày                                  │  │
│   │                                                                     │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │                                                                     │  │
│   │   Chính sách đổi trả như thế nào?                              ▼   │  │
│   │                                                                     │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │                                                                     │  │
│   │   Có thể chỉnh sửa sau khi đặt hàng không?                     ▼   │  │
│   │                                                                     │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │                                                                     │  │
│   │   Phí vận chuyển tính như thế nào?                             ▼   │  │
│   │                                                                     │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                            (Light section)                  │
│                                                                             │
│                    Không tìm thấy câu trả lời?                             │
│                                                                             │
│                    ┌─────────────────────────────────┐                     │
│                    │        Liên hệ hỗ trợ           │                     │
│                    └─────────────────────────────────┘                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### 📄 ABOUT / LIÊN HỆ (About Page - Apple Style)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   Logo    Sản phẩm   Custom   In 3D   FAQ   About              🛒    👤    │
│   ─────────────────────────────────────────────────────────────────────    │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                                                                             │
│                           Về Chúng Tôi                                      │
│                                                                             │
│        Chuyên tạo mô hình 3D độc đáo, cá nhân hóa theo yêu cầu.           │
│                                                                             │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌────────────────────────┐   ┌────────────────────────┐                  │
│   │                        │   │                        │                  │
│   │      [Workshop         │   │        [3D Printer     │                  │
│   │       Image]           │   │         Image]         │                  │
│   │                        │   │                        │                  │
│   │                        │   │                        │                  │
│   │   Chế tác thủ công     │   │   Công nghệ in tiên    │                  │
│   │   Mỗi sản phẩm đều     │   │   tiến với máy in      │                  │
│   │   được làm tỉ mỉ.      │   │   FDM và Resin.        │                  │
│   │                        │   │                        │                  │
│   └────────────────────────┘   └────────────────────────┘                  │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                            (Light section)                  │
│                                                                             │
│                              Liên Hệ                                        │
│                                                                             │
│   ┌────────────────────┐  ┌────────────────────┐  ┌────────────────────┐   │
│   │                    │  │                    │  │                    │   │
│   │   📍 Địa chỉ       │  │   📞 Hotline       │  │   📧 Email         │   │
│   │                    │  │                    │  │                    │   │
│   │   123 Đường ABC    │  │   0912.345.678     │  │   hello@3dprint.vn │   │
│   │   Quận 1, HCM      │  │   (8:00 - 22:00)   │  │                    │   │
│   │                    │  │                    │  │                    │   │
│   └────────────────────┘  └────────────────────┘  └────────────────────┘   │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │                                                                     │  │
│   │   Instagram: @3dprint.vn    Facebook: 3D Print Vietnam             │  │
│   │                                                                     │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Phân Biệt Flow 3 Loại Sản Phẩm

> [!IMPORTANT]
> Chỉ **Custom Products** cần quy trình Review ảnh + Xác nhận khách hàng

### 4.1 Bảng So Sánh 3 Loại Đơn Hàng

| Thuộc Tính | Có Sẵn (Ready-made) | Custom | In 3D (Printing) |
|------------|---------------------|--------|------------------|
| **Cần Upload Ảnh** | ❌ Không | ✅ Có | ✅ Có (STL file) |
| **Cần Review Photo** | ❌ Không | ✅ Có | ❌ Không |
| **Cần Xác Nhận Khách** | ❌ Không | ✅ Có | ❌ Không |
| **Admin Flow** | Đơn giản | Phức tạp | Đơn giản |
| **Thanh Toán** | 50% cọc | 50% cọc | 100% |

### 4.2 Flow Đơn Hàng Có Sẵn (Ready-made)

```mermaid
flowchart TD
    A[Đơn hàng mới<br/>Type: ready_made] --> B{Thanh toán 50%?}
    B -- Thành công --> C[Status: PAID]
    B -- Chờ --> A
    
    C --> D[Admin: Chuẩn bị hàng từ kho]
    D --> E[Status: PREPARING]
    E --> F[Admin: Đóng gói xong]
    F --> G[Admin: Tạo vận đơn Viettel Post]
    G --> H[Status: SHIPPED]
    H --> I[Email tracking cho khách]
    I --> J[Webhook VTP: Đã giao]
    J --> K[Status: DELIVERED]
    K --> L[Email hoàn tất + Yêu cầu đánh giá]
    L --> M([Hoàn thành])
    
    style A fill:#e1f5fe
    style M fill:#c8e6c9
```

### 4.3 Flow Đơn Hàng Custom (CHI TIẾT - NHIỀU TRƯỜNG HỢP)

> [!IMPORTANT]
> - **KHÔNG CẦN preview** từ khách trong quá trình thiết kế
> - **CHỈ CẦN xác nhận** khi gửi **ẢNH DEMO** sản phẩm hoàn thành
> - Nếu **KHÔNG ĐỒNG Ý** → Chuyển ngay đến liên hệ trực tiếp (Điện thoại / Zalo)

#### 4.3.1 Flow Chính - Custom Order

```mermaid
flowchart TD
    A[Đơn hàng mới<br/>Type: custom] --> B{Thanh toán 50% cọc?}
    B -- Chưa thanh toán --> B1[Gửi nhắc nhở]
    B1 --> B2{Quá 24h?}
    B2 -- Có --> B3[Status: EXPIRED<br/>Hủy đơn tự động]
    B2 -- Chưa --> B
    B -- Thanh toán thành công --> C[Status: PAID]
    
    C --> D[📧 Email xác nhận đã nhận cọc]
    D --> E[Admin: Xem ảnh từ R2 Storage]
    E --> F[Admin: Bắt đầu thiết kế + Sản xuất]
    F --> G[Status: DESIGNING]
    
    G --> H[Admin: Hoàn thành sản phẩm]
    H --> I[Admin: Chụp ẢNH DEMO sản phẩm]
    I --> J[Upload ảnh demo lên R2]
    J --> K[Status: PENDING_DEMO_APPROVAL]
    
    K --> L[📧 Email gửi ẢNH DEMO cho khách]
    L --> M{Khách phản hồi?}
    
    M -- ✅ ĐỒNG Ý --> N[Status: APPROVED]
    M -- ❌ KHÔNG ĐỒNG Ý --> O[Chuyển liên hệ trực tiếp]
    M -- ⏰ Không phản hồi 48h --> P[Gửi nhắc nhở lần 2]
    
    P --> Q{Phản hồi sau nhắc?}
    Q -- ✅ ĐỒNG Ý --> N
    Q -- ❌ KHÔNG ĐỒNG Ý --> O
    Q -- ⏰ Thêm 48h nữa --> R[Auto APPROVED<br/>Gửi email thông báo]
    R --> N
    
    N --> S[Admin: Đóng gói]
    S --> T[Tạo vận đơn Viettel Post]
    T --> U[Status: SHIPPED]
    U --> V[📧 Email tracking cho khách]
    V --> W[Webhook VTP: Đã giao]
    W --> X[Status: DELIVERED]
    X --> Y[📧 Email hoàn tất + Yêu cầu đánh giá]
    Y --> Z([✅ Hoàn thành])
    
    style A fill:#fff3e0
    style K fill:#ffecb3
    style M fill:#ffe082
    style O fill:#ffcdd2
    style Z fill:#c8e6c9
```

#### 3.3.2 Flow Không Đồng Ý - Liên Hệ Trực Tiếp

```mermaid
flowchart TD
    A[Khách bấm: KHÔNG ĐỒNG Ý] --> B[Hiển thị popup]
    
    B --> C["Bạn có vấn đề với sản phẩm?<br/>Vui lòng liên hệ trực tiếp để giải quyết nhanh nhất:"]
    
    C --> D{Chọn kênh liên hệ}
    
    D -- 📞 Điện thoại --> E["Gọi ngay: 0123.456.789<br/>(Bấm để gọi)"]
    D -- 💬 Zalo --> F["Chat Zalo: 0123.456.789<br/>(Mở app Zalo)"]
    
    E --> G[Status: CONTACT_REQUESTED]
    F --> G
    
    G --> H[Admin nhận thông báo:<br/>Khách X cần liên hệ về đơn #123]
    H --> I[Admin liên hệ khách trực tiếp]
    
    I --> J{Kết quả thương lượng?}
    
    J -- Chỉnh sửa nhỏ --> K[Admin sửa sản phẩm]
    K --> L[Chụp ảnh demo mới]
    L --> M[Gửi lại email demo]
    M --> N[Status: PENDING_DEMO_APPROVAL]
    
    J -- Làm lại hoàn toàn --> O[Admin làm lại từ đầu]
    O --> K
    
    J -- Hoàn tiền cọc --> P[Status: REFUND_REQUESTED]
    P --> Q[Admin xử lý hoàn tiền]
    Q --> R[Status: REFUNDED]
    R --> S([❌ Đơn hàng hủy])
    
    J -- Khách chấp nhận --> T[Status: APPROVED]
    T --> U([Tiếp tục ship])
    
    style A fill:#ffcdd2
    style G fill:#fff9c4
    style S fill:#ef9a9a
    style U fill:#c8e6c9
```

#### 3.3.3 Các Trường Hợp Đặc Biệt

| Trường Hợp | Xử Lý | Status |
|------------|-------|--------|
| Không thanh toán > 24h | Hủy đơn tự động | `EXPIRED` |
| Không phản hồi demo 48h | Nhắc nhở lần 2 | `PENDING_DEMO_APPROVAL` |
| Không phản hồi 96h (48h+48h) | Auto approved, thông báo | `APPROVED` |
| Không đồng ý | Redirect liên hệ Phone/Zalo | `CONTACT_REQUESTED` |
| Yêu cầu hoàn tiền | Admin xử lý manual | `REFUND_REQUESTED` → `REFUNDED` |
| Sửa đổi nhiều lần > 3 | Admin liên hệ thương lượng | `CONTACT_REQUESTED` |

#### 3.3.4 Thông Tin Liên Hệ Shop

```yaml
Contact Info:
  phone: "0123.456.789"
  zalo: "0123.456.789"
  working_hours: "8:00 - 22:00 hàng ngày"
  
UI Buttons:
  - icon: 📞
    label: "Gọi ngay"
    action: "tel:0123456789"
    
  - icon: 💬  
    label: "Chat Zalo"
    action: "https://zalo.me/0123456789"
```

### 3.4 Flow Đơn Hàng In 3D (Printing Service)

```mermaid
flowchart TD
    A[Đơn hàng mới<br/>Type: printing] --> B[Slicing Service xử lý]
    B --> C[Tính giá tự động]
    C --> D{Thanh toán 100%?}
    D -- Thành công --> E[Status: PAID]
    D -- Chờ --> C
    
    E --> F[Admin: Bắt đầu in]
    F --> G[Status: PRINTING]
    G --> H[Admin: In xong + QC]
    H --> I[Status: COMPLETED]
    I --> J[Admin: Đóng gói]
    J --> K[Admin: Tạo vận đơn Viettel Post]
    K --> L[Status: SHIPPED]
    L --> M[Email tracking cho khách]
    M --> N[Webhook VTP: Đã giao]
    N --> O[Status: DELIVERED]
    O --> P([Hoàn thành])
    
    style A fill:#f3e5f5
    style P fill:#c8e6c9
```

---

## 4. Công Thức Tính Giá In 3D

> [!IMPORTANT]
> Chỉ hiển thị **giá cuối cùng** cho khách hàng, KHÔNG hiển thị giờ in và khối lượng

### 4.1 Công Thức

```
┌─────────────────────────────────────────────────────────────┐
│  FDM:    Giá = (600 × Khối_lượng_gram) + (3000 × Giờ_in)   │
│  Resin:  Giá = (3000 × Giờ_in) + (3000 × Khối_lượng_gram)  │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Ví Dụ Tính Toán

| Loại | Khối lượng | Thời gian | Công thức | Giá (VNĐ) |
|------|------------|-----------|-----------|-----------|
| **FDM** | 50g | 3h | 600×50 + 3000×3 | **39,000đ** |
| **FDM** | 100g | 8h | 600×100 + 3000×8 | **84,000đ** |
| **Resin** | 30g | 2h | 3000×2 + 3000×30 | **96,000đ** |
| **Resin** | 50g | 4h | 3000×4 + 3000×50 | **162,000đ** |

### 4.3 UI Hiển Thị Cho Khách

```
┌────────────────────────────────────────┐
│  Báo Giá In 3D                         │
│  ─────────────────────────────────     │
│  Loại in:     FDM                      │
│  Màu nhựa:    Đỏ                       │
│  ─────────────────────────────────     │
│  💰 Tổng giá: 84,000 VNĐ              │  ← CHỈ HIỆN GIÁ
│                                         │
│  [Thêm vào giỏ hàng]                   │
└────────────────────────────────────────┘
```

---

## 5. Microservices Chi Tiết

### 5.1 Service Architecture

```mermaid
graph TB
    subgraph "Auth & Identity"
        US[User Service]
    end
    
    subgraph "Catalog"
        PS[Product Service]
    end
    
    subgraph "Transaction"
        CS[Cart Service]
        OS[Order Service]
        PMS[Payment Service]
    end
    
    subgraph "Processing"
        SLS[Slicing Service<br/>Worker]
    end
    
    subgraph "Delivery"
        LS[Logistics Service]
        NS[Notification Service]
    end
    
    subgraph "Storage"
        FS[File Service]
    end
    
    OS --> SLS
    OS --> LS
    OS --> NS
    CS --> OS
    PMS --> OS
    US --> OS
    PS --> CS
    FS --> OS & SLS
```

### 5.2 Slicing Service (Worker) - CẬP NHẬT

```yaml
Input:
  - STL/OBJ file URL (from R2)
  - Print type: FDM | Resin
  - Material ID
  - Layer height, Infill %

Processing:
  1. Download file từ R2
  2. Load vào Kiri:Moto engine
  3. Slice với config
  4. Extract: print_time_hours, weight_grams

Pricing Calculation:
  if (printType === 'FDM'):
    price = (600 * weight_grams) + (3000 * print_time_hours)
  else if (printType === 'Resin'):
    price = (3000 * print_time_hours) + (3000 * weight_grams)

Output:
  - calculated_price: number  # CHỈ TRẢ GIÁ
  # KHÔNG trả print_time, weight cho frontend

Database Storage:
  - Lưu đầy đủ thông tin trong order_items.configuration
  - Chỉ dùng cho mục đích nội bộ Admin
```

### 5.3 Order Service - Xử Lý 3 Loại Đơn

```yaml
Order Status Enum:
  # Chung cho tất cả
  - PENDING              # Chờ thanh toán
  - EXPIRED              # Hết hạn thanh toán (>24h)
  - PAID                 # Đã thanh toán
  - COMPLETED            # Hoàn thành sản phẩm
  - SHIPPED              # Đã gửi hàng
  - DELIVERED            # Đã giao
  
  # Riêng cho ready_made
  - PREPARING            # Đang chuẩn bị từ kho
  
  # Riêng cho custom
  - DESIGNING            # Đang thiết kế
  - PENDING_DEMO_APPROVAL # Chờ khách xác nhận ẢNH DEMO
  - CONTACT_REQUESTED    # Khách không đồng ý, cần liên hệ
  - APPROVED             # Khách đã duyệt demo
  - REFUND_REQUESTED     # Yêu cầu hoàn tiền
  - REFUNDED             # Đã hoàn tiền
  
  # Riêng cho printing
  - PRINTING             # Đang in 3D

Status Flow by Type:
  ready_made: 
    PENDING → PAID → PREPARING → COMPLETED → SHIPPED → DELIVERED
    PENDING → EXPIRED (timeout >24h)
  
  custom:
    Happy path:
      PENDING → PAID → DESIGNING → PENDING_DEMO_APPROVAL → APPROVED → SHIPPED → DELIVERED
    
    Không đồng ý:
      PENDING_DEMO_APPROVAL → CONTACT_REQUESTED → (APPROVED hoặc REFUND_REQUESTED)
    
    Hoàn tiền:
      CONTACT_REQUESTED → REFUND_REQUESTED → REFUNDED
    
    Timeout:
      PENDING → EXPIRED (>24h không thanh toán)
      PENDING_DEMO_APPROVAL → APPROVED (>96h auto-approve)
  
  printing:
    PENDING → PAID → PRINTING → COMPLETED → SHIPPED → DELIVERED
```

---

## 6. Database Schema

### 6.1 ERD Diagram

```mermaid
erDiagram
    profiles ||--o{ addresses : has
    profiles ||--o{ orders : places
    products ||--o{ product_variants : has
    products }o--|| categories : belongs_to
    orders ||--o{ order_items : contains
    orders ||--|| payments : has
    orders ||--o| shipping_orders : generates
    
    profiles {
        uuid id PK
        text full_name
        text email
        text phone
        text role
    }
    
    products {
        uuid id PK
        text title
        text slug
        text type "ready_made|custom_template|service"
        decimal base_price
        int inventory
        jsonb metadata
        boolean is_showcase
    }
    
    orders {
        bigint id PK
        uuid user_id FK
        text order_type "ready_made|custom|printing"
        text status
        decimal total_amount
        decimal deposit_amount
        text payment_status
        text shipping_code
    }
    
    order_items {
        uuid id PK
        bigint order_id FK
        uuid product_id FK
        int quantity
        decimal unit_price
        jsonb configuration
    }
    
    payments {
        uuid id PK
        bigint order_id FK
        decimal amount
        text status
        text payos_transaction_id
    }
    
    shipping_orders {
        uuid id PK
        bigint order_id FK
        text vtp_tracking_number
        text status
    }
```

### 6.2 JSONB Configuration Examples

#### Custom Order Item
```json
{
  "type": "couple",
  "r2_file_urls": [
    "https://r2.domain.com/custom/123/photo1.jpg",
    "https://r2.domain.com/custom/123/photo2.jpg"
  ],
  "size_scale": 1.5,
  "accessories": [],
  "review_photo_url": "https://r2.domain.com/review/123/final.jpg",
  "customer_approved": true,
  "approved_at": "2026-01-15T10:00:00Z"
}
```

#### Printing Order Item (NỘI BỘ - KHÔNG HIỂN THỊ CHO KHÁCH)
```json
{
  "stl_url": "https://r2.domain.com/stl/456/model.stl",
  "print_type": "FDM",
  "material": "PLA_RED",
  "layer_height": 0.2,
  "infill": 15,
  
  "_internal": {
    "print_time_hours": 3.5,
    "weight_grams": 45,
    "slice_job_id": "job_abc123"
  },
  
  "calculated_price": 57000
}
```

---

## 7. User Personas & Use Cases

### 7.1 Actors

```mermaid
graph LR
    A[("👤 Guest")] -- Đăng ký --> B[("👤 Customer")]
    B -- Phân quyền --> C[("👤 Admin")]
    D[("🤖 System")] -- Auto process --> B & C
```

### 7.2 Use Case Diagram

```mermaid
graph TB
    subgraph Customer Use Cases
        UC1[Xem Showcase 3D]
        UC2[Mua sản phẩm có sẵn]
        UC3[Đặt hàng Custom<br/>+ Upload ảnh]
        UC4[Upload STL + Nhận báo giá]
        UC5[Xem lịch sử đơn hàng]
        UC6[Xác nhận ảnh review<br/>CHỈ Custom]
        UC7[Track vận chuyển]
    end
    
    subgraph Admin Use Cases
        UC11[Quản lý sản phẩm]
        UC12[Xử lý đơn có sẵn<br/>→ Ship trực tiếp]
        UC13[Xử lý đơn Custom<br/>→ Gửi review → Chờ confirm]
        UC14[Xử lý đơn In 3D<br/>→ Ship trực tiếp]
        UC15[Nhập mã vận đơn]
    end
    
    subgraph System Use Cases
        UC21[Auto-slice STL]
        UC22[Tính giá tự động]
        UC23[Gửi email thông báo]
        UC24[Đồng bộ tracking VTP]
    end
    
    Customer((Customer)) --> UC1 & UC2 & UC3 & UC4 & UC5 & UC6 & UC7
    Admin((Admin)) --> UC11 & UC12 & UC13 & UC14 & UC15
    System((System)) --> UC21 & UC22 & UC23 & UC24
```

---

## 8. Integration Diagrams

### 8.1 PayOS Payment Flow

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant OS as Order Service
    participant PAY as PayOS
    
    U->>F: Checkout
    F->>OS: Create Order
    OS->>OS: Calculate deposit (50% or 100%)
    OS->>PAY: Create Payment Link
    PAY-->>OS: Payment URL
    OS-->>F: Redirect URL
    F->>U: Redirect to PayOS
    U->>PAY: Complete payment
    PAY->>OS: Webhook (success)
    OS->>OS: Update status → PAID
    OS-->>F: Order confirmed
```

### 8.2 Slicing & Pricing Flow (CẬP NHẬT)

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend  
    participant API as API
    participant Q as Queue
    participant W as Slicing Worker
    participant R2 as Cloudflare R2
    
    U->>F: Upload STL file
    F->>API: POST /files/upload
    API->>R2: Store STL file
    R2-->>API: File URL
    
    API->>Q: Push SLICE_JOB
    API-->>F: Job ID
    
    F->>F: Polling status...
    
    Q->>W: Process job
    W->>R2: Download STL
    W->>W: Kiri:Moto slice
    W->>W: Calculate: FDM = 600×g + 3000×h
    W->>API: Return ONLY price
    
    F->>API: GET /jobs/{id}/status
    API-->>F: {"price": 84000}
    
    F->>U: Hiển thị: "Giá: 84,000đ"
    Note over U,F: KHÔNG hiển thị giờ in/khối lượng
```

### 8.3 Viettel Post Shipping Flow

```mermaid
sequenceDiagram
    participant A as Admin
    participant OS as Order Service
    participant LS as Logistics Service
    participant VTP as Viettel Post
    participant U as Customer
    
    A->>OS: Update: Ready to ship
    OS->>LS: Create shipping request
    LS->>VTP: POST /createOrder
    VTP-->>LS: Tracking number
    LS->>OS: Update shipping_code
    LS->>U: Email: tracking info
    
    loop Status Updates
        VTP->>LS: Webhook: status changed
        LS->>OS: Log status
        LS->>U: Email notification
    end
    
    VTP->>LS: Webhook: Delivered
    LS->>OS: Update → DELIVERED
    LS->>U: Email: Đã giao hàng
```

---

## 9. Frontend Pages Structure

```
📁 app/
├── 📄 page.tsx                    # Trang chủ Showcase 3D
├── 📁 products/
│   ├── 📄 page.tsx                # Danh sách sản phẩm
│   └── 📁 [slug]/page.tsx         # Chi tiết sản phẩm
├── 📁 custom/
│   └── 📄 page.tsx                # Flow tùy biến (multi-step)
├── 📁 printing/
│   └── 📄 page.tsx                # Upload STL + Báo giá
├── 📁 cart/page.tsx               # Giỏ hàng
├── 📁 checkout/page.tsx           # Thanh toán
├── 📁 account/
│   ├── 📄 page.tsx                # Dashboard
│   ├── 📁 orders/page.tsx         # Lịch sử đơn
│   └── 📁 orders/[id]/review.tsx  # Xác nhận ảnh (CHỈ Custom)
├── 📁 faq/page.tsx
├── 📁 about/page.tsx
└── 📁 admin/
    ├── 📄 page.tsx                # Dashboard
    ├── 📁 orders/page.tsx         # Quản lý đơn hàng
    └── 📁 orders/[id]/page.tsx    # Xử lý đơn hàng
```

---

## 10. Kế Hoạch Phát Triển

### Phase 1: Foundation (2 tuần)
- Setup Next.js + Supabase + Tailwind
- Authentication (Google, Email OTP)
- Cloudflare R2 integration

### Phase 2: Product & Showcase (2 tuần)
- Three.js showcase trang chủ
- Product listing & detail
- Search với Elasticsearch

### Phase 3: Custom Flow (2 tuần)
- Multi-step wizard
- Upload ảnh lên R2
- Size visualizer

### Phase 4: Printing Service (3 tuần)
- STL upload
- Slicing worker với Kiri:Moto
- **Pricing: FDM = 600g + 3000h, Resin = 3000h + 3000g**
- Chỉ hiển thị giá cuối

### Phase 5: Checkout & Payment (2 tuần)
- Cart, PayOS integration
- 50% deposit cho có sẵn/custom
- 100% cho printing

### Phase 6: Admin Dashboard (3 tuần)
- **3 flows khác nhau theo loại đơn**
- Review upload (chỉ custom)
- Viettel Post integration

### Phase 7: Notifications (1 tuần)
- Email automation
- Realtime updates

### Phase 8: Polish (2 tuần)
- Performance optimization
- Mobile responsive
- Testing

---

> **Tài liệu cập nhật:** v2.0 - Phân biệt 3 loại đơn hàng, Cloudflare R2 free storage, Công thức giá mới
