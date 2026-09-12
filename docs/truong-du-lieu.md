# Các trường trong file sản phẩm

**File này được sinh tự động** bằng `node scripts/gen-field-docs.mjs` từ
`src/content.config.ts`. Đừng sửa tay — sửa schema rồi chạy lại.

Dấu `*` = bắt buộc.

## Trường ở cấp sản phẩm

| Trường | Kiểu | Bắt buộc |
|---|---|---|
| `slug` | chữ | **có** |
| `locale` | một trong: `vi`, `en`, `th`, `id` | **có** |
| `translationKey` | chữ | **có** |
| `status` | một trong: `draft`, `published` | không (có sẵn mặc định) |
| `name` | chữ | **có** |
| `shortName` | chữ | không |
| `sku` | chữ | **có** |
| `includes` | danh sách nhóm trường | không (có sẵn mặc định) |
| `gifts` | danh sách nhóm trường | không (có sẵn mặc định) |
| `price` | số | **có** |
| `compareAtPrice` | số | không |
| `currency` | chữ | không (có sẵn mặc định) |
| `availability` | một trong: `InStock`, `OutOfStock`, `PreOrder`, `BackOrder` | không (có sẵn mặc định) |
| `shipping` | nhóm trường | không |
| `returnPolicy` | nhóm trường hoặc danh sách nhóm trường | không |
| `variants` | danh sách nhóm trường | không (có sẵn mặc định) |
| `seo` | nhóm trường | **có** |
| `compliance` | nhóm trường | **có** |
| `blocks` | danh sách khối — xem mục "Các loại khối" bên dưới | **có** |

## Các loại khối dùng trong `blocks`

Mỗi khối là một mục trong mảng `blocks`, thứ tự trong mảng chính là thứ tự
hiển thị trên trang. Mỗi khối phải có `"type"`.

### `hero`

- `eyebrow`
- `heading *`
- `lead *`
- `usp *`
- `image *`
- `primaryCta *`
- `secondaryCta`
- `trustBadges`

### `offer`

- `eyebrow`
- `heading *`
- `body *`
- `validUntil`
- `notes`

### `problem`

- `id`
- `eyebrow`
- `heading *`
- `intro`
- `quotes *`
- `explainer *`

### `cards`

- `id`
- `eyebrow`
- `heading *`
- `intro`
- `columns`
- `items *`

### `ingredients`

- `id`
- `eyebrow`
- `heading *`
- `intro`
- `caption`
- `rows *`

### `steps`

- `id`
- `eyebrow`
- `heading *`
- `intro`
- `totalTime`
- `items *`
- `footnote`

### `gallery`

- `id`
- `eyebrow`
- `heading *`
- `intro`
- `disclaimer`
- `consent *`
- `images *`

### `testimonials`

- `id`
- `eyebrow`
- `heading *`
- `intro`
- `consent *`
- `items *`

### `order`

- `eyebrow`
- `heading *`
- `body *`
- `points *`

### `faq`

- `id`
- `eyebrow`
- `heading *`
- `items *`

## Những điều máy sẽ chặn bạn (và vì sao)

- **Viết số tiền trực tiếp** trong bất kỳ câu chữ nào. Dùng `{{price}}`,
  `{{compareAtPrice}}`, `{{save}}` — trang tự thay bằng giá thật, nên giá không
  bao giờ lệch giữa các chỗ.
- **Tuyên bố bị cấm với mỹ phẩm** (trị/chữa bệnh, cam kết kết quả, so sánh với
  laser, danh nghĩa bác sĩ…). Thông báo lỗi nêu rõ nên viết thế nào thay thế.
  Áp dụng cả khi bạn gõ **không dấu**.
- **Tên, tuổi, số điện thoại, email của khách hàng** ở ngoài khối có cổng đồng ý.
  Lời chứng phải nằm trong khối `testimonials` kèm `consent`.
- **Ảnh sai đường dẫn**, **neo `#...` trỏ tới khối không tồn tại**, **hai khối
  trùng `id`**, **thiếu khối `order`**, **hai gói cùng `recommended`**.
- **Gõ sai tên trường** (`headding` thay vì `heading`) — máy chỉ đích danh.

Kích thước ảnh **không cần khai**: đặt file vào `src/assets/images/` là xong,
máy tự đọc số pixel. Ảnh người thật chưa có văn bản đồng ý thì để trong
`src/media-gated/` và đặt `consent.obtained: false`.
