# Mocha — nền tảng landing page sản phẩm

Astro 7, xuất HTML tĩnh. Mỗi sản phẩm là **một file JSON**; bố cục và thứ tự khối do
chính file đó quyết định, không phải sửa code.

> **Bắt đầu ở đây:** [`docs/kien-truc.md`](docs/kien-truc.md) — trang được tổ chức
> thế nào, tại sao nó tốt cho SEO, và dữ liệu khách hàng đi về đâu.
> Bằng chứng SEO đo từ bản build: [`docs/bao-cao-seo.md`](docs/bao-cao-seo.md)
> (`npm run test:seo`).

```
src/
  content.config.ts          schema Zod cho catalog + các khối nội dung
  content/products/<slug>/<locale>.json
  data/mocha.json            thông tin pháp nhân, hotline, kênh bán
  i18n/ui.ts                 chuỗi giao diện + quy tắc đường dẫn theo ngôn ngữ
  layouts/                   BaseLayout (head, font, schema) + ProductLanding (ghép khối)
  components/blocks/         Hero, Offer, Problem, Cards, Ingredients, Steps,
                             Gallery, Testimonials, Order, Faq
  lib/                       định dạng tiền/ngày, sinh JSON-LD
  styles/tokens.css          design tokens
src/assets/images/           ảnh nguồn, được astro:assets xử lý thành AVIF/WebP nhiều kích thước
public/                      font self-host, robots.txt, favicon
scripts/check-budget.mjs     cổng ngân sách trọng lượng, chạy trong CI
scripts/seo-report.mjs       60 phép đo SEO trên dist/, chạy trong CI
functions/api/orders.ts      nhận đơn, ghi vào Cloudflare D1
functions/api/admin/orders.ts  đọc/cập nhật đơn, cần Bearer token
functions/admin/index.ts     trang xem đơn cho nhân viên (/admin)
migrations/0001_orders.sql   lược đồ cơ sở dữ liệu đơn hàng
```

## Thêm một sản phẩm mới

1. **Chép file mẫu**: `mkdir -p src/content/products/<slug> && cp src/content/_template/vi.json src/content/products/<slug>/`
2. Sửa `slug`, `translationKey`, `name`, `sku`, `price`, `seo`, `compliance`.
3. Sửa `blocks` — thứ tự trong mảng chính là thứ tự hiển thị trên trang.
4. Đặt `status: "published"` khi muốn lên trang.

Hướng dẫn đầy đủ cho người biên tập: **[`docs/them-san-pham.md`](docs/them-san-pham.md)**
— gồm bảng neo mặc định và bảng giải nghĩa thông báo lỗi thường gặp.
Bảng trường: **[`docs/truong-du-lieu.md`](docs/truong-du-lieu.md)** — sinh tự động
từ schema bằng `npm run docs:fields`, và CI fail nếu nó lệch khỏi schema.

Không cần khai kích thước ảnh: đặt file vào `src/assets/images/` là đủ, máy tự
đọc số pixel từ chính file.

Build sẽ **từ chối** file thiếu trường bắt buộc, sai kiểu, **hoặc gõ sai tên
trường** (`headding` thay vì `heading` được chỉ đích danh) — schema là hàng rào,
không phải tài liệu. Ví dụ meta description quá 170 ký tự là build fail ngay.

Trước đây mục này chỉ nói "điền các trường bắt buộc" mà không chỗ nào liệt kê
chúng; một người kiểm định đóng vai biên tập viên đã mất ba vòng build-lỗi mới
qua được. Đó là lý do có thư mục mẫu và bảng trường.

## Lệnh

```bash
npm install
npm run dev      # máy chủ phát triển
npm run build    # xuất ra dist/
npm run preview  # xem thử bản đã build

npm run test:guards   # toàn bộ hàng rào: giá, từ cấm (kèm khẳng định ĐÚNG luật nào
                      # bắt), dữ liệu cá nhân, richtext, lint bộ mẫu, và bộ thử
                      # đi qua schema (tầng nối dây)
npm run test:schema   # chỉ bộ thử đi qua schema
npm run test:order    # 8 kịch bản gửi đơn thật trên Chromium, có cả kịch bản áp CSP
npm run docs:fields   # sinh lại docs/truong-du-lieu.md từ schema
node scripts/check-budget.mjs        # ngân sách trọng lượng + đối chiếu CSP với endpoint
node scripts/check-offer-window.mjs  # chuông báo hạn ưu đãi đã qua
```

## Khi nối endpoint nhận đơn

Biểu mẫu gửi bằng `fetch()`. Nếu endpoint nằm ở tên miền khác, **phải thêm origin
của nó vào `connect-src` trong `public/_headers`** — nếu không trình duyệt chặn và
mọi đơn hàng đều thất bại. `check-budget.mjs` đọc endpoint từ chính bản build và
fail nếu thiếu, nên đừng bỏ qua bước đó trong quy trình phát hành.

## Hàng rào tự động

Những ràng buộc dưới đây được **thi hành bằng code**, không phải bằng hướng dẫn:

| Hàng rào | Ở đâu | Chặn gì |
|---|---|---|
| Số tiền trong câu chữ phải khớp dữ liệu giá | `src/content.config.ts` | Quét mọi chuỗi của sản phẩm, nhận cả `990k`, `630 nghìn`, `1.140.000 đồng` |
| Tuyên bố phải khai dựa trên bằng chứng gì | `src/content.config.ts` | `verified`/`study` không có nguồn; `survey` không có cỡ mẫu |
| Ảnh và lời chứng của khách cần văn bản đồng ý | `src/content.config.ts` | Chưa có consent thì component không render |
| Ngôn ngữ chưa dịch xong giao diện | `src/i18n/ui.ts` | Build lỗi thay vì xuất trang nửa Việt nửa Anh |
| Ngân sách trọng lượng trang | `scripts/check-budget.mjs` | HTML gzip, JS nội tuyến, tổng font, cỡ ảnh |
| Ưu đãi hết hạn | `src/components/blocks/Offer.astro` | Ẩn dòng hạn + cảnh báo (cố ý không dừng build) |

Tất cả chạy trong CI (`.github/workflows/ci.yml`) trên mọi lần push.

## Ràng buộc đã chốt

**Tuân thủ.** Trường `compliance` là bắt buộc trong schema vì Nghị định 342/2025/NĐ-CP
yêu cầu quảng cáo mỹ phẩm phải nêu tên sản phẩm, tính năng công dụng, tên và địa chỉ tổ chức
công bố, cùng các cảnh báo. Thiếu số công bố thì trang tự hiển thị ô cảnh báo vàng — cố ý,
để dữ liệu thiếu không lọt lên production.

Cũng theo nghị định đó, **không được dùng hình ảnh, trang phục, tên gọi của cơ sở y tế,
bác sĩ, dược sĩ hay nhân viên y tế**. Đừng đưa lại nội dung dạng này vào bất kỳ landing nào.

**Structured data.** Không khai `aggregateRating` và `review` cho tới khi có hệ thống review
thật hiển thị trên trang — khai sai dẫn tới manual action của Google.

**Hiệu năng.** Ngân sách: LCP ≤ 2.0s, INP ≤ 150ms, CLS ≤ 0.03, JS first-party ≤ 12KB brotli,
ảnh màn đầu ≤ 180KB, tổng tải đầu ≤ 700KB. Không dùng GTM, không Partytown, không ClientRouter.
Font self-host tách subset latin/vietnamese qua `unicode-range`.

**Cần cấu hình trước khi chạy thật.** Endpoint nhận đơn đọc từ biến môi trường
`PUBLIC_ORDER_ENDPOINT` lúc build (đặt trong `.env` hoặc biến môi trường của CI):

```bash
PUBLIC_ORDER_ENDPOINT=https://api.vi-du.com/orders npm run build
```

Chưa đặt thì nút gửi mang `aria-disabled`, biểu mẫu **không** gửi đi đâu và trang
nói thẳng điều đó với khách kèm số hotline. Không có chuyện hiện màn hình cảm ơn giả.

Xem `docs/round-1-synthesis.md` để biết vì sao từng ràng buộc tồn tại.

## Đo lường chuyển đổi

Không hardcode ID nào. Đặt biến môi trường lúc build để bật:

```bash
PUBLIC_GA4_ID=G-XXXXXXX \
PUBLIC_META_PIXEL_ID=000000000 \
PUBLIC_TIKTOK_PIXEL_ID=XXXXXXXX \
PUBLIC_ORDER_ENDPOINT=https://api.vi-du.com/orders \
npm run build
```

Không đặt gì thì trang vẫn phát sự kiện trên `window` (`mocha:event`) để mã khác
lắng nghe, và **không tải script bên thứ ba nào**.

**Cách nạp.** Không dùng GTM — container của nó chạy custom HTML đồng bộ trong
click handler và là thủ phạm INP số một trên landing bán hàng. Pixel được nạp sau
sự kiện `load`, cộng thêm 1,2 giây, rồi mới chờ trình duyệt rảnh; tương tác thật
của người dùng thì nạp ngay. Đã đo: không host bên ngoài nào được gọi trước tương tác.

**Đồng ý trước ở thị trường ngoài Việt Nam.** Trang bán sang EU và UK, nơi đặt
cookie đo lường trước khi có đồng ý là vi phạm. Với mọi locale khác `vi`, không
nạp gì cho tới khi người dùng bấm Đồng ý. Bấm Từ chối thì không bao giờ nạp.

**Sự kiện**: `view_item`, `begin_checkout` (mọi CTA, kèm `cta_id`), `contact`
(gọi điện / Zalo), `form_start`, `generate_lead`, `scroll_depth`.

## Kiểm thử

```bash
npm run build          # schema từ chối nội dung vi phạm ngay lúc build
npm run check          # kiểm kiểu, 0 lỗi
node scripts/check-budget.mjs
PUBLIC_ORDER_ENDPOINT=http://localhost:8132/orders npm run build && npm run test:order
```

`npm run test:order` dựng một endpoint thật và đi qua ba kịch bản người dùng
thật sẽ gặp: gửi thành công, máy chủ trả 500, mạng đứt. Trang phải nói đúng sự
thật trong cả ba — đặc biệt là **không được báo thành công khi chưa gửi được**.

Nhánh này từng là nhánh chết suốt bốn vòng kiểm định: mọi lần đo đều ở trạng thái
"chưa cấu hình endpoint", nên phần code xử lý đơn hàng thật chưa ai chạy. Nay nó
chạy trong CI.
