# Báo cáo refactor — theo mẫu §54 của bản yêu cầu

Kỳ báo cáo: từ `dccd506` (hợp nhất nền tảng đa sản phẩm) tới nay.
**85 file thay đổi, +5.425 / −172 dòng.** Chín giai đoạn trong
[`docs/audit-refactor.md`](audit-refactor.md) đã đóng.

---

## FILES ADDED

| File | Việc |
|---|---|
| `docs/audit-refactor.md` | Audit PHASE 1 — 12 mục đầu ra bản yêu cầu đòi trước khi code |
| `docs/giong-van.md` | Sáu lỗi "thuần AI" và mạch chuẩn 9 khối của một landing |
| `docs/bao-cao-refactor.md` | File này |
| `src/lib/base.ts` | Tiền tố đường dẫn con, cho bản xem thử |
| `src/components/blocks/RelatedProducts.astro` | Bước tiếp theo ở cuối landing |
| `src/components/blocks/FinalCta.astro` | Lời mời cuối, không hứa thêm gì |
| `src/content/policies/lien-he/{vi,en}.json` | Trang Liên hệ |
| `src/content/policies/ve-mocha/{vi,en}.json` | Trang Về Mocha |
| `.github/workflows/deploy-pages.yml` | Bản xem thử GitHub Pages |

## FILES CHANGED (nhóm chính)

- `src/components/SiteHeader.astro` — điều hướng ba mục + bảng danh mục + ngăn kéo di động
- `src/components/Picture.astro` — khung tỉ lệ, `fit`, điểm cắt theo từng ảnh
- `src/components/Section.astro` — thang nhịp `space`, cờ `sameSurface`
- `src/layouts/ProductLanding.astro` — nhịp tính theo mạch truyện, hai khối mới
- `src/content.config.ts` — `navLabel`, `order`, `topLevel`, `focus`, `rhythmFields`, ba khối mới
- `src/styles/tokens.css` — ba nhịp section thay cho một
- 24 file nội dung sản phẩm (12 × 2 ngôn ngữ), 12 file dòng, 2 file trang chủ

## FILES REMOVED

Không có. Không hệ thống nào bị gỡ.

---

## FEATURES CHANGED

| Trước | Sau |
|---|---|
| 8 mục điều hướng phẳng, xếp theo bảng chữ cái slug | 3 mục có thứ bậc: Sản phẩm ▾ · Tư vấn · Liên hệ |
| Dưới 860px **không có điều hướng nào** | Ngăn kéo `<details>`, 0 byte JS |
| Không có trang Liên hệ, không có trang Về Mocha | Có, cả hai ngôn ngữ |
| Chiều cao thẻ sản phẩm do tỉ lệ file gốc quyết định | Khung 4:3 chung, `object-fit: contain` |
| Một điểm cắt ảnh hero cho mọi sản phẩm | Điểm cắt khai theo từng ảnh (`focus`) |
| Bề mặt gắn chết vào **loại** khối | Bề mặt và nhịp theo **mạch truyện** và **vị trí** |
| Cuối landing là ngõ cụt | `relatedProducts` + `compare` ở tầng sản phẩm |
| 10/12 landing có 5–6 khối | 12/12 có ≥10 khối, cả hai ngôn ngữ (124 khối tiếng Việt) |

## SEO CHANGES

- **1.021 → 1.059 phép đo, 0 lỗi.** Tăng do 2 trang mới × các phép đo mỗi trang.
- 46 → 51 trang trong sitemap.
- Liên kết nội bộ tăng mạnh: bảng danh mục (17 liên kết trên mọi trang), khối
  `relatedProducts` (3 liên kết/landing), khối `compare`, 7 liên kết mới ở trang chủ.
- Ba lỗi thật bị cổng bắt và đã sửa: `llms.txt` dẫn URL sai của trang ở gốc;
  trang Về Mocha mồ côi; hai meta description 165 ký tự.
- **Không thêm** `aggregateRating` hay `review` — giữ nguyên cho tới khi có hệ
  thống review thật.

## PERFORMANCE CHANGES

| Chỉ số | Trước | Sau | Trần |
|---|---|---|---|
| JS nội tuyến / trang sản phẩm | 7.971B | 7.981B | 8.192B |
| HTML gzip (combo-nam) | 18.344B | ~18.6KB | 24.576B |
| Một lượt tải (nam-tham) | 367KB | trong ngân sách | 700KB |
| INP `/combo-nam/` | — | **24ms** (p75 24ms) | 150ms |
| INP `/nam-tham/`, `/` | — | **32ms** | 150ms |
| Tác vụ dài | — | không có | — |

Ngăn kéo di động thêm **0 byte JavaScript** — dùng `<details>`, vì trần chỉ còn
221 byte lúc bắt đầu.

## DESIGN CHANGES

- **Không viết lại `tokens.css`.** Hệ tokens đã cố ý tránh đúng những thứ bản
  yêu cầu cấm (không gradient, không glassmorphism, bo góc 2–3px,
  `--shadow-1: none`, tương phản đo bằng công thức WCAG). Chỉ bổ sung thang nhịp.
- Nhịp thị giác gom thành bốn mạch: kể chuyện (bone) → dẫn chứng (paper) →
  hướng dẫn (mist) → quyết định (navy). Hai khối cùng mạch dính thành một cụm
  (`0/40px`), chuyển mạch giãn ra (`88px`).
- Tương phản: 19/19 cặp đạt WCAG AA, không đổi.

## CONTENT / ASSET GAPS

**Nội dung:** không còn. 12/12 sản phẩm đủ mạch ở cả hai ngôn ngữ.

**Tài nguyên — đây là nút thắt còn lại:**

| Mã | Việc | Ai làm |
|---|---|---|
| `A15` | Ảnh hero bị cắt 44% chiều ngang. Cần bản chụp dọc 4:5 ≥1600×2000, **hoặc** quyết định đổi bố cục hero | Chủ site |
| `A16` | Hero tràn 7px ở màn hình rộng do `100vw` tính cả thanh cuộn. Sửa cùng lúc với A15 | Chủ site quyết hướng |
| — | 9/11 ảnh sản phẩm dưới ngưỡng 1200px | Chụp lại |
| — | `packshot-combo` 1002×762, đặc tả đòi 1600×1200 | Chụp lại |
| — | `nam_01/02/03` dưới ngưỡng và sai tỉ lệ | Chụp lại |
| — | Chưa có ảnh texture, ứng dụng, lifestyle (§12 bản yêu cầu) | Chụp mới |

**Không tạo** `Texture`, `Lifestyle`, `KOL`, `BeforeAfter` — chúng bị chặn bởi
tài nguyên chứ không bởi code, và dựng component rỗng lúc này là tạo nợ.

## TEST RESULTS

```
npm run build        51 trang, 0 lỗi
npm run test:seo     1059/1059 phép đo, 0 lỗi
npm run test:guards  20/20 kịch bản API + 6 bộ hàng rào nội dung
npm run test:inp     6/6 phép đo (INP 24–32ms / trần 200ms)
npm run test:contrast 19/19 cặp đạt WCAG AA
check-budget.mjs     trong ngân sách
npx astro check      0 lỗi, 0 cảnh báo
```

## REMAINING RISKS

1. **Ảnh là rủi ro lớn nhất.** `check:assets` báo 3/20 vị trí đạt. Trang đã
   dựng tốt nhất có thể với bộ ảnh hiện có, nhưng chất lượng thị giác của một
   website mỹ phẩm bị chặn trần ở đó.
2. **Trần JS còn 211 byte.** Bất kỳ tính năng tương tác mới nào cũng phải thuần
   CSS, hoặc phải nâng trần có chủ ý.
3. **Hai câu hỏi chưa có trả lời**: bộ ảnh (chụp lại hay dùng nguyên), và trần JS.
4. **Bản xem thử GitHub Pages chưa bật** (`A14`) — cần vào Settings → Pages →
   Source: GitHub Actions một lần.
5. **Số liệu còn thiếu từ hãng**: số tiếp nhận phiếu công bố của một số sản
   phẩm, và chỉ số PA của kem chống nắng (`A1`, `A10`). Trang hiện nói thẳng là
   chưa có thay vì im lặng — đó là cách xử lý đúng, nhưng vẫn là dữ liệu thiếu.

## MỘT LƯU Ý VỀ CÁCH KIỂM TRA

Ảnh chụp màn hình trong phiên này không đáng tin: khi cửa sổ trình duyệt bị
che, `requestAnimationFrame` không chạy nên transition của hiệu ứng cuộn đóng
băng ở `opacity: 0` và ảnh chụp ra trắng. Mọi khẳng định về bố cục trong báo
cáo này đo bằng `getComputedStyle` và `getBoundingClientRect`, không bằng mắt
nhìn ảnh chụp.
