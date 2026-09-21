# Mục tiêu, tầm nhìn và kỳ vọng

Tài liệu này ghi lại **vì sao website này tồn tại** và **nó phải trở thành cái
gì**, đúc kết từ toàn bộ quá trình trao đổi giữa chủ dự án và người dựng site.
Mọi tài liệu khác trong `docs/` trả lời câu hỏi "làm thế nào"; tài liệu này trả
lời "để làm gì" — và nó là thứ dùng để phân xử khi hai phương án kỹ thuật đều
chạy được nhưng chỉ một cái đúng hướng.

---

## 1. Mục tiêu

**Xây một nền tảng landing page đa sản phẩm cho Mocha** — không phải một trang
bán hàng đơn lẻ. Mỗi sản phẩm của Mocha phải có một trang chi tiết riêng: đẹp,
sống động, nhanh, chuẩn SEO, và bán được hàng.

Ba việc website phải làm được, theo thứ tự ưu tiên:

1. **Thu đơn hàng thật.** Khách điền biểu mẫu → chuyên viên gọi lại xác nhận →
   giao hàng thu tiền tận nơi. Mỗi đơn phải được lưu lại an toàn, không rơi vào
   hư không.
2. **Được tìm thấy** — trên Google, và trên các trợ lý AI đang dần thay thế
   Google ở bước tìm hiểu trước khi mua.
3. **Tạo được niềm tin** ở một thị trường mà người mua đã bị "kem trộn" làm cho
   nghi ngờ mọi lời quảng cáo.

## 2. Định vị: một lợi thế duy nhất, và xây mọi thứ quanh nó

Thị trường mỹ phẩm chăm sóc da nám Việt Nam có một đặc điểm: gần như không hãng
nào công bố **nồng độ** hoạt chất. Bao bì ghi "chiết xuất độc quyền", và con số
thật có thể là 0,01% hoặc 3% — người mua không có cách nào biết, nên không có
cách nào so sánh.

**Mocha đi ngược lại: in nồng độ lên bao bì, và công khai đúng con số đó trên
web.** Kem ghi 3% Tranexamic Acid, 2% NIO-NAG, 1% Ceramide; serum ghi
1000ppm 4-butylresorcinol, 4% Niacinamide, 1% Bio-Placenta. Website tồn tại để
biến chi tiết này thành lợi thế cạnh tranh nhìn thấy được.

Hệ quả trực tiếp lên cách làm site, và đây là quy tắc bất di bất dịch:

> **Cái nào có số thì ghi số. Không có thì bỏ số ra.**
> Không bao giờ tự điền một con số mà bao bì không in.

Đổi lại sự minh bạch đó, website **không hứa những điều không đo được**. Mọi sản
phẩm là mỹ phẩm dùng ngoài da, không phải thuốc, và trang nói thẳng điều đó.

## 3. Tầm nhìn

### 3.1 Từ một sản phẩm thành cả danh mục

Cấu trúc bốn tầng, lấy cảm hứng từ cách các hãng lớn tổ chức (lorealparis.com.vn
là mẫu tham chiếu ban đầu), nhưng dựng để **thêm sản phẩm không phải sửa code**:

```
Trang chủ            thương hiệu, tuyên ngôn, lối vào
  └─ Dòng sản phẩm   nhóm theo vấn đề của da (nám thâm, dầu mụn, lão hoá…)
       └─ Landing    một trang bán hàng đầy đủ cho từng sản phẩm
  └─ Góc tư vấn      nội dung trả lời câu hỏi trước khi mua
  └─ Chính sách      đổi trả, dữ liệu cá nhân
```

Thêm một sản phẩm = thêm một file JSON. Hiện Mocha mới có một dòng và một sản
phẩm trên site; còn khoảng chín sản phẩm nữa trong danh mục cần đưa lên.

Bố cục **tự đổi theo số lượng thật**: một mục thì dàn thành dải lớn, nhiều mục
mới xếp lưới. Ngày danh mục đầy đủ, trang tự chuyển dạng mà không phải dựng lại.

### 3.2 Nhiều ngôn ngữ, nhiều thị trường

Việt Nam là thị trường chính. Tiếng Anh đã chạy song song đầy đủ ngay từ đầu —
không phải vì cần ngay, mà vì một site hai ngôn ngữ được dựng đúng từ ngày đầu
thì mở thêm Thái Lan, Indonesia và phần còn lại của Đông Nam Á chỉ là thêm dữ
liệu. Dựng một ngôn ngữ rồi sau đó nhét đa ngữ vào là làm lại từ đầu.

### 3.3 Chuẩn cho cả người đọc lẫn máy đọc

Người mua ngày nay hỏi trợ lý AI trước khi hỏi Google. Site phải để một mô hình
ngôn ngữ **trích dẫn được**: dữ liệu có cấu trúc đầy đủ, `llms.txt` song ngữ,
các con số nằm ở dạng máy đọc được chứ không chỉ nằm trong ảnh hay bảng HTML.

## 4. Kỳ vọng cụ thể

### 4.1 Nội dung và trải nghiệm

- **Đúng và đủ, không quá tải.** Không khối nào được nhồi nhét; bố cục cân đối,
  chuyển động mượt mà.
- **Cảm giác thương hiệu lớn**, không phải cảm giác "web do dev junior dựng".
  Hai trang quan trọng nhất không được mở đầu bằng hai ngôn ngữ thị giác khác nhau.
- **Điện thoại là thiết bị chính.** Phần lớn khách Việt vào bằng điện thoại; một
  bảng dữ liệu tràn ngang trên điện thoại là lỗi nặng, không phải chi tiết nhỏ.
- **Đánh giá bằng mắt, không bằng suy luận.** Chạy script xanh hết không có
  nghĩa là trang đẹp. Phải chụp màn hình từng khúc, desktop và mobile, rồi nhìn.
  Lỗi bảng thành phần vỡ trên điện thoại chỉ lộ ra theo cách đó.

### 4.2 SEO và khả năng chạy quảng cáo

- Mỗi truy vấn chỉ **một trang** sở hữu — không để hai trang ăn thịt nhau.
- Liên kết nội bộ sinh ra từ **quan hệ dữ liệu**, không gõ tay.
- Bằng chứng SEO phải **đo được trên chính bản build**, không phải lời hứa.
- Site phải sẵn sàng cho quảng cáo trả phí: đo chuyển đổi, và — vì bán thu tiền
  tận nơi — phải đẩy được chuyển đổi **sau khi giao hàng thành công** ngược lên
  nền tảng quảng cáo, nếu không thuật toán sẽ học trên những đơn bị huỷ ở cửa.

### 4.3 Pháp lý

Đây là mỹ phẩm bán tại Việt Nam, nên pháp lý không phải phần phụ:

- Số tiếp nhận phiếu công bố hiện trên trang (Nghị định 342/2025/NĐ-CP).
- Không tuyên bố công dụng kiểu thuốc — không "trị", không "cam kết khỏi".
- Dữ liệu khách hàng theo Nghị định 13/2023/NĐ-CP: chỉ lưu khi có đồng ý, và lưu
  lại **đúng câu chữ** mà khách đã đọc khi đồng ý.
- Giá gạch ngang phải là giá đã từng bán thật (Nghị định 98/2020/NĐ-CP), chương
  trình khuyến mại phải có ngày bắt đầu và ngày kết thúc (Nghị định 81/2018/NĐ-CP).
- Ảnh khách hàng là dữ liệu cá nhân: không có văn bản đồng ý thì không lên trang.

### 4.4 Dữ liệu khách hàng

Đơn hàng phải về **cơ sở dữ liệu của Mocha**, không phải một bảng tính của bên
thứ ba. Cùng miền với website để không phải nới lỏng chính sách bảo mật, có sao
lưu, có trang quản trị, và chống được đơn rác lẫn đơn trùng.

### 4.5 Cách làm việc

- **Hàng rào build thay cho lời dặn.** Một quy tắc chỉ ghi trong tài liệu thì
  sớm muộn cũng bị vi phạm; một quy tắc làm đỏ CI thì không.
- **Phản biện có tổ chức.** Mỗi khi thấy "xong", chạy lại bộ câu hỏi phản biện
  và mời các chuyên gia theo từng vai (SEO kỹ thuật, GEO, hiệu năng, tâm lý
  chuyển đổi, art direction, copywriting, pháp lý mỹ phẩm, kiến trúc thông tin)
  soi lại — bằng ảnh chụp thật, không bằng đọc mã.
- **Nói thật khi sai.** Đã có lần tôi đọc ảnh marketing độ phân giải thấp rồi
  kết luận sai rằng bao bì không in nồng độ, và xoá đi sáu con số đúng. Ghi lại
  ở đây để cách làm việc là: sai thì nói rõ đã sai ở đâu, rồi sửa.

## 5. Những điều KHÔNG đánh đổi

- **Không** gắn `aggregateRating` hay `review` khi chưa có hệ thống đánh giá thật.
  Sao giả là vi phạm chính sách Google, không phải mẹo tăng lượt bấm.
- **Không** bịa số liệu, không bịa chứng nhận, không bịa nhận xét khách hàng.
- **Không** dùng Google Tag Manager — nó nạp trước khi khách đồng ý.
- **Không** nhân bản file để tạo biến thể quảng cáo.
- **Không** đưa ảnh hoặc lời kể của khách lên trang khi chưa có đồng ý bằng văn bản.
- **Không** để một đơn hàng rơi vào hư không: thiếu cấu hình nơi nhận đơn thì
  biểu mẫu không hiện, chỉ hiện hotline.

## 6. Thước đo thành công

| Đo cái gì | Ngưỡng |
| --- | --- |
| Đơn hàng thật vào được cơ sở dữ liệu | 100%, kiểm bằng một đơn thử trên tên miền thật |
| Phép đo SEO trên bản build | tất cả đạt, CI đỏ nếu tụt |
| Hàng rào nội dung và pháp lý | tất cả đạt |
| Trọng lượng trang | trong ngân sách đã đặt |
| Bố cục trên điện thoại | không tràn ngang, không chữ bị cắt, ở mọi khối |
| Số sản phẩm Mocha đã lên site | 1 / ~10 — đây là con số cần tăng |

## 7. Hiện trạng và việc còn lại

**Đã có:** nền tảng bốn tầng chạy được cho cả VN lẫn EN, một landing sản phẩm
đầy đủ, hệ thống đơn hàng, các trang chính sách, bộ hàng rào build, báo cáo SEO
đo trên bản build, và tài liệu vận hành.

**Đang chờ quyết định của Mocha:** hạn ưu đãi sắp hết; bằng chứng cho mức giá
niêm yết gạch ngang; số công bố của serum; văn bản đồng ý cho ảnh trước/sau và
nhận xét khách; email theo tên miền thay cho Gmail; thông báo website với Bộ
Công Thương.

**Việc kỹ thuật còn lại:** bộ ảnh đúng đặc tả (xem `docs/anh-can-co.md`), đưa
chứng từ lên trang, đường dẫn đo chuyển đổi cho quảng cáo, và chín sản phẩm còn
lại của danh mục.

Danh sách đầy đủ, có thứ tự làm: [`docs/deploy.md`](deploy.md).

## 8. Ranh giới — website này KHÔNG phải cái gì

- Không phải nơi tư vấn y khoa. Nám cần can thiệp y khoa thì trang nói khách đi
  gặp bác sĩ da liễu.
- Không phải sàn thương mại điện tử. Hiện bán qua biểu mẫu và cuộc gọi lại; khi
  có gian hàng Shopee/Lazada/TikTok Shop thì thêm đường dẫn, không dựng giỏ hàng.
- Không phải blog. Nội dung tư vấn tồn tại để trả lời câu hỏi trước khi mua và
  để dẫn về sản phẩm, không phải để chạy theo lượt xem.
