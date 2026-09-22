# PHASE 1 — Audit trước khi refactor

Đọc: `README.md`, `docs/kien-truc.md`, `docs/muc-tieu-va-tam-nhin.md`,
`src/content.config.ts` (~1.100 dòng schema), 15 block component, `tokens.css`
(446 dòng), `ProductLanding.astro`, `Picture.astro`, `lib/schema.ts`,
`scripts/{seo-report,check-budget,check-assets,check-contrast}.mjs`,
`functions/api/orders.ts`, 12 file sản phẩm, 6 file dòng.

Đo: `npm run build` (49 trang), `test:seo` (1021 phép đo), `test:guards`
(20 kịch bản API + 6 bộ hàng rào nội dung), `check-budget`, `check:assets`,
`astro check`.

---

## 0. Kết luận đặt lên đầu

**Khoảng 60% bản yêu cầu đã có sẵn trong hệ thống**, và có bằng chứng đo được.
Không nên làm lại những phần đó; làm lại là đi lùi.

| Mục trong bản yêu cầu | Trạng thái | Bằng chứng |
|---|---|---|
| §24 SEO là một phần kiến trúc | **Đã có** | 1021/1021 phép đo chạy trong CI |
| §25 AI search / server-rendered | **Đã có** | HTML tĩnh 100%, `llms.txt`, JSON-LD `@graph` |
| §27 Không dark pattern | **Đã có** | Không countdown, không "còn 3 sản phẩm" |
| §28 Ngân sách hiệu năng | **Đã có** | `check-budget.mjs` chặn trong CI |
| §36 Compliance | **Đã có** | `claims-guard` 135 ca, consent gate, `compliance` bắt buộc |
| §38 Analytics | **Đã có** | 6 sự kiện, `cta_id`, không hardcode ID, không GTM |
| §52 Không bịa dữ liệu | **Đã có** | Không `aggregateRating`, không `review` |
| §53 Không over-engineer | **Đã có** | 0 dependency runtime, 0 hydration |

Phần còn lại — và là phần chủ site đã chỉ ra bằng mắt thường — nằm ở **tầng thị
giác, tầng ảnh và tầng nội dung**, không nằm ở kiến trúc.

---

## 1. Đánh giá kiến trúc hiện tại

**Giữ nguyên.** Không có lý do kỹ thuật nào để đổi.

- Astro 7, xuất tĩnh, **0 JavaScript của framework**, 0 hydration.
- Một route `[...path].astro` phục vụ 4 tầng nội dung × 2 ngôn ngữ. Va chạm URL
  và va chạm `primaryKeyword` bị chặn **lúc build**.
- Nội dung là JSON + Zod. Gõ sai tên trường là build fail, có chỉ đích danh.
- Hàng rào chạy trong CI: giá, tuyên bố, dữ liệu cá nhân, XSS richtext, tương
  phản WCAG, INP, ngân sách trọng lượng, đặc tả ảnh.

Điểm mạnh hiếm: **phần lớn ràng buộc được thi hành bằng code chứ không bằng tài
liệu.** Đây là thứ cần bảo vệ trong suốt refactor.

---

## 2. Vấn đề UX

| # | Vấn đề | Bằng chứng |
|---|---|---|
| U1 | **Không có điều hướng trên di động** | `SiteHeader.astro`: `.nav { display: none }` dưới 860px, không có drawer. Dưới 860px chỉ còn hotline, nút Đặt mua và chân trang. |
| U2 | Mọi section cùng một nhịp | `tokens.css:258` — `section { padding-block: clamp(64px,7vw,112px) }`, một giá trị cho mọi loại khối. |
| U3 | Bề mặt gắn chết vào loại khối | `Ingredients`→paper, `Steps`→mist, `Routine`→bone… Hai trang khác nhau có **cùng một chuỗi màu nền**, vì màu do danh tính khối quyết định chứ không do vị trí. |
| U4 | Thẻ sản phẩm cao thấp lệch nhau | Ảnh có tỉ lệ từ 1:1 tới 1:2,1 nhưng lưới không có khung tỉ lệ. |
| U5 | Trang dòng mỏng ở phần trên | Dưới H1 là ngay lưới sản phẩm; người đến từ quảng cáo không có gì để định vị. |
| U6 | Mục "Về Mocha" trong yêu cầu chưa tồn tại | Chỉ có khối `about` trong trang chủ, không có trang riêng. |

---

## 3. Vấn đề thị giác

| # | Vấn đề | Bằng chứng |
|---|---|---|
| V1 | **Ảnh không được chỉ đạo** | `Picture.astro` không có khung tỉ lệ, không `object-position`, không điểm nhấn theo từng ảnh. Cắt ở đâu là do CSS của khối, không do nội dung ảnh. |
| V2 | Ảnh lệch tỉ lệ nghiêm trọng | 1:1 (8 file), 4:3 (combo), 3:4 (serum, uv-block), **1:2,1** (`smart-white-plus` 900×1890). Đặt cùng một lưới thì hoặc viền đen hoặc cắt mất phần lớn sản phẩm. |
| V3 | Ảnh hero dưới đặc tả | `packshot-combo.webp` 1002×762; đặc tả đòi 1600×1200. Phóng to trên màn hình lớn là phóng to pixel. |
| V4 | Mỗi sản phẩm chỉ có **một** ảnh | 12 packshot / 12 sản phẩm. Không texture, không ứng dụng, không lifestyle, không cận cảnh. §12 (10 loại ảnh/sản phẩm) **không thể thực hiện bằng code**. |
| V5 | 11/17 ảnh không thuộc vị trí nào | `check:assets`: các packshot được thêm dần mà không khai slot, nên **không ảnh nào trong số đó được kiểm**. |

> Hệ tokens **không** phải vấn đề. Nó đã cố ý tránh đúng những thứ bản yêu cầu
> cấm: không gradient, không glassmorphism, bo góc 2–3px, `--shadow-1: none`,
> tương phản đo bằng công thức WCAG chứ không chọn bằng mắt. Sửa nó là đi lùi.

---

## 4. Vấn đề chuyển đổi

| # | Vấn đề |
|---|---|
| C1 | **10/12 landing thiếu toàn bộ phần thuyết phục.** `combo-nam` 13 khối; `smart-brightening-cream` 8; mười trang còn lại 5–6 khối, đều đúng một chuỗi `hero,ingredients,steps,order,faq`. Chúng nhảy từ "cái này là gì" sang "trong đó có gì". |
| C2 | Không có khối sản phẩm liên quan. Cuối trang là FAQ rồi chân trang — ngõ cụt. `relatedArticles` có, `relatedProducts` không. |
| C3 | CTA giữa trang không đổi theo ngữ cảnh: mọi nút đều là "Đặt hàng", kể cả ngay sau bảng thành phần, nơi câu hỏi tiếp theo là "dùng thế nào". |
| C4 | Không có khối so sánh ở tầng sản phẩm (chỉ có ở tầng dòng). Người đọc landing riêng lẻ không tự so được. |

---

## 5. Vấn đề SEO

Rất ít. 1021/1021 phép đo đạt. Ba điểm còn lại:

| # | Vấn đề |
|---|---|
| S1 | 10 landing mỏng (~6,5KB JSON) đấu cùng cụm truy vấn với trang dòng. Cổng `primaryKeyword` chỉ chặn được khi trùng **nguyên văn**. |
| S2 | Chưa có `Product.aggregateRating` — **đúng**, giữ nguyên cho tới khi có hệ thống review thật. |
| S3 | `sameAs` của Organization phụ thuộc A9 (Zalo OA chưa chốt). |

---

## 6. Vấn đề hiệu năng

Tất cả trong ngân sách, nhưng **một chỉ số gần chạm trần**:

| Chỉ số | Hiện tại | Trần | Còn |
|---|---|---|---|
| JS nội tuyến / trang sản phẩm | **7.989B** | 8.192B | **203B** |
| HTML gzip (combo-nam) | 18.344B | 24.576B | 6.232B |
| Một lượt tải (nam-tham) | 367KB | 700KB | 333KB |

**Đây là ràng buộc cứng lên §7 và §31.** Một drawer điều hướng di động viết bằng
JS sẽ vượt trần ngay. Phương án: drawer thuần CSS — 0 byte JS.

---

## 7. Vấn đề kiến trúc nội dung

| # | Vấn đề |
|---|---|
| A1 | 15 khối hiện có; bản yêu cầu liệt kê 25. Thiếu thật sự: `RelatedProducts`, `Comparison` ở tầng sản phẩm, `FinalCTA`, `Guarantee`. Các khối còn lại **trùng chức năng** với khối đã có (`ExpectedResults`≈`timeline`, `HowToUse`≈`steps`+`routine`, `IngredientGrid`≈`ingredients`). Không tạo khối mới chỉ để khớp tên trong danh sách. |
| A2 | `Texture`, `Lifestyle`, `ProductHighlight`, `Creator/KOL` **bị chặn bởi tài nguyên**, không bởi code. Tạo component rỗng lúc này là tạo nợ. |
| A3 | Bề mặt và khoảng cách section không phải là dữ liệu — không khai được trong JSON, nên không dựng được nhịp thị giác riêng cho từng trang. |
| A4 | Product schema chưa có `skinConcerns`, `skinTypes`, `relatedProducts`. Ba trường này phục vụ cả UI (gợi ý), SEO (thuộc tính thực thể) và quảng cáo (khớp intent). |

---

## 8. Design system đề xuất

**Không viết lại `tokens.css`.** Bổ sung bốn nhóm token còn thiếu:

```
/* Nhịp section — thay cho MỘT giá trị padding dùng chung */
--space-section-sm / -md / -lg / -xl

/* Khung tỉ lệ ảnh — để lưới không còn phụ thuộc tỉ lệ file gốc */
--ratio-pack: 1/1;  --ratio-hero: 4/5;  --ratio-wide: 16/9;  --ratio-card: 4/3;

/* Trạng thái ngữ nghĩa còn thiếu (đã có verify/amber, thiếu error) */
--error / --error-soft

/* z-index thành thang, thay cho số rời rạc 50/60 nằm trong component */
--z-header: 50; --z-sticky: 60; --z-panel: 70;
```

Palette giữ nguyên: navy `--ink-navy`, cobalt `--cobalt`, giấy
`--paper`/`--bone`/`--vellum`. Đây đã đúng là "warm white / cool gray / muted
blue" mà bản yêu cầu mô tả.

---

## 9. Kiến trúc khối mới

Ba việc, theo thứ tự:

1. **Bề mặt và nhịp thành dữ liệu.** Thêm `surface?` và `space?` (tuỳ chọn) vào
   mọi khối trong schema. Mặc định giữ nguyên hành vi hôm nay, nên không trang
   nào đổi cho tới khi người biên tập chủ động khai. Đây là chìa khoá cho §45.
2. **Hai khối mới, có lý do rõ**: `relatedProducts` và `compare` (tầng sản phẩm).

   Ban đầu định ba, có cả `finalCta`. Đã dựng rồi gỡ: nó không có chỗ nào dùng
   được mà không trùng lặp. Trên trang sản phẩm thì biểu mẫu đặt hàng, hotline
   trong khối `order` và thanh CTA cố định đã phủ hết đường liên hệ — thêm một
   lời mời nữa là spam đúng nghĩa. Còn chỗ nó THỰC SỰ có ích (trang dòng, bài
   viết, trang chủ) thì lại không dùng hệ thống khối. Đây là đúng thứ chính bản
   yêu cầu cấm: dựng component khi chưa có chỗ dùng.
3. **Không tạo** `Texture`, `Lifestyle`, `KOL`, `BeforeAfter` cho tới khi có ảnh.

---

## 10. Cấu trúc landing sản phẩm mới

```
hero            Đây là gì, cho ai, giá bao nhiêu       [ảnh hero, CTA đôi]
problem         Vì sao thứ bạn thử trước không ăn thua
cards           Bạn thuộc trường hợp nào (gồm cả "chưa phải lúc")
ingredients     Trong đó có gì, tỉ lệ bao nhiêu        -> CTA "Xem cách dùng"
timeline        Bao lâu thì thấy                       [nếu có căn cứ]
routine         Đặt vào đâu trong ngày
steps           Dùng thế nào cho đúng
compare         So với lựa chọn khác                   [mới]
testimonials    Ai đã dùng                             [chặn bởi consent]
offer/order     Mua thế nào, rủi ro gì                 -> CTA "Đặt hàng"
faq             Còn gì chưa hỏi
relatedProducts Bước tiếp theo                         [mới]
```

Không bắt mọi sản phẩm đủ 12 khối. Khối nào không có dữ liệu thì bỏ, không dựng rỗng.

---

## 11. Tài nguyên cần bổ sung

Đây là **nút thắt lớn nhất** của toàn bộ bản refactor. `check:assets` hiện báo
**1/9 vị trí đạt**.

| Cần | Tỉ lệ | Tối thiểu | Dùng ở | Mức |
|---|---|---|---|---|
| `packshot-combo` chụp lại | 4:3 | 1600×1200 | Hero, thẻ, og:image | **Bắt buộc** |
| `nam_01/02/03` chụp lại | 4:3 | 800×600 | Khối ba loại nám | **Bắt buộc** |
| 11 packshot: khai slot + chuẩn hoá 1:1 | 1:1 | 1400×1400 | Hero, thẻ mọi sản phẩm | **Bắt buộc** |
| `texture-*` (12 ảnh) | 3:2 | 1200×800 | Khối kết cấu | Nên có |
| `ung-dung-*` (12 ảnh) | 4:5 | 1000×1250 | Khối cách dùng | Nên có |
| `thuong-hieu` | 16:9 | 1920×1080 | Trang chủ, Về Mocha | Nên có |
| Ảnh KOL / UGC có quyền dùng | — | — | Social proof | Tuỳ chọn |

**Không tự tạo ảnh sản phẩm.** Thiếu thì để khối không dựng, và ghi ở mục A của
`docs/ke-hoach-chuan-hoa.md`.

---

## 12. Kế hoạch theo file

Mỗi giai đoạn: sửa → `build` → `test:seo` → `test:guards` → `astro check` → commit.

| Giai đoạn | Việc | File |
|---|---|---|
| **P1** | Điều hướng di động, 0 byte JS | `SiteHeader.astro`, `i18n/ui.ts` |
| **P2** | Khung tỉ lệ + điểm nhấn cho ảnh | `Picture.astro`, `content.config.ts` (`image.ratio`, `image.focus`), các khối dùng ảnh |
| **P3** | Khai slot cho 11 packshot | `src/data/_anh-can-co.json`, `docs/anh-can-co.md` |
| **P4** | Nhịp + bề mặt thành dữ liệu | `tokens.css`, `Section.astro`, `content.config.ts`, 15 block |
| **P5** | Ba khối mới | `blocks/RelatedProducts.astro`, `blocks/Compare.astro`, `blocks/FinalCta.astro`, `ProductLanding.astro`, schema, `docs/truong-du-lieu.md` |
| **P6** | **10 landing còn lại** — phần nặng nhất | `src/content/products/*/{vi,en}.json` |
| **P7** | Trang "Về Mocha" | `src/content/policies/ve-mocha/*` |
| **P8** | Trang chủ: khối hoạt chất, vấn đề/giải pháp | `src/content/pages/home/*`, `HomePage.astro` |
| **P9** | Đo lại: budget, INP, contrast, responsive 375→1920 | `tests/inp.mjs`, `check-budget`, `check-contrast` |

**Rủi ro đã biết:** trần JS còn 203B (P1 phải thuần CSS); P4 chạm 15 component
nên phải mặc định giữ nguyên hành vi; P6 dài nhất và phụ thuộc dữ liệu thật từ
bản cào — thiếu gì ghi vào mục A, không bịa.
