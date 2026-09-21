# Kế hoạch chuẩn hoá website — bản đang thi công

> File này là **sổ công việc** của đợt chuẩn hoá, không phải tài liệu kiến trúc.
> Kiến trúc xem [`kien-truc.md`](kien-truc.md). Việc còn thiếu ai cung cấp xem
> [`deploy.md`](deploy.md).
>
> Mỗi mục có trạng thái: `[ ]` chưa làm · `[~]` đang làm · `[x]` xong và đã đo ·
> `[!]` chặn, cần người thật quyết.

## Bối cảnh — đọc trước khi sửa bất cứ gì

**Chủ site là đại lý, không phải công ty gốc.** Chủ site đã xác nhận **được Mocha
uỷ quyền dùng pháp nhân của họ**, nên `legalName` / `taxId` / `address` giữ
nguyên là của Mocha. Hai hệ quả bắt buộc:

1. Phải có **văn bản uỷ quyền lưu lại**. Đây là thứ cơ quan quản lý và Google
   đều có thể hỏi tới. Không có văn bản thì mọi dòng khai pháp nhân bên dưới
   thành khai sai. → xem `[!] A0`.
2. Kênh liên hệ trên site (0367 848 918, gmail) **khác** kênh của trang chính
   hãng (1900 4498, cskh@mochavietnam.com). Khai pháp nhân của hãng nhưng đưa số
   của đại lý là chỗ khách và Google đều thấy vênh. Phải nói rõ quan hệ ngay
   trên trang. → xem `[ ] B1`.

**Mục tiêu của site** (chủ site nêu): không phải sàn TMĐT. Là nơi người ta ghé
đọc thông tin sản phẩm rồi **để lại thông tin mua hàng**. Mỗi sản phẩm có một
trang landing riêng, và chính trang landing đó là nơi kỳ vọng SEO tốt để **đấu
thầu Google Ads**.

Điều đó định hình mọi quyết định bên dưới: nội dung phải trả lời trọn câu hỏi
trước khi xin thông tin; biểu mẫu phải ngắn; tốc độ và mobile là điều kiện cần
để điểm chất lượng quảng cáo không tụt.

## Số đo mở đầu (bản build ngày bắt đầu đợt này)

| Trang | Số từ | Ảnh | SVG | Bảng |
|---|---|---|---|---|
| combo-nam | 2.297 | 5 | 0 | 1 |
| smart-brightening-cream | 1.413 | 2 | 0 | 1 |
| Trang chủ | 678 | 3 | 0 | 0 |
| nam-tham (dòng) | 1.050 | 4 | 0 | 0 |

Cổng tự động: `test:seo` 387/387 · `test:guards` đủ chuỗi · `budget` 12/12 ·
`astro check` 0 lỗi · 19 trang.

Nợ kỹ thuật đang đỏ: `dist/combo-nam/index.html` gzip **24.645B / 24.576B**.

---

## A. Chặn — cần người thật

- `[!] A0` **Văn bản uỷ quyền dùng pháp nhân Mocha.** Chủ site xác nhận có; cần
  lưu bản scan và ghi ngày hiệu lực. Không có thì phải đổi sang pháp nhân riêng.
- `[!] A1` **Số tiếp nhận phiếu công bố của serum (bản 2025).** Số 2024
  (`1458/24/CBMP-LA`) đã bị thay, không dùng. Kem đã có `1517/25/CBMP-LA`.
- `[!] A5` **Năm ảnh bắt buộc còn lại** — xem `anh-can-co.md`. Chủ site đã chốt
  **không hạ ngưỡng**, chờ ảnh gốc.
- `[!] A6` **Chứng từ có chữ ký giám đốc.** Phải che chữ ký và dấu cá nhân trước
  khi đăng lên trang công khai.
- `[!] A7` **Văn bản đồng ý cho 4 ảnh trước/sau.** Cổng build đang chặn đúng.
- `[!] A12` **Bao bì Smart Whitening in tuyên bố "DARK SPOTS DISAPPEAR IN JUST
  4 DAYS".** Đó là mốc thời gian tuyệt đối, mâu thuẫn với toàn bộ lập trường của
  site về kỳ vọng, và claims-guard chặn. Trang không bê câu đó sang. Nhưng chữ
  vẫn nằm trên vỏ hộp khách nhận được — cần Mocha biết, và cần thống nhất xem
  trang nói gì nếu khách hỏi tại sao hai nơi nói khác nhau.
- `[!] A11` **Tinh chất phục hồi B5 10ml — thiếu dữ liệu để dựng trang.** Trang
  sản phẩm chính hãng chỉ có xuất xứ, dung tích và hai dòng công dụng; không có
  bảng thành phần nào, và nhãn chai cũng chỉ đọc được "PRO-VITAMIN B5
  PERFECTION". Dựng một trang gần như trống trên site có nhận diện "công khai
  từng thành phần" thì tự mâu thuẫn. Cần bảng thành phần hoặc ảnh nhãn rõ hơn.
- `[!] A10` **Chỉ số PA của kem chống nắng UV-Block Plus.** Hai nguồn của chính
  hãng mâu thuẫn: trang sản phẩm ghi `SPF 50 PA+`, bốn tài liệu marketing ghi
  `SPF 50 PA++++`. Trang hiện để trống chỉ số PA và chỉ ghi SPF 50 (cả hai
  nguồn khớp). Cần đọc từ vỏ hộp thật rồi khai đúng một con số.
- `[!] A8` **Đăng ký Bộ Công Thương.** Bản cào có hồ sơ
  `online.gov.vn/Home/WebDetails/139375`, nhưng đó là đăng ký cho **tên miền
  mochavietnam.com**. Site này chạy tên miền khác, nên KHÔNG được gắn logo hay
  dẫn hồ sơ đó — phải đăng ký riêng cho tên miền đang dùng. Cần chủ site xác
  nhận tên miền cuối cùng rồi mới làm bước này.
- `[!] A9` **Zalo OA.** Bản cào có `zalo.me/4500053981574656766` (OA chính
  thức), trong khi site đang dùng `zalo.me/0367848918` (số cá nhân). Cần chủ
  site chọn kênh nào là kênh chính thức để khai nhất quán.

## B. Danh tính và uy tín

- `[x] B1` **Xem lại: đã có sẵn.** Chân trang mọi trang đang khai pháp nhân, mã
  số thuế 0317963313, địa chỉ, tổ chức công bố sản phẩm, số tiếp nhận phiếu công
  bố và bốn dòng cảnh báo. Không thiếu gì để thêm. Việc còn lại là văn bản uỷ
  quyền → `[!] A0`.
- `[x] B2` **Xong.** `sameAs` phát bốn hồ sơ chính thức, lấy từ chính trang tin
  tức báo chí của mochavietnam.com: Facebook, Instagram, TikTok, YouTube. Khai
  qua trường `profiles` trong schema `brand` nên đi qua đúng các hàng rào của
  footer. Hiện cả ở chân trang với `rel="me"`.
- `[!] B3` **Không dựng được — chuyển sang chặn.** Đã soát kỹ bản cào:
  * "Tin tức báo chí" trên mochavietnam.com **không phải báo ngoài đưa tin** mà
    là chuyên mục blog do chính thương hiệu viết. Toàn bộ ~40 bài đều nằm trên
    mochavietnam.com, không có URL bài báo nào của VTV / Sức khoẻ & Đời sống /
    Emdep / SaoStar / Tiền Phong.
  * Logo báo và logo nhà cung cấp (BASF, CHEMICO, AGC, AvantChem, MahaChem)
    chỉ xuất hiện dưới dạng **ảnh chụp nằm trong ảnh marketing**, không kèm
    chứng từ hay đường dẫn nào.
  Dựng khối "được báo chí đưa tin" hay "nguyên liệu từ BASF" từ chừng đó là
  tuyên bố không chống lưng được — đúng thứ mà mọi hàng rào của dự án này tồn
  tại để chặn, và là rủi ro chính sách thật khi chạy Google Ads.
  **Để mở khoá:** cần (a) đường dẫn bài báo thật, hoặc (b) chứng từ quan hệ
  cung ứng. Có một trong hai thì dựng được ngay.
- `[ ] B4` Khối chứng từ (TÜV SÜD + phiếu công bố) — chờ `A6`.

## C. Trực quan và kể chuyện

Chủ site yêu cầu: ảnh marketing chính hãng **kết hợp** UI hiện đại, mạch kể
rõ ràng, và cân nhắc tâm lý hành vi — màu sắc, tương quan ảnh/nền, ảnh/chữ.

- `[x] C1` **Xong.** Đã bổ sung chặng còn thiếu — khối "ai không nên dùng"
  (bốn trường hợp, chia hai mức: hỏi bác sĩ trước / nên cân nhắc lại) đặt ngay
  trước khối `order`.
  **Giữ nguyên vị trí khối `offer` ở đầu trang, có lý do:** mạch kể mẫu đặt giá
  ở gần cuối, nhưng cả trang được xây trên một giọng nói duy nhất là minh bạch.
  Giấu giá tới cuối thì mâu thuẫn với chính giọng đó, và với người đến từ quảng
  cáo thì giá là thứ họ tìm trước nhất.
- `[x] C2` **Xong.** Hai khối trực quan, cả hai dựng bằng CSS/HTML thuần chứ
  không SVG — nhẹ hơn, tự co theo khung, tự dùng token màu:
  * `timeline` — ba nhóm nám, ba khoảng thời gian đặt cạnh nhau. Số liệu ở
    dạng chữ trong `<dl>` là chính, biểu đồ mang `aria-hidden`.
  * `routine` — lộ trình sáng và tối, cho thấy bước chống nắng chỉ có ở cột
    sáng. Dấu sáng/tối phân biệt bằng hình (đĩa đặc / đĩa khuyết) chứ không chỉ
    bằng màu; bước bắt buộc có chữ "Bắt buộc" trong nội dung, không chỉ tô màu.
  Toàn site trước đó có **0 sơ đồ**.
- `[!] C3` **Không dựng được — chuyển sang chặn.** Đã soát lại toàn bộ 195 ảnh:
  * Mọi infographic chính hãng đều **in chữ tiếng Việt lên ảnh**. Site này song
    ngữ, nên chúng không đặt được lên trang `/en/`. Quan trọng hơn: chúng lặp
    lại đúng nội dung mà trang đã trình bày tốt hơn ở dạng chữ (bảng thành
    phần, khối `routine`) — và lặp lại dưới dạng ẢNH thì Google và trợ lý AI
    không đọc được.
  * Ảnh thật sự là ảnh chụp thì là **người mẫu stock phương Tây**, không phải
    ảnh của Mocha, lại đặt trong ngữ cảnh da mụn. Dùng chúng trên một trang nói
    "dành riêng cho làn da người Việt" là tự mâu thuẫn.
  Thứ trang cần là ảnh ở `[!] A5` — chất kem 16:9 và thao tác dùng 3:2. Chủ site
  đã chốt không hạ ngưỡng, nên mục này chờ ảnh gốc.
- `[x] C4` **Xong.** Bảng `compare` trên trang dòng, năm tiêu chí: gồm những
  gì, hợp với ai, chiếm mấy bước trong lộ trình, đã có bước chống nắng chưa,
  hoạt chất chính. Cột lấy từ `products`, giá render từ dữ liệu sản phẩm chứ
  không viết tay. Schema chặn lỗi trượt cột. Ghi chú cuối bảng nói rõ không cột
  nào "mạnh hơn" cột nào — thiếu câu đó thì bảng so sánh tự đẩy người đọc về
  cột đắt nhất.
- `[x] C5` **Xong — dựng thành cổng thường trực, không phải một lần rà.**
  `scripts/check-contrast.mjs` đọc hex thật từ tokens.css rồi tính lại 19 cặp
  đang dùng; đã nối vào `test:guards` và CI. Bắt được ngay hai lỗi do chính đêm
  nay tạo ra: nền dải mốc thời gian thứ ba 3,92:1 (trượt AA) và vạch trục
  1,86:1 (mờ tới mức vô dụng). Cả hai đã sửa.
  *Chưa canh được:* chữ đặt trên ảnh — việc đó cần render rồi lấy pixel. Hiện
  trang chưa có chỗ nào đặt chữ đè lên ảnh; ngày nào có thì phải bổ sung.

## D. SEO và AI search

- `[x] D0` **Phát hiện ngoài kế hoạch:** `seo-report.mjs` đếm số từ hiển thị
  nhưng chỉ bóc `<script>`, không bóc `<style>` — nên CSS nội tuyến được đếm là
  chữ và phép đo "nội dung hiển thị > 300 từ" **luôn xanh trên mọi trang kể từ
  ngày viết ra**. Việc chuyển CSS ra file rời làm lộ chuyện này. Đã sửa.
- `[x] D1b` Trang góc tư vấn từ 223 từ (vi) / 165 từ (en) lên 849 / 633 —
  thêm collection `guides` cho nội dung biên tập của chính trang hub.

- `[x] D1` **Xong.** `howToNode` trong `lib/schema.ts`, phát trên mọi trang có
  khối `steps`. Đã sửa lại ghi chú đầu module cho khớp lý do thật: khai không
  phải để lấy rich result (Google bỏ rồi) mà để máy đọc biết ranh giới từng bước.
- `[x] D2` **Xong.** Trang chủ 678 → 1.316 từ (vi), 552 → 1.053 (en). Ba mục
  viết theo việc khách phải làm: chọn đúng nhóm trước khi xem giá; đặt hàng ở
  đây thì chuyện gì xảy ra; và những điều chúng tôi không nói. Kèm FAQ 4 câu,
  phát FAQPage. Thêm trường `links` cho `proseSection` (href qua `safeUrl`) vì
  `richText` cố ý không cho thẻ `a` — dùng chung cho pages/lines/articles/guides.
- `[x] D3` **Quyết định KHÔNG làm.** Google chỉ hỗ trợ `speakable` trong phạm
  vi tin tức và vẫn ở dạng beta từ 2018. Khai trên trang mỹ phẩm là thêm byte
  vào JSON-LD mà không bên nào đọc. Việc đánh dấu ranh giới nội dung đã do
  FAQPage và HowTo đảm nhiệm.
- `[x] D4` **Không phải làm.** `llms.txt` tự sinh từ dữ liệu (`pages/llms.txt.ts`)
  nên đã có sẵn hai sản phẩm mới.
- `[x] D5` **Xong.** Thêm `relatedArticles` cho sản phẩm và khối "Đọc thêm
  trước khi quyết định". Trước đó liên kết chỉ một chiều — bài dẫn về sản phẩm,
  sản phẩm không dẫn ngược lại, nên trang đích quảng cáo là ngõ cụt. Đã nối hai
  chiều cho cả ba sản phẩm. Phần còn lại (trang mồ côi, độ sâu ≤3 cú nhấp) vốn
  đã được `test:seo` canh và đang xanh.

## E. Chuyển đổi

- `[x] E1` **Đã rà, không có gì để bỏ.** Địa chỉ chỉ bắt buộc khi chọn gói có
  giá (không bắt buộc với "tôi cần tư vấn"); ghi chú vốn tuỳ chọn; còn lại là
  họ tên, số điện thoại và ô đồng ý — cả ba đều cần để gọi xác nhận được.
- `[x] E2` **Xong.** Thông báo sau khi gửi trước đây dừng ở "sẽ gọi xác nhận
  trong 2 giờ". Thêm nốt phần còn lại: hàng đi 2–5 ngày, mở kiểm tra rồi mới
  trả tiền, và "chưa trừ tiền ở bước này".
- `[x] E3` **Xong — dựng thành cổng.** `tests/inp.mjs` chạy Chromium thật trên
  ba trang chính. Đo được: INP tệ nhất **24ms** (ngưỡng tốt của Google là
  200ms), 0 tác vụ dài trong lúc tương tác, processingTime 0ms ở mọi tương tác.
  Đã nối vào CI.

## F. Nợ kỹ thuật

- `[x] F1` **Xong — chọn `inlineStylesheets: 'auto'`.** Đo cả hai:
  `always` 19 trang = 318KB gzip HTML, trang nặng nhất 25.015B (vượt);
  `auto` = 152KB HTML + 9KB CSS = 161KB, nặng nhất 15.421B/24.576B (đạt).
  Tổng byte cả site giảm một nửa, và ngay cả lượt xem một trang cũng không tệ
  hơn. Lý do cũ đúng khi site có một trang landing, không còn đúng với 19 trang.
- `[x] F2` **Xong hai dòng:** "Bảo vệ da" (4 mục + FAQ + 1 sản phẩm) và
  "Làm sạch" (3 mục + bảng so sánh + FAQ + 2 sản phẩm).
  Thêm "Phục hồi da" (3 mục + bảng so sánh + FAQ + 2 sản phẩm).
  Thêm "Chăm sóc da mụn" và "Treatment". **Đủ sáu dòng, đóng mục này.**

## G. Sản phẩm còn lại (2)

> Đã xong: `uv-block-sunscreen` · `bio-active-cleanser` ·
> `bio-deep-detox-rebalance` · `biovector-brightening-cream` ·
> `collagen-peptide-cream` · `smart-target-acne-gel` ·
> `smart-whitening-turmergel` · `retinol-mixpeel-kit`.
>
> Còn lại: mặt nạ gel lạnh (195.000đ) và tinh chất B5 10ml (`[!] A11`).

Giá và mã vạch đã lấy từ cửa hàng chính hãng, chờ dựng trang:

| Giá bán | Sản phẩm |
|---|---|
| 200.000đ | Tinh chất B5 10ml |
| 195.000đ | Mặt nạ gel lạnh tế bào gốc |

## Nguồn tài nguyên

Bản cào trang chính hãng: `Q:\5_Project\mochavietnam.com`
— 14 trang sản phẩm thật dưới `mochavietnam.com/san-pham/`, 195 ảnh ≥800px
dưới `wp-content/uploads/`, trong đó có ảnh sản phẩm sạch nền trắng cho hầu hết
sản phẩm và bộ infographic chính hãng.

> ⚠️ Bản cào còn lẫn ảnh của hãng khác (Eucerin, Bioderma, CeraVe, Shiseido,
> Estée Lauder, La Roche-Posay, The Ordinary, Paula's Choice). **Không** được
> đưa bất kỳ ảnh nào trong số đó vào site.
