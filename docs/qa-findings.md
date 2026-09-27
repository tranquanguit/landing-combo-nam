# Phát hiện QA còn mở — và những phát hiện đã BÁC BỎ

Ghi bằng tay sau vòng QA khép kín chạy trên browser thật (Chromium, dist build).
Mục đích: không để một phát hiện nào rơi mất, và quan trọng hơn — **ghi lại
những thứ trông như lỗi nhưng không phải**, để người sau không "sửa" chúng.

Các issue đã đóng đủ chu trình nằm trong lịch sử commit, không lặp lại ở đây.

---

## 1. Còn mở — cần quyết định

### QA-01 · Câu báo hết hàng nằm sau các ô đã bị khoá — P2, tiềm ẩn

**Đo được:** đặt tạm một sản phẩm thành `availability: OutOfStock` và dựng lại.
Khối đặt hàng render đúng về mặt kỹ thuật — không có thẻ `<form>`, 9 ô bị khoá,
JSON-LD khai `OutOfStock`, có câu giải thích kèm hotline, và nút submit trỏ
`aria-describedby="form-sold-out"`.

**Vấn đề:** câu giải thích đứng **sau** toàn bộ các ô nhập. Người đọc gặp lời mời
"Điền thông tin đặt hàng…", rồi bảng giá, rồi một loạt ô xám — và chỉ biết lý do
ở cuối khối.

**Vì sao chưa sửa:** hiện **không sản phẩm nào** đang hết hàng. Đổi bố cục khối
đặt hàng lúc này là đặt 12 trang đang chạy vào rủi ro để đổi lấy lợi ích bằng 0.
Đây là quyết định thương mại (có nên bày trang hết hàng không, và bày thế nào),
không phải quyết định kỹ thuật.

**Cách tái hiện:**
```bash
# đặt availability = "OutOfStock" trong một file sản phẩm, rồi:
PUBLIC_ORDER_ENDPOINT=http://localhost:8132/orders npx astro build
grep -c 'form-sold-out' dist/<slug>/index.html   # phải > 0
```

### QA-02 · Hai trang dòng không có khối `#chon` — content gap

`lam-sach` và `cham-soc-da-mun` không có tiêu chí dạng "hợp với ai" trong bảng so
sánh (tiêu chí của chúng nói về chức năng và thứ tự dùng), nên khối chọn ở cuối
trang không render.

Đây là **hành vi đúng theo thiết kế**: khối chọn dựng TỪ dữ liệu bảng so sánh,
không viết lại bằng chữ mới. Thà thiếu một khối còn hơn dựng nó bằng chữ tự nghĩ
ra, rồi để nó lệch khỏi bảng sau lần sửa nội dung đầu tiên.

**Cần từ chủ doanh nghiệp:** một tiêu chí "hợp với ai" cho hai dòng này, với một
câu cho MỖI sản phẩm trong dòng. Thêm `"fit": true` vào tiêu chí đó là khối tự
hiện, không cần sửa mã.

---

## 2. Đã BÁC BỎ — đừng "sửa" những thứ này

Mỗi mục dưới đây từng trông như một lỗi. Đo lại thì không phải. Ghi ra để lần
sau không ai mất thời gian, hoặc tệ hơn, sửa một thứ đang đúng.

| Nghi vấn | Vì sao KHÔNG phải lỗi |
| --- | --- |
| Ảnh hero `naturalWidth` báo 389px cho ảnh đáng lẽ 960px | Nguồn 1002×762, 4 ứng viên srcset đúng kích thước thật, `sizes` đúng, trình duyệt chọn đúng theo DPR, file decode ra đủ 960×730. Là artifact của phép đo trên phần tử trong trang. |
| Console 404 trên `/404.html` | `favicon.svg` trả 200. Chỉ `favicon.ico` trả 404 — đó là probe mặc định của trình duyệt trên site chỉ có SVG favicon, có ở mọi trang. |
| Thanh CTA dính đáy che nút gửi đơn | Đo ở 390/430/360: không tái hiện. Thân trang đã chừa đệm đáy cho thanh này. |
| skip-link chỉ 1×1 ở 390px | Đo ngay sau `Tab` thì style `:focus` chưa áp. Chờ 200ms: 341×46 ở mọi khổ. |
| FAQ không mở bằng Enter | Selector bắt trúng `<summary>` của menu điều hướng. Với `#faq details summary` thì Enter đóng/mở đúng. |
| `drawer-panel` là phần tử fixed ở đáy trang dòng | Là ngăn điều hướng mobile **đang đóng** (`checkVisibility` = false), có trên mọi trang từ trước. Thanh CTA thật (`.sticky`) chỉ có trên trang sản phẩm — đúng thiết kế. |
| Form không gửi được (0 POST) | Mock API trong bộ kiểm thử thiếu nhánh `OPTIONS`; trình duyệt gửi preflight vì `Content-Type: application/json` và bị chặn ở CORS. Lỗi harness. |
| Mã đơn không hiện sau khi gửi | Hiện đúng (`codeHidden: false`). Lỗi ở cách assertion của bộ kiểm thử đọc DOM. |

### QA-03 · `test:inp` trượt khoảng 1/4 lần — KHÔNG phải regression

Phép đo "tác vụ dài" trượt không đều với một tác vụ ~120–130ms trên `/nam-tham/`.

Đã dựng lại build ở đúng commit **trước** các thay đổi QA và đo 6 lần: cũng
trượt, cùng dạng lỗi, cùng độ lớn (132ms). Đây là cổng flaky sẵn có, nặng hơn khi
máy đang chạy nhiều tiến trình trình duyệt.

**Không nới ngưỡng để làm nó xanh.** Nếu cần xử lý, hướng đúng là làm phép đo ổn
định (chạy nhiều lần lấy trung vị), không phải hạ chuẩn.

### QA-04 · Chỉ số "khớp ý định ở màn hình đầu" — CHỈ SỐ SAI, đã loại

Một phép đo thử nghiệm so từ vựng của `adContext.primaryNeed` với chữ trong màn
hình đầu. Nó chấm 25–33% cho bốn sản phẩm, trông như "màn hình đầu không xác nhận
đúng chỗ".

Đọc thẳng nội dung thì ngược lại:

| Ý định | Tiêu đề màn hình đầu | Chỉ số |
| --- | --- | --- |
| "Muốn biết chính xác trong hũ kem có gì trước khi bỏ tiền" | "Sản phẩm duy nhất ở đây công bố đủ cả 45 thành phần theo INCI" | 25% |
| "Mờ rồi lại đậm, muốn một lộ trình hai bước làm sẵn" | "Hai bước chăm sóc da nám, công thức công khai từng tỉ lệ" | 27% |

Cả hai trả lời gần như trọn vẹn ý định, bằng từ ngữ khác. Chỉ số đo **trùng từ
vựng**, không đo mức liên quan — và chạy theo nó nghĩa là viết lại tiêu đề tốt
thành tiêu đề nhồi từ khoá, đúng thứ nguyên tắc nội dung của dự án cấm.

**Kết luận: không sửa một chữ copy nào vì chỉ số này.** Ghi lại để không ai dựng
lại nó rồi hành động theo.

---

## 3. Những gì vòng QA này ĐÃ xác nhận là đúng

Đo bằng browser thật, không suy từ mã:

- **Giá nằm trong màn hình đầu ở 12/12 trang sản phẩm** (y ≈ 505–620 trên khung 844).
- **Lối tắt tới bằng chứng ngay màn hình đầu ở 12/12** — CTA phụ của hero trỏ
  thẳng tới bảng thành phần (hoặc tới phần chống chỉ định, với bộ peel).
- **Đường mua luôn sẵn** trên trang sản phẩm: thanh dính đáy hiện ở mọi mốc.
- **Chống bấm trùng hoạt động**: bấm gửi hai lần chỉ tạo một POST; nút khoá và
  đổi nhãn khi đang gửi.
- **Không bao giờ báo thành công giả**: lỗi 500 và mạng đứt đều báo thất bại kèm
  hotline, và gửi lại được.
- **Bàn phím sạch**: Tab đầu tiên vào skip-link, 64–65 phần tử focus được đều có
  vòng focus, vùng cuộn ngang focus được và có nhãn, form trống đẩy focus vào
  đúng trường lỗi.
- **0 tràn ngang** trên 19 route × 390px và × 1280px, và 128/128 phép đo của cổng
  đáp ứng (8 trang × 16 bề ngang).
- **Trang EN sạch**: 9/9 route, không tràn ngang, không console error.
