# Landing page — Combo Nám Mocha

Landing page một trang (single-file), chuẩn SEO + AI Search, tối ưu cho quảng cáo
Meta / Google / TikTok.

```
index.html      — toàn bộ landing page (HTML + CSS + JS inline, không phụ thuộc thư viện ngoài)
robots.txt      — cho phép cả bot tìm kiếm truyền thống và AI crawler (GPTBot, ClaudeBot, PerplexityBot…)
sitemap.xml     — sitemap kèm image sitemap
llms.txt        — bản tóm tắt dữ kiện dạng văn bản cho các mô hình AI trích dẫn
images/ videos/ — tài sản hình ảnh và video
```

## Trước khi lên production — 5 việc bắt buộc

1. **Tên miền.** Toàn bộ URL tuyệt đối đang dùng `https://mochatrinam.com`.
   Nếu chạy tên miền khác, thay đồng loạt:
   `grep -rl 'mochatrinam.com' . | xargs sed -i 's#mochatrinam\.com#TEN-MIEN-MOI#g'`

2. **Endpoint nhận đơn hàng.** Trong `index.html`, tìm `var ENDPOINT = '';`
   và điền URL nhận POST (Google Apps Script, CRM, Zapier, n8n…). Payload JSON gồm:
   `name, phone, address, note, pack, page, utm`. Khi để trống, form vẫn chạy và
   chỉ log ra console — chỉ dùng để demo.

3. **Mã đo lường.** Dán GA4 / Meta Pixel / TikTok Pixel vào ngay trước `</head>`.
   Trang đã tự bắn sự kiện qua `dataLayer`, `gtag`, `fbq`, `ttq`:
   `begin_checkout` (mọi nút CTA), `contact` (gọi điện / Zalo), `form_start`,
   `generate_lead` (gửi form thành công), `scroll_depth` (25/50/75/90%).
   Mỗi nút có `data-cta="..."` để biết CTA nào tạo ra lead.

4. **Số liệu social proof.** `4,9/5 · 1.284 đánh giá` và `8/100 suất` là số mẫu.
   Phải thay bằng số thật trước khi chạy ads — schema `aggregateRating` khai báo
   sai số liệu có thể bị Google phạt rich result và vi phạm chính sách quảng cáo.

5. **Ảnh Open Graph.** `images/hero-full.jpg` nên được cắt đúng 1200×630 để
   preview quảng cáo và mạng xã hội không bị méo.

## Những gì đã tối ưu

**SEO kỹ thuật**
- Một `<h1>` duy nhất, phân cấp `h2`/`h3` theo chủ đề; landmark `header/main/section/footer`.
- Title + meta description viết theo intent tìm kiếm ("combo nám mocha", "kem trị nám",
  "trị nám sau sinh", "giá bao nhiêu"), canonical, hreflang, robots directives đầy đủ.
- Structured data `@graph`: Organization, WebSite, WebPage (+ speakable), BreadcrumbList,
  Product (offers, shippingDetails, returnPolicy, aggregateRating, review), FAQPage, HowTo.
- Sitemap + image sitemap, robots.txt khai báo sitemap.

**Hiệu năng (Core Web Vitals)**
- Bỏ hoàn toàn Tailwind CDN và Flowbite (~150KB JS chặn render ở bản cũ) — CSS viết tay inline.
- Preload ảnh hero theo breakpoint, font tải bất đồng bộ, video `preload="none"`.
- Mọi ảnh có `width`/`height` + `loading="lazy"` để tránh CLS.

**AI Search / GEO**
- `llms.txt` cung cấp dữ kiện có cấu trúc cho mô hình AI trích dẫn.
- robots.txt allow-list các AI crawler chính.
- Nội dung viết theo lối "trả lời trước" (answer-first): mỗi mục giải đáp trọn một câu hỏi,
  có bảng thành phần và mốc thời gian cụ thể — dạng dữ liệu mà AI dễ trích dẫn.

**Chuyển đổi & quảng cáo**
- CTA lặp lại theo từng chặng cuộn, sticky bar trên mobile, nút gọi/Zalo nổi.
- Đếm ngược lưu `localStorage` (không reset mỗi lần tải lại — trung thực hơn với người dùng).
- Form có validate số điện thoại Việt Nam, thông báo lỗi rõ ràng, trạng thái thành công.
- Giữ tham số UTM để quy kết nguồn quảng cáo.

**Khả năng tiếp cận**
- Skip link, `aria-label`, `aria-labelledby`, focus-visible rõ ràng, tôn trọng
  `prefers-reduced-motion`, FAQ dùng `<details>` gốc (hoạt động cả khi tắt JS).

## Tuân thủ quảng cáo mỹ phẩm

Trang đã ghi rõ miễn trừ: *"là mỹ phẩm chăm sóc da, không phải là thuốc và không có
tác dụng thay thế thuốc chữa bệnh"* và không dùng từ "điều trị"/"chữa khỏi" trong các
tuyên bố hiệu quả — điều kiện cần để duyệt quảng cáo Meta/Google ngành mỹ phẩm.
