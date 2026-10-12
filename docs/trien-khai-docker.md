# Triển khai trên Ubuntu bằng Docker

> Đưa lên máy chủ thật lần đầu (DNS, `.env`, HTTPS, sao lưu, Google Search Console): làm theo
> [`dua-len-production.md`](dua-len-production.md). Tài liệu này là phần vận hành hằng ngày.

Một máy chủ Ubuntu chạy ba container:

| Container | Việc |
|---|---|
| `db` | Postgres 17 — đơn hàng, **nội dung**, **ảnh**, tài khoản quản trị, lịch sử sửa, lịch sử xuất bản |
| `app` | Node 24 — phục vụ website (file tĩnh đã build), nhận đơn `/api/orders`, chat `/api/chat`, trang quản trị `/admin` |
| `caddy` | HTTPS tự động bằng Let's Encrypt cho tên miền chính, `www` và tên miền con quản trị (`ADMIN_HOST`) |

Nội dung **nhập ở Postgres**, website **vẫn là trang tĩnh** được build từ nội dung
đó. Bấm "Xuất bản" trong `/admin` thì `app` ghi nội dung ra file, chạy `astro
build` (mọi hàng rào của schema chạy ở bước này), và chỉ khi build xanh mới đổi
sang bản mới. Build đỏ thì bản đang chạy giữ nguyên.

## 1. Chuẩn bị máy chủ (một lần)

```bash
# Ubuntu 22.04/24.04
sudo apt update && sudo apt install -y ca-certificates curl git
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER   # đăng xuất / đăng nhập lại

# Mở cổng web
sudo ufw allow OpenSSH && sudo ufw allow 80,443/tcp && sudo ufw enable
```

Trỏ bản ghi DNS `A` của tên miền (và `www`) về IP máy chủ **trước** khi bật Caddy
— Let's Encrypt kiểm tên miền lúc cấp chứng chỉ.

## 2. Cài và chạy

```bash
git clone <repo> mocha && cd mocha
cp .env.example .env
nano .env        # điền POSTGRES_PASSWORD, ADMIN_TOKEN, IP_SALT, ADMIN_BOOTSTRAP_PASSWORD
                 # sinh chuỗi bí mật: openssl rand -base64 36

docker compose --profile https up -d --build   # có HTTPS qua Caddy
# hoặc, nếu máy chủ đã có nginx: docker compose up -d --build  rồi proxy tới 127.0.0.1:8080
```

Lần chạy đầu `app` tự:

1. áp migration `db/pg/*.sql`;
2. tạo tài khoản quản trị từ `ADMIN_BOOTSTRAP_USER` / `ADMIN_BOOTSTRAP_PASSWORD`;
3. nạp toàn bộ nội dung + ảnh đang có trong image vào Postgres;
4. build lại site từ Postgres (ở nền; trong lúc đó vẫn phục vụ bản có sẵn trong image).

Kiểm tra: `curl -s https://<tên-miền>/healthz` → `ok`. Vào `https://<ADMIN_HOST>/admin/`
(ví dụ `https://admin.mochatrinam.com/admin/`; chưa đặt `ADMIN_HOST` thì `https://<tên-miền>/admin/`),
đăng nhập, rồi **xoá `ADMIN_BOOTSTRAP_PASSWORD` khỏi `.env`** và đặt mật khẩu mới ở
**Tài khoản**.

## 3. Việc hằng ngày

| Việc | Ở đâu |
|---|---|
| Sửa giá, nội dung, số công bố | `/admin` → Sản phẩm → Sửa → Kiểm tra & lưu → **Xuất bản** |
| Thêm giấy tờ | `/admin/media` tải ảnh (đã che thông tin cá nhân) vào `documents` → Giấy tờ → Thêm mới → Xuất bản |
| Xem / gọi lại đơn | `/admin/orders` |
| Xuất CSV đơn hàng | `curl -H "Authorization: Bearer $ADMIN_TOKEN" "https://<tên-miền>/api/admin/orders?format=csv"` |
| Thêm người nhập liệu | `/admin/users` (tài khoản quyền admin) |

Hướng dẫn nhập liệu chi tiết: [`nhap-lieu.md`](nhap-lieu.md).

## 4. Sao lưu và khôi phục

Mọi thứ cần giữ nằm trong **một** CSDL (kể cả ảnh), nên một `pg_dump` là đủ:

```bash
# sao lưu (nên đặt cron hằng đêm, chép ra ngoài máy chủ)
docker compose exec -T db pg_dump -U mocha -Fc mocha > backup-$(date +%F).dump

# khôi phục vào máy mới
docker compose up -d db
docker compose exec -T db pg_restore -U mocha -d mocha --clean --if-exists < backup-2026-10-01.dump
docker compose up -d app
```

## 5. Cập nhật mã nguồn

```bash
deploy/backup.sh && git pull
docker compose --profile https up -d --build
docker compose logs app | grep -E "đồng bộ|giữ bản|xuất bản"
```

Lúc khởi động, máy chủ làm theo thứ tự: migration → **đồng bộ bản code mới vào CSDL** → xuất bản.
Đồng bộ (`syncFromFiles`, bật mặc định, tắt bằng `SYNC_ON_BOOT=0`):

| Mục trong CSDL | Bản mới có thay đổi |
|---|---|
| chưa có | thêm |
| có, lần ghi cuối là máy (nạp lần đầu, `import`, `sync`) | cập nhật theo bản mới — câu chữ, khối mới, ảnh làm lại |
| có, nhân viên đã sửa trong trang quản trị | **giữ** bản trang quản trị, ghi tên mục vào log ("giữ bản đã sửa…") |
| Thông tin cửa hàng (`brand/mocha`) đã sửa tay | giữ giá trị đã điền, chỉ bổ sung trường / tổ chức công bố mới |
| đã xoá trong trang quản trị | không thêm lại |

Log phải có hai dòng `đồng bộ bản code mới: …` và `xuất bản lúc khởi động #N: thành công`.

### Vì sao đồng bộ phải chạy TRƯỚC xuất bản

Xuất bản **ghi CSDL ra `src/content` và xoá mọi file không có trong CSDL**. Nếu xuất bản
chạy trước, nó dọn sạch nội dung mới vừa theo image vào; thứ tự sai cho lỗi khó đoán —
một combo tiếng Anh báo "chứa sản phẩm chưa xuất bản ở ngôn ngữ này" vì `en.json` của
mấy món đó vừa bị xoá khỏi đĩa. Đồng bộ đọc `src/` khi nó còn nguyên bản trong image,
nên lần deploy 2026-10-11 (phải tắt `PUBLISH_ON_BOOT`, nạp tay, ghi đè riêng
`brand/mocha` từ file trên host) không cần lặp lại nữa.

### Lấy bản mới cho một mục đã sửa tay

Mục có tên trong dòng "giữ bản đã sửa trong trang quản trị" là mục cả nhân viên lẫn bản
mới cùng sửa. Muốn lấy bản mới (mất phần sửa tay) thì ghi đè có chủ đích, rồi Xuất bản:

```bash
docker compose exec app node --import ./scripts/shim/register.mjs server/cli.ts import --entries products/uv-block-sunscreen/vi < /dev/null
docker compose exec app node --import ./scripts/shim/register.mjs server/cli.ts sync < /dev/null      # chạy lại đồng bộ, in báo cáo
```

Một sản phẩm trỏ tới tổ chức công bố chưa khai trong Thông tin cửa hàng **không** còn làm
hỏng cả lần xuất bản: build cảnh báo và trang sản phẩm đó hiện "cần bổ sung".

> `docker compose exec -T` nhận stdin. Chạy nó trong một script truyền qua
> `ssh 'bash -s' < script` thì nó ăn luôn phần script còn lại và các lệnh sau im lặng
> không chạy. Thêm `< /dev/null` vào mỗi lệnh `exec -T` trong script.

Muốn đưa nội dung đang chạy thật về repo (để commit, để review diff):

```bash
docker compose exec app node --import ./scripts/shim/register.mjs server/cli.ts export --out /tmp/out
docker compose cp app:/tmp/out/src ./src
git diff src/content
```

## 6. Lệnh vận hành

```bash
docker compose exec app node --import ./scripts/shim/register.mjs server/cli.ts <lệnh>
#   validate        kiểm mọi nội dung trong CSDL bằng schema
#   publish         xuất bản một lần
#   import --only-new  chỉ nạp nội dung/ảnh chưa có trong CSDL (dùng khi cập nhật bản mới)
#   import --entries products/x/vi,...  ghi đè đúng các mục bản mới đã sửa
#   import          nạp lại TOÀN BỘ nội dung từ file trong image (GHI ĐÈ bản trùng mã — cẩn thận)
#   user <tên> admin   (mật khẩu trong biến ADMIN_PASSWORD)
docker compose logs -f app
```

## 7. Bảo mật đã có sẵn

- Postgres không mở cổng ra ngoài; `app` chỉ nghe trên `127.0.0.1`. Log Docker xoay vòng (10 MB × 5 mỗi dịch vụ).
- Trang quản trị ở tên miền con riêng (`ADMIN_HOST`): script GTM/Facebook/TikTok của website không
  chạm được vào nó; thêm nữa, mọi `fetch()` từ script trong trình duyệt tới `/admin` bị từ chối
  (chỉ nhận điều hướng thật của trình duyệt), header `Cross-Origin-Opener-Policy: same-origin`.
- Đăng nhập: tối đa 10 lần / 15 phút mỗi IP và 20 lần mỗi tên đăng nhập; đổi mật khẩu thì mọi
  phiên cũ phải đăng nhập lại.
- Giới hạn kích thước yêu cầu theo đường dẫn (đơn hàng 64 KB, chat 8 MB, ảnh 30 MB) áp trước
  khi đọc; chat và sự kiện chat giới hạn nhịp theo IP (IPv6 theo khối /64); yêu cầu bị chặn không
  ghi gì vào CSDL; bảng giới hạn nhịp tự dọn mỗi giờ.
- Header bảo mật (CSP, HSTS, nosniff…) đọc từ chính `public/_headers`.
- `/admin`: mật khẩu băm scrypt, phiên lưu dạng băm, cookie `HttpOnly; Secure; SameSite=Strict`,
  mọi POST phải cùng Origin, không cache, `noindex`.
- Đơn hàng: CSDL tự từ chối đơn không có đồng ý dữ liệu; IP chỉ lưu dạng băm có muối để chống spam.
- Nhật ký không ghi nội dung đơn (dữ liệu cá nhân).

## 8. Giới hạn đã biết

- Build trong image không có thư mục `.git`, nên `lastmod` trong sitemap để trống (bản
  build trên CI vẫn có). Không ảnh hưởng hiển thị.
- `test:perf` đo LCP trên 4G mô phỏng; trên máy bận (ngay sau khi build) số đo dao động
  tới ~1 giây. Đo lại khi máy yên trước khi kết luận.
