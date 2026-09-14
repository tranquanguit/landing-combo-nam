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

---

## Thêm một dòng sản phẩm

Dòng sản phẩm là trang gánh phần truy vấn lớn nhất — người gõ "kem dưỡng da nám
nên chọn loại nào" chưa biết Mocha là ai.

1. `mkdir -p src/content/lines/<slug>` rồi tạo `vi.json` (và `en.json`).
2. Bắt buộc: `slug`, `locale`, `translationKey`, `primaryKeyword`, `seo`,
   `heading`, `lead`.
3. `products`: danh sách slug sản phẩm, **theo thứ tự muốn hiển thị**. Bỏ trống
   thì trang tự gom mọi sản phẩm có `line: "<slug>"`.
4. `sections`: các mục nội dung biên tập. Đây là phần giúp trang xếp hạng — một
   trang chỉ có danh sách sản phẩm là trang mỏng và build sẽ chặn.
5. `faq`, `articles`: tuỳ chọn.

Dòng sản phẩm và sản phẩm **nằm cùng cấp URL**, nên slug phải khác mọi slug sản
phẩm. Trùng thì build dừng và nêu tên hai trang đang tranh nhau.

## Thêm một bài tư vấn

1. `mkdir -p src/content/articles/<slug>` rồi tạo `vi.json`.
2. Bắt buộc: `primaryKeyword`, `seo`, `title`, `lead`, `publishedAt`,
   `sections` (ít nhất một mục).
3. `relatedLine` và `relatedProducts` là thứ biến bài viết thành đường dẫn về
   trang bán hàng. Bỏ trống thì bài trở thành ngõ cụt và phép đo
   "mọi trang dẫn được sang nơi bán hàng" trong `npm run test:seo` sẽ đỏ.
4. Bài dưới **350 từ** bị chặn: ngắn hơn thì không trả lời trọn một câu hỏi.

URL sinh ra là `/goc-tu-van/<slug>/` (tiếng Việt) và `/en/advice/<slug>/`.

## Một truy vấn, một trang

Mỗi trang khai `primaryKeyword` — truy vấn mà trang đó **sở hữu**. Hai trang
cùng khai một truy vấn thì build dừng. Không phải để cho khó: hai trang nhắm một
truy vấn thì Google chọn một, và thường chọn trang có tỉ lệ chuyển đổi thấp hơn.

## Biến thể landing cho quảng cáo

Muốn 5 biến thể landing cho 5 nhóm quảng cáo: tạo sản phẩm mới với
`canonicalOf: "<slug-gốc>"`. Biến thể sẽ `noindex` và canonical trỏ về trang
gốc, nên nó không cạnh tranh với chính trang gốc trên kết quả tìm kiếm.
