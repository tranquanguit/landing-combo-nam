# Trang cảm ơn, chuyển đổi Google Ads và hành trình khách

Ba phần làm cùng nhau:

1. **Trang cảm ơn.** Khách gửi biểu mẫu thành công thì được chuyển sang trang cảm ơn. Trang này là
   mốc để đếm chuyển đổi cho quảng cáo.
2. **Chuyển đổi quảng cáo.** Mã Google Ads, GA4, Meta và TikTok nhập ở trang quản trị. Chuyển đổi
   chỉ bắn ở trang cảm ơn, mỗi đơn một lần.
3. **Hành trình khách.** Ghi khách đã xem trang nào, đọc phần nào bao lâu và bấm nút gì. Xem ở
   **Bán hàng → Hành trình khách**.

Cả ba chỉ chạy với khách **đã bấm "Đồng ý"** ở thanh đo lường cuối trang. Từ bản này, thanh đó hiện
với mọi khách lần đầu ghé, kể cả khi chưa nhập mã quảng cáo nào, vì hành trình khách cũng cần khách
đồng ý.

---

## 1. Trang cảm ơn

| Biểu mẫu | Tiếng Việt | Tiếng Anh |
|---|---|---|
| Đặt hàng (trang sản phẩm, trang combo) | `/dat-hang-thanh-cong/` | `/en/order-received/` |
| Nhận tư vấn (trang Liên hệ) | `/da-nhan-yeu-cau-tu-van/` | `/en/request-received/` |

- Trang hiện **mã đơn**, gói đã chọn kèm giá, và các bước tiếp theo:
  - gọi xác nhận;
  - giao trong 2–5 ngày;
  - mở kiểm tra rồi mới trả tiền.

  Trang cũng có nút gọi hotline và nhắn Zalo.
- **Mã đơn không nằm trên URL.** Trang lấy mã đơn từ chính tab vừa gửi đơn. Vì vậy:
  - khi mở thẳng đường dẫn, trang chỉ hiện lời cảm ơn chung, không có mã đơn và **không đếm
    chuyển đổi**;
  - khi tải lại trang, chuyển đổi không bị đếm thêm.
- Có chế độ riêng tư chặt chặn bộ nhớ của trình duyệt. Khi đó khách ở lại trang và thấy mã đơn ngay
  trên trang như trước. Lượt đó quảng cáo không đếm được.
- Trang không cho Google lập chỉ mục và không có trong sitemap.

## 2. Gắn chuyển đổi Google Ads

### Bước 1: tạo hành động chuyển đổi trong Google Ads

1. Vào **Mục tiêu → Chuyển đổi → Tóm tắt → + Tạo hành động chuyển đổi**, chọn **Trang web**.
2. Nhập tên miền `mochacosmetic.com`, rồi chọn **Thêm hành động chuyển đổi theo cách thủ công**.
3. Điền như sau:
   - **Mục tiêu:** *Mua hàng* (hoặc *Gửi biểu mẫu khách hàng tiềm năng*).
   - **Tên:** "Đặt hàng website".
   - **Giá trị:** chọn **Sử dụng các giá trị khác nhau cho mỗi lượt chuyển đổi**. Website gửi giá
     của gói khách chọn. Giá trị mặc định có thể để bằng giá Combo Nám.
   - **Số lượt:** chọn **Một**. Một lượt bấm quảng cáo chỉ tính một đơn.
4. Lưu. Ở bước "Thiết lập", chọn **Sử dụng Google Tag** → **Tự cài đặt**. Google hiện một đoạn mã có
   dòng sau:
   ```
   'send_to': 'AW-123456789/AbCdEfGhIjk'
   ```
   - Phần trước dấu `/` là **mã tài khoản**: `AW-123456789`.
   - Phần sau dấu `/` là **nhãn chuyển đổi**: `AbCdEfGhIjk`.

   Chỉ cần chép hai giá trị này, **không** dán đoạn mã vào đâu cả.
5. Muốn đếm cả yêu cầu tư vấn: tạo thêm một hành động tên "Nhận tư vấn website". Chọn mục tiêu
   *Liên hệ* và bỏ giá trị. Chép nhãn của hành động này.

### Bước 2: nhập mã vào trang quản trị

1. Mở **Website → Thông tin cửa hàng → Mã đo lường quảng cáo** và điền:
   - **Google Ads — mã tài khoản:** `AW-123456789`;
   - **Nhãn chuyển đổi "Đặt hàng":** `AbCdEfGhIjk`;
   - **Nhãn chuyển đổi "Nhận tư vấn":** để trống nếu không đo;
   - GA4, Meta Pixel, TikTok Pixel nếu có.
2. Bấm **Kiểm tra & lưu**, rồi bấm **Xuất bản**.

Mã sai dạng (ví dụ thiếu `AW-`) thì trang báo lỗi và không lưu.

### Không dùng quy tắc "URL chứa…" của Google Ads

Google Ads cho phép đếm theo kiểu "khi trang có URL chứa `/dat-hang-thanh-cong/` được tải". Cách đó
đếm cả lượt tải lại và lượt mở thẳng đường dẫn, và không có giá trị đơn. Cách ở trên (mã tài khoản +
nhãn) không mắc hai lỗi đó.

### Mỗi lần khách gửi đơn thành công, website gửi những gì

| Đi tới | Sự kiện | Giá trị |
|---|---|---|
| Google Ads | `conversion` (send_to = mã/nhãn) | giá gói, VND |
| GA4 | `generate_lead` | giá gói, VND |
| Meta | `Lead` | giá gói, VND |
| TikTok | `SubmitForm` | giá gói, VND |

Website **không** gửi đi mã đơn, họ tên, số điện thoại hay địa chỉ.

### Kiểm tra

1. Mở website bằng cửa sổ ẩn danh và bấm **Đồng ý**.
2. Đặt một đơn thử, chờ sang trang cảm ơn.
3. Trong Google Ads, hành động chuyển đổi chuyển sang **Đang ghi nhận lượt chuyển đổi** sau vài giờ.
   Có thể kiểm ngay bằng tiện ích **Google Tag Assistant**.
4. Huỷ đơn thử trong **Đơn hàng**.

### Giới hạn

- Khách **từ chối** đo lường thì Google Ads không đếm được lượt đó. Đơn vẫn vào hệ thống bình thường.
  Số đơn trong **Đơn hàng** luôn là số thật; số trên Google Ads luôn **thấp hơn** số thật.
- Website chưa dùng *Chuyển đổi nâng cao* (gửi số điện thoại đã băm cho Google). Muốn dùng thì phải
  bàn riêng, vì đó là gửi dữ liệu cá nhân của khách ra ngoài.

## 3. Hành trình khách

### Ghi những gì

| Ghi | Không ghi |
|---|---|
| Trang đã mở và thời gian **xem thật** (chỉ tính lúc tab đang hiện) | Chữ khách gõ, họ tên, số điện thoại |
| Khối nội dung nằm trong màn hình bao lâu (từ 1 giây) | Vị trí chuột, thao tác cuộn từng pixel |
| Nút và link đã bấm (đặt hàng, gọi, Zalo, menu…) | Địa chỉ IP (máy chủ cũng không lưu) |
| Câu hỏi thường gặp đã mở | |
| Bắt đầu điền biểu mẫu, gửi đơn, tới trang cảm ơn | |
| Nguồn: utm, trang giới thiệu, có bấm từ quảng cáo không (gclid/fbclid/ttclid) | |
| Loại thiết bị (điện thoại / máy tính bảng / máy tính) | |

Mỗi khách mang một **mã ngẫu nhiên** do trình duyệt tạo ra. Phiên kết thúc khi khách không thao tác
quá 30 phút. Khi khách đặt hàng, đơn được gắn vào phiên đang mở. Trong **Đơn hàng**, đơn có link
**Xem hành trình** để mở dòng thời gian của phiên đó.

### Đọc trang "Hành trình khách"

- **Khoảng thời gian:** 24 giờ / 7 / 30 / 90 ngày.
- **Chỉ số:**
  - số phiên và số khách;
  - tỉ lệ phiên có đặt đơn;
  - thời gian xem thật trung bình;
  - số trang mỗi phiên;
  - tỉ lệ "rời ngay": chỉ 1 trang và dưới 10 giây.
- **Phễu đặt hàng:** phiên có truy cập → xem trang sản phẩm/combo → bấm nút đặt hàng → bắt đầu điền
  biểu mẫu → gửi đơn → tới trang cảm ơn. Bước nào tụt mạnh nhất là chỗ cần sửa trước.
- **Khối nội dung được đọc lâu nhất:** cho biết khách dừng lâu ở đâu. Một khối nằm cao trong bảng mà
  phễu vẫn tụt sau đó thường là chỗ khách đang băn khoăn. Nên đọc khối đó cùng với **Câu hỏi được
  mở**.
- **Trang:** lượt xem, thời gian xem trung bình, tỉ lệ phiên **rời site tại trang này**.
- **Nút được bấm**, **Câu hỏi được mở**, **Nguồn**, **Thiết bị**.
- **Phiên gần đây:** bấm **Xem** để mở dòng thời gian của một phiên, từng bước có giờ. Bật **Chỉ
  phiên có đặt đơn** để xem đường đi của khách đã mua.

### Lưu ý khi đọc số

- Chỉ gồm khách đã bấm **Đồng ý**, nên đây là **mẫu**, không phải toàn bộ lượt truy cập. Hãy so tỉ lệ
  giữa các trang và các tuần với nhau, đừng lấy số tuyệt đối để báo cáo.
- Bot và công cụ đo tốc độ trang bị loại ra.
- Khách xem trên hai thiết bị được tính là hai khách.

### Quyền riêng tư và cấu hình

- Dữ liệu tự xoá sau **90 ngày**. Đổi bằng biến `JOURNEY_RETENTION_DAYS` trong `.env`.
- Tắt hẳn tính năng: đặt `PUBLIC_JOURNEY=0` trong `.env`, rồi chạy
  `docker compose --profile https up -d --build`.
- Khách bấm **Rút lại đồng ý đo lường** ở cuối trang thì trình duyệt xoá mã ngẫu nhiên và ngừng ghi.
- Trang **Chính sách dữ liệu** đã có đoạn mô tả việc này (cập nhật 16/10/2026).

### Kỹ thuật (cho người bảo trì)

- **Trình duyệt:** `src/lib/journey-client.ts`, gọi từ `src/components/Analytics.astro` sau khi khách
  đồng ý. Gửi theo lô bằng `sendBeacon` tới `POST /api/j`: mỗi 20 giây, và khi ẩn tab hoặc rời
  trang.
- **Máy chủ:** `server/lib/journey.ts`, bảng `journey_sessions` và `journey_events`
  (`db/pg/0005_journey.sql`).
  - Mỗi lô tối đa 60 sự kiện và 32KB.
  - Giới hạn tần suất theo IP đã băm và theo phiên.
  - Mã phiên của khách khác không ghi vào được.
  - Luôn trả 204.
- **Trang quản trị:** `server/admin/journey.ts`.
- **Trang cảm ơn:**
  - `src/layouts/ThanksPage.astro`, đường dẫn trong `thanksPath()` (`src/lib/routes.ts`);
  - biểu mẫu ghi `sessionStorage['mocha_last_order']` rồi chuyển trang (`src/components/blocks/Order.astro`).
