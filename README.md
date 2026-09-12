# Mocha — nền tảng landing page sản phẩm

Astro 7, xuất HTML tĩnh. Mỗi sản phẩm là **một file JSON**; bố cục và thứ tự khối do
chính file đó quyết định, không phải sửa code.

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
```

## Thêm một sản phẩm mới

1. Tạo `src/content/products/<slug>/vi.json`.
2. Điền các trường bắt buộc; `blocks` liệt kê khối theo đúng thứ tự muốn hiển thị.
3. Đặt `status: "published"`.

Build sẽ **từ chối** file thiếu trường bắt buộc hoặc sai kiểu — schema là hàng rào,
không phải tài liệu. Ví dụ meta description quá 170 ký tự là build fail ngay.

## Lệnh

```bash
npm install
npm run dev      # máy chủ phát triển
npm run build    # xuất ra dist/
npm run preview  # xem thử bản đã build
```

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
