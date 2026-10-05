# Nhập liệu

Mọi nội dung của website — sản phẩm, giấy tờ, dòng sản phẩm, bài tư vấn, chính
sách, trang chủ, thông tin thương hiệu — nhập ở **`/admin`** và lưu trong Postgres.

## Một schema cho tất cả

Cái gì hợp lệ do **một** nơi quyết định: `src/content.config.ts`. Trang quản trị
kiểm bằng đúng schema đó mỗi lần bấm **Kiểm tra & lưu**, nên:

- sai kiểu, thiếu trường, **gõ sai tên trường** → báo ngay, chỉ đúng trường, bằng tiếng Việt;
- **số tiền viết tay** trong câu chữ (`990k`, `1.050.000 đồng`) → bị chặn; dùng `{{price}}`,
  `{{compareAtPrice}}`, `{{save}}` để giá chỉ tồn tại ở trường `price`;
- tuyên bố `verified` không kèm nguồn, ảnh khách không có văn bản đồng ý, số công bố
  lệch giấy tờ… → bị chặn như lúc build.

Nội dung sai **không lưu được**, nên không bao giờ có chuyện lưu xong mới biết xuất bản hỏng.
Bảng giải nghĩa từng trường: [`truong-du-lieu.md`](truong-du-lieu.md).

## Quy trình

1. **Sửa** — `/admin` → chọn nhóm → **Sửa**. Các ô phía trên (giá, trạng thái, số công bố…)
   là trường hay đổi nhất; mọi trường khác nằm trong ô JSON bên dưới.
2. **Kiểm tra & lưu** — lỗi thì sửa lại, nội dung đã gõ không mất. Lưu được thì mỗi lần lưu
   để lại một bản trong **Lịch sử** (khôi phục được).
3. **Xuất bản** — `/admin/publish`. Trang thật chỉ đổi ở bước này. Build lỗi thì bản đang
   chạy giữ nguyên và nhật ký chỉ rõ lỗi.

## Thêm sản phẩm mới

Sản phẩm → mở một sản phẩm gần giống → **Nhân bản** → đặt mã `ten-san-pham/vi` →
sửa → lưu (trạng thái `draft` cho tới khi sẵn sàng) → làm tương tự cho `/en` →
đổi `status` thành `published` → Xuất bản.

Mọi sản phẩm dùng bản trình bày **flagship**. Bố cục tự đi theo dữ liệu:

| Dữ liệu | Hiển thị |
|---|---|
| Tên hoạt chất có nồng độ (`"Tranexamic Acid 3%"`) | Con số lớn trên sân khấu hero và trong bảng hoạt chất |
| Không có nồng độ | Chỉ tên hoạt chất — **không bao giờ tự điền số** |
| `image.backdrop: "photo"` | Ảnh chụp có nền riêng → đặt trong khung vòm |
| Không khai `backdrop` (packshot nền trắng) | Hoà vào nền sân khấu |
| `includes` đúng 2 món có ảnh | Sân khấu dựng từ ảnh từng món |
| Khối `{"type": "documents"}` không kèm `items` | Tự lấy giấy tờ áp dụng cho sản phẩm |

## Giấy tờ (phiếu công bố, phiếu kiểm nghiệm…)

Một giấy = một mục trong **Giấy tờ**, khai `appliesTo` là danh sách mã sản phẩm (hoặc
`"all"`). Giấy tự hiện ở trang của mọi sản phẩm nó áp dụng và ở `/chung-nhan/`.

Trước khi đăng một giấy:

1. **Che thông tin cá nhân** trên ảnh (chữ ký, tên người ký, số điện thoại cá nhân, số
   giấy tờ tuỳ thân) rồi mới tải lên `/admin/media` vào thư mục `documents`. Trường
   `redacted: true` là lời xác nhận đã che — schema không cho đăng nếu thiếu.
2. **Đọc điều khoản của nơi cấp.** Có phòng kiểm nghiệm cấm dùng báo cáo trong quảng cáo
   (TÜV SÜD — điều 4 trang cuối mỗi phiếu). Giấy như vậy để `draft`.
3. Phiếu công bố: `reference` phải trùng `compliance.productNotificationNumber` của sản
   phẩm (một bộ nhiều món thì ít nhất một phiếu trùng). Lệch thì không xuất bản được.
4. Giấy có hạn thì khai `validUntil` — quá hạn tự ẩn và build cảnh báo.

Những giấy đang chờ quyết định: [`chung-tu-cho-duyet.md`](chung-tu-cho-duyet.md).

## Ảnh

**Ảnh đại diện sản phẩm (hero, thẻ sản phẩm): luôn là ảnh NỀN TRẮNG**, khung vuông,
sản phẩm nằm giữa với lề đều khoảng 5–12% (bộ ảnh `hero-*.webp` hiện có làm theo
chuẩn này, lấy từ folder "TƯ LIỆU HÌNH ẢNH SẢN PHẨM/HÌNH WEB" trên Drive). Nền trắng
hoà vào sân khấu; ảnh chụp có nền màu thì bị cắt và trông lệch với các trang khác.

`/admin/media`: ảnh tự chuyển WebP, cạnh dài ≤ 1600px, ≤ 120KB (ngân sách trọng lượng).
Dùng đường dẫn hiện dưới ảnh trong JSON, ví dụ `"src": "/images/packshot-uv-block-plus-2025.webp"`.

Không dùng: ảnh bác sĩ, nhân viên y tế (Nghị định 342/2025); ảnh khách, người nổi
tiếng, KOC khi chưa có văn bản đồng ý cho **chính website này**.

## Chạy thử trên máy (không cần cài Postgres)

```bash
# PGlite: Postgres thật chạy trong tiến trình Node, lưu vào thư mục .data/
DATABASE_URL=pglite:./.data/pg COOKIE_SECURE=0 PUBLISH_ON_BOOT=0 \
ADMIN_BOOTSTRAP_USER=admin ADMIN_BOOTSTRAP_PASSWORD=mat-khau-thu-dai \
ADMIN_TOKEN=token-thu-nghiem-dai-hon-24-ky-tu IP_SALT=thu npm run server
# mở http://localhost:8080/admin/
```

`npm run test:server` chạy bộ thử máy chủ trên Postgres (PGlite) — nằm trong `test:guards`.
