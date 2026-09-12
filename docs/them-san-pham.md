# Thêm một sản phẩm mới

Chép file mẫu:

```bash
mkdir -p src/content/products/<ten-san-pham>
cp src/content/_template/vi.json src/content/products/<ten-san-pham>/
```

(Chép **file**, không chép cả thư mục — `cp -r` sẽ mang theo cả file hướng dẫn
vào thư mục sản phẩm.)

`src/content/_template/vi.json` nằm **ngoài** `src/content/products/` nên bản thân
nó không bao giờ lên trang.

Sau khi chép, sửa: `slug`, `translationKey`, `name`, `sku`, `price`, `seo`,
`compliance`, rồi nội dung trong `blocks`. Đặt `status: "published"` khi muốn lên trang.

**Bảng trường đầy đủ: [`truong-du-lieu.md`](truong-du-lieu.md)**

Vài điều tiết kiệm thời gian:

- **Không khai kích thước ảnh.** Đặt file vào `src/assets/images/` là đủ; máy đọc
  số pixel từ chính file. Đường dẫn sai thì build dừng và nói rõ cần đặt file ở đâu.
- **Không viết số tiền trực tiếp.** Dùng `{{price}}`, `{{compareAtPrice}}`, `{{save}}`.
- **Không thêm khoá lạ.** Mọi nhóm trường đều bật `strict`, nên `headding` hay
  `ogimage` bị chỉ đích danh thay vì bị bỏ qua âm thầm. Muốn ghi chú thì viết ở
  file README như file này, không nhét vào JSON.
- **Thứ tự `blocks` là thứ tự hiển thị.** Phải có đúng một khối `order`.
- **Lời chứng và ảnh khách hàng** chỉ được đặt trong khối `testimonials`/`gallery`
  có trường `consent`. Chưa có văn bản đồng ý thì đặt `consent.obtained: false` —
  khối tự ẩn khỏi trang và ảnh không được phát ra bản build.

## Neo mặc định trong trang

`secondaryCta.href` và mọi liên kết `#...` phải trỏ tới một khối có thật. Nếu
khối không khai `id` thì nó dùng neo mặc định dưới đây (nguồn:
`src/lib/block-anchors.ts`, và schema kiểm chéo lúc build):

| Loại khối | Neo mặc định |
|---|---|
| `problem` | `#van-de` |
| `ingredients` | `#thanh-phan` |
| `steps` | `#huong-dan` |
| `gallery` | `#hieu-qua` |
| `testimonials` | `#danh-gia` |
| `order` | `#dat-hang` |
| `faq` | `#faq` |

Khối `hero`, `offer`, `cards` không có neo mặc định — muốn liên kết tới thì tự
khai `"id"`. Khối `gallery`/`testimonials` đang `consent.obtained: false` bị ẩn
khỏi trang, nên neo của nó **không** được tính là có thật.

## Thông báo lỗi thường gặp

| Thông báo | Nghĩa |
|---|---|
| `blocks.1.rows.0: Expected type "object", received "string"` | `rows` là danh sách **nhóm trường**, mỗi dòng cần `name`, `role`, `suitedFor` — xem bảng trường |
| `blocks.2.items.0.q: Required` | FAQ dùng khoá `q` và `a`, không phải `question`/`answer` |
| `Unrecognized key: "..."` | gõ sai tên trường; mọi nhóm trường đều bật `strict` |
| `Không tìm thấy ảnh "..."` | đặt file vào `src/assets/images/` đúng tên đó |
| `Nội dung chứa tuyên bố bị cấm với mỹ phẩm` | thông báo nêu luôn cách viết thay thế |
| `Số tiền không được viết trực tiếp` | dùng `{{price}}`, `{{compareAtPrice}}`, `{{save}}` |
| `trỏ tới "#..." nhưng không khối nào có id đó` | thông báo liệt kê các neo có thật |
