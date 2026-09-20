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

## B. Danh tính và uy tín

- `[ ] B1` Khối "Đại lý chính hãng" nói rõ: ai vận hành site, lấy hàng từ đâu,
  ai chịu trách nhiệm công bố sản phẩm. Đặt ở chân trang + trang giới thiệu.
- `[ ] B2` `sameAs` cho `Organization` — hiện **0**. Nối fanpage, gian hàng,
  hồ sơ Google Business. Đây là tín hiệu gốc để Google và trợ lý AI xác nhận
  thực thể. Cần chủ site cung cấp danh sách URL.
- `[ ] B3` Khối nhà cung cấp nguyên liệu (BASF, CHEMICO, AGC, AvantChem,
  MahaChem) và báo chí đã đưa tin (VTV Online, Sức khoẻ & Đời sống, Emdep,
  SaoStar, Tiền Phong). Logo có sẵn trong bản cào.
- `[ ] B4` Khối chứng từ (TÜV SÜD + phiếu công bố) — chờ `A6`.

## C. Trực quan và kể chuyện

Chủ site yêu cầu: ảnh marketing chính hãng **kết hợp** UI hiện đại, mạch kể
rõ ràng, và cân nhắc tâm lý hành vi — màu sắc, tương quan ảnh/nền, ảnh/chữ.

- `[ ] C1` Mạch kể chuẩn cho trang landing sản phẩm, áp cho mọi sản phẩm:
  vấn đề → vì sao cách cũ không ăn → cơ chế → bằng chứng → cách dùng →
  ai không nên dùng → giá và cam kết → biểu mẫu.
  Thứ tự này đặt phần trung thực nhất ("ai không nên dùng") ngay trước lúc
  xin thông tin — đó là chỗ nó tăng tỉ lệ chốt chứ không làm giảm.
- `[ ] C2` Sơ đồ SVG inline: cơ chế nhiều tầng, lộ trình sáng/tối, mốc thời
  gian theo loại nám. Tự đổi màu theo theme, không phụ thuộc ảnh chụp.
- `[ ] C3` Dải ảnh chính hãng đúng chỗ trong mạch kể (infographic thành phần,
  routine sáng/tối, ảnh chất kem). Quy tắc: ảnh có chữ in đè **không** nằm cạnh
  chữ của trang — để nó đứng riêng thành một chặng.
- `[ ] C4` Bảng so sánh chọn sản phẩm theo loại da / loại nám / ngân sách.
  Đây là dạng nội dung trợ lý AI trích nhiều nhất.
- `[ ] C5` Rà bảng màu và tương phản: tối thiểu AA cho mọi cặp chữ/nền, kể cả
  chữ đặt trên ảnh. Đo bằng số, không bằng mắt.

## D. SEO và AI search

- `[ ] D1` Phát `HowTo` từ khối `steps` — hiện **không có**, dù mọi trang sản
  phẩm đều có khối hướng dẫn. Rich result và là dạng trợ lý AI hay trích.
- `[ ] D2` Trang chủ 678 từ là quá mỏng để đấu Google. Viết lại cho dày và có
  mạch, không nhồi từ khoá.
- `[ ] D3` `speakable` cho đoạn trả lời chính của mỗi trang.
- `[ ] D4` Cập nhật `llms.txt` theo các sản phẩm mới.
- `[ ] D5` Kiểm lại nội bộ: mọi trang sản phẩm phải tới được từ trang chủ trong
  ≤ 3 cú nhấp, và dòng sản phẩm phải dẫn sang bài tư vấn liên quan.

## E. Chuyển đổi

- `[ ] E1` Rà biểu mẫu: bỏ mọi trường không dùng tới. Mỗi trường thừa là một
  phần trăm rơi rụng.
- `[ ] E2` Trạng thái sau khi gửi phải nói rõ chuyện gì xảy ra tiếp theo và
  trong bao lâu — không chỉ "cảm ơn".
- `[ ] E3` Đo INP thật khi bấm CTA, mở FAQ, chọn gói.

## F. Nợ kỹ thuật

- `[ ] F1` `combo-nam` vượt ngân sách gzip 69B. Ba lối: chuyển
  `inlineStylesheets` sang `'auto'`, nâng ngưỡng, hoặc cắt byte thật. Chọn lối
  nào phải ghi lý do vào commit.
- `[ ] F2` Sản phẩm mới cần dòng sản phẩm mới (Bảo vệ da, Làm sạch, Phục hồi da,
  Chăm sóc da mụn, Treatment). Mỗi dòng cần nội dung biên tập thật, không phải
  chỉ danh sách — build sẽ chặn trang mỏng.

## G. Mười sản phẩm còn lại

Giá và mã vạch đã lấy từ cửa hàng chính hãng, chờ dựng trang:

| Giá bán | Sản phẩm |
|---|---|
| 550.000đ | Peel vi gai tảo biển |
| 335.000đ | Kem chống nắng UV-Block Sunscreen 7 màng lọc |
| 335.000đ | Kem dưỡng sáng Biovector |
| 285.000đ | Sữa rửa mặt Bio-Active Cleanser |
| 250.000đ | Collagen Peptide Cream |
| 235.000đ | Gel mù u Smart Target |
| 215.000đ | Smart Whitening (giảm thâm mụn) |
| 215.000đ | Tẩy trang Bio-Deep Detox & Rebalance |
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
