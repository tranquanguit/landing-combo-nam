# Đưa website lên production

Giả định: đã có **một máy chủ Ubuntu** (22.04 hoặc 24.04, có IP công khai, đăng nhập SSH được)
và **một tên miền** (ví dụ `mochatrinam.com`) có quyền sửa DNS. Làm lần lượt từ bước 1 đến
bước 9; phần Google ở cuối (bước 10–14) làm sau khi trang đã chạy bằng HTTPS.

Thời gian: khoảng 1 giờ cho bước 1–9 (phần lớn là chờ DNS và build), thêm 30 phút cho Google.

Sau khi lên, website gồm ba phần, tất cả trên một máy chủ:

| Địa chỉ | Dành cho |
|---|---|
| `https://mochatrinam.com` | khách: website, đặt hàng, bong bóng chat |
| `https://www.mochatrinam.com` | tự chuyển về địa chỉ trên |
| `https://admin.mochatrinam.com/admin/` | nhân viên: nhập liệu, đơn hàng, chat, xuất bản |

Trang quản trị đặt ở tên miền con riêng có lý do: website chạy mã Google/Facebook/TikTok, và
tách tên miền thì các mã đó không đọc được đơn hàng hay thao tác được trang quản trị.

---

## 1. Máy chủ cần gì

| | Tối thiểu | Nên dùng |
|---|---|---|
| CPU / RAM | 2 vCPU / 2 GB + 2 GB swap | 2 vCPU / 4 GB |
| Ổ đĩa | 30 GB SSD | 40 GB SSD |
| Hệ điều hành | Ubuntu 22.04 / 24.04 LTS | |

Nút **Xuất bản** build lại website ngay trên máy chủ: mỗi lần build dùng khoảng 1–1,5 GB RAM
trong 1–2 phút. Với 2 GB RAM thì bắt buộc tạo swap (bước 3).

## 2. Trỏ tên miền (DNS)

Ở nơi quản lý tên miền, tạo 3 bản ghi **A** trỏ về IP máy chủ:

| Tên | Loại | Giá trị |
|---|---|---|
| `@` (mochatrinam.com) | A | `<IP máy chủ>` |
| `www` | A | `<IP máy chủ>` |
| `admin` | A | `<IP máy chủ>` |

Nếu máy chủ có IPv6 thì thêm 3 bản ghi **AAAA** tương ứng; nếu không, **không** để bản ghi
AAAA cũ nào trỏ chỗ khác (Let's Encrypt sẽ cấp chứng chỉ thất bại).

Kiểm tra (từ máy bất kỳ) — cả ba phải ra đúng IP trước khi sang bước 5:

```bash
dig +short mochatrinam.com www.mochatrinam.com admin.mochatrinam.com
```

Nếu tên miền đang dùng Cloudflare: để **DNS only** (đám mây xám) cho cả ba bản ghi. Bật proxy
của Cloudflare thì mọi khách sẽ hiện cùng một IP và bộ chống spam đơn hàng chặn nhầm khách thật.

## 3. Chuẩn bị máy chủ (một lần)

Đăng nhập SSH bằng tài khoản có quyền `sudo`:

```bash
# Cập nhật, giờ Việt Nam, công cụ cơ bản
sudo apt update && sudo apt -y upgrade
sudo timedatectl set-timezone Asia/Ho_Chi_Minh
sudo apt install -y ca-certificates curl git ufw

# Docker (bản chính thức, có sẵn docker compose)
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
# -> đăng xuất SSH rồi đăng nhập lại để nhận quyền docker

# Tường lửa: chỉ mở SSH và web
sudo ufw allow OpenSSH
sudo ufw allow 80,443/tcp
sudo ufw enable

# Swap 2 GB (bắt buộc nếu RAM dưới 4 GB)
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

Lưu ý: Docker tự mở cổng 80/443 cho Caddy kể cả khi `ufw` chặn — đó là ý muốn ở đây. Postgres
và cổng 8080 của app **không** mở ra ngoài (đã cấu hình sẵn trong `docker-compose.yml`).

## 4. Lấy mã nguồn

```bash
cd ~
git clone https://github.com/tranquanguit/landing-combo-nam.git mocha
cd mocha
```

Kho là private thì tạo **deploy key** (khoá chỉ-đọc cho riêng máy chủ):

```bash
ssh-keygen -t ed25519 -f ~/.ssh/mocha_deploy -N ""
cat ~/.ssh/mocha_deploy.pub
# GitHub → repo → Settings → Deploy keys → Add (không tick "Allow write access")
GIT_SSH_COMMAND="ssh -i ~/.ssh/mocha_deploy" git clone git@github.com:tranquanguit/landing-combo-nam.git mocha
```

## 5. Điền cấu hình `.env`

```bash
cp .env.example .env
chmod 600 .env          # chứa mật khẩu — chỉ chủ máy đọc được
nano .env
```

Sinh các chuỗi bí mật bằng `openssl rand -base64 36` (mỗi biến một chuỗi khác nhau):

| Biến | Điền |
|---|---|
| `POSTGRES_PASSWORD` | chuỗi bí mật |
| `ADMIN_TOKEN` | chuỗi bí mật (≥ 24 ký tự) — dùng cho API xuất đơn hàng / chat |
| `IP_SALT` | chuỗi bí mật — muối băm IP chống spam. **Không đổi** sau khi chạy |
| `ADMIN_BOOTSTRAP_USER` | tên đăng nhập quản trị đầu tiên, ví dụ `admin` |
| `ADMIN_BOOTSTRAP_PASSWORD` | mật khẩu tạm cho lần đăng nhập đầu (≥ 10 ký tự); xoá sau bước 7 |
| `PUBLIC_SITE_URL` | `https://mochatrinam.com` (không có `/` cuối) |
| `SITE_DOMAIN` | `mochatrinam.com` |
| `ADMIN_HOST` | `admin.mochatrinam.com` |
| `COOKIE_SECURE` | `1` |
| `PUBLIC_GA4_ID` … | để trống lúc đầu; điền ở bước 13 |
| `N8N_*`, `CHAT_MODE` | để trống — chat chạy bằng kịch bản tư vấn; nối n8n sau trên trang quản trị |

Dùng tên miền khác `mochatrinam.com` thì thay ở cả `PUBLIC_SITE_URL`, `SITE_DOMAIN`, `ADMIN_HOST`.

## 6. Build và chạy

```bash
docker compose --profile https up -d --build
docker compose logs -f app        # Ctrl+C để thoát xem log (container vẫn chạy)
```

Lần đầu mất 5–10 phút (tải image, cài thư viện, build website). Log của `app` lần lượt có:

```
[mocha]   migrate 0001_orders.sql … 0004_chat_admin_rules_analytics.sql
[mocha]   tạo tài khoản quản trị đầu tiên: admin
[mocha]   nạp 39 kịch bản tư vấn mẫu
[mocha] nạp nội dung lần đầu từ image: … nội dung, … ảnh
[mocha] đang chạy ở cổng 8080
[mocha] xuất bản lúc khởi động #1: thành công
```

Kiểm tra:

```bash
docker compose ps                                   # db, app: healthy; caddy: running
curl -s https://mochatrinam.com/healthz             # -> ok
curl -sI https://www.mochatrinam.com | head -3      # -> 301 về https://mochatrinam.com
curl -sI https://mochatrinam.com/admin/ | head -1   # -> 404 (admin không mở ở tên miền chính)
curl -sI https://admin.mochatrinam.com/admin/login | head -1   # -> 200
```

Caddy không cấp được chứng chỉ (log `docker compose logs caddy` có `challenge failed`) thì
gần như luôn do DNS (bước 2) chưa trỏ đúng hoặc cổng 80 bị chặn ở nhà cung cấp máy chủ.

## 7. Đăng nhập lần đầu và khoá lại

1. Mở `https://admin.mochatrinam.com/admin/`, đăng nhập bằng `ADMIN_BOOTSTRAP_USER` /
   `ADMIN_BOOTSTRAP_PASSWORD`.
2. **Tài khoản** → nhập lại đúng tên đó với **mật khẩu mới** (≥ 10 ký tự) → Lưu. Trang sẽ đưa
   về màn đăng nhập; đăng nhập bằng mật khẩu mới.
3. Tạo tài khoản cho từng nhân viên (quyền **Biên tập**). Không dùng chung một tài khoản —
   lịch sử sửa ghi theo tên đăng nhập.
4. Trên máy chủ, xoá mật khẩu tạm:
   ```bash
   sed -i 's/^ADMIN_BOOTSTRAP_PASSWORD=.*/ADMIN_BOOTSTRAP_PASSWORD=/' .env
   docker compose --profile https up -d
   ```

## 8. Kiểm tra trước khi mở cho khách

Trên điện thoại thật (4G, không wifi):

- [ ] Trang chủ, `/combo-nam/`, `/chung-nhan/` mở nhanh, ảnh đủ, không lỗi chữ.
- [ ] Đặt một đơn thử ở `/combo-nam/` → đơn hiện trong **Đơn hàng** trên trang quản trị → đổi
      trạng thái sang **Huỷ**, ghi chú "đơn thử".
- [ ] Bong bóng chat: hỏi "giá combo bao nhiêu" → có thẻ sản phẩm đúng giá.
- [ ] Trang quản trị → **Xuất bản** → **Xuất bản ngay** → kết quả **thành công** sau 1–2 phút.
- [ ] Giá và số điện thoại hotline trên trang đúng với thực tế.

Có thể chạy thêm bộ kiểm tra tự động (đặt đơn thử, chat, xuất bản, header bảo mật…) ngay trên
máy chủ; nó dựng một bản tạm riêng rồi xoá, không đụng tới dữ liệu thật:

```bash
docker compose -p mocha-verify --env-file deploy/verify.env -f docker-compose.yml -f deploy/verify.compose.yml \
  up --build --abort-on-container-exit --exit-code-from verify
docker compose -p mocha-verify --env-file deploy/verify.env -f docker-compose.yml -f deploy/verify.compose.yml down -v
```

## 9. Sao lưu, theo dõi, cập nhật

**Sao lưu** — mọi thứ (đơn, nội dung, ảnh, tài khoản, chat) nằm trong một CSDL:

```bash
chmod +x deploy/backup.sh
sudo mkdir -p /var/backups/mocha && sudo chown $USER /var/backups/mocha
deploy/backup.sh                     # thử một lần
crontab -e                           # thêm dòng sau: 2 giờ 15 sáng mỗi ngày
15 2 * * * /home/<user>/mocha/deploy/backup.sh >> /home/<user>/mocha-backup.log 2>&1
```

Bản sao lưu nằm trên cùng máy chủ thì chưa an toàn: chép thêm ra ngoài (Google Drive qua
`rclone`, hoặc `scp` về máy khác) ít nhất mỗi tuần. File sao lưu chứa dữ liệu cá nhân của khách.

Khôi phục:

```bash
docker compose up -d db
docker compose exec -T db pg_restore -U mocha -d mocha --clean --if-exists < /var/backups/mocha/mocha-YYYYMMDD-HHMMSS.dump
docker compose --profile https up -d
```

**Theo dõi** — đăng ký một dịch vụ kiểm tra miễn phí (UptimeRobot, Better Stack…) gọi
`https://mochatrinam.com/healthz` mỗi 5 phút, báo qua email/Zalo khi khác `ok`.

```bash
docker compose ps                  # trạng thái
docker compose logs --tail 200 app # log gần nhất (log tự xoay vòng, tối đa 50 MB mỗi dịch vụ)
df -h /                            # dung lượng ổ đĩa
```

**Cập nhật mã nguồn** khi có bản mới:

```bash
cd ~/mocha
deploy/backup.sh                                  # luôn sao lưu trước
git pull
docker compose --profile https up -d --build
```

Nội dung đang chạy (giá, câu chữ, ảnh đã sửa trên trang quản trị) **không** bị ghi đè khi cập
nhật — CSDL là bản gốc. Nếu bản mới có thêm sản phẩm/bài viết trong mã nguồn, nạp riêng các
mục **mới** (không đụng mục đã có) rồi xuất bản:

```bash
docker compose exec app node --import ./scripts/shim/register.mjs server/cli.ts import --only-new
# rồi vào trang quản trị -> Xuất bản
```

Quay lại bản trước nếu bản mới lỗi: `git checkout <mã commit cũ>` rồi chạy lại lệnh
`docker compose … up -d --build`; nếu dữ liệu cũng hỏng thì khôi phục bản sao lưu.

---

# Phần Google — để khách tìm thấy

Website đã tự sinh sẵn mọi file Google cần, **không phải tải file nào lên Google**:

| Đã có sẵn | Địa chỉ |
|---|---|
| Sơ đồ trang (sitemap) — mọi trang vi + en | `https://mochatrinam.com/sitemap-index.xml` |
| `robots.txt` — cho phép Google, Bing và các trợ lý AI đọc; chỉ đường tới sitemap | `https://mochatrinam.com/robots.txt` |
| Dữ liệu có cấu trúc (JSON-LD): Product, Offer, phí ship, chính sách đổi trả, FAQ, HowTo, Breadcrumb, Organization | trong mã HTML từng trang |
| `hreflang` vi-VN / en / x-default, `canonical` | trong mã HTML từng trang |
| Ảnh chia sẻ (og:image) | trong mã HTML từng trang |
| `llms.txt` — tóm tắt cho trợ lý AI | `https://mochatrinam.com/llms.txt` |
| Trang quản trị gắn `noindex` | không bao giờ lên kết quả tìm kiếm |

Việc còn lại là **khai báo quyền sở hữu** và **nộp sitemap**.

## 10. Google Search Console (bắt buộc)

1. Vào <https://search.google.com/search-console> → **Thêm thuộc tính** → chọn **Miền** (Domain),
   nhập `mochatrinam.com` (không có https, không có www).
2. Google đưa một bản ghi **TXT** dạng `google-site-verification=…` → thêm vào DNS (tên `@`,
   loại TXT) → đợi 5–30 phút → bấm **Xác minh**. Cách này bao trọn http/https/www/admin,
   không cần đặt file xác minh nào lên website.
3. **Sơ đồ trang web** → nhập `sitemap-index.xml` → **Gửi**. Trạng thái phải là "Thành công".
4. **Kiểm tra URL** → dán lần lượt trang chủ, `/combo-nam/` và 3–4 trang sản phẩm chính →
   **Yêu cầu lập chỉ mục** cho từng trang (mỗi ngày làm được khoảng 10 trang).
5. Sau 3–7 ngày, xem:
   - **Trang** (Lập chỉ mục): các trang chính phải ở mục "Đã lập chỉ mục". Mục "Trang thay thế có
     thẻ chính tắc thích hợp" là **bình thường** (link có `?utm_…` gộp về trang gốc).
   - **Cải tiến / Mua sắm**: "Đoạn trích sản phẩm", "Trang thông tin người bán" — không được có lỗi.
   - **Chỉ số Web thiết yếu**: cần vài tuần có người truy cập mới có số liệu.

Không cần gửi riêng các trang tiếng Anh: sitemap và `hreflang` đã khai cả hai ngôn ngữ.

## 11. Bing Webmaster Tools (nên làm, 5 phút)

Bing cung cấp kết quả cho Copilot, DuckDuckGo và một phần tìm kiếm của ChatGPT.
<https://www.bing.com/webmasters> → **Import from Google Search Console** → chọn
`mochatrinam.com`. Bing tự lấy quyền sở hữu và sitemap từ Google, không phải làm lại.

## 12. Kiểm tra dữ liệu có cấu trúc (một lần, sau khi lên)

- <https://search.google.com/test/rich-results> → dán `https://mochatrinam.com/combo-nam/`
  → phải thấy **Đoạn trích sản phẩm** và **Trang thông tin người bán** hợp lệ, có giá, phí ship,
  chính sách đổi trả.
- Câu hỏi thường gặp (FAQ) vẫn được khai đúng chuẩn, nhưng từ 2023 Google chỉ hiện ô FAQ trên
  kết quả cho trang của cơ quan nhà nước và y tế — không thấy ô FAQ là bình thường.
- **Không** thêm điểm đánh giá sao (aggregateRating) hay đánh giá tự viết: Google phạt thao tác
  thủ công khi phát hiện đánh giá không có thật, và quảng cáo mỹ phẩm bằng đánh giá khách cần
  bằng chứng theo Nghị định 342/2025. Chỉ thêm khi có hệ thống đánh giá thật từ người mua.

## 13. Google Analytics 4 (khi muốn đo quảng cáo)

1. <https://analytics.google.com> → tạo **Thuộc tính** → **Luồng dữ liệu web** →
   `https://mochatrinam.com` → chép **Mã đo lường** `G-XXXXXXXXXX`.
2. Trên máy chủ: điền `PUBLIC_GA4_ID=G-XXXXXXXXXX` trong `.env` (Meta/TikTok Pixel tương tự,
   `PUBLIC_META_PIXEL_ID`, `PUBLIC_TIKTOK_PIXEL_ID`), rồi
   `docker compose --profile https up -d --build`.
3. Website hỏi khách đồng ý trước khi chạy mã đo lường (Nghị định 13/2023) — số liệu sẽ thấp
   hơn số người vào thật; đó là đúng.
4. GA4 → **Quản trị** → **Liên kết Search Console** → chọn thuộc tính ở bước 10.

## 14. Tuỳ chọn khi đã ổn định

- **Google Merchant Center** (<https://merchants.google.com>) — hiện sản phẩm miễn phí ở tab
  Mua sắm. Khai thông tin doanh nghiệp, chọn **thêm sản phẩm từ website** (Google đọc dữ liệu
  Product/Offer sẵn có trên trang), khai phí ship và chính sách đổi trả trùng với trang
  `/chinh-sach/`. Mỹ phẩm được phép, nhưng mọi câu chữ phải hợp lệ như trên website.
- **Google Business Profile** (<https://business.google.com>) — nếu có địa chỉ kinh doanh và
  hotline công khai; giúp tên thương hiệu hiện bảng thông tin khi khách tìm "Mocha".

## Lỗi hay gặp

| Hiện tượng | Nguyên nhân thường gặp |
|---|---|
| Trình duyệt báo chứng chỉ không hợp lệ | DNS chưa trỏ đúng / chưa đủ thời gian; xem `docker compose logs caddy` |
| Đăng nhập trang quản trị xong lại về màn đăng nhập | đang mở bằng `http://` mà `COOKIE_SECURE=1` — luôn dùng `https://` |
| "Thử sai quá nhiều lần" khi đăng nhập | quá 10 lần thử đăng nhập trong 15 phút từ một mạng (hoặc 20 lần với một tên): đợi 15 phút |
| Xuất bản báo **lỗi** | mở nhật ký trên trang Xuất bản — dòng cuối nói rõ nội dung nào sai; website đang chạy giữ nguyên |
| Đơn hàng báo "gửi quá nhanh" với khách thật | máy chủ đặt sau một proxy khác (Cloudflare bật proxy…) — để DNS only, xem bước 2 |
| Hết dung lượng ổ đĩa | `docker system prune -f` (xoá image cũ sau nhiều lần build), kiểm tra `/var/backups/mocha` |

Tài liệu liên quan: vận hành hằng ngày [`trien-khai-docker.md`](trien-khai-docker.md) ·
nhập liệu [`nhap-lieu.md`](nhap-lieu.md) · chat và n8n [`chat-n8n.md`](chat-n8n.md) ·
dữ liệu chat [`chat-analytics.md`](chat-analytics.md).
