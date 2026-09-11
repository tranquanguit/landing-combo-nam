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

---

# Vòng 4 — kết quả kiểm định độc lập và các sửa chữa

Một kiểm định viên độc lập (không tham gia dựng sản phẩm) đã chạy bộ 32 câu hỏi và
đo bằng Playwright. Kết quả: **22/32 CHƯA ĐẠT**. Ba phát hiện nặng nhất:

1. **Trang không bán được hàng, chỉ giả vờ bán.** Form không gửi đi đâu nhưng vẫn hiện
   "Đơn hàng đã được ghi nhận, chuyên viên sẽ gọi trong 2 giờ". Tắt JS thì nó đẩy tên,
   số điện thoại và địa chỉ khách lên query string rồi vứt đi.
2. **Đợt dọn pháp lý ở vòng 1 chỉ dọn phần chữ nhìn thấy.** `public/llms.txt` vẫn có mục
   "Chuyên gia liên quan" giới thiệu BSCKI Trúc Mai và bệnh viện; `public/images/hero.jpg`
   vẫn là ảnh áo blouse có chữ nung; `logo-byt.png` là con dấu Sở Y tế; video bác sĩ 6,8MB
   vẫn nằm trong `dist/`. Đã sửa cái nhìn thấy trong trình duyệt rồi tuyên bố xong việc.
3. **Trang tự mâu thuẫn về giá.** Giá gốc khai 1.680.000đ trong khi chính trang ghi mua lẻ
   kem 590.000đ + serum 550.000đ = 1.140.000đ. "Tiết kiệm 630.000đ" chỉ đúng nếu người đọc
   không biết cộng.

## Đã sửa

| Vấn đề | Cách sửa |
|---|---|
| Form báo thành công giả | Không có endpoint thì **không** hiện màn hình cảm ơn; hiện cảnh báo và hotline. Gửi hỏng thì báo lỗi thật kèm số điện thoại |
| Dữ liệu cá nhân lọt vào URL khi tắt JS | `method="post"`; không có endpoint thì không có `action`, form không submit được thay vì submit sai |
| `llms.txt` lệch khỏi trang | Xoá bản viết tay, **sinh tự động từ dữ liệu sản phẩm** lúc build. Không thể lệch nữa |
| 47MB ảnh/video vi phạm và không dùng | Xoá khỏi repo, không chỉ khỏi trang. `public/` từ 51MB còn 912KB |
| Giá gốc ảo | `compareAtPrice` = 1.140.000đ, đúng bằng tổng giá lẻ. Copy viết lại quanh "rẻ hơn 90.000đ và được thêm hai sản phẩm" |
| 3 ảnh chân dung khách trùng md5 với ảnh trước–sau | Bỏ avatar khỏi testimonial |
| Tổng tiền không đổi theo gói | Cập nhật theo lựa chọn; gói tư vấn thì ẩn dòng tổng |
| Regex loại bỏ `+84...` | Chuẩn hoá `+84`/`84` về `0` trước khi kiểm |
| Sticky CTA che disclaimer ở đáy trang | `padding-bottom` 64px cho body trên mobile |
| Viền input 1,33:1, trượt WCAG 1.4.11 | Token riêng `--line-control` |
| Skip link không bao giờ hiện | Thêm luật `:focus` |
| Schema hardcode `InStock`, phí ship, ngôn ngữ | Đưa vào schema dữ liệu; thêm `priceValidUntil`, `hasMerchantReturnPolicy`; `areaServed`/`availableLanguage` theo locale |
| Bản EN rò 6 chuỗi tiếng Việt, in giá kiểu `1.050.000đ` | Đưa vào `i18n/ui.ts`; tiền và ngày format theo locale trang |
| Sản phẩm thứ 2 không có route | Gộp thành một route `[...path].astro` phục vụ mọi sản phẩm × mọi ngôn ngữ |
| Cấu hình ảnh và `sharp` không được dùng | Gỡ bỏ, ghi rõ việc còn lại thay vì để đó như trang trí |
| Ưu đãi hết hạn vẫn hiển thị | Build **dừng lại** nếu `validUntil` đã qua |
| Trang khẳng định có gian hàng chính hãng nhưng không dẫn đi đâu | Hiện ô cảnh báo vàng cho tới khi có link thật |

## Số đo sau khi sửa

| | Trước | Sau |
|---|---|---|
| Tổng tải lần đầu | ~375 KB / 61 ảnh thừa trong dist | **216 KB, 9 request** |
| `public/` | 51 MB | **912 KB** |
| LCP (lab, localhost) | 740 ms | **124 ms** |
| CLS | 0.000 | **0.0004** |
| Ảnh lớn nhất (logo cho ô 92×34) | 107.388 B | **4.598 B** |

## Chưa xử lý, để vòng 5

- Chưa có `srcset`: ảnh vẫn là đường dẫn chuỗi trong JSON nên pipeline ảnh của Astro
  không chạm tới. Cần chuyển sang `import.meta.glob`.
- Chưa có cụm nội dung chuyên đề, nên trang vẫn không có cơ hội với truy vấn thông tin.
- Chưa có breadcrumb và `BreadcrumbList`.
- Nội dung JSON vẫn nhúng HTML thô render qua `set:html`, người không biết code gõ sai thẻ là vỡ trang.
- 4/7 hoạt chất chưa có nguồn tham chiếu. Riêng dòng Niacinamide cần kiểm lại: nghiên cứu
  kinh điển dùng 5%, sản phẩm khai 1% — nguồn hiện tại có thể không chống lưng được cho claim.

---

# Vòng 5–6 — kiểm định lần 2 và các sửa chữa

Một kiểm định viên thứ hai (không liên quan người trước) chạy lại bộ 32 câu và **kiểm
chứng từng tuyên bố sửa chữa của vòng 4**. Kết quả: **11 ĐẠT / 21 CHƯA ĐẠT**, và ba lỗi
P0 nặng hơn cả vòng trước.

## Ba lỗi P0

**1. Mọi nút "Đặt hàng" trượt khỏi form 2.100px.** Đo trên 390×844: cả 4 CTA sau khi bấm
đều dừng cách `#dat-hang` hơn 2.000px, người dùng rơi vào giữa thư viện ảnh. Nguyên nhân
là `content-visibility: auto` khai chiều cao giả 720px cho mọi section, trình duyệt chốt
đích cuộn theo chiều cao giả rồi section nở ra giữa lúc cuộn mượt.
→ Đã gỡ `content-visibility` hoàn toàn. Một trang mà mọi CTA đều là liên kết neo thì không
dùng được thủ thuật này; tiết kiệm vài chục ms render không đáng đổi lấy việc không ai
bấm được nút đặt hàng.

**2. Chữ trắng trên nền trắng, tương phản 1.00:1.** `.surface-navy` đổi màu chữ cho **mọi
hậu duệ**, kể cả nội dung nằm trong các thẻ nền trắng bên trong nó. Bốn vùng bị ảnh hưởng,
trong đó có **chính ô cảnh báo "form này không gửi đơn đi đâu cả"** ở mức 1.03:1 — lời
cảnh báo trung thực duy nhất trên trang thì người dùng không đọc được.
→ Đánh dấu `.on-light` cho các thẻ nền sáng và giới hạn selector. Đo lại: 6.73–17.12:1.

**3. Form vẫn có thể báo "đặt hàng thành công" giả.** Vòng 4 kiểm `if (!form.action)`.
Theo HTML spec thuộc tính này **không bao giờ rỗng** — thiếu `action` thì IDL trả về URL
của chính tài liệu. Thực tế JS POST về chính trang; host tĩnh nào trả 200 cho POST là
hiện màn hình cảm ơn giả. Tắt JS thì POST → 501, mất sạch dữ liệu khách đã gõ.
→ Kiểm cờ do build đặt thay vì kiểm thuộc tính DOM; nút gửi bị `disabled` khi chưa cấu
hình endpoint nên tắt JS cũng không submit được.

## Bài học lặp lại

Kiểm định viên chỉ ra rằng vòng 4 **lặp lại đúng thói quen mà chính nó phê phán**: sửa cái
nhìn thấy rồi tuyên bố xong. Lần trước là ảnh còn trong `dist/`; lần này là `form.action`
chưa từng được mở trình duyệt kiểm, là "630.000đ" còn nguyên trong JSON, là ảnh chuyển thư
mục mà quên `og:image` và `Organization.logo` (cả hai trả 404).

Vì vậy vòng này thêm **hàng rào tự động thay cho lời hứa**: schema quét mọi chuỗi tiền
trong nội dung và chặn build nếu xuất hiện con số không thuộc tập giá hợp lệ. Đã thử cố ý
ghi sai — build dừng và chỉ đúng vị trí `blocks[1].body`.

## Bảng sửa chữa

| Vấn đề | Đo trước | Đo sau |
|---|---|---|
| CTA cuộn trượt form | 2.173px (vi) / 2.069px (en) | **72px, cả 8 lượt bấm** |
| Tương phản chữ trong thẻ giá và thẻ form | 1.00–1.07:1 | **6.73–17.12:1** |
| Form báo thành công giả | có thể xảy ra | nút `disabled`, **không hiện màn hình cảm ơn** |
| CLS bản EN trên 3G | 0.2382 | **0.0079** |
| `og:image`, `Organization.logo` | 404 | URL `/_astro/` tồn tại |
| `Product.image` trong JSON-LD | thiếu | có |
| "tiết kiệm 630.000đ" | còn trong dữ liệu | **90.000đ**, có hàng rào build |
| Số điện thoại quốc tế trên trang EN | bị chặn 100% | chấp nhận; thêm ô quốc gia bắt buộc |
| Chuỗi tiếng Việt rò sang EN | ≥6 chỗ | 0 |
| canonical vs sitemap | lệch dấu `/` | khớp |
| Không có liên kết nội bộ nào | 0 | thêm bộ chuyển ngôn ngữ |
| Ưu đãi hết hạn | **dừng build hẳn** | cảnh báo to + ẩn dòng hạn |

Điểm cuối đáng nói: cổng chặn của vòng 4 khiến sau 30/9/2026 **không deploy được gì cả**,
kể cả bản vá khẩn. Một hàng rào an toàn không được phép biến thành khoá cửa.

## Còn nợ

- `evidence` và `source` trong schema vẫn chưa được component nào hiển thị — cơ chế kiểm
  soát bằng chứng hiện mới là dữ liệu, chưa thành giao diện.
- 4/7 hoạt chất chưa có nghiên cứu công khai để dẫn.
- Claim "cảm nhận sau 4–6 tuần" chưa nêu cỡ mẫu và đơn vị khảo sát.
- Chưa có cụm nội dung chuyên đề, chưa có trang danh mục.
- Ảnh trước–sau chưa có tuyên bố đồng ý, và mỗi cặp khác nhau về ánh sáng lẫn trang điểm.
- Chưa đo trên mạng thật tại Việt Nam; mọi số LCP ở trên là localhost, thiếu RTT và TLS.
