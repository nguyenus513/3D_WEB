# MCP / API tạo 3D model từ ảnh

## Khuyến nghị

### 1) Meshy API (ưu tiên cho web production)
- Có Image-to-3D API chính thức.
- Input: URL ảnh public hoặc data URI base64.
- Output: `glb`, `fbx`, `obj`, `usdz` tuỳ cấu hình.
- Phù hợp tích hợp vào hệ thống: upload ảnh R2 -> gọi Meshy -> lưu model URL vào MongoDB/R2.

Env cần có:
```env
MESHY_API_KEY="..."
```

Flow web đề xuất:
1. User/admin upload ảnh vào R2.
2. Backend gọi `POST https://api.meshy.ai/openapi/v1/image-to-3d`.
3. Lưu `task_id` vào MongoDB collection `model_generation_tasks`.
4. Poll/stream task đến khi `SUCCEEDED`.
5. Tải `.glb` về R2.
6. Hiển thị viewer 3D bằng `<model-viewer>` hoặc `@react-three/fiber`.

### 2) Tripo 3D MCP (ưu tiên cho agent/Blender workflow)
- Có MCP server chính thức qua stdio.
- Mạnh cho text-to-3D + Blender scene automation.
- Image-to-3D tuỳ MCP implementation; nếu cần web production vẫn nên dùng API trực tiếp.

Env cần có:
```env
TRIPO_API_KEY="..."
```

### 3) Local/open-source
- TripoSR/Hunyuan3D/TRELLIS chạy local cần GPU mạnh.
- Không phù hợp Vercel free; nên chạy worker riêng hoặc dùng API cloud.

## MCP config mẫu

Tuỳ client MCP, thêm dạng tương tự:
```json
{
  "mcpServers": {
    "tripo-3d": {
      "command": "npx",
      "args": ["-y", "@vast-ai-research/tripo-mcp"],
      "env": {
        "TRIPO_API_KEY": "${TRIPO_API_KEY}"
      }
    }
  }
}
```

Nếu dùng Meshy MCP/community server, cần API key Meshy và kiểm tra package chính xác trước khi cài.

## Cần làm tiếp trong repo

- Thêm API route: `/api/admin/3d-models/generate`.
- Thêm collection MongoDB: `model_generation_tasks`.
- Thêm page admin xem tiến trình generate.
- Thêm viewer 3D trong trang sản phẩm/custom.
