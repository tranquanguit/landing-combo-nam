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
public/                      ảnh, video, font self-host, robots.txt
legacy/index.html            bản HTML viết tay trước đây, giữ để đối chiếu
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

**Cần cấu hình trước khi chạy thật.** Endpoint nhận đơn đọc từ `data-order-endpoint`
trên thẻ `<html>`; chưa đặt thì form chỉ log ra console.

Xem `docs/round-1-synthesis.md` để biết vì sao từng ràng buộc tồn tại.
