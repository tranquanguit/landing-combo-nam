# Phản hồi của khách và ảnh tình trạng da

## Phản hồi của khách (khối "voices")

Mỗi lời chứng là một nội dung riêng ở **Nội dung → Phản hồi khách**. Trang sản phẩm tự lấy các
lời **đủ điều kiện** cho đúng sản phẩm đó, tối đa 6 lời. Không có lời nào đủ điều kiện thì khối
không hiện.

### Vì sao phải có văn bản đồng ý

Khi doanh nghiệp đăng lại lời của khách để bán hàng, đó là **quảng cáo dùng lời nói, chữ viết của
cá nhân**. Việc này cần chính người đó đồng ý (Luật Quảng cáo 2012, Điều 8 khoản 11), và tin nhắn
của khách là dữ liệu cá nhân (Nghị định 13/2023/NĐ-CP). Ảnh chụp màn hình chat trong Drive đại lý
**chưa phải** là đồng ý.

Vì vậy website chỉ hiện lời có `consent.status = "written"`, kèm ngày, cách lấy, phạm vi có
`website`, và chỗ lưu bằng chứng. Lời đang chờ hay bị từ chối thì không hiện trên website thật.

### Quy trình cho một lời chứng

1. **Chọn đoạn.** Lấy những câu tả **cảm giác khi dùng**: kết cấu, mùi, thấm nhanh, không bết,
   không cay mắt…, tức điều người mua tự kiểm được ngay lần đầu dùng. **Không** lấy câu hứa kết
   quả ("hết mụn", "trắng hẳn", "đỡ nám"), câu có số tiền, hay câu nói về công dụng sản phẩm chưa
   công bố. Trang quản trị chặn các từ cấm và số tiền, nhưng việc chọn đúng đoạn vẫn là của người
   biên tập.
2. **Gửi tin xin đồng ý** qua đúng kênh khách đã nhắn. Mẫu:

   > Dạ chị ơi, Mocha xin phép đăng lại đoạn chị nhắn: "…(trích nguyên văn)…" lên website
   > mochatrinam.com, phần phản hồi của khách. Mocha chỉ ghi "Chị T." (không ghi tên, không ghi
   > tài khoản, không đăng ảnh của chị), và sẽ gỡ ngay khi chị yêu cầu. Chị đồng ý thì nhắn giúp
   > em "Đồng ý" nha. Em cảm ơn chị!

3. **Lưu bằng chứng**: chụp tin trả lời "Đồng ý" kèm ngày, lưu vào thư mục nội bộ (không đưa lên
   website).
4. **Cập nhật lời chứng** trên trang quản trị:
   - **Đồng ý của khách**: *Đã có văn bản đồng ý*;
   - **Ngày đồng ý**;
   - trong ô JSON: `"method": "tin nhắn Messenger"`, `"scope": ["website"]`,
     `"evidence": "<đường dẫn ảnh chụp trong thư mục nội bộ>"`.

   Rồi bấm **Kiểm tra & lưu**, sau đó **Xuất bản**.
5. Khách **rút lại đồng ý**: đổi sang *Khách từ chối* rồi **Xuất bản**. Lời đó biến khỏi mọi trang.

### Quy tắc của mỗi lời chứng

| Trường | Quy tắc |
|---|---|
| `quote` | trích **nguyên văn**, giữ cả cách viết tắt; bỏ bớt đoạn thì đánh dấu `[…]` |
| `person.display` | chỉ xưng hô + chữ cái đầu: `Chị T.`, `Bạn V.` — trang chặn tên đầy đủ |
| `person.detail` | thông tin không định danh: `da dầu`, `dùng 1 tuần` |
| `productVersion` | khách dùng **bản cũ / bao bì cũ** thì PHẢI ghi, website in dòng "Phản hồi về phiên bản trước" |
| `channel`, `receivedAt` | kênh và ngày khách nhắn (nếu biết) |
| `sponsored` | khách được tặng quà / sản phẩm để nhận xét thì phải là `true` |
| `sourceNote` | chỗ để ảnh gốc, chỉ ghi nội bộ, không in ra trang |

Website **không chấm sao** và không tính điểm trung bình. Site không có hệ thống đánh giá của
người mua đã xác minh, nên một điểm số tính từ vài lời khen chọn lọc là con số gây hiểu nhầm, và
Google phạt dữ liệu đánh giá kiểu này.

### Sáu lời chứng mẫu hiện có

`src/content/testimonials/kcn-0*.json` chép từ ảnh chat trong Drive đại lý (*THÔNG TIN SET SHOP /
KEM CHỐNG NẮNG / FEEDBACK KHÁCH HÀNG*). Tất cả đang ở trạng thái **chờ đồng ý**. Hộp sản phẩm
trong ảnh là **bản cũ** "Mocha Derma UV-Block Sunscreen", nên `productVersion` đã ghi rõ.

### Xem trước khi chưa có đồng ý (bản demo)

```bash
PUBLIC_DEMO_CONTENT=1 npm run build
```

Bản này hiện cả lời đang chờ, mỗi thẻ dán nhãn **"Mẫu demo"**, và tự gắn `noindex`. Chỉ dùng để
duyệt bố cục trên máy, **không** dùng cho bản chạy thật hay bản xem thử công khai.

## Ảnh tình trạng da (khối "conditions")

- Nguồn: ảnh thiết kế của hãng trong Drive đại lý — *MỤN (5).jpg* (4 loại mụn) và *da 2.jpg*
  (các loại nám và thâm). Đã cắt **chỉ phần cận vùng da**, không có mắt hay khuôn mặt, nên không
  nhận ra được người. Ảnh nằm ở `src/assets/images/da-*.webp`.
- Đây là ảnh **minh hoạ tình trạng**, không phải ảnh trước/sau. Trường `caption` bắt buộc phải nói
  rõ điều đó ngay dưới lưới ảnh.
- Mỗi ô phải nói sản phẩm hợp tới đâu (`fit`: `yes` / `partial` / `no`). Nên có ít nhất một ô
  "không phải việc của sản phẩm này".
- **Không dùng**:
  - ảnh trước/sau kèm con số ("−85%", "90%", "2–4 tuần") khi không có nghiên cứu chống lưng;
  - ảnh có bác sĩ, nhân viên y tế (Nghị định 342/2025);
  - ảnh khuôn mặt của khách, KOC hay người nổi tiếng khi chưa có văn bản đồng ý cho chính website này.
- Ảnh tư liệu gốc chỉ khoảng 180–240px, nên được hiển thị ở kích thước vừa phải. Có ảnh chụp
  cận da độ phân giải cao hơn (từ hãng, có quyền dùng) thì thay vào cùng tên tệp là xong.

## Ảnh tình trạng da trong bài viết và trang dòng sản phẩm (trường `figure`)

Mỗi mục văn bản (`sections[]`) của bài tư vấn, trang dòng sản phẩm và trang hỏi đáp có thể có
thêm một dải ảnh ngay dưới thân bài:

```json
"figure": {
  "items": [
    { "src": "/images/da-nam-mang.webp", "alt": "Cận vùng da má có mảng nâu nhạt", "label": "Nám mảng" }
  ],
  "caption": "Ảnh cận vùng da để minh hoạ tình trạng, không phải ảnh trước/sau…"
}
```

- 1–6 ảnh, dùng chung bộ `src/assets/images/da-*.webp` với khối `conditions`.
- `caption` bắt buộc (20–240 ký tự) và phải nói rõ đây là ảnh minh hoạ.
- Đường dẫn ảnh sai thì build dừng, không ra trang có ảnh hỏng.
