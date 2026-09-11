# Vòng 1 — Tổng hợp nghiên cứu và chốt phương án

Bốn chuyên gia đã nghiên cứu độc lập rồi đối chiếu. Dưới đây là những gì đã chốt,
những chỗ họ mâu thuẫn nhau và cách phân xử.

## 1. Phát hiện quan trọng nhất

**Nghị định 342/2025/NĐ-CP, khoản 4 Điều 4, hiệu lực 15/02/2026:** quảng cáo mỹ phẩm
**không được dùng hình ảnh, trang phục, tên gọi, thư tín hay bài viết của cơ sở y tế,
bác sĩ, dược sĩ hoặc nhân viên y tế.**

Toàn bộ trục tin cậy của trang cũ đứng trên hình ảnh BSCKI Trúc Mai — ảnh hero, video,
trích dẫn, và dòng "Bác sĩ da liễu tin dùng". Tất cả đều đã phải gỡ. Đây không phải
lựa chọn thẩm mỹ mà là điều kiện để không bị xử phạt và để quảng cáo được duyệt.

## 2. Ba mâu thuẫn giữa các chuyên gia và cách phân xử

| Mâu thuẫn | Bên A | Bên B | Phân xử |
|---|---|---|---|
| Dùng hình ảnh bác sĩ | Art direction đề xuất copy hero xoay quanh uy tín bác sĩ, và yêu cầu chụp mới chân dung bác sĩ | Pháp lý: cấm tuyệt đối theo NĐ 342/2025 | **Pháp lý thắng.** Luật không thương lượng được. Nhu cầu "uy tín" chuyển sang bằng chứng hợp pháp: số công bố mỹ phẩm, phiếu kiểm nghiệm, tem QR, link gian hàng chính hãng |
| Số "4,9/5 từ 1.284 đánh giá" | Art direction đề xuất đưa lên hero vì nỗi sợ lớn nhất là hàng giả | SEO: Google cấm khai rating mà trang không hiển thị dữ liệu thật → manual action | **Bỏ khỏi schema và khỏi giao diện.** Chỉ khai lại khi có link gian hàng thật để người dùng tự kiểm chứng |
| Đếm ngược và "còn 8 suất" | Giữ vì tạo áp lực mua | Tâm lý học: khan hiếm giả bị phát hiện chỉ bằng một lần F5, và với COD nó tạo **đơn ảo** chứ không tạo doanh thu | **Bỏ.** Thay bằng hạn khuyến mãi có ngày cố định |

## 3. Đã chốt — áp dụng ngay

- Gỡ `aggregateRating` + `Review` tự khai khỏi schema; gỡ mọi con số không kiểm chứng được.
- Gỡ toàn bộ tham chiếu nhân viên y tế.
- Thay từ ngữ vi phạm: "trị nám" → "chăm sóc da nám", "liệu trình" → "chu kỳ chăm sóc da",
  "Bộ Y Tế cấp phép" → "đã công bố sản phẩm mỹ phẩm" (mỹ phẩm chỉ công bố, không được cấp phép),
  "chuẩn y khoa" và cam kết "sau 2 tuần" → bỏ.
- Gỡ logo FDA/TÜV/KIPO: FDA Hoa Kỳ không cấp chứng nhận cho mỹ phẩm.
- Bỏ đếm ngược, thanh tồn kho cứng 92%, "còn 8/100 suất".
- Bổ sung khối thông tin bắt buộc theo NĐ 342/2025 và cảnh báo sản phẩm.

## 4. Đã chốt — làm ở vòng sau

**Kiến trúc.** Astro 7.x, content collections với schema Zod, `blocks[]` dạng discriminated
union để mỗi landing sắp xếp khối khác nhau mà dùng chung component. Thêm sản phẩm = thêm
một file MDX. i18n subfolder `/en/`, `/th/`, `/id/`; vi không prefix.

**Lưu ý ngược dòng:** với **một** landing một ngôn ngữ, Astro không nhanh hơn file HTML hiện tại.
Giá trị của Astro nằm ở khả năng bảo trì và xử lý ảnh tự động, và chỉ thực sự có lãi từ mốc
3 sản phẩm × 2 ngôn ngữ. Điều kiện nghiệm thu: bản Astro phải ≤ bản HTML hiện tại về số byte
và LCP đo ở phòng thí nghiệm, nếu không thì không chuyển.

**Ngân sách hiệu năng** (mobile, 4G Việt Nam): LCP ≤ 2.0s, INP ≤ 150ms, CLS ≤ 0.03,
JS first-party ≤ 12KB brotli, JS bên thứ ba ≤ 45KB, ảnh màn đầu ≤ 180KB, tổng tải đầu ≤ 700KB.
Đặt làm cổng CI, vượt thì fail build.

**Quyết định kỹ thuật đã chốt:** không dùng GTM (thủ phạm INP số một) mà gọi thẳng gtag/fbq,
chuyển sự kiện chuyển đổi sang Meta CAPI server-side; không dùng Partytown; không dùng
ClientRouter; self-host font subset tiếng Việt (~20KB/weight thay vì tải Google Fonts);
`content-visibility:auto` cho section dưới màn hình đầu; hosting Cloudflare Pages vì có PoP
tại Hà Nội và TP.HCM peering VNIX.

**Nội dung.** Một landing page không thể xếp hạng cho "cách trị nám sau sinh". Cần cụm 6–10 bài
chuyên đề liên kết về trang sản phẩm. Không có cụm này thì mục tiêu SEO thông tin là bất khả thi.

**AI search.** `llms.txt` gần như không được nhà cung cấp nào đọc — giữ lại như phụ lục,
không đầu tư thêm. Thứ thực sự có tác dụng: đưa toàn bộ dữ kiện có đơn vị và điều kiện vào
HTML render sẵn, dẫn nguồn nghiên cứu cho từng hoạt chất, và **không dùng ngôn ngữ claim y tế**
— vì chính claim y tế không nguồn là lý do khiến trợ lý AI từ chối giới thiệu sản phẩm.

## 5. Đang chờ khách hàng cung cấp

Những mục có dấu ⚠️ trong trang là chỗ đang thiếu dữ liệu thật:

1. Số tiếp nhận phiếu công bố sản phẩm mỹ phẩm của cả 4 sản phẩm + mã số thuế.
2. Phiếu kiểm nghiệm corticoid / hydroquinone / thủy ngân / chì, có ngày và tên đơn vị.
3. Link gian hàng chính hãng Shopee/Lazada/TikTok Shop, để thay số đánh giá bằng số tự kiểm chứng được.
4. Ảnh packshot nền sạch (hiện đang phải cắt tạm từ banner cũ).
5. Ảnh trước–sau chụp đúng chuẩn: chân máy cố định, cùng đèn, cùng giờ, có văn bản đồng ý, ghi rõ mốc tuần.
6. Hợp đồng với MC Vân Hugo để gắn nhãn nội dung tài trợ.
7. Chính sách đổi trả và chính sách bảo vệ dữ liệu cá nhân thành văn.
8. Danh mục sản phẩm Mocha đầy đủ, để thiết kế schema dữ liệu dùng chung.
