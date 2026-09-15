# Đưa site lên server

Danh sách này viết để làm theo từ trên xuống. Phần **A** là những thứ *bắt buộc*
phải có trước khi bật quảng cáo — thiếu chúng thì site chạy được nhưng có rủi ro
pháp lý hoặc mất đơn. Phần **B** là các bước kỹ thuật. Phần **C** là việc sau
khi lên.

---

## A. Những gì còn thiếu, và ai phải cung cấp

Mỗi dòng dưới đây hiện đang hiện một ô cảnh báo vàng trên chính trang web (chủ ý:
để không ai quên). Điền xong thì ô tự biến mất.

| # | Thiếu gì | Sửa ở đâu | Vì sao chặn |
| --- | --- | --- | --- |
| A1 | **Số tiếp nhận phiếu công bố mỹ phẩm** | `src/content/products/combo-nam/*.json` → `compliance.productNotificationNumber` | Nghị định 342/2025/NĐ-CP bắt buộc với quảng cáo mỹ phẩm. Thiếu là rủi ro xử phạt. |
| A2 | **Mã số thuế doanh nghiệp** | `src/data/mocha.json` → `taxId` | Bắt buộc với website thương mại điện tử bán hàng. |
| A3 | **Trang chính sách** (đổi trả, bảo mật dữ liệu cá nhân) | chưa có — cần viết | Nghị định 13/2023/NĐ-CP: đã thu thập dữ liệu cá nhân thì phải công bố chính sách. Câu đồng ý trên biểu mẫu đang hứa "có thể yêu cầu xoá bất cứ lúc nào". |
| A4 | **Đường dẫn gian hàng chính hãng** (Shopee, Lazada, TikTok Shop, Facebook) | `src/data/mocha.json` → `marketplaces[].url` | Đang nhắc tên sàn mà không dẫn được tới đâu. |
| A5 | **Bộ ảnh đúng đặc tả** | `src/assets/images/` | Xem `docs/anh-can-co.md`. Hiện **cả 6 ảnh bắt buộc đều dưới chuẩn**: logo 220×81 không nền trong suốt, packshot 1002×762 (cần 1600×1200), ba ảnh nám ba tỉ lệ khác nhau. |
| A6 | **Chứng từ** (phiếu công bố, CGMP, kiểm nghiệm) | `src/assets/documents/` rồi khai khối `documents` | Khối đã dựng xong và đã kiểm thử, chỉ chờ file. Đây là bằng chứng mạnh nhất một trang mỹ phẩm có thể đưa ra. |
| A7 | **Văn bản đồng ý cho 4 ảnh trước/sau** | có văn bản rồi thì chuyển file từ `src/media-gated/images/` sang `src/assets/images/` | Ảnh khách là dữ liệu cá nhân. Cổng build đang chặn chúng khỏi `dist/`. |

> **A1 — một đầu mối để đối chiếu.** Tìm kiếm công khai cho ra số
> **1459/24/CBMP-LA** gắn với sản phẩm Mocha, nhưng cùng một số lại xuất hiện cho
> cả kem và serum ở các nguồn bán lẻ khác nhau, nên **không dùng được**. Đây là
> trường pháp lý: lấy đúng số in trên phiếu công bố bản gốc của từng sản phẩm.

---

## B. Các bước kỹ thuật

### B1. Tên miền

Site đang khai `site: 'https://mochatrinam.com'` trong `astro.config.mjs`. Đổi
tên miền thì phải sửa **ba** chỗ, nếu không canonical và sitemap sẽ trỏ sai:

```
astro.config.mjs        → export const SITE
wrangler.toml           → [vars] ALLOWED_ORIGIN
public/robots.txt       → dòng Sitemap:
```

Sau khi đổi, `npm run test:seo` sẽ đỏ nếu còn sót chỗ nào.

### B2. Cơ sở dữ liệu đơn hàng

```bash
npx wrangler d1 create mocha-orders          # dán database_id vào wrangler.toml
npm run db:migrate                            # tạo bảng orders + rate_limit
npx wrangler pages secret put ADMIN_TOKEN     # >= 32 ký tự ngẫu nhiên
npx wrangler pages secret put IP_SALT         # ngẫu nhiên, đặt MỘT LẦN rồi thôi
```

Chi tiết vận hành: `docs/co-so-du-lieu.md`.

### B3. Build và deploy

```bash
npm ci
PUBLIC_ORDER_ENDPOINT=/api/orders npm run build
npx wrangler pages deploy dist
```

`PUBLIC_ORDER_ENDPOINT` **bắt buộc** phải đặt. Không đặt thì biểu mẫu đặt hàng
không render thẻ `<form>` và chỉ hiện hotline — chủ ý như vậy, vì một đơn hàng
rơi vào hư không tệ hơn một nút không hoạt động.

### B4. Kiểm trước khi bật quảng cáo

```bash
npm run check          # 0 lỗi kiểu
npm run test:guards    # 535 ca hàng rào
npm run test:seo       # 223 phép đo SEO trên chính bản build
npm run test:orders-api # 20 kịch bản API đơn hàng
npm run test:admin     # 9 kịch bản trang quản trị
npm run check:assets   # ảnh khớp đặc tả
node scripts/check-budget.mjs
```

Và **một lần đặt thử đơn thật** trên tên miền thật. Toàn bộ phần máy chủ đã kiểm
bằng SQLite thật và trình duyệt thật, nhưng binding D1 và secret là thứ chỉ sai
được đúng ở lần deploy đầu tiên.

---

## C. Sau khi lên

### C1. Khai báo với công cụ tìm kiếm

1. **Google Search Console** — thêm tài sản theo tên miền, xác minh bằng bản ghi
   DNS TXT, rồi gửi `https://<tên-miền>/sitemap-index.xml`.
2. **Bing Webmaster Tools** — nhập thẳng từ Search Console.
3. Kiểm dữ liệu có cấu trúc bằng
   [Rich Results Test](https://search.google.com/test/rich-results) cho cả bốn
   loại trang: trang chủ, dòng sản phẩm, landing, bài tư vấn.

### C2. Google Business Profile

Địa chỉ 290/2 Nam Kỳ Khởi Nghĩa đã có trong JSON-LD `Organization`. Tạo hồ sơ
doanh nghiệp với **đúng** tên pháp nhân, địa chỉ và số điện thoại đó — sai lệch
giữa hai nơi làm yếu tín hiệu địa phương.

### C3. Đo lường

`src/lib/analytics.ts` đã sẵn chỗ cho GA4, Meta Pixel và TikTok Pixel; điền ID
là chạy. Mã đo **chỉ nạp sau khi khách bấm đồng ý** — đừng thay bằng Google Tag
Manager, vì GTM nạp trước khi có đồng ý và làm hỏng cả cơ chế đó lẫn ngân sách
hiệu năng.

### C4. Hạn ưu đãi

`validUntil` của khối `offer` hiện là **2026-09-30**. Trang tĩnh đã deploy sẽ
tiếp tục hiện ưu đãi cũ cho tới lần deploy kế tiếp, nên
`scripts/check-offer-window.mjs` làm CI đỏ khi hạn đã qua. Đặt lịch nhắc trước
ngày đó.

### C5. Sao lưu đơn hàng

```bash
npx wrangler d1 export mocha-orders --remote --output=sao-luu-$(date +%F).sql
```

Hằng tuần. D1 có bản sao của Cloudflare, nhưng một lệnh `DELETE` gõ nhầm thì bản
sao đó cũng chép theo.

### C6. Khi có bộ ảnh đúng đặc tả

Đổi bước "Ảnh khớp đặc tả" trong `.github/workflows/ci.yml` từ
`npm run check:assets` sang `node scripts/check-assets.mjs --strict`, để chất
lượng ảnh không trôi trở lại.

---

## D. Những gì KHÔNG cần làm

- **Không** cài Google Tag Manager (xem C3).
- **Không** thêm `aggregateRating` hay `review` vào JSON-LD khi chưa có hệ thống
  đánh giá thật kiểm chứng được. Đánh dấu sao bịa là vi phạm chính sách Google,
  không phải mẹo tăng tỉ lệ nhấp. Có một phép đo trong `npm run test:seo` giữ
  cho quyết định này không bị đảo ngược.
- **Không** tạo bản sao landing để chạy quảng cáo bằng cách nhân file. Dùng
  trường `canonicalOf` — biến thể sẽ tự `noindex` và canonical trỏ về trang gốc.
- **Không** sửa `docs/truong-du-lieu.md`, `docs/bao-cao-seo.md` hay
  `docs/anh-can-co.md` bằng tay: cả ba đều sinh tự động.
