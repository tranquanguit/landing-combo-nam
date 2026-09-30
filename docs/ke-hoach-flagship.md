# Kế hoạch: đưa bản trình bày flagship ra toàn site + vùng chứng từ

Trạng thái: **ĐÃ THỰC HIỆN** 2026-09-30 (lập 2026-09-29). Mẫu chuẩn: `/combo-nam/`

> Kết quả và những chỗ lệch khỏi kế hoạch:
> - 12/12 sản phẩm (vi + en), trang chủ, 6 trang dòng dùng ngôn ngữ flagship; bản
>   `standard` đã gỡ (CSS của nó chặn render mọi trang — LCP 3 trang vượt 2,5s).
> - Nhận diện ảnh chụp/packshot bằng thuật toán đã thử và bỏ (sai ~20%); thay bằng
>   trường `image.backdrop`.
> - Vùng chứng từ: 11 phiếu công bố + 1 phiếu SPF đã đăng; phiếu kiểm nghiệm TÜV SÜD
>   và báo cáo Ellead KHÔNG đăng vì điều khoản cấm dùng trong quảng cáo — xem
>   [`chung-tu-cho-duyet.md`](chung-tu-cho-duyet.md).
> - Không gắn link tra cứu của Cục QLD: đường dẫn định dùng trả 404.
> - Thêm phần không có trong kế hoạch ban đầu: nhập liệu trên Postgres + Docker —
>   [`nhap-lieu.md`](nhap-lieu.md), [`trien-khai-docker.md`](trien-khai-docker.md).
(`presentation: "flagship"`, code ở `src/components/flagship/`).

Nguyên tắc không đổi trong suốt kế hoạch:

- Cùng dữ liệu, cùng thứ tự khối, cùng vai, cùng JSON-LD — chỉ đổi component dựng.
- Cái nào có số thì ghi số, không có thì bỏ số ra. Không bịa số, giấy tờ, lời chứng.
- Thiếu dữ liệu thật thì khối **tự ẩn trên production**, chỉ hiện ô vàng ở `dev`.
- Mỗi giai đoạn kết thúc bằng: build + `test:guards` + `test:seo` + `test:order`
  + `check:responsive` + `test:perf` + chụp màn hình desktop/mobile và nhìn.

---

## Hiện trạng đo được (2026-09-29)

| Sản phẩm | Kiểu truyện | Số công bố | Hoạt chất có nồng độ | includes |
|---|---|---|---|---|
| combo-nam | bundle | 1517/25/CBMP-LA | 12/12 | 2 + 2 quà — **đã xong** |
| smart-brightening-cream | comparison | 1517/25/CBMP-LA | 6/6 | – |
| smart-first-care-serum | comparison | **thiếu** | 6/6 | – |
| retinol-mixpeel-kit | education-led | **thiếu** | 1/5 | 4 |
| smart-whitening-turmergel | single-product | **thiếu** | 3/8 | – |
| smart-target-acne-gel | single-product | **thiếu** | 2/7 | – |
| biovector-brightening-cream | comparison | **thiếu** | 0/12 | – |
| collagen-peptide-cream | comparison | **thiếu** | 0/4 | – |
| uv-block-sunscreen | single-product | **thiếu** | 0/13 | – |
| bio-active-cleanser | education-led | **thiếu** | 0/8 | – |
| bio-deep-detox-rebalance | education-led | **thiếu** | 0/8 | – |
| ultra-egf-bio-gel-mask | education-led | **thiếu** | 0/8 | – |

`src/assets/documents/` trống: chưa có bản scan chứng từ nào.

---

## Giai đoạn 1 — Tổng quát hoá bộ flagship (nền cho 11 trang)

Bộ hiện tại được dựng quanh dữ liệu của combo. Phải chạy đúng với mọi dạng dữ liệu:

1. **Sân khấu hero tự chọn bố cục theo ảnh**, không theo tên sản phẩm:
   - lúc build lấy mẫu 4 góc ảnh bằng `sharp` → nền trắng = packshot (hoà `multiply`
     lên sân khấu), nền khác = ảnh chụp (đặt trong khung vòm);
   - 1 ảnh → một sản phẩm lớn giữa vòng quỹ đạo; ≥2 ảnh (`includes[].image`) → vòm + trước.
2. **Chip nồng độ có dạng "không số"**: sản phẩm không in nồng độ thì chip hiện tên
   hoạt chất chủ lực, không có ô số; bảng hoạt chất đổi số "12" lớn thành đếm hoạt chất
   và bỏ câu "cái nào có số thì ghi số" (câu đó chỉ đúng khi thật sự có số).
3. **`FCompare`** — bản flagship của khối so sánh (10 trang đang dùng): hai cột thẻ,
   cột đề xuất nổi, bảng cuộn được trên điện thoại mà không tràn trang.
4. **`FDocuments`** — xem Giai đoạn 2.
5. Khối timeline/steps/routine/cards đã chạy dữ liệu chung — chỉ kiểm lại với
   dữ liệu retinol (timeline) và các trang không có ảnh thẻ.
6. **Hiệu năng**: CSS flagship nằm trong bundle chung, 11 trang cùng dùng nên không
   tăng thêm; mở rộng `scripts/check-perf.mjs` đo **cả 12 trang sản phẩm** (hiện chỉ đo
   3 route) và chạy 3 lần lấy trung vị để bớt nhiễu. Mục tiêu LCP lạnh ≤ 2,4s.

## Giai đoạn 2 — Vùng chứng từ (giấy tờ tăng uy tín)

### Dữ liệu: collection `documents`, không khai theo từng trang

Một file JSON cho **mỗi giấy tờ** (`src/content/documents/<slug>.json`):

| Trường | Ý nghĩa |
|---|---|
| `kind` | `notification` (phiếu công bố) · `test-report` (phiếu kiểm nghiệm) · `gmp` (CGMP-ASEAN nhà máy) · `business` (ĐKKD) · `trademark` (bảo hộ nhãn hiệu) · `other` |
| `title`, `reference` | tên giấy + số hiệu in trên giấy |
| `issuedBy`, `issuedAt`, `validUntil?` | cơ quan cấp, ngày cấp, hạn (nếu có) |
| `appliesTo` | `"all"` hoặc danh sách slug sản phẩm |
| `pages` | ảnh từng trang (scan), `alt` bắt buộc |
| `findings?` | chỉ tiêu kiểm nghiệm đúng như in (vd. "Corticoid: không phát hiện") |
| `lookupUrl?` | trang tra cứu công khai của cơ quan cấp |

Trang sản phẩm **tự gom** giấy tờ theo `appliesTo` — giấy CGMP của nhà máy khai
một lần, hiện trên cả 12 trang. Đúng quy tắc "liên kết sinh từ quan hệ dữ liệu".

### Hiển thị

- **Khối `FDocuments`** đặt ngay sau bảng hoạt chất (vai `proof`, đứng trước đặt hàng
  — cổng narrative đã yêu cầu vậy): thẻ giấy tờ dạng tờ giấy có bóng, nhãn loại,
  số hiệu, cơ quan cấp, ngày cấp, và nút "Xem bản đầy đủ".
- **Xem bản đầy đủ không tốn JS** (ngân sách JS nội tuyến còn 147 byte): dùng
  `popover` gốc của HTML, ảnh độ phân giải đủ để **đọc được số hiệu**.
- Dải **"Số tiếp nhận phiếu công bố"** dạng chữ, kèm liên kết tra cứu — hiện kể cả khi
  chưa có bản scan, vì số đó đã có trong `compliance`.
- Hero: cước chú "có chứng từ trên trang" trỏ thẳng tới `#chung-tu` khi có giấy.
- **Trang tổng `/chung-nhan/`** (EN `/en/certificates/`): toàn bộ giấy tờ của Mocha,
  lọc theo sản phẩm; liên kết từ chân trang và từ trang "Về Mocha".
- Dấu chìm CSS "Hiển thị tại mochatrinam.com" trên ảnh giấy tờ để bản chụp màn hình
  khó bị tái dùng cho hàng giả.

### Hàng rào mới (build đỏ nếu vi phạm)

- `reference` của giấy `notification` phải **trùng** `compliance.productNotificationNumber`
  của mọi sản phẩm nó áp dụng.
- Giấy đã quá `validUntil` → ẩn khỏi trang + cảnh báo lúc build (cùng cách hạn ưu đãi).
- `findings` chỉ được dùng làm nguồn cho tuyên bố `verified` khi giấy thật sự có mặt;
  USP trỏ `#chung-tu` mà trang không có giấy nào → build dừng.
- Ảnh giấy tờ chưa có trong `src/assets/documents/` → không phát ra `dist/`.
- Không đăng giấy có số CMND/CCCD hay chữ ký cá nhân chưa che (Nghị định 13/2023)
  — kiểm bằng danh sách xác nhận `redacted: true` bắt buộc.

## Giai đoạn 3 — Chuyển 11 sản phẩm (vi + en)

Thứ tự theo độ sẵn dữ liệu và giá trị quảng cáo:

1. `smart-brightening-cream`, `smart-first-care-serum` (đủ số, cùng dòng nám với combo)
2. `retinol-mixpeel-kit` (có 4 `includes`, cần sân khấu nhiều món)
3. `smart-whitening-turmergel`, `smart-target-acne-gel` (có một phần số)
4. `biovector-brightening-cream`, `collagen-peptide-cream`, `uv-block-sunscreen`,
   `bio-active-cleanser`, `bio-deep-detox-rebalance`, `ultra-egf-bio-gel-mask`
   (không in số — dùng dạng "không số")

Mỗi trang: bật `presentation`, khai ảnh `includes` nếu là bộ, gắn giấy tờ, chụp
desktop + mobile, sửa đến khi nhìn đạt. Cập nhật `src/content/_template/vi.json`
để sản phẩm mới mặc định là flagship.

## Giai đoạn 4 — Các trang và chức năng còn lại

| Trang | Việc |
|---|---|
| Trang chủ | hero sân khấu thương hiệu (cùng ngôn ngữ với trang sản phẩm — đúng yêu cầu "hai trang quan trọng nhất không mở đầu bằng hai ngôn ngữ thị giác khác nhau"), dải tuyên ngôn nền đêm, lưới dòng sản phẩm, dải chứng từ thương hiệu |
| 6 trang dòng sản phẩm | hero dòng, thẻ sản phẩm kiểu khối "trong hộp có gì", khối chọn theo vấn đề |
| Góc tư vấn + bài viết | chữ đọc dài (giữ `--measure-prose`), sơ đồ minh hoạ, thẻ sản phẩm cuối bài |
| Chính sách, Liên hệ, Về Mocha | trang chữ gọn; Về Mocha thêm dải chứng từ + liên kết `/chung-nhan/` |
| 404 | trang lạc đường có lối về dòng nám và hotline |
| Header | sửa nút "Đặt mua" xuống 2 dòng ở 390px (lỗi có sẵn) |
| Footer | thêm liên kết trang chứng nhận |
| Thanh CTA dính đáy | bo tròn cùng hệ nút mới |
| Biểu mẫu đặt hàng | **chỉ đổi phần nhìn qua token**, không đụng logic (đã có `test:order`) |

Toàn bộ bản tiếng Anh đi cùng từng trang.

## Giai đoạn 5 — Kiểm định và bàn giao

- Chạy toàn bộ cổng như CI + `test:perf` (12 trang) + `test:inp`.
- Chụp mọi trang ở 390 / 768 / 1280, cả vi và en; nhìn từng khúc.
- Cập nhật `docs/them-san-pham.md`, `docs/anh-can-co.md` (thêm đặc tả ảnh chứng từ),
  `docs/truong-du-lieu.md` (sinh lại), README.

---

## Mocha cần cung cấp (không có thì vùng đó tự ẩn, không chặn tiến độ)

1. Số tiếp nhận phiếu công bố của 10 sản phẩm còn thiếu.
2. Bản scan phiếu công bố từng sản phẩm (PDF hoặc ảnh ≥ 1600px cạnh dài).
3. Phiếu kiểm nghiệm (tên phòng kiểm nghiệm, số phiếu, ngày, chỉ tiêu).
4. Giấy chứng nhận CGMP-ASEAN của nhà máy sản xuất, ĐKKD, giấy bảo hộ nhãn hiệu (nếu có).
5. Xác nhận đã che thông tin cá nhân trên các giấy tờ.
6. Ảnh packshot riêng cho các món trong bộ retinol (nếu muốn sân khấu nhiều món).

## Rủi ro

- **LCP**: combo-nam đang 2,28–2,50s lạnh. Thêm vùng chứng từ nằm dưới màn hình đầu
  nên không ảnh hưởng, nhưng phải đo lại từng trang.
- **Trang không có số và chưa có giấy tờ** sẽ kém ấn tượng hơn combo: đó là sự thật
  của dữ liệu, không bù bằng nội dung bịa.
- **URL tra cứu công bố** của cơ quan quản lý phải kiểm tra còn hoạt động trước khi gắn.
