# Cơ sở dữ liệu đơn hàng

Hướng dẫn vận hành cho người không viết code. Chi tiết kiến trúc nằm ở
[`kien-truc.md`](kien-truc.md) mục 3.

## Đơn hàng nằm ở đâu

Cloudflare **D1** — một cơ sở dữ liệu SQLite chạy ngay cạnh trang web, cùng tên
miền. Không có máy chủ riêng để trả tiền, không có bảng tính để ai đó lỡ tay
sửa. Gói miễn phí của Cloudflare cho 5 triệu lượt đọc/ngày; ở quy mô của Mocha
thì không chạm tới.

## Xem đơn

Vào **`mochatrinam.com/admin`**, nhập mã truy cập.

- Mã do người quản trị đặt (`ADMIN_TOKEN`), không phải mật khẩu cá nhân
- Mã chỉ nằm trong tab đang mở; đóng tab là phải nhập lại
- Lọc theo trạng thái, đổi trạng thái ngay trên bảng, tải CSV để mở bằng Excel

Sáu trạng thái: **Mới → Đã gọi → Đã chốt → Đã gửi → Xong**, và **Huỷ**.

> ⚠️ Trang này hiển thị họ tên, số điện thoại và địa chỉ nhà của khách. Không mở
> trên máy dùng chung, không chụp màn hình gửi qua chat, không chuyển tiếp file
> CSV ra ngoài nhóm xử lý đơn.

## Dựng lần đầu

```bash
npx wrangler d1 create mocha-orders
# dán database_id nhận được vào wrangler.toml
npm run db:migrate
npx wrangler pages secret put ADMIN_TOKEN     # >= 32 ký tự ngẫu nhiên
npx wrangler pages secret put IP_SALT         # ngẫu nhiên, ĐẶT MỘT LẦN rồi thôi
```

`IP_SALT` đổi về sau thì bộ đếm chống spam mất trí nhớ một lần — không mất đơn,
nhưng không có lý do gì để đổi.

Chưa đặt `ADMIN_TOKEN` (hoặc đặt ngắn dưới 24 ký tự) thì API quản trị **khoá
hẳn** và trả 503. Đây là chủ ý: một trang quản trị chưa cấu hình phải đóng, chứ
không phải mở.

## Việc thường gặp

```bash
# Đếm đơn theo ngày
npx wrangler d1 execute mocha-orders --remote \
  --command "SELECT substr(created_at,1,10) d, COUNT(*) n FROM orders GROUP BY d ORDER BY d DESC LIMIT 14"

# Đơn đến từ chiến dịch nào
npx wrangler d1 execute mocha-orders --remote \
  --command "SELECT utm_source, utm_campaign, COUNT(*) n FROM orders GROUP BY 1,2 ORDER BY n DESC"

# Khách yêu cầu xoá dữ liệu (Nghị định 13/2023/NĐ-CP)
npx wrangler d1 execute mocha-orders --remote \
  --command "DELETE FROM orders WHERE phone = '0912345678'"

# Sao lưu
npx wrangler d1 export mocha-orders --remote --output=sao-luu-$(date +%F).sql
```

Nên đặt lịch sao lưu hằng tuần. D1 có bản sao của Cloudflare, nhưng một lệnh
`DELETE` gõ nhầm thì bản sao đó cũng chép theo.

## Còn thiếu

- **Xoá theo thời hạn.** Chưa có. Cần chốt giữ đơn bao lâu sau khi giao xong
  (đề xuất 24 tháng, theo nghĩa vụ chứng từ kế toán) rồi thêm lịch xoá.
- **Nút xoá trên `/admin`.** Câu đồng ý đã hứa với khách "có thể yêu cầu xoá bất
  cứ lúc nào"; hiện phải xoá bằng dòng lệnh ở trên.
- **Chạy thử trên Cloudflare thật.** Toàn bộ đã kiểm bằng SQLite thật và trình
  duyệt thật, nhưng lần deploy đầu vẫn phải đặt thử một đơn để xác nhận binding
  và secret đúng.
