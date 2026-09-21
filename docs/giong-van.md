# Giọng văn — viết cho người mua, không phải cho máy chấm điểm

Sổ này ra đời sau một nhận xét đúng: *"dùng ngôn từ thuần AI quá"*. Dưới đây là
chỗ sai cụ thể và cách viết lại, lấy ví dụ từ chính nội dung đang có trên site.

Không phải chuyện thẩm mỹ. Người đọc trang này đang cân nhắc bỏ ra vài trăm
nghìn đến gần hai triệu cho một thứ họ chưa sờ được, từ một đại lý họ chưa từng
mua. Văn viết như tờ thông số kỹ thuật không sai về dữ kiện — nó chỉ không trả
lời được câu hỏi thật sự trong đầu họ.

## Sáu lỗi lặp lại

### 1. Mở bài bằng định nghĩa, không bằng vấn đề

> Hũ 30gr mang Tranexamic Acid, NIO-NAG, Ceramide, Bakuchiol, Vietnam Bio-white
> Complex và Black Truffle Extract — đúng danh sách in trên bao bì.

Sáu cái tên hoạt chất trong câu đầu tiên. Người đã biết chúng là gì thì không
cần đọc trang này; người chưa biết thì vừa bị dội một gáo nước lạnh.

Bắt đầu từ chỗ người đọc đang đứng, rồi mới dẫn tới hoạt chất:

> Nám đã mờ được vài lần rồi lại đậm lên? Thường là vì sản phẩm chỉ làm sáng
> lớp ngoài, còn tế bào hắc tố bên dưới vẫn hoạt động như cũ.

### 2. Danh sách thay cho câu

Liệt kê là cách né việc chọn ra điều quan trọng nhất. Ba gạch đầu dòng ngang
nhau thì người đọc phải tự xếp hạng — việc đáng ra người viết phải làm.

### 3. Chữ "giúp", "hỗ trợ", "tối ưu", "mang lại", "đem đến"

Những từ này không có nội dung. "Giúp cải thiện làn da" nói đúng bằng không
nói gì. Bỏ hẳn, hoặc thay bằng động từ có nghĩa: *hạn chế*, *làm chậm*, *thay
mới*, *củng cố*.

Ngoại lệ có thật: khi quy định quảng cáo mỹ phẩm buộc phải nói giảm. Lúc đó
giữ "hỗ trợ" nhưng phần còn lại của câu phải cụ thể.

### 4. Câu nào cũng dài bằng nhau

Văn AI có nhịp đều tăm tắp: câu nào cũng 20–25 chữ, mệnh đề nào cũng cân đối.
Đọc ba đoạn là buồn ngủ.

Xen câu ngắn vào. Rất ngắn. Một câu bốn chữ đặt sau một câu dài là chỗ người
đọc dừng lại và nhớ.

### 5. Không bao giờ dùng "bạn"

Văn đang viết ở ngôi vô nhân xưng: "Dành cho da sạm nám, không đều màu". Ai?
Tiếng Việt bán hàng gọi thẳng người đọc: *"Nếu da bạn..."*, *"Bạn sẽ thấy..."*,
*"Chỗ này đáng để bạn cân nhắc kỹ"*.

Xưng "chúng tôi" khi nói về đại lý và về cam kết. Không xưng "Mocha chúng tôi"
— chúng ta là đại lý, không phải hãng.

### 6. Tiêu đề nhồi từ khoá

> Kem nám Mocha Smart Brightening X3, công khai từng hoạt chất trên vỏ hộp

Đây là thẻ `<title>` bị đem đi làm `<h1>`. Hai thứ có hai việc khác nhau:
`title` nói cho máy tìm kiếm, `h1` nói cho người vừa bấm vào. Tách ra.

## Những gì phải giữ nguyên

Giọng văn hay hơn không có nghĩa là hứa nhiều hơn. Ba ràng buộc không đổi:

- **Không con số nào không in trên bao bì.** Thiếu thì bỏ số ra, không ước
  lượng. Đây là quy tắc chủ site đã đặt, và cổng `claims-guard` giữ nó.
- **Không tuyên bố chữa bệnh.** Mỹ phẩm dùng ngoài da. "Hết nám", "trị nám",
  "đặc trị" đều bị chặn ở cổng build, và đúng ra phải bị chặn.
- **Không phóng đại cảm xúc thay cho dữ kiện.** "Lấy lại làn da tuổi đôi mươi"
  là thứ văn mà trang này được dựng lên để KHÔNG dùng. Sự tin cậy là lợi thế
  cạnh tranh duy nhất của một đại lý; tiêu nó để đổi lấy một câu kêu là lỗ.

Ranh giới: viết cho người đọc thấy mình trong đó, chứ không viết cho người đọc
tin vào điều chưa chứng minh được.

## Cấu trúc một trang sản phẩm

Mọi landing đi theo cùng một mạch, đúng thứ tự này. Trang thiếu khối nào thì
mạch đứt ở đó, và người đọc rơi ra ngoài.

| # | Khối | Câu hỏi trong đầu người đọc |
|---|------|------------------------------|
| 1 | `hero` | Cái này là gì, cho ai? |
| 2 | `problem` | Họ có hiểu vấn đề của tôi không? |
| 3 | `cards` | Tôi thuộc trường hợp nào? |
| 4 | `timeline` / `compare` | Bao lâu? So với cái kia thì sao? |
| 5 | `ingredients` | Trong đó có gì, có an toàn không? |
| 6 | `steps` / `routine` | Dùng thế nào cho đúng? |
| 7 | `gallery` / `testimonials` | Có ai dùng thật chưa? |
| 8 | `order` | Mua thế nào, rủi ro gì? |
| 9 | `faq` | Còn điều gì tôi chưa hỏi? |

Bản hiện tại: `combo-nam` có 13 khối; mười sản phẩm còn lại chỉ có 5
(`hero, ingredients, steps, order, faq`) — tức là nhảy thẳng từ "cái này là gì"
sang "trong đó có gì", bỏ trắng toàn bộ phần thuyết phục.
