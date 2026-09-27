# Bằng chứng và lòng tin

Tài liệu này trả lời: **trang lấy gì ra để người đọc tin**, và **chuyện gì xảy
ra khi thứ đó chưa có**.

---

## 1. Nguyên tắc duy nhất

> Thiếu bằng chứng thì **im lặng**, không phải bịa.

Nền tảng này không tạo chứng nhận giả, không dựng thẻ chứng từ rỗng, không gắn
huy hiệu "đã xác minh" khi chưa xác minh, không viết lời chứng thay khách, và
không khai `aggregateRating` khi chưa có hệ thống đánh giá kiểm chứng được.

Khi dữ liệu thật chưa có, khối tương ứng **không render**. Trang im lặng về điều
nó không chứng minh được, thay vì nói to về điều nó không có. Chỗ trống được ghi
vào `docs/content-gaps.md` kèm đúng thứ cần để lấp.

Đây không phải lời hứa trong tài liệu: nó được **cưỡng chế bằng mã**, ở các chỗ
liệt kê bên dưới.

---

## 2. Bằng chứng có nhiều hạng, và hạng phải khai ra

Mỗi tuyên bố ở màn hình đầu phải nói nó dựa trên cái gì (`hero.usp[].evidence`):

| Hạng | Nghĩa | Schema bắt buộc |
| --- | --- | --- |
| `verified` | Có chứng từ kiểm chứng được | **phải** có `source` |
| `study` | Dựa trên nghiên cứu công bố | **phải** có `source` |
| `survey` | Khảo sát nội bộ | **phải** có `qualifier` nêu cỡ mẫu |
| `ingredient` | Suy ra từ bảng thành phần, không hứa kết quả | — |

Build **dừng** nếu khai `verified`/`study` mà không dẫn được nguồn, hoặc khai
`survey` mà không nêu cỡ mẫu. Lý do ghi thẳng trong schema: *"một con số khảo sát
không có mẫu số là một con số vô nghĩa."*

Trên trang, các hạng này hiện dưới dạng **cước chú** (¹ ² ³) dẫn xuống khối "Cơ
sở", theo đúng quy ước của một tài liệu có dẫn nguồn — không phải một dòng chữ
xám dưới mỗi gạch đầu dòng.

Với bảng thành phần còn một ràng buộc nữa: `referenceNote` phải ghi nồng độ mà
nghiên cứu được dẫn **thật sự đã thử nghiệm**, khi nó khác nồng độ trong sản
phẩm. Dẫn một nghiên cứu dùng 5% để chống lưng cho công thức 1% là dẫn nguồn gây
hiểu nhầm.

---

## 3. Bằng chứng nằm ở chỗ nó trả lời câu hỏi

Không dồn mọi thứ vào một khối "Uy tín" ở cuối trang. Bằng chứng đi theo câu
chuyện (xem `docs/story-architecture.md`):

| Khi trang nói… | Bằng chứng ở đó |
| --- | --- |
| "Bên trong có gì?" | bảng thành phần, nồng độ, `reference` + `referenceNote` |
| "Dựa vào đâu mà tin?" | khối `documents` — phiếu công bố, phiếu kiểm nghiệm |
| "Bao lâu thì thấy?" | khối `timeline` — số liệu vẫn ở dạng CHỮ dưới hình |
| "Dùng đúng thế nào?" | `routine`, `steps`, và cảnh báo bắt buộc |
| "Ai không nên dùng?" | khối vai `safety` |
| "Ai đang bán?" | `compliance` + chân trang, cùng một pháp nhân |
| "Có chuyện thì sao?" | chính sách đổi trả, vận chuyển, hotline |

---

## 4. Những chỗ mã CHẶN việc bịa

Đây là phần đáng đọc nhất, vì nó là thứ còn lại khi không ai nhớ tài liệu này.

### 4.1 Cổng đồng ý cho ảnh và lời chứng

`gallery` và `testimonials` **bắt buộc** có `consent`:

```json
"consent": { "obtained": false, "statement": "Chưa thu thập được văn bản đồng ý…" }
```

`obtained: false` → khối **không render**. Và schema còn đi xa hơn: neo trong
trang trỏ tới một khối đang bị ẩn sẽ làm **hỏng build**, vì neo đó không tồn tại
trên trang thật.

Hiện `combo-nam` có cả hai khối ở trạng thái `false`. Nghĩa là sản phẩm đắt nhất
đang chạy **không có một bằng chứng xã hội nào** — xem `CG-004`, `CG-005`.

### 4.2 Dữ liệu cá nhân chỉ được nằm trong khối có cổng đồng ý

Mọi chuỗi ngoài `gallery`/`testimonials` bị quét tìm tên + tuổi + nơi ở + số
điện thoại. Khối `problem` bị quét **chặt hơn**: câu trích ở đó phải ẩn danh,
nếu không chỉ cần đổi `type` là lách được cổng consent.

### 4.3 Lời chứng có tài trợ phải khai

`sponsored: boolean`, mặc định `false`, bắt buộc có mặt trong schema.

### 4.4 Tên pháp nhân không được lệch

`ProductLanding.astro` **ném lỗi lúc build** nếu
`compliance.declaringOrganization` khác `brand.legalName`. Tên pháp nhân là dữ
kiện pháp lý, không dịch theo ngôn ngữ.

### 4.5 Dữ liệu thương hiệu đi qua đúng những hàng rào mà sản phẩm phải đi qua

Collection `brand` bị quét claims + dữ liệu cá nhân + giá viết tay, **đệ quy**.
Nội dung của nó render ở chân trang **mọi** trang, trong `llms.txt` và trong
JSON-LD — nên nó là bề mặt rộng nhất của site, không phải một tệp cấu hình.

### 4.6 Structured data không khai thứ không có

Không `aggregateRating`, không `review`. Có một phép đo trong báo cáo SEO giữ
cho quyết định này **không bị ai lặng lẽ đảo ngược**.

### 4.7 Chính sách đổi trả trong markup phải khớp lời hứa trên trang

`returnPolicy` nhận **nhiều** mục vì các thị trường khác nhau có cửa sổ khác
nhau. Markup rộng hơn lời hứa thật là đúng loại rủi ro bị kiểm chéo.

---

## 5. Khối chứng từ — có sẵn, nhưng chưa có gì để hiện

Khối `documents` tồn tại trong schema và có component: ảnh mở được ở kích thước
đầy đủ để đọc số hiệu, kèm `reference` và `issuedBy`.

**Hiện không sản phẩm đã xuất bản nào dùng nó**, vì `src/assets/documents/` rỗng.
Cổng `tests/narrative.mjs` chặn việc khai một khối chứng từ không có mục nào —
nên không thể "dựng sẵn khung chờ ảnh".

Đây là khoảng trống lớn nhất còn lại của trang. Xem `CG-003`.

Số tiếp nhận phiếu công bố cũng thiếu ở **10 trên 12** sản phẩm (`CG-001`), và
hai sản phẩm đang dùng **chung một số** — có thể đúng, nhưng cần doanh nghiệp
xác nhận chứ không phải trang suy đoán (`CG-002`).

---

## 6. Ảnh cũng là nội dung

Chữ in trong ảnh là tuyên bố thật, và không được miễn trừ chỉ vì máy khó đọc.
`npm run check:assets` đối chiếu từng vị trí ảnh với đặc tả. Ảnh khách hàng chưa
có đồng ý nằm trong `src/media-gated/` — **ngoài** thư mục build, nên không thể
vô tình lọt lên bản phát hành.

---

## 7. Hai tầng, đừng nhầm

| | `claims-lexicon.ts` | `ad-safety.ts` |
| --- | --- | --- |
| Áp cho | **mọi** nội dung | chỉ bề mặt quảng cáo |
| Kết quả | chặn build | xếp loại + báo cáo |
| Vì sao | cấm tuyệt đối với mỹ phẩm | cần người quyết định |

Một câu hợp lệ trên website giáo dục vẫn có thể không dùng được trong một mẩu
quảng cáo. Bài "Nám nội tiết là gì" **phải** nói về nám. Nên siết một tầng duy
nhất là chặn nhầm hướng — chi tiết ở `docs/ad-readiness.md`.

Tầng quảng cáo **không bao giờ** kết luận "đã được duyệt". Mức cao nhất nó đưa
ra là *"sẵn sàng để người phụ trách soát"*.

---

## 8. Kiểm lại bằng lệnh

```bash
npm run test:guards      # claims, PII, giá, consent, schema
npm run test:narrative   # bằng chứng đứng trước chỗ quyết định
npm run check:ads        # bề mặt quảng cáo
npm run check:gaps       # còn thiếu gì, và cần gì để lấp
npm run check:assets     # ảnh so với đặc tả
```
