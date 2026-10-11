# Thông tin cửa hàng

Mọi thông tin về cửa hàng và thương hiệu khai ở **một** chỗ: trang quản trị → **Website → Thông tin cửa
hàng** (`/admin/store`). Lưu xong bấm **Xuất bản** để trang thật đổi theo.

| Nhóm | Trường | In ở đâu |
|---|---|---|
| Cửa hàng | tên cửa hàng, tên pháp nhân (để trống nếu là đại lý), địa chỉ, mã số thuế, giờ làm việc (trống = 24/7) | chân trang mọi trang, trang Liên hệ, Về Mocha, dữ liệu cho Google, llms.txt |
| Liên lạc | hotline (số +84 tự suy ra), Zalo, email | như trên + nút gọi/Zalo ở biểu mẫu đặt hàng, chat |
| Mạng xã hội | Facebook, Instagram, TikTok, YouTube | chân trang, trang Liên hệ, `sameAs` cho Google |
| Bộ Công Thương | đường dẫn xác nhận đã thông báo website | chân trang ("Đã thông báo Bộ Công Thương") |
| Tổ chức công bố | mã, gọi tắt, tên pháp nhân, địa chỉ — mỗi hãng/dòng một dòng | chân trang của từng sản phẩm |
| Sản phẩm | tổ chức công bố, số tiếp nhận phiếu công bố (áp cho cả bản vi + en) | chân trang của sản phẩm |

Tên tổ chức công bố hoặc số công bố để trống thì trang sản phẩm hiện cảnh báo **"cần bổ sung"** thay vì in
một tên đoán. Không xoá được một tổ chức công bố khi còn sản phẩm đang trỏ tới nó.

## Trong câu chữ: viết mã, không chép số

Bài viết, chính sách, câu hỏi đáp… cần nhắc thông tin cửa hàng thì viết **mã**, trang tự thay lúc xuất bản:

| Mã | Ra |
|---|---|
| `{{storeName}}` | tên cửa hàng |
| `{{phone}}` | hotline (cách hiển thị) |
| `{{zalo}}` | đường dẫn Zalo |
| `{{email}}` | email |
| `{{address}}` | địa chỉ |
| `{{taxId}}` | mã số thuế |
| `{{facebook}}` | đường dẫn Facebook |
| `{{hours}}` | giờ làm việc, hoặc "24/7" khi để trống |

Nhờ vậy đổi hotline một lần ở Thông tin cửa hàng là mọi trang đổi theo, không sót câu nào.
