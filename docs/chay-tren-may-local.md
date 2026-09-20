# Chạy dự án trên máy của bạn

Toàn bộ mã nguồn nằm trên GitHub: `tranquanguit/landing-combo-nam`, nhánh làm
việc hiện tại là **`claude/friendly-ride-3bnyfn`**.

---

## 1. Cần có sẵn

| Thứ | Bản | Ghi chú |
| --- | --- | --- |
| Node.js | **22 trở lên** | Bộ kiểm thử dùng `--experimental-strip-types` và `node:sqlite`, Node 20 chạy không được |
| Git | bất kỳ | |
| Wrangler | qua `npx` | Chỉ cần khi động tới cơ sở dữ liệu đơn hàng |

Kiểm tra: `node -v` phải ra `v22.x` trở lên.

## 2. Tải về và cài

```bash
git clone https://github.com/tranquanguit/landing-combo-nam.git
cd landing-combo-nam
git checkout claude/friendly-ride-3bnyfn
npm ci
```

`npm ci` **không** tải sẵn trình duyệt cho Playwright — package.json không có
`postinstall`. Hai bộ thử chạy trong trình duyệt thật (`test:order`, `test:admin`)
và công cụ chụp màn hình cần thêm một lần:

```bash
npx playwright install chromium
```

Khoảng 115 MB, chỉ tải một lần cho cả máy. Bỏ qua bước này thì `test:order` chết
với "Executable doesn't exist" — không phải lỗi của trang.

## 3. Chạy thử

```bash
npm run dev
```

Mở `http://localhost:4321`. Sửa file JSON trong `src/content/` là trang tự nạp lại.

**Lưu ý quan trọng:** biểu mẫu đặt hàng **không hiện** ở chế độ dev mặc định, vì
nó chỉ render khi có nơi nhận đơn. Muốn thấy đầy đủ biểu mẫu:

```bash
PUBLIC_ORDER_ENDPOINT=/api/orders npm run dev
```

Trên Windows PowerShell:

```powershell
$env:PUBLIC_ORDER_ENDPOINT="/api/orders"; npm run dev
```

Biểu mẫu sẽ hiện nhưng bấm gửi sẽ lỗi — endpoint thật chỉ sống trên Cloudflare
Pages. Muốn thử cả đường gửi đơn ngay trên máy, xem `docs/co-so-du-lieu.md`
(`npx wrangler pages dev dist --d1 DB=mocha-orders`).

## 4. Bộ kiểm trước khi commit

```bash
npm run check           # 0 lỗi kiểu
npm run test:guards     # hàng rào nội dung: tiền, tuyên bố cấm, dữ liệu cá nhân…
PUBLIC_ORDER_ENDPOINT=/api/orders npm run build
npm run test:seo        # 299 phép đo SEO trên chính bản build
npm run test:orders-api # 20 kịch bản API đơn hàng (SQLite thật)
npm run check:assets    # ảnh có khớp đặc tả không
```

CI chạy đúng những lệnh này, nên xanh ở máy là xanh trên GitHub.

## 5. Chụp màn hình chính trang của mình

```bash
npm run build
npx astro preview      # http://localhost:4321
node scripts/tham-khao.mjs http://localhost:4321/combo-nam/
```

Ảnh ra ở `refs/localhost/`. Đây cũng là cách tôi tìm ra lỗi bảng thành phần vỡ
trên điện thoại — đọc mã không thấy, chụp màn hình mới thấy.

---

## 6. Cào web mẫu về tham khảo

```bash
node scripts/tham-khao.mjs https://www.lorealparis.com.vn/
node scripts/tham-khao.mjs https://some-brand.com/product-page
```

Mỗi lần chạy sẽ lưu vào `refs/<tên-miền>/<đường-dẫn>/`:

- `desktop.png` — ảnh toàn trang 1440px
- `mobile.png` — ảnh toàn trang 390px
- `trang.html` — HTML sau khi trình duyệt dựng xong
- `ghi-chu.json` — tiêu đề, mô tả, H1/H2, số ảnh, số khối JSON-LD

Thư mục `refs/` đã nằm trong `.gitignore`, **không bao giờ lọt vào repo**. Đó là
chủ ý: nó chứa nội dung của người khác.

**Dùng để tham khảo cái gì, và không dùng cho cái gì.** Cấu trúc trang, nhịp
cuộn, cách sắp xếp bằng chứng, thứ tự thông tin, kiểu ảnh họ chụp — những thứ đó
xem thoải mái và học được nhiều. Còn chữ, ảnh, mã nguồn và bộ nhận diện của họ
thì có bản quyền; đừng chép vào site này. Một trang bán mỹ phẩm chép nội dung
của hãng khác vừa rủi ro pháp lý vừa bị Google xếp là nội dung trùng lặp.
