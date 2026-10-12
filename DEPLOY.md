# Hướng dẫn deploy lên Ubuntu server

Tài liệu cho người **cập nhật website đang chạy** trên máy chủ Ubuntu (Docker) lên bản mới nhất
của nhánh `main`. Làm lần lượt từ bước 1 tới bước 7, chạy đúng lệnh, và kiểm đúng kết quả ghi ở
mỗi bước. Mất khoảng 10–15 phút. Website **không** bị trắng trong lúc build: bản cũ vẫn chạy cho
tới khi bản mới sẵn sàng.

> **Máy chủ chưa từng cài?** Làm theo [`docs/dua-len-production.md`](docs/dua-len-production.md)
> mục 1–8 (chuẩn bị máy, DNS, `.env`, chạy lần đầu). Tài liệu này dành cho các lần cập nhật sau.

> **Không còn dùng quy trình cũ** (`PUBLISH_ON_BOOT=0`, `import --only-new`, `import --entries
> brand/mocha`…). Từ bản `045f148`, máy chủ tự đồng bộ nội dung của bản mới mỗi lần khởi động.
> Chạy lại các lệnh cũ không cần thiết và có thể ghi đè chỉnh sửa trên trang quản trị.

---

## 0. Trước khi bắt đầu

```bash
ssh <user>@<máy-chủ>
cd ~/mocha                                   # thư mục chứa mã nguồn trên máy chủ

docker compose ps                            # db, app: healthy · caddy: running
df -h /                                      # còn trống ít nhất 3 GB
free -h                                      # RAM + swap tổng ít nhất 3 GB (build cần ~1,5 GB)
git status --short                           # PHẢI trống
```

- `git status --short` có dòng nào → **dừng lại**, chụp kết quả gửi người phụ trách. Đó là file bị
  sửa trực tiếp trên máy chủ; pull đè lên sẽ mất hoặc xung đột.
- Ổ đĩa gần đầy → `docker system prune -f` (xoá image cũ của các lần build trước), kiểm lại.

Lấy tên miền đang cấu hình (dùng ở các bước sau):

```bash
SITE=$(grep -oP '^PUBLIC_SITE_URL=\K.*' .env); ADMIN=$(grep -oP '^ADMIN_HOST=\K.*' .env)
echo "$SITE  |  https://$ADMIN"
```

## 1. Sao lưu

```bash
deploy/backup.sh
```

Kết quả: `… đã sao lưu /var/backups/mocha/mocha-YYYYMMDD-HHMMSS.dump (… MB)`.
**Ghi lại tên file** — cần nếu phải khôi phục (mục "Quay lại bản trước").

## 2. Lấy mã nguồn mới

```bash
OLD=$(git rev-parse --short HEAD); echo "bản đang chạy: $OLD"     # ghi lại để quay lại khi cần
git fetch origin
git checkout main
git pull --ff-only origin main
git log --oneline -1                                               # bản sắp deploy
```

`git pull` báo lỗi "Not possible to fast-forward" → **dừng lại**, gửi kết quả cho người phụ trách.

## 3. Kiểm tra biến cấu hình mới

```bash
comm -13 <(grep -oE '^[A-Z0-9_]+=' .env | sort) <(grep -oE '^[A-Z0-9_]+=' .env.example | sort)
```

- **Không in gì** → bỏ qua bước này.
- In ra tên biến → mở `.env.example` đọc chú thích của biến đó, thêm vào `.env` (`nano .env`).
  Riêng `SYNC_ON_BOOT` không bắt buộc: không khai thì mặc định là `1` (bật).

## 4. Build và khởi động bản mới

```bash
docker compose --profile https up -d --build
```

Mất 5–10 phút (cài thư viện, build website, kiểm ngân sách dung lượng trang). Lệnh kết thúc với
`Container mocha-app-1 Started` (tên có thể khác chút). Nếu dừng giữa chừng với lỗi → xem mục
"Lỗi hay gặp".

## 5. Theo dõi khởi động

```bash
docker compose logs -f app
```

Chờ tới khi thấy các dòng sau (thứ tự này), rồi **Ctrl+C** để thoát xem log — container vẫn chạy:

```
[mocha] đồng bộ bản code mới: thêm …, cập nhật …, bổ sung … nội dung; ảnh thêm …, cập nhật …
[mocha] đang chạy ở cổng 8080
[mocha] xuất bản lúc khởi động #N: thành công
```

- `xuất bản lúc khởi động #N: thành công` thường đến sau 2–4 phút. Trước khi có dòng này, website
  vẫn phục vụ bản cũ — bình thường.
- Có dòng `giữ bản đã sửa trong trang quản trị (bản code mới KHÁC — kiểm tra lại): …` → **ghi lại
  danh sách đó** vào báo cáo (bước 7). Đó là những mục nhân viên đã sửa tay trên trang quản trị và
  bản mới cũng sửa; hệ thống giữ bản của nhân viên. Không cần làm gì thêm ở bước này.
- Có dòng `xuất bản lúc khởi động #N: LỖI` → xem mục "Lỗi hay gặp".

Xem lại các dòng quan trọng bất cứ lúc nào:

```bash
docker compose logs app | grep -E "đồng bộ|giữ bản|xuất bản"
```

## 6. Kiểm tra sau deploy

**Tự động** (chạy trên máy chủ):

```bash
docker compose ps                                               # db, app: healthy
curl -s  "$SITE/healthz"                                        # -> ok
for p in / /combo/ /combo-nam/ /uv-block-sunscreen/ /hairborn-peel-ion/ /lien-he/ /sitemap-index.xml; do
  printf '%-24s %s\n' "$p" "$(curl -s -o /dev/null -w '%{http_code}' "$SITE$p")"
done                                                            # mọi dòng -> 200
curl -s "$SITE/uv-block-sunscreen/" | grep -c 'id="combo-co-san-pham"'   # -> 1 (khối combo mới có trên trang cũ)
curl -sI "https://$ADMIN/admin/login" | head -1                          # -> HTTP/2 200
```

**Bằng mắt** (trình duyệt, nhấn **Ctrl+F5** để bỏ bản lưu tạm):

- [ ] Trang chủ có mục **Combo ưu đãi**; menu **Sản phẩm** có **Chăm sóc tóc** và **Combo ưu đãi**.
- [ ] `/uv-block-sunscreen/`: dưới phần đầu trang có dải **thông tin sản phẩm**; có khối ảnh tình
      trạng da; gần cuối có **Combo có sản phẩm này**.
- [ ] `/combo/`: danh sách combo theo nhóm, ảnh hiện đủ.
- [ ] `/lien-he/`: chỉ có thông tin liên hệ + biểu mẫu "Gửi yêu cầu tư vấn".
- [ ] Chân trang: tên cửa hàng, địa chỉ, mã số thuế, SĐT, Zalo, email đúng thực tế.
- [ ] Tab trình duyệt hiện logo tròn MOCHA (không phải chữ "M").
- [ ] Trang quản trị (`https://$ADMIN/admin/`) đăng nhập được; menu **Website → Thông tin cửa
      hàng** mở được.

**Tuỳ chọn — đặt một đơn thử**: đặt ở `/combo-nam/` → đơn hiện trong **Đơn hàng** trên trang quản trị
→ đổi trạng thái sang **Huỷ**, ghi chú "đơn thử deploy".

## 7. Báo cáo lại

Gửi người phụ trách đoạn sau (điền vào):

```
Deploy <ngày giờ>
- Bản cũ: <OLD ở bước 2>   Bản mới: <git log --oneline -1>
- Sao lưu: <tên file ở bước 1>
- Log đồng bộ: <dòng "đồng bộ bản code mới: …">
- Mục giữ bản sửa tay: <danh sách, hoặc "không có">
- Xuất bản lúc khởi động: thành công / LỖI
- Kiểm tra bước 6: đạt / không đạt (<điểm nào>)
```

---

## Việc trên trang quản trị sau deploy (người phụ trách nội dung)

Không thuộc phần kỹ thuật, nhưng cần làm sau lần deploy này:

1. **Website → Thông tin cửa hàng** → kiểm tên, địa chỉ, MST, hotline, Zalo, email, Facebook.
   Điền **Tổ chức công bố** của Hairborn (tên pháp nhân + địa chỉ đúng như phiếu công bố) và số công
   bố của các sản phẩm còn trống. Lưu → **Xuất bản**.
2. Mục nằm trong danh sách "giữ bản sửa tay" (bước 5): mở từng mục, quyết giữ bản đang có hay lấy
   bản mới. Muốn lấy bản mới cho một mục (mất phần đã sửa tay):
   ```bash
   docker compose exec -T app node --import ./scripts/shim/register.mjs server/cli.ts import --entries products/<slug>/vi < /dev/null
   ```
   rồi **Xuất bản** trên trang quản trị.
3. Khuyến mãi tháng 10 đang ở trạng thái **Nháp** (chỉ để xem thử). Muốn chạy thật: **Khuyến mãi** →
   mở đợt → **Trạng thái: Đang hiện** → lưu → **Xuất bản**.
4. Google Search Console: gửi lại `sitemap-index.xml`; chạy lại **Rich Results Test** cho
   `/combo-nam/` và một trang combo (ví dụ `/combo/combo-nam-peel/`).

---

## Quay lại bản trước

Chỉ khi bản mới hỏng (trang lỗi, không xuất bản được) và không sửa nhanh được:

```bash
git checkout <OLD>                                   # mã ghi ở bước 2
docker compose --profile https up -d --build
```

Mã nguồn quay lại, **dữ liệu giữ nguyên** (đơn hàng, chỉnh sửa trên trang quản trị). Chỉ khi dữ liệu
cũng hỏng mới khôi phục bản sao lưu ở bước 1 — việc này **mất mọi đơn hàng và chỉnh sửa từ lúc sao
lưu**, nên hỏi người phụ trách trước:

```bash
docker compose up -d db
docker compose exec -T db pg_restore -U mocha -d mocha --clean --if-exists < /var/backups/mocha/<file>.dump
docker compose --profile https up -d
```

Xong việc khẩn cấp thì trả máy chủ về nhánh `main` (`git checkout main`) để lần deploy sau không
chạy trên một commit lẻ.

---

## Lỗi hay gặp

| Hiện tượng | Xử lý |
|---|---|
| Bước 4 dừng ở `check-budget` với các dòng `✗ … / …B` | Trang mới vượt ngân sách dung lượng. Không nới ngưỡng trên máy chủ — gửi các dòng `✗` cho người phụ trách. Website vẫn chạy bản cũ. |
| Bước 4 báo `Killed` / `exit code 137` | Hết RAM lúc build. Thêm swap 2 GB (xem `docs/dua-len-production.md` mục 3) rồi chạy lại bước 4. |
| Bước 4 báo `no space left on device` | `docker system prune -f`, kiểm `df -h /`, chạy lại bước 4. |
| Log ghi `xuất bản lúc khởi động #N: LỖI` | Trang quản trị → **Xuất bản** → mở lần lỗi → đọc dòng cuối nhật ký: nó nêu đúng nội dung nào sai. Gửi dòng đó cho người phụ trách. Website giữ bản đang chạy. |
| Log có `⚠️ … tổ chức công bố "…" chưa có trong Thông tin cửa hàng` | Không phải lỗi deploy: điền tổ chức công bố trên trang quản trị (mục "Việc trên trang quản trị", bước 1). |
| Không thấy dòng `đồng bộ bản code mới` | `.env` đang đặt `SYNC_ON_BOOT=0` → đổi thành `1` (hoặc xoá dòng), chạy `docker compose --profile https up -d`. |
| Trang vẫn hiện bản cũ dù log báo thành công | Trình duyệt lưu tạm: Ctrl+F5 hoặc mở tab ẩn danh. Đang dùng Cloudflare proxy thì xoá cache trên Cloudflare. |
| Trình duyệt báo chứng chỉ không hợp lệ | `docker compose logs caddy` — thường do DNS hoặc cổng 80/443 bị chặn. |
| Chạy lệnh `docker compose exec -T …` trong script qua `ssh 'bash -s' < script` thì các lệnh sau không chạy | `exec -T` ăn stdin: thêm `< /dev/null` vào cuối mỗi lệnh `exec -T`. |

Tài liệu liên quan: cài lần đầu [`docs/dua-len-production.md`](docs/dua-len-production.md) · vận hành
Docker và cơ chế đồng bộ [`docs/trien-khai-docker.md`](docs/trien-khai-docker.md) · thông tin cửa hàng
[`docs/thong-tin-cua-hang.md`](docs/thong-tin-cua-hang.md) · combo [`docs/combo.md`](docs/combo.md) ·
khuyến mãi [`docs/khuyen-mai.md`](docs/khuyen-mai.md).
