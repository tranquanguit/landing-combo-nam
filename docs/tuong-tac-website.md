# Tương tác trên website: popup khuyến mãi, lời mời chat, giữ chân khách, thông báo đơn

Website có bốn lời mời. Mỗi cái bật/tắt riêng ở **Website → Thông tin cửa hàng → Tương tác trên
website**. Sau khi đổi, lưu rồi bấm **Xuất bản**.

Hiệu quả của từng lời mời xem ở **Bán hàng → Hành trình khách → Popup & lời mời**: số phiên đã thấy,
đã bấm, đã đóng. Bảng này chỉ tính khách đã bấm "Đồng ý" ở thanh đo lường.

| Lời mời | Hiện ở đâu, khi nào | Mặc định |
|---|---|---|
| **Popup khuyến mãi** | Trang sản phẩm / combo **đang có khuyến mãi chạy**, sau vài giây | Bật, sau 4 giây |
| **Lời mời chat** | Các trang **không có** popup khuyến mãi (trang chủ, trang dòng, sản phẩm không khuyến mãi, bài viết…) | Bật, sau 10 giây |
| **Giữ chân khách sắp rời** | Mọi trang, khi khách có dấu hiệu sắp rời mà chưa hỏi, chưa điền | Bật |
| **Thông báo đơn gần đây** | Góc trên bên trái, từ **đơn thật** trong 7 ngày | Bật, cách nhau 20 giây |

Không lời mời nào hiện trên trang cảm ơn.

## Quy tắc chung

Áp dụng cho cả bốn lời mời:

- **Mỗi lúc chỉ một lời mời.** Đang mở popup, bảng chat hay đang gõ vào ô nhập thì lời mời khác chờ.
  Riêng biểu mẫu giữ chân khách được chen trước lời mời chat và thông báo đơn, vì lúc đó khách sắp đi.
- **Mỗi lời mời tối đa một lần mỗi phiên.**
- **Không làm phiền người đang mua:** khách đã bắt đầu điền biểu mẫu đặt hàng thì không lời mời nào
  chen vào.
- **Thời gian chỉ tính lúc tab đang mở.** Khách chuyển sang tab khác thì đồng hồ dừng.

## 1. Popup khuyến mãi

- **Nội dung:** tên đợt, gói khuyến mãi (gói được đánh dấu khuyến nghị, không có thì gói đầu), giá,
  giá mua lẻ gạch ngang, % tiết kiệm, quà tặng, giờ kết thúc. Mọi con số lấy từ chính đợt khuyến mãi
  trong mục **Khuyến mãi**, không gõ tay.
- **Nút "Đặt hàng ngay":** đóng popup, chọn sẵn gói đó trong biểu mẫu, cuộn tới biểu mẫu và đặt con
  trỏ vào ô họ tên.
- **Trên điện thoại:** popup là tấm trượt từ đáy lên, không che kín màn hình. Bấm "Để sau", dấu ×,
  hoặc bấm ra ngoài để đóng.
- **Vì sao chờ vài giây mà không hiện ngay khi trang vừa tải:** trên điện thoại, Google trừ điểm trang
  có lớp phủ che nội dung ngay lúc khách vừa bấm vào từ Google. Muốn hiện sớm hơn thì giảm số giây,
  nhưng nên để từ 3 giây trở lên.

## 2. Lời mời chat

- **Hình thức:** một thẻ nhỏ phía trên nút chat, có 2–3 câu hỏi gợi ý. Khách bấm một câu thì bảng chat
  mở ra và câu đó được gửi luôn.
- **Câu hỏi gợi ý theo trang:**

  | Trang | Câu gợi ý |
  |---|---|
  | Sản phẩm / combo | "{tên} có hợp với da tôi không?", "Dùng {tên} thế nào cho đúng?", "{tên} đang có ưu đãi gì?" |
  | Dòng sản phẩm | "Da tôi nên chọn sản phẩm nào trong dòng {tên}?" và một câu chung |
  | Trang khác | Câu chung, ví dụ "Da tôi bị nám, nên bắt đầu từ đâu?" |

- Các câu gợi ý trong bảng chat cũng đổi theo trang.
- Không hiện nếu khách đã từng chat.

## 3. Giữ chân khách sắp rời ("để lại số")

### Khi nào hiện

Sau ít nhất 12 giây xem thật, khi có một trong các dấu hiệu sau:

- **Điện thoại:**
  - vuốt ngược lên nhanh sau khi đã đọc sâu xuống trang;
  - kéo về đầu trang, động tác hay gặp khi khách tìm thanh địa chỉ hay nút đóng tab;
  - chuyển sang ứng dụng khác rồi quay lại.
- **Máy tính:** chuột rời khỏi mép trên cửa sổ, tức là khách đi tới thanh tab hay thanh địa chỉ.

### Không hiện khi

Khách đã chat, đã bấm gọi / Zalo, đã điền biểu mẫu, hoặc đã để lại số trước đó.

Website **không** chặn nút Quay lại của trình duyệt. Chrome tự bỏ qua kiểu chặn đó, và Google Ads
coi đó là hành vi lừa người dùng.

### Nội dung biểu mẫu

- Chỉ hỏi số điện thoại và khách muốn được tư vấn về gì:
  - trên trang sản phẩm / combo: "Tư vấn về {sản phẩm đang xem}" hoặc "Tư vấn về sản phẩm khác";
  - trang khác: chỉ ô số điện thoại.
- Câu đồng ý dữ liệu nằm ngay trên nút gửi, và được lưu nguyên văn cùng yêu cầu.

### Sau khi gửi

- Yêu cầu vào **Đơn hàng** như mọi đơn khác:
  - cột khách hiện **"Để lại số nhanh (chưa có tên)"**;
  - gói là "Gọi lại: tư vấn sản phẩm này" hoặc "Gọi lại: tư vấn sản phẩm khác";
  - sản phẩm là trang khách đang xem.
- Khách được chuyển sang trang **Đã nhận yêu cầu tư vấn** (`/da-nhan-yeu-cau-tu-van/`). Nếu đã nhập
  nhãn chuyển đổi "Nhận tư vấn" thì Google Ads đếm lượt này (xem `docs/hanh-trinh-khach.md`).

## 4. Thông báo đơn gần đây

- **Ví dụ:** "Một khách đã đặt Combo Nám Mocha · 2 giờ trước", hiện 5 giây ở góc trên bên trái rồi ẩn.
- **Chỉ từ đơn thật:** đơn mua có giá, chưa huỷ, trong 7 ngày.
  - Không có đơn nào thì không hiện gì.
  - Không hiện tên, số điện thoại, địa chỉ, mã đơn hay giờ chính xác. Thời gian làm tròn xuống 5 phút.
  - Mỗi đơn hiện tối đa một lần mỗi lượt xem trang, tối đa 5 thông báo; không lặp vòng để trông đông
    hơn thực tế.
- **Đơn thử nghiệm phải chuyển sang "Huỷ"** trong **Đơn hàng**, nếu không sẽ hiện lên.
- Khách bấm × thì tắt cho đến hết phiên.
- Không dùng dữ liệu bịa: thông báo mua hàng không có thật là quảng cáo gây hiểu lầm, và có thể khiến
  quảng cáo Google / Meta bị từ chối hoặc tài khoản bị khoá.

## Kỹ thuật (cho người bảo trì)

| Phần | Tệp |
|---|---|
| Cấu hình | `brand.engagement` (`src/content.config.ts`); mặc định ở `src/lib/engagement.ts`; form ở `server/admin/store.ts` |
| Điều phối lớp phủ | `src/lib/overlay.ts` |
| Popup khuyến mãi | `src/components/PromoPopup.astro` (ProductLanding, ComboPage) |
| Lời mời chat | `src/components/ChatWidget.astro` + `ask()` trong `src/lib/chat/client.ts` |
| Giữ chân khách | `src/components/ExitLead.astro` |
| Thông báo đơn | `src/components/RecentOrders.astro` |

- **Giữ chân khách:** gửi về `/api/orders` với `quick: true`. Kiểm tra đầu vào ở
  `functions/_lib/orders.ts`: `quick` chỉ bỏ yêu cầu tên cho gói không giá.
- **Thông báo đơn:** lấy dữ liệu từ `GET /api/recent-orders` (`server/lib/recent-orders.ts`), có bộ
  nhớ đệm 60 giây.
- **Đo hiệu quả:** sự kiện hành trình loại `popup` (`db/pg/0006_journey_popup.sql`):
  - `promo:show|order|close`
  - `chat:show|ask|close`
  - `exit:show|submit|close`
  - `recent:show|close`
- **Test:**
  - máy chủ: `tests/server-pg.mjs`;
  - trình duyệt: kịch bản "sắp rời: để lại số" trong `tests/order-endpoint.mjs`.
