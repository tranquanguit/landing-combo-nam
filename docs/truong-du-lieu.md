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
| `line` | chữ | không |
| `relatedArticles` | danh sách chữ | không (có sẵn mặc định) |
| `primaryKeyword` | chữ | không |
| `canonicalOf` | chữ | không |
| `name` | chữ | **có** |
| `shortName` | chữ | không |
| `sku` | chữ | **có** |
| `includes` | danh sách nhóm trường | không (có sẵn mặc định) |
| &nbsp;&nbsp;&nbsp;&nbsp;`includes[].name` | chữ | **có** |
| &nbsp;&nbsp;&nbsp;&nbsp;`includes[].note` | chữ | không |
| `gifts` | danh sách nhóm trường | không (có sẵn mặc định) |
| &nbsp;&nbsp;&nbsp;&nbsp;`gifts[].name` | chữ | **có** |
| &nbsp;&nbsp;&nbsp;&nbsp;`gifts[].note` | chữ | không |
| `price` | số | **có** |
| `compareAtPrice` | số | không |
| `currency` | chữ | không (có sẵn mặc định) |
| `availability` | một trong: `InStock`, `OutOfStock`, `PreOrder`, `BackOrder` | không (có sẵn mặc định) |
| `shipping` | nhóm trường | không |
| &nbsp;&nbsp;&nbsp;&nbsp;`shipping.country` | chữ | **có** |
| &nbsp;&nbsp;&nbsp;&nbsp;`shipping.rate` | số | **có** |
| &nbsp;&nbsp;&nbsp;&nbsp;`shipping.transitDaysMin` | số | **có** |
| &nbsp;&nbsp;&nbsp;&nbsp;`shipping.transitDaysMax` | số | **có** |
| `returnPolicy` | nhóm trường hoặc danh sách nhóm trường | không |
| `variants` | danh sách nhóm trường | không (có sẵn mặc định) |
| &nbsp;&nbsp;&nbsp;&nbsp;`variants[].label` | chữ | **có** |
| &nbsp;&nbsp;&nbsp;&nbsp;`variants[].note` | chữ | không |
| &nbsp;&nbsp;&nbsp;&nbsp;`variants[].price` | số | không |
| &nbsp;&nbsp;&nbsp;&nbsp;`variants[].recommended` | đúng/sai | không (có sẵn mặc định) |
| `seo` | nhóm trường | **có** |
| &nbsp;&nbsp;&nbsp;&nbsp;`seo.title` | chữ | **có** |
| &nbsp;&nbsp;&nbsp;&nbsp;`seo.description` | chữ | **có** |
| &nbsp;&nbsp;&nbsp;&nbsp;`seo.ogImage` | chữ | không |
| `compliance` | nhóm trường | **có** |
| &nbsp;&nbsp;&nbsp;&nbsp;`compliance.productNotificationNumber` | chữ | không |
| &nbsp;&nbsp;&nbsp;&nbsp;`compliance.declaringOrganization` | chữ | **có** |
| &nbsp;&nbsp;&nbsp;&nbsp;`compliance.declaringAddress` | chữ | **có** |
| &nbsp;&nbsp;&nbsp;&nbsp;`compliance.functions` | chữ | **có** |
| &nbsp;&nbsp;&nbsp;&nbsp;`compliance.warnings` | danh sách chữ | **có** |
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

- `surface`
- `space`
- `id`
- `eyebrow`
- `heading *`
- `intro`
- `quotes *`
- `explainer *`

### `cards`

- `surface`
- `space`
- `id`
- `eyebrow`
- `heading *`
- `intro`
- `columns`
- `items *`

### `ingredients`

- `surface`
- `space`
- `id`
- `eyebrow`
- `heading *`
- `intro`
- `caption`
- `rows *`

### `steps`

- `surface`
- `space`
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

### `relatedProducts`

- `id`
- `surface`
- `space`
- `eyebrow`
- `heading *`
- `intro`
- `items *`

### `finalCta`

- `id`
- `surface`
- `space`
- `eyebrow`
- `heading *`
- `body`
- `primary *`
- `secondary`

### `faq`

- `surface`
- `space`
- `id`
- `eyebrow`
- `heading *`
- `items *`

### `feature`

- `id`
- `image *`
- `caption`

### `documents`

- `surface`
- `space`
- `id`
- `eyebrow`
- `heading *`
- `intro`
- `items *`
- `footnote`

### `timeline`

- `surface`
- `space`
- `id`
- `eyebrow`
- `heading *`
- `intro`
- `max *`
- `unitLabel *`
- `items *`
- `footnote`

### `routine`

- `surface`
- `space`
- `id`
- `eyebrow`
- `heading *`
- `intro`
- `columns *`
- `footnote`

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
