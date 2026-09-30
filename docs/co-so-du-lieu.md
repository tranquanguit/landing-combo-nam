# Cơ sở dữ liệu

Hướng dẫn vận hành cho người không viết code. Cài đặt máy chủ nằm ở
[`trien-khai-docker.md`](trien-khai-docker.md); nhập nội dung ở [`nhap-lieu.md`](nhap-lieu.md).

## Dữ liệu nằm ở đâu

Một CSDL **PostgreSQL** (container `db`) trên máy chủ Ubuntu, cùng máy với website.
Lược đồ ở `db/pg/*.sql`, tự áp khi container `app` khởi động.

| Bảng | Chứa gì |
|---|---|
| `orders` | đơn hàng — dữ liệu cá nhân của khách, chỉ để xác nhận và giao đơn |
| `rate_limit` | đếm nhịp gửi đơn theo IP **đã băm có muối** (chống spam), không lưu IP thô |
| `content_entries`, `content_revisions` | nội dung website + lịch sử mọi lần sửa |
| `media` | ảnh (lưu ngay trong CSDL, nên một bản sao lưu là đủ cả chữ lẫn ảnh) |
| `admin_users`, `admin_sessions` | tài khoản quản trị (mật khẩu băm scrypt), phiên đăng nhập (chỉ lưu băm) |
| `publish_runs` | nhật ký các lần xuất bản |

## Xem đơn

Vào **`mochatrinam.com/admin/orders`**, đăng nhập bằng tài khoản quản trị. Lọc theo
trạng thái, đổi trạng thái và ghi chú ngay trên bảng.

Sáu trạng thái: **Mới → Đã gọi → Đã xác nhận → Đang giao → Hoàn tất**, và **Huỷ**.

Xuất CSV (mở bằng Excel):

```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" "https://mochatrinam.com/api/admin/orders?format=csv" -o don-hang.csv
```

> ⚠️ Trang này hiển thị họ tên, số điện thoại và địa chỉ nhà của khách. Không mở
> trên máy dùng chung, không chụp màn hình gửi qua chat, không chuyển tiếp file
> CSV ra ngoài nhóm xử lý đơn.

## Việc thường gặp

```bash
# mở psql
docker compose exec db psql -U mocha -d mocha

# Đếm đơn theo ngày
SELECT substr(created_at, 1, 10) AS ngay, count(*) FROM orders GROUP BY 1 ORDER BY 1 DESC;

# Đơn đến từ chiến dịch nào
SELECT utm_source, utm_campaign, count(*) FROM orders GROUP BY 1, 2 ORDER BY 3 DESC;

# Khách yêu cầu xoá dữ liệu (Nghị định 13/2023/NĐ-CP) — xoá theo số điện thoại
DELETE FROM orders WHERE phone = '0912345678';
```

## Sao lưu

```bash
docker compose exec -T db pg_dump -U mocha -Fc mocha > sao-luu-$(date +%F).dump
```

Hằng đêm, chép ra ngoài máy chủ. Một lệnh `DELETE` gõ nhầm thì chỉ bản sao lưu cứu được.
Khôi phục: xem [`trien-khai-docker.md`](trien-khai-docker.md) mục 4.
