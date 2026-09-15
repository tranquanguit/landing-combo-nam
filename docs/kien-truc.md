# Kiến trúc nền tảng landing page Mocha

Tài liệu này trả lời ba câu hỏi: **trang được tổ chức thế nào**, **tại sao nó
tốt cho SEO**, và **dữ liệu khách hàng đi về đâu**. Mọi con số trong đây đều
đo được lại bằng lệnh ghi kèm.

---

## 1. Hình dạng tổng thể

Đây **không phải một trang landing**. Đây là một bộ sinh trang bốn tầng: nội
dung nằm trong file JSON, mã nguồn chỉ là khuôn. Thêm một sản phẩm, một dòng
hay một bài viết = thêm một file JSON, không đụng vào một dòng `.astro` nào.

### Bốn tầng, mỗi tầng một ý định tìm kiếm

| Tầng | URL | Ai tới đây, và họ gõ gì |
| --- | --- | --- |
| **Trang chủ** | `/` | "mocha", "kem nám mocha" — đã biết thương hiệu |
| **Dòng sản phẩm** | `/nam-tham/` | "kem dưỡng da nám nên chọn loại nào" — **chưa biết thương hiệu, khối lượng lớn nhất** |
| **Landing sản phẩm** | `/combo-nam/` | "combo nám mocha giá bao nhiêu" — sẵn sàng mua |
| **Góc tư vấn** | `/goc-tu-van/nam-noi-tiet-la-gi/` | "nám nội tiết là gì" — chưa mua, và **là nơi AI trích dẫn** |

Điểm dễ bị bỏ qua: **tầng dòng sản phẩm gánh phần truy vấn lớn nhất.** Người gõ
"kem trị nám loại nào tốt" chưa biết Mocha là ai; họ sẽ không tìm thấy landing.
Trang dòng bắt họ, giải thích, rồi mới đẩy xuống landing.

```
src/content/pages/home/<locale>.json        ← trang chủ
src/content/lines/<slug>/<locale>.json      ← dòng sản phẩm
src/content/products/<slug>/<locale>.json   ← landing sản phẩm
src/content/articles/<slug>/<locale>.json   ← bài tư vấn
src/data/mocha.json                         ← thông tin thương hiệu dùng chung
        │
        ▼  content collections + Zod (src/content.config.ts)
src/lib/routes.ts  ← MỘT nơi biết URL của mọi trang; allRoutes() liệt kê tất cả
        │
        ▼
src/pages/[...path].astro   ← một route bắt tất cả, tự phân nhánh theo loại
        │
        ├── HomePage.astro     ├── LinePage.astro
        ├── ProductLanding.astro (10 khối) └── ArticlePage.astro / AdviceIndex.astro
        ▼
dist/  (11 trang)  + sitemap + robots.txt + llms.txt
```

### Vì sao một route chứ không bốn

Dòng sản phẩm và sản phẩm nằm **cùng cấp URL** (`/nam-tham/` và `/combo-nam/`).
Bốn route riêng thì hai `getStaticPaths` có thể cùng đòi `/nam-tham/` và Astro
chọn một cái — im lặng. Ở đây mọi đường dẫn đi qua `allRoutes()`, nên cổng build
nhìn thấy va chạm ngay và dừng lại kèm tên hai trang đang tranh nhau.

### Khối là một discriminated union

Mỗi phần tử trong `blocks[]` của landing có trường `type`, và Zod chọn schema
tương ứng. Một sản phẩm có thể bỏ hẳn phần "Thành phần" và thêm hai "Gallery",
chỉ bằng cách sửa mảng — khai sai tên khối hay thiếu trường bắt buộc thì **build
thất bại**, không phải trang lỗi lúc chạy.

### Liên kết nội bộ sinh từ quan hệ dữ liệu

Sản phẩm khai `line: "nam-tham"`; bài viết khai `relatedLine` và
`relatedProducts`. Từ đó site tự dựng: điều hướng đầu trang, breadcrumb ba bậc,
danh sách sản phẩm trong trang dòng, khối "bài viết liên quan", khối "sản phẩm
được nhắc tới". **Không có liên kết nào đặt tay.** Đây là 70% giá trị SEO của
một site nhiều trang, và cũng là thứ hỏng đầu tiên khi người ta đặt tay.

### Ngôn ngữ và URL

| Thị trường | URL | `lang` |
| --- | --- | --- |
| Việt Nam (chính) | `https://mochatrinam.com/` | `vi-VN` |
| Quốc tế | `https://mochatrinam.com/en/` | `en` |
| Thái Lan, Indonesia | `/th/`, `/id/` — cấu hình sẵn, chưa có nội dung | |

`prefixDefaultLocale: false` nên tiếng Việt nằm ở gốc miền. `trailingSlash:
'always'` giữ **một dạng URL duy nhất**, để canonical, hreflang và sitemap không
bao giờ lệch nhau một dấu gạch chéo. Đoạn đường dẫn của chuyên mục tư vấn được
**dịch** (`/goc-tu-van/` ↔ `/en/advice/`): URL là nội dung, và người đọc tiếng
Anh gặp `/en/goc-tu-van/` thì không đọc được nó nói gì.

Xem `docs/them-san-pham.md` để biết quy trình thêm nội dung và
`docs/truong-du-lieu.md` cho bảng trường (sinh tự động từ schema bằng
`npm run docs:fields`, nên không thể lệch với mã).

## 2. Tại sao tốt cho SEO — và bằng chứng

Câu trả lời không nằm ở một danh sách mẹo. Nó nằm ở bốn quyết định kiến trúc,
và một báo cáo chạy lại được.

### 2.1 Tĩnh hoàn toàn

Astro ở chế độ tĩnh mặc định — không có `output: 'server'`. Không server, không hydrate, không framework UI. Bot nhận
HTML đã có đầy đủ chữ ngay ở phản hồi đầu tiên — không phụ thuộc vào việc
Googlebot có chịu chạy JavaScript hay không, và các bot AI (phần lớn **không**
chạy JavaScript) đọc được toàn bộ nội dung.

Đo: 11 trang, mọi trang đều trên 300 từ hiển thị (landing sản phẩm ~2.000 từ,
bài tư vấn ~900 từ), JS nội tuyến **7.172 byte** trên ngân sách 8.192 byte.

### 2.2 Dữ liệu có cấu trúc sinh từ chính dữ liệu bán hàng

`src/lib/schema.ts` dựng JSON-LD từ cùng một file JSON dựng ra trang. Nên giá
trong `Offer` **không thể** lệch với giá hiển thị — và báo cáo SEO còn kiểm lại
điều đó một lần nữa.

Kiểu khai theo từng loại trang — không rải `Product` lên mọi trang:

| Trang | JSON-LD |
| --- | --- |
| Trang chủ | `Organization`, `WebSite`, `WebPage` |
| Dòng sản phẩm | `CollectionPage`, **`ItemList`**, `BreadcrumbList`, `FAQPage` |
| Landing sản phẩm | `Product`, `Offer` ×3, `Brand`, `MerchantReturnPolicy`, `OfferShippingDetails`, `FAQPage`, `BreadcrumbList` |
| Bài tư vấn | `Article`, `WebPage`, `BreadcrumbList`, `FAQPage` |

`ItemList` trên trang dòng là thứ phân biệt một trang danh mục thật với một
trang giới thiệu có gắn vài liên kết. `Article` khai `author` là **pháp nhân**,
không phải một tên người bịa ra cho có vẻ chuyên gia — một tên không kiểm chứng
được thì tệ hơn là không khai tên.

**Không khai `aggregateRating` và không khai `review`.** Đây là lựa chọn có
chủ ý: Mocha chưa có hệ thống đánh giá kiểm chứng được, và đánh dấu sao bịa là
vi phạm chính sách Google, không phải mẹo tăng CTR. Có một phép đo trong báo
cáo giữ cho quyết định này không bị ai lặng lẽ đảo ngược.

### 2.3 Đa ngôn ngữ đúng chuẩn, đối xứng hai chiều

Mỗi trang khai `hreflang` cho mọi bản dịch **và cho chính nó**, cộng
`x-default`. Sitemap lặp lại quan hệ đó bằng `xhtml:link`. Thiếu chiều về là
lỗi Google bỏ qua cả cụm — nên báo cáo kiểm tính đối xứng trên toàn site, chứ
không kiểm từng trang một.

`lastmod` trong sitemap lấy từ **ngày commit cuối của chính file JSON nội
dung**, không phải ngày build. Dùng ngày build thì mỗi lần deploy lại báo "vừa
cập nhật" cho những trang không đổi gì, và tín hiệu đó mất giá trị.

### 2.4 Dành riêng cho tìm kiếm bằng AI (GEO)

- `public/robots.txt` cho phép tường minh 15 tác tử AI (GPTBot, OAI-SearchBot,
  ClaudeBot, PerplexityBot, Google-Extended, Applebot-Extended, CCBot…). Mặc
  định "cứ để `User-agent: *`" là mặc định thua, vì vài tác tử chỉ đọc nhóm
  mang tên mình.
- `src/pages/llms.txt.ts` sinh `/llms.txt` **từ dữ liệu**, song ngữ: tóm tắt
  sản phẩm, nồng độ hoạt chất, giá, chính sách, kèm miễn trừ mỹ phẩm. Sinh từ
  dữ liệu chứ không viết tay, nên không bao giờ nói khác trang.
- Toàn bộ FAQ nằm trong HTML (`<details>` mở được bằng bàn phím), không nạp
  bằng JS — bot đọc được câu trả lời.

### 2.5 Hiệu năng (Core Web Vitals)

| Phép đo | Điều kiện | Kết quả |
| --- | --- | --- |
| CLS | Chromium, viewport 390×844, ảnh trễ 400ms | **0,0000** trên cả 4 loại trang, cả VI và EN |
| Tương phản chữ | 10 trang × 2 bề ngang (390px, 1280px) | **0 lỗi** WCAG AA |
| HTML gzip | trang chủ | 20.880 B / ngân sách 24.576 B |
| Tổng một lượt tải | trang chủ | 324.226 B / ngân sách 716.800 B |
| Font | toàn bộ | 113.148 B / 122.880 B |

Cách đạt được: CSS nội tuyến hết (`inlineStylesheets: 'always'` — tiết kiệm
một vòng request trên 4G Việt Nam); font subset Việt/Latin tách riêng, preload
sáu face dùng above-the-fold; ảnh đi qua `astro:assets` sinh AVIF/WebP
kèm `srcset` và **luôn có `width`/`height`** nên không có khoảng nhảy; font
dự phòng được chỉnh metric để hoán đổi không đẩy chữ.

Không có Google Tag Manager. Mã đo lường **chỉ nạp sau khi khách bấm đồng ý** —
nên với khách chưa đồng ý, chi phí là 0 byte bên thứ ba.

### 2.6 Bằng chứng: `npm run test:seo`

```bash
npm run build && npm run test:seo     # 223 phép đo, thoát 1 nếu có lỗi
npm run docs:seo                      # ghi docs/bao-cao-seo.md
```

Kịch bản này đọc **`dist/` đã build**, không đọc mã nguồn và không tin tài
liệu. Kết quả hiện tại: `docs/bao-cao-seo.md` — **223/223 đạt** trên 11 trang.

Ba phép đo quan trọng nhất từ khi site có nhiều tầng, và không phép nào kiểm
được bằng cách đọc từng file:

- **Trang mồ côi** — trang không ai trỏ tới thì gần như không được thu thập, dù
  có trong sitemap. Chính phép đo này phát hiện tầng Góc tư vấn được dựng xong
  mà không có chỗ nào trỏ tới; điều hướng chính ra đời từ đó.
- **Độ sâu tối đa 3 cú nhấp** từ trang chủ của **từng ngôn ngữ** — bản tiếng Anh
  không được phép chỉ tới được qua bộ chuyển ngôn ngữ.
- **Mọi trang dẫn được sang nơi bán hàng** — một bài viết cụt là một bài đọc
  xong rồi thoát.

Quan trọng hơn con số: báo cáo đã được **kiểm tra ngược bằng đột biến**. Mười
lỗi thật được cố tình tiêm vào bản build, cả mười đều bị bắt:

| Lỗi tiêm vào | Bắt được |
| --- | --- |
| canonical trỏ sang miền khác | ✅ |
| bỏ hreflang chiều về ở trang EN | ✅ |
| thêm `aggregateRating` bịa | ✅ |
| bỏ `alt` của một ảnh | ✅ |
| giá JSON-LD lệch giá trên trang | ✅ |
| thêm `<h1>` thứ hai | ✅ |
| neo `#dat-hang` trỏ vào id không tồn tại | ✅ |
| `Disallow: /` trong robots.txt | ✅ |
| bỏ một URL khỏi sitemap | ✅ |
| trang 404 bỏ `noindex` | ✅ |

CI chạy cả hai chiều: một bước đòi báo cáo xanh, một bước **cố tình làm hỏng
canonical rồi đòi báo cáo phải đỏ đúng vì canonical**. Một cổng không bao giờ
fail được thì không phải là cổng.

---

## 3. Dữ liệu đi về đâu

Trang là file tĩnh trên CDN. Nhưng đơn hàng thì phải nằm ở đâu đó — và nó nằm
trong **Cloudflare D1**, một cơ sở dữ liệu SQLite chạy ngay cạnh trang.

```
Biểu mẫu #order-form
   │  fetch() POST JSON
   ▼
POST /api/orders            functions/api/orders.ts
   │  kiểm tra → chống bấm hai lần → ghi
   ▼
D1 (SQLite)  bảng orders    migrations/0001_orders.sql
   ▲
   │  Bearer token
/admin  ←  GET/PATCH /api/admin/orders
```

### 3.1 Vì sao cùng tên miền, không phải dịch vụ ngoài

Biểu mẫu gửi bằng `fetch()`. Endpoint ở tên miền khác thì **phải** có mặt trong
`connect-src` của CSP, và một vòng kiểm định trước đã mất 100% đơn hàng đúng vì
chỗ đó. `/api/orders` cùng gốc thì `'self'` đã đủ: không CORS, không preflight,
không có gì để quên khi đổi tên miền.

### 3.2 Lưu gì, và cố tình không lưu gì

| Nhóm | Cột | Ghi chú |
| --- | --- | --- |
| Đơn | `order_code`, `created_at`, `product_slug`, `locale`, `pack`, `pack_price` | `order_code` dạng `MC-260914-A7K3`, bỏ ký tự dễ nghe nhầm để đọc qua hotline |
| Khách | `name`, `phone`, `address`, `country`, `note` | `phone` chuẩn hoá về `0xxxxxxxxx` — `+84`, `84`, có dấu chấm đều gộp về một |
| Đồng ý | `data_consent`, `consent_text` | **Đúng câu khách đã đọc**, không phải một cờ true/false |
| Nguồn | `utm_*`, `referrer_host` | Về chiến dịch, không về người. Chỉ lưu tên miền, không lưu URL đầy đủ |
| Vận hành | `status`, `staff_note`, `updated_at` | 6 trạng thái, ràng buộc bằng `CHECK` ở cấp cơ sở dữ liệu |

**Không lưu:** IP thô, User-Agent, cookie quảng cáo, mã khách của bên thứ ba.
Chống spam dùng IP đã **băm SHA-256 với muối** rồi cắt còn 16 ký tự, trong bảng
riêng tự hết hạn — đủ để đếm, không đủ để truy ngược ra một người. Không có
`IP_SALT` thì bỏ qua hẳn việc đếm, chứ không băm bằng muối rỗng (muối rỗng cho
ra bảng băm tra ngược được, tức là lưu IP mà tưởng đã ẩn danh).

`consent_text` là cột quan trọng nhất về mặt pháp lý. Nghị định 13/2023/NĐ-CP
đòi chứng minh được khách đã đồng ý **với điều gì**; một cờ `true` không chứng
minh được điều đó, nhất là sau này khi câu chữ trên trang đã đổi.

### 3.3 Những gì không thể xảy ra

Mỗi dòng dưới đây là một phép thử chạy trong CI, không phải một lời hứa:

- Không tick ô đồng ý → **không có dòng nào vào cơ sở dữ liệu** (và `CHECK
  (data_consent = 1)` chặn lần thứ hai ngay ở cấp bảng, kể cả khi có ai ghi
  thẳng vào D1 sau này)
- Bấm nút hai lần → **một đơn**, trả lại cùng mã đơn
- Phản hồi lỗi **không mang tên, số điện thoại hay địa chỉ** khách vừa gõ — log
  của Cloudflare không phải nơi dữ liệu cá nhân đi qua
- Website khác POST vào `/api/orders` → **403**
- Chèn SQL trong tên khách → lưu nguyên văn thành một chuỗi, bảng còn nguyên
- Gửi dồn dập từ một IP → **429**
- Ô CSV bắt đầu bằng `=` `+` `-` `@` → vô hiệu hoá trước khi xuất, để mở bằng
  Excel không thành công thức

### 3.4 Ai đọc được

`/admin` — một trang HTML, không framework, không build. Token nhập một lần và
chỉ nằm trong `sessionStorage` của tab đang mở; đóng tab là mất. Trang **rỗng**
cho tới khi token được máy chủ chấp nhận, nên mở được URL cũng không thấy gì.

- `ADMIN_TOKEN` chưa đặt (hoặc ngắn dưới 24 ký tự) → API trả **503, khoá hẳn**,
  không phải mở toang
- So sánh token trong thời gian không đổi
- Mọi phản hồi mang `X-Robots-Tag: noindex` và `Cache-Control: no-store`
- `/admin` và `/api/` cũng bị chặn trong `robots.txt` — lớp thứ hai, vì
  robots.txt là đề nghị chứ không phải khoá
- Nội dung khách gõ luôn đi qua `textContent`, không bao giờ qua `innerHTML`

Chín kịch bản trên trang này được đi thử bằng trình duyệt thật trong CI, gồm cả
"tên khách chứa `<b>` phải hiện nguyên văn" và "token không rơi vào
localStorage hay cookie".

### 3.5 Đo lường → chỉ sau khi đồng ý

- Trước khi khách trả lời: **không** nạp GA4, Meta Pixel, TikTok Pixel. Không
  một byte bên thứ ba.
- Quyết định lưu trong `localStorage` khoá `mocha_analytics_consent`, **trên
  máy khách**, không gửi đi đâu.
- Sự kiện nội bộ `mocha:lead` chỉ mang `{ pack }`. Không tên, không số điện
  thoại, không địa chỉ. Có phép thử tự động khẳng định đúng điều này — vì "chắc
  là không gửi PII đâu" không phải một phép đo.

### 3.6 Ảnh khách hàng và lời chứng

Thư mục `src/media-gated/` chứa 4 ảnh **chưa** có văn bản đồng ý bằng văn bản
của khách. Chúng **không** vào bản build: `scripts/check-budget.mjs` kiểm và
fail nếu một trong số đó lọt ra `dist/`. Khi Mocha có văn bản đồng ý, chuyển
file sang `src/assets/` và bật khối.

### 3.7 Còn phải quyết

- **Thời hạn lưu.** Hiện chưa có cơ chế xoá tự động. Cần chốt: giữ đơn bao lâu
  sau khi giao xong (đề xuất 24 tháng cho nghĩa vụ kế toán), rồi thêm một
  Routine xoá theo lịch.
- **Quyền xoá của khách.** Câu đồng ý đã hứa "có thể yêu cầu xoá bất cứ lúc
  nào". Hiện phải xoá tay bằng `wrangler d1 execute`; nên có nút trên `/admin`.

## 4. Cổng lúc build: điều gì không thể lọt qua

Kiến trúc này đặt cược vào một ý: **quy tắc nào quan trọng thì phải là cổng,
không phải tài liệu.** 535 ca kiểm thử chia bốn tầng:

| Tầng | Hỏi gì | Tệp |
| --- | --- | --- |
| Nội dung | Nội dung thật có vi phạm không | `claims-guard`, `money-guard`, `personal-data` |
| Lint mẫu | Bản thân hàng rào còn là hàng rào không | `pattern-lint` |
| Cổng schema | Dây nối đã nối chưa | `schema-gate` |
| Nguồn khác | Các nguồn chữ khác có được canh không | `ui-strings`, `brand-gate`, `budget-gate` |

Những gì làm **dừng build**:

- **Tuyên bố cấm** (17 quy tắc): "trị nám", "hết nám", "cấp phép FDA"… Mỹ phẩm
  ở Việt Nam không được nói như thuốc (Thông tư 06/2011/TT-BYT). Bộ lọc xử lý
  được cả tiếng Việt không dấu và thực thể HTML — vì lách được bằng
  `&#116;rị` thì không phải hàng rào.
- **Hình ảnh và tên bác sĩ, cơ sở y tế** — Nghị định 342/2025/NĐ-CP.
- **Giá viết cứng trong câu chữ**: phải dùng `{{price}}`, `{{compareAtPrice}}`,
  `{{save}}`. Một lần sửa giá trong JSON là mọi chỗ đổi theo; không có cách nào
  để trang nói hai giá khác nhau.
- **Dữ liệu cá nhân** trong nội dung không nằm trong khối đã có đồng ý.
- **Ngân sách trang** vượt hạn mức.
- **`availability` khác `InStock`**, slug sai định dạng, trùng id neo, neo
  `#...` trỏ vào khối không tồn tại, thiếu bản dịch, `.strict()` trên ~32 đối
  tượng nên gõ sai tên trường là dừng ngay.
- **Hai trang cùng đòi một URL** — dòng sản phẩm và sản phẩm nằm cùng cấp nên
  slug phải khác nhau trên toàn site, không chỉ trong cùng collection.
- **Hai trang cùng khai một `primaryKeyword`** — hai trang nhắm một truy vấn thì
  Google chọn một, và thường chọn trang có tỉ lệ chuyển đổi thấp hơn. Đây là lỗi
  không thấy được khi đọc từng file, chỉ thấy khi nhìn cả site cùng lúc.
- **Biến thể quảng cáo (`canonicalOf`) trỏ canonical vào trang không tồn tại** —
  nó sẽ tự loại mình khỏi chỉ mục mà không chuyển tín hiệu đi đâu cả.
- **Trang dòng rỗng** (không sản phẩm, không nội dung) và **bài viết dưới 350 từ**
  — nội dung mỏng kéo theo cả những trang khác.
- **Hạn ưu đãi đã qua** — trang tĩnh đã deploy sẽ tiếp tục hiện ưu đãi cũ cho
  tới lần deploy kế, nên đây là chuông báo có người phải nghe.

Chất lượng của bộ kiểm thử được đo bằng **kiểm thử đột biến**, không bằng số
ca. Chính phương pháp đó đã phát hiện `src/data/mocha.json` và `src/i18n/ui.ts`
hoàn toàn **không có hàng rào nào** suốt mười hai vòng đọc mã — nên có
`brand-gate` và `ui-strings` hôm nay.

---

## 5. Triển khai

Trang là file tĩnh; `functions/` chạy trên Cloudflare Pages Functions và cần D1.

```bash
# một lần, lúc dựng
npx wrangler d1 create mocha-orders           # dán database_id vào wrangler.toml
npm run db:migrate                            # tạo bảng orders + rate_limit
npx wrangler pages secret put ADMIN_TOKEN     # chuỗi ngẫu nhiên >= 32 ký tự
npx wrangler pages secret put IP_SALT         # chuỗi ngẫu nhiên, không đổi về sau

# mỗi lần deploy
PUBLIC_ORDER_ENDPOINT=/api/orders npm run build
npx wrangler pages deploy dist
```

Chưa đặt `PUBLIC_ORDER_ENDPOINT` thì biểu mẫu **không render thẻ `<form>`** và
hiện hotline thay thế — một đơn hàng rơi vào hư không tệ hơn nhiều so với một
nút không hoạt động.

`public/_headers` đi kèm bản build và **là file trong repo** — CSP, HSTS,
`Permissions-Policy`, `X-Content-Type-Options`, cache bất biến cho tài nguyên
có hash. Bảy vòng kiểm định trước ghi "nên bật CSP ở phía hosting" mà không ai
bật được, vì không ai biết nó nằm ở đâu. Nay nó nằm ở đây.

**Chưa chạy thử trên Cloudflare thật.** Toàn bộ phần máy chủ được kiểm bằng
SQLite thật và trình duyệt thật trong Node, nhưng lần deploy đầu tiên lên
Cloudflare vẫn cần đi lại một lượt đặt thử đơn — cấu hình binding và secret là
thứ chỉ sai được ở đúng nơi đó.

## 6. Chạy lại mọi con số trong tài liệu này

```bash
npm ci
npm run build          # dựng dist/
npm run check          # 0 lỗi kiểu
npm run test:guards    # 535 ca hàng rào
npm run test:seo       # 223 phép đo SEO trên bản build
npm run test:order     # 9 kịch bản đặt hàng trong trình duyệt thật
npm run test:orders-api # 20 kịch bản API đơn hàng trên SQLite thật
npm run test:admin     # 9 kịch bản trang quản trị trong trình duyệt thật
node scripts/check-budget.mjs
```
