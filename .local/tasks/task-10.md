---
title: Printer profiles: Bambu A1 + Mars 5 Ultra, 3MF only
---
# Cập nhật máy in thực tế & chỉ nhận 3MF

## What & Why
Cập nhật hệ thống quote để phản ánh đúng 2 máy in thực tế đang dùng, và giới hạn upload chỉ nhận file `.3mf` (bỏ STL/OBJ). File 3MF mang đầy đủ thông tin về vật liệu, màu sắc và đơn vị đo — chuẩn hơn cho luồng quote tự động.

## Done looks like
- Upload chỉ nhận `.3mf`; STL/OBJ bị từ chối với thông báo tiếng Việt rõ ràng
- Profile FDM dùng đúng khổ Bambu Lab A1 (256×256×256 mm, nozzle 0.4 mm)
- Profile Resin dùng đúng khổ ELEGOO Mars 5 Ultra (153.36×77.76×165 mm)
- Nếu model vượt khổ máy → báo lỗi cụ thể ("Model vượt khổ in của máy X") thay vì lỗi chung

## Out of scope
- Hỗ trợ nhiều máy in (hệ thống vẫn khóa cứng 2 máy trên)
- Thay đổi công thức tính giá
- Resin production với Chitubox

## Tasks
1. **Cập nhật INI profile FDM** — Sửa `bed_shape`, `max_print_height` và thông số nozzle/filament trong cả hai file `fdm_petg_standard.ini` và `fdm_pla_standard.ini` theo đúng Bambu Lab A1 (256×256×256 mm).

2. **Cập nhật INI profile Resin** — Sửa `bed_shape`, kích thước display và `max_print_height` trong `resin_standard_detail.ini` và `resin_fast.ini` theo đúng ELEGOO Mars 5 Ultra (153.36×77.76×165 mm). Giữ pixel density hợp lý (6080×3072 native).

3. **Thêm buildVolumeMm vào ProfileDefinition** — Thêm field `buildVolumeMm: {x, y, z}` vào interface `ProfileDefinition` và điền giá trị đúng cho từng profile.

4. **Validate kích thước model trước khi slice** — Trong `slicerRunner.ts`, sau khi parse bbox (hoặc trước khi gọi PrusaSlicer), kiểm tra model có vừa khổ máy không. Nếu vượt → throw lỗi tiếng Việt nêu rõ chiều nào vượt và bao nhiêu mm. Bỏ validate STL/OBJ (chỉ còn 3MF).

5. **Giới hạn upload chỉ 3MF** — Cập nhật ALLOWED_EXTENSIONS trong route API, `accept` attribute trong file input, text hướng dẫn trên UI, và bộ lọc file trong `handleFileChange`.

## Relevant files
- `printer-profiles/fdm/fdm_petg_standard.ini`
- `printer-profiles/fdm/fdm_pla_standard.ini`
- `printer-profiles/resin/resin_standard_detail.ini`
- `printer-profiles/resin/resin_fast.ini`
- `src/lib/slicer/profiles.ts`
- `src/lib/slicer/slicerRunner.ts:86-120`
- `src/lib/slicer/slicerRunner.ts:270-320`
- `src/app/api/printing/exact-quote/route.ts:11-45`
- `src/app/printing/page.tsx:559-574,660-670,748-770`