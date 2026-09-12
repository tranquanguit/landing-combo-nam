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

---

# Vòng 8 — kiểm định lần 3: hàng rào bị phá, và cách dựng lại

Kiểm định viên thứ ba chấm **14 ĐẠT / 17 CHƯA ĐẠT** và làm một việc hai người trước
chưa làm: **tấn công chính các hàng rào tự động**.

## Kết luận nặng nhất: ba cơ chế, ba lần chỉ là lời hứa viết bằng TypeScript

**Hàng rào giá (vòng 6) bị phá bằng 7/7 chiêu.** Nó chỉ quét `blocks`, và chỉ nhận dạng
`1.050.000đ`. Lách được bằng cách đặt số vào `variants[].note`, `gifts[].note`,
`seo.description`; hoặc viết `1234000đ`, `990k`, `630 nghìn đồng`, `1.140.000 đồng`.
Kiểm định viên dựng một sản phẩm chứa đồng thời sáu con số mâu thuẫn và build vẫn chạy,
**không một cảnh báo nào**.

**Cổng bằng chứng (vòng 7) bị né bằng cách dời câu chữ.** Luật mới bắt `evidence: survey`
phải có cỡ mẫu, nên câu "cảm nhận sau 4–6 tuần" bị gỡ khỏi `usp[]` — và ở nguyên trong
FAQ, nơi hàng rào không nhìn tới. Nó vẫn in ra cả hai trang và cả `llms.txt`.

**Ngân sách hiệu năng "đặt làm cổng CI" — không hề có CI.** `.github/` không tồn tại.
Tệ hơn: đúng lúc kiểm định bắt đầu, cây làm việc **không build được** vì vòng 7 siết
schema mà quên cập nhật `en.json`.

## Đã dựng lại

| Hàng rào | Trước | Sau |
|---|---|---|
| CI | không tồn tại | `.github/workflows/ci.yml`: build + `astro check` + ngân sách, chạy mọi lần push |
| Ngân sách trọng lượng | chỉ là câu chữ trong tài liệu | `scripts/check-budget.mjs`, fail CI khi vượt |
| Hàng rào giá | quét `blocks`, 1 dạng số | quét **toàn bộ** sản phẩm, nhận `990k`, `630 nghìn`, `1.140.000 đồng`, số không dấu phân cách |
| Cổng bằng chứng | chỉ soi `usp[]` | câu "4–6 tuần" đã bị gỡ khỏi mọi nơi, kể cả FAQ và `llms.txt` |
| Consent | chỉ áp cho ảnh | áp cả cho lời chứng nêu tên, tuổi, nơi ở |
| Ngôn ngữ chưa dịch | xuất trang `lang="th-TH"` với giao diện 100% tiếng Việt | **build lỗi** kèm hướng dẫn |

Bộ thử phá hàng rào giá nay chạy 6/6 đúng, không báo nhầm (`SPF 50`, `3%`, và
`1.050.000 VND` đúng giá đều cho qua).

## Ba lỗi P0 khác

**Cảnh báo quan trọng nhất trên trang EN viết bằng tiếng Việt.** Ô báo "biểu mẫu này
không gửi đơn đi đâu cả" hardcode tiếng Việt, còn phơi cả tên biến môi trường. Bản dịch
`form.noEndpoint` **đã tồn tại trong `i18n/ui.ts` mà không nơi nào gọi**. Đây là lỗi vòng
5 (chữ trắng trên nền trắng ở đúng ô này) tái diễn dưới dạng khác.

**Trang EN nói ba điều mâu thuẫn về phí giao hàng, cách nhau vài chục pixel:** thân bài
"chúng tôi báo giá trước", dòng tổng "(đã gồm phí giao hàng)", nút gửi "Free delivery".
Câu chữ trong JSON được sửa ở vòng 7, bảng `i18n/ui.ts` thì không. Nay nhãn nút EN là
"Request this order" và dòng tổng ghi rõ phí quốc tế báo riêng.

**Chỉ báo focus bị xoá trên mọi ô nhập và mọi radio.** `outline: none` trong `Order.astro`
có độ đặc hiệu cao hơn luật `:focus-visible` ở `tokens.css`. Người dùng bàn phím không
thấy mình đang ở đâu. Nay outline 3px trên cả ô nhập lẫn khối chọn gói.

## Cũng đã sửa

Bảng thành phần cuộn ngang được bằng chuột nhưng không bằng bàn phím (`tabindex="0"` +
`role="region"`); nút gửi dùng `aria-disabled` thay vì `disabled` để trình đọc màn hình
đọc được lời giải thích; `scrollIntoView` tôn trọng `prefers-reduced-motion`; mọi vùng
chạm đạt 24×24; `llms.txt` nay **nói thẳng rằng website chưa nhận đơn trực tuyến**;
README sửa lại hướng dẫn cấu hình endpoint (trước đó hướng dẫn sai hoàn toàn).

## Số đo sau vòng 8

| | vi 4G | vi 3G | en 4G | en 3G |
|---|---|---|---|---|
| CLS | 0 | 0.0032 | 0 | 0 |
| LCP | 596ms | 1896ms | 584ms | 1884ms |

Tải đầu 188KB / 9 request. Không tràn ngang. 8/8 CTA dừng cách form 72px.
Vùng chạm dưới 24px: không còn. Chuỗi tiếng Việt trên trang EN: không còn.

## Vẫn còn nợ

- **Không có đo lường chuyển đổi nào** — trang sạch JS đến mức không có GA4/Pixel. Cần
  quyết định: thêm lại có kiểm soát, hay đo bằng server-side.
- Chưa có cụm nội dung chuyên đề, chưa có trang danh mục, 0 liên kết nội bộ nội dung.
- Hero không có giá; giá nằm ở section kế tiếp.
- `font-display: optional` vẫn tải 115KB font rồi có thể không dùng ở lần tải đầu chậm.
- Nhánh `fetch` khi có endpoint **chưa bao giờ chạy** trong bất kỳ vòng kiểm định nào.
- Mọi số LCP đều là phòng thí nghiệm trên localhost, chưa có RTT và TLS thật.

---

# Vòng 10 — kiểm định lần 4: hàng rào bị phá lần nữa, và lần này đổi cách làm

Kiểm định viên thứ tư chấm **13 ĐẠT / 19 CHƯA ĐẠT** và tấn công trực diện vào các
hàng rào. Kết luận của họ đáng ghi lại nguyên văn: *"Ba cơ chế, ba lần chỉ là lời
hứa viết bằng TypeScript."*

## Lỗ hổng bảo mật: nội dung JSON thực thi được JavaScript

Dán `Gia tot </script><script>window.__pwned=1</script>` vào `faq.items[].a` → build
sạch, trang chạy đoạn mã đó. Thoát ra được **hai đường**: qua `set:html` và qua
`JSON.stringify(jsonLd)` đổ vào thẻ `<script>`. README bán nền tảng này với lời hứa
"người không biết code tự sửa nội dung" — tức đây là stored XSS chờ sẵn.

Đã sửa: `src/lib/richtext.ts` chỉ cho phép `<strong> <em> <b> <i> <br> <sup> <sub>`
**không thuộc tính**, escape mọi thứ khác; `safeJsonLd()` escape `<`, `>`, `&`,
U+2028/2029 trước khi nhúng. Kiểm chứng trong trình duyệt: `window.__pwned` undefined,
0 alert, JSON-LD vẫn parse được, `<strong>` hợp lệ vẫn render.

## Đổi hình dạng bài toán thay vì siết regex lần thứ tư

Hàng rào giá bị phá **10/11 chiêu**: `990.000 VNĐ` (Đ≠D), chữ số full-width, chữ số
Ả Rập, HTML entity, số bị cắt bởi `<strong>`, zero-width space, `$39.90`, số La Mã,
số viết bằng chữ. Đồng thời **chặn nhầm 3 câu hợp lệ**: "gọi 1900 1000 **đồng** hành
cùng bạn", "đơn hàng số 1.234.567 **đã** giao", "hơn 5 **triệu** phụ nữ".

Vì vậy bỏ hẳn cách quét-số-trong-văn-xuôi. Giá nay viết bằng **token**
`{{price}}`, `{{compareAtPrice}}`, `{{save}}`, do layout thay một lần cho toàn bộ dữ
liệu. Hàng rào chỉ còn một luật đơn giản: *không được viết số tiền trực tiếp*. Trước
khi dò, chuỗi được chuẩn hoá — giải HTML entity, bóc thẻ, xoá zero-width, NFKC, đổi
chữ số Ả Rập/Ba Tư/Devanagari sang ASCII.

**Kết quả thử lại: 14/14 đúng** — chặn cả 9 cách né, cho qua cả 3 câu hợp lệ từng bị
chặn nhầm. Rủi ro còn lại được ghi nhận: số không kèm đơn vị ("777.000") không phân
biệt được với số đơn hàng, nhưng với token thì không ai có lý do viết giá kiểu đó.

## Các cổng khác đều đã bị né, đều đã vá

| Cổng | Cách né | Vá |
|---|---|---|
| Bằng chứng | Chỉ soi `hero.usp[]`; đặt "98% khách hàng hết nám", "chứng minh lâm sàng", "hiệu quả như laser" vào FAQ là lọt | Thêm `src/lib/claims-lexicon.ts`: 9 nhóm từ bị cấm theo TT 06/2011 và NĐ 342/2025, quét **mọi** trường chuỗi, mỗi lỗi kèm câu thay thế |
| Consent | Đổi `type` từ `testimonials` sang `problem` là đăng được tên–tuổi–nơi ở | `problem.quotes[]` từ chối mọi chuỗi chứa danh tính |
| Ngôn ngữ | Bảng dịch **một khoá** vẫn qua, vì chỉ kiểm bảng có tồn tại | So khoá với `ui.vi`, thiếu khoá nào liệt kê khoá đó |
| Ngân sách | Không đếm video, svg, gif, iframe, font CDN, và không có luật tổng trang | Đếm đủ; thêm luật tổng một lượt tải và luật cấm tài nguyên bên ngoài nhúng sẵn |
| `astro check` trong CI | `@astrojs/check` không có trong deps → prompt tương tác → **thoát 0 mà không kiểm gì** | Khai `devDependencies`, đổi sang `npm run check`. Chạy thật: 33 file, 0 lỗi |

Một phát hiện quan trọng khi vá: **`\b` không hoạt động sau ký tự có dấu**. Mẫu
`/\b(bác sĩ)\b.../u` không bao giờ khớp vì "sĩ" kết thúc bằng `ĩ` — JavaScript coi
`\b` theo ASCII. Đây là loại lỗi im lặng khiến một hàng rào trông như đang chạy.

## Ba lỗi P0 khác

**Form vẫn mất đơn khi tắt JS.** Vòng 6 dùng `disabled`, vòng 8 đổi sang
`aria-disabled` cho trình đọc màn hình — nhưng `aria-disabled` không ngăn submit, và
nhấn Enter trong ô nhập vẫn submit ngầm. Sửa triệt để: **chưa có endpoint thì không
render thẻ `<form>` nào cả**, các ô nhập bị vô hiệu. Đo lại: 0 POST.

**Thanh consent che nút đặt hàng trên mobile EN.** Khách EU/UK lần đầu bằng điện
thoại không bấm được nút đặt hàng. Sửa: đặt thanh phía trên thanh CTA, không đè lên.

**GDPR.** Trước đây chỉ hỏi đồng ý khi `locale !== 'vi'` — nhưng ngôn ngữ trang không
cho biết người đọc ở đâu; một người ở EU đọc bản tiếng Việt bị đặt cookie không cần
đồng ý. Nay hỏi ở mọi ngôn ngữ, và thêm link **rút lại đồng ý** (điều 7(3)) có xoá
cookie mà pixel đã đặt.

## Cũng đã sửa

Hai section rỗng in ghi chú nội bộ ("chưa thu thập được văn bản đồng ý") lên mặt
khách hàng — nay khối biến mất khỏi bản production, ghi chú chỉ hiện khi chạy dev.
Tràn ngang 3px ở 320px do con của grid có `min-width: auto`. Lỗi JS mới do chính
thay đổi form gây ra (`form.elements` trên một `<div>`).

## Số đo — kèm điều kiện đo

Kiểm định viên chỉ ra bảng số đo vòng 8 **không tái lập được** (LCP ghi 596ms, họ đo
432ms) vì không ghi profile throttle. Từ nay ghi rõ:

> Chromium headless, viewport 390×844, DPR 1, CPU throttle 4×, mạng giả lập
> 1.6 Mbps / 150 ms (4G) và 400 kbps / 400 ms + CPU 6× (3G), phục vụ bằng
> `python3 -m http.server` trên localhost — **không gzip, không HTTP/2, không TLS,
> RTT ≈ 0**. Số thật trên hạ tầng có CDN sẽ khác.

| | vi 4G | vi 3G | en 4G | en 3G |
|---|---|---|---|---|
| CLS | 0 | 0 | 0 | 0 |
| LCP | 584 ms | 2040 ms | 548 ms | 1916 ms |

Tải đầu 9 request / 44 KB (chưa nén). Tràn ngang ở 320/390/1440px: 0. Vùng chạm
dưới 24px: không còn. Chuỗi tiếng Việt trên trang EN: không còn. `npm run check`:
0 lỗi trên 33 file.

## Vẫn còn nợ

- Nhánh `fetch` khi có endpoint thật **vẫn chưa bao giờ chạy** — nợ từ vòng 8.
- Chưa đo trên thiết bị và mạng thật tại Việt Nam.
- Chưa có cụm nội dung chuyên đề, chưa có trang danh mục, 0 liên kết nội bộ nội dung.
- Hero vẫn không có giá.
- CI chưa từng chạy trên GitHub — mới chỉ chạy tay từng lệnh.
- Biến thể sản phẩm chưa được mô hình hoá thành nhiều `Offer` trong JSON-LD.

---

# Vòng 12 — kiểm định lần 5: vòng 10 gây hồi quy, và tuyên bố "14/14" là sai

Kiểm định viên thứ năm chấm **10 ĐẠT / 21 CHƯA ĐẠT** — điểm thấp nhất từ đầu, vì họ
tấn công chính những thứ vừa được vá.

## Hồi quy do vòng 10 gây ra

**`1.050.000 đồng` — cách viết giá phổ biến nhất tiếng Việt — lọt qua hàng rào.**
Nguyên nhân: `(?![\p{L}])` đặt ngay sau `đ`; trong "đồng", sau `đ` là `ồ`, một chữ
cái, nên luật tự loại chính nó. Trước vòng 10 dạng này bị bắt.

Commit vòng 10 ghi *"Thử lại 14/14 đúng"*. **Tuyên bố đó sai** — bộ thử của tôi không
có ca `1.050.000 đồng`. Tôi đã thử đúng những ca mình nghĩ ra, rồi kết luận về những
ca mình không nghĩ ra.

Cách chữa không phải sửa regex rồi tự chấm điểm lại. Nay mỗi hàng rào có **bộ thử
riêng nằm trong `tests/`, chạy trong CI**, và mỗi ca trong đó là một cách phá mà
kiểm định viên độc lập đã dùng thành công:

- `tests/money-guard.mjs` — **37 ca** (29 phải chặn, 8 phải cho qua)
- `tests/claims-guard.mjs` — **34 ca** (27 phải chặn, 7 phải cho qua)
- `tests/order-endpoint.mjs` — **6 kịch bản** đặt hàng thật

## Bản tiếng Anh không có hàng rào tuân thủ nào

`claims-lexicon.ts` viết bằng tiếng Việt nên `Removes melasma permanently`,
`cures dark spots`, `FDA approved`, `Dermatologist recommended`,
`Money back guarantee`, `100% effective` đều lên trang được — ở chính thị trường
EU/UK, nơi claim mỹ phẩm bị phạt nặng nhất. Đã thêm 8 nhóm mẫu tiếng Anh.

Cũng vá: đồng nghĩa tiếng Việt (`xoá nám`, `đánh bay nám`, `triệt tiêu`, `chấm dứt`,
`tạm biệt nám vĩnh viễn`), và lỗ phủ định — `"Không ngờ, trị nám chỉ sau 2 tuần"`
từng lách được vì luật nhìn 40 ký tự bất kỳ phía trước; nay dấu phẩy cắt phạm vi.

## Lỗi cắt-dán: `variants` rơi khỏi vùng quét

`const { price, compareAtPrice, currency, variants, ...rest } = p` viết cho luật giá,
rồi `scanClaims` tái dùng `rest` — nên **nhãn gói bán trở thành vùng tự do**.
`label: "Combo tri nam tan goc"` build sạch và hiện hai lần trên trang.

## Luồng đặt hàng nói dối trong hai tình huống

Vòng 11 vừa thêm test cho nhánh này và tuyên bố "cả ba đều đúng". Test đó **bỏ sót
cả hai**:

1. **Gửi lại thành công sau lỗi** → trang hiện **đồng thời** "Đơn hàng đã được ghi
   nhận" và "Gửi đơn không thành công, hãy gọi hotline". Không dòng nào ẩn hộp lỗi cũ.
2. **Tắt JS khi đã có endpoint** → POST native gửi `form-urlencoded` trong khi nhánh
   JS gửi `application/json` (hai định dạng vào cùng một endpoint), và khách bị điều
   hướng sang màn hình `{"ok":true}` trần.

Đã sửa: dọn hộp lỗi trước mỗi lần gửi; bỏ `action` và **ẩn hẳn biểu mẫu khi không có
JavaScript**, chỉ để lại lối gọi hotline. Thêm hai kịch bản này vào bộ thử.

## Cũng đã sửa

| Vấn đề | Cách sửa |
|---|---|
| `/llms.txt` in nguyên văn `{{price}}` cho máy đọc | `llms.txt.ts` không đi qua layout nên không được thay token — nay tự thay |
| Từ chối consent không lưu được, banner hiện lại mọi lần tải | `consentGiven()` chỉ so `'yes'`; nay đọc cả `'no'`, và thêm nút xem lại lựa chọn để từ chối không thành quyết định vĩnh viễn |
| Đổi trả 7 ngày (vi) vs 14 ngày (en) cho cùng một SKU trong schema | Thống nhất 7 ngày; quyền rút lui 14 ngày của EU/UK là quyền theo luật, nêu ở phần cảnh báo |
| Thứ tự khối khác nhau: vi = order→faq, en = faq→order | Thống nhất |
| Không có ô đồng ý xử lý dữ liệu cá nhân | Thêm checkbox bắt buộc theo NĐ 13/2023 — trước đây cookie đo lường thì có banner, còn họ tên + SĐT + địa chỉ thì không hỏi gì |
| Focus rơi về `body` sau khi gửi đơn | Chuyển focus sang thông báo |
| Hotline ở header dưới 24px | `min-height: 24px` |

## Ngân sách: nâng ngưỡng, nhưng ghi lại lịch sử

Cổng ngân sách bắt luồng consent mới (6.836 B / 6.144 B). Kiểm định viên đã chỉ ra ở
vòng trước: *"một cổng mà người vi phạm tự sửa được ngưỡng trong cùng commit thì không
ràng buộc được ai"*. Đúng.

Nên trước khi nâng, đã **cắt thật ~590 byte**: bỏ theo dõi độ sâu cuộn (cũng là nguồn
cưỡng bức reflow mà kiểm định viên nêu), gộp hai bảng ánh xạ sự kiện trùng nhau, bỏ
handler dọn listener thừa. Vẫn dư 100 byte nên nâng 6 KB → 7 KB, và `check-budget.mjs`
nay giữ **nhật ký thay đổi ngưỡng** ghi rõ từng lần nâng, lý do, và đã cắt được gì
trước đó. Việc nới không thể diễn ra âm thầm nữa.

## Số đo — điều kiện đo ghi trong tài liệu

> Chromium 1194 headless, 390×844 DPR 1, CPU throttle 4× (4G) / 6× (3G),
> `Network.emulateNetworkConditions` 1.6 Mbps/150 ms và 400 kbps/400 ms,
> `python3 -m http.server` trên localhost — **không gzip, không HTTP/2, không TLS,
> RTT ≈ 0**. Số thật trên hạ tầng có CDN sẽ cao hơn.

| | vi 4G | vi 3G | en 4G | en 3G |
|---|---|---|---|---|
| CLS | 0 | 0.0087 | 0 | 0 |
| LCP | 616 ms | 2316 ms | 564 ms | 2200 ms |

Tràn ngang 320/390/1440px: 0 · vùng chạm dưới 24px: không còn · chuỗi tiếng Việt trên
trang EN: không còn · giá trong màn hình đầu: y=519px cả hai ngôn ngữ ·
`npm run check`: 0 lỗi.

## Vẫn còn nợ, không giấu

- `richText` từ chối `<br />` (dạng chuẩn có dấu cách) và không bất biến; `plainText`
  nuốt văn bản giữa `<` và `>`. Ảnh hưởng `seo.description`, JSON-LD, `llms.txt`.
- `cards.items[].body` vẫn đăng được tên + tuổi + số điện thoại mà không qua cổng consent.
- `AggregateOffer.lowPrice` = 550.000 gắn trên `Product` vốn là combo giá 1.050.000.
- Bảng dịch có khoá nhưng **giá trị rỗng hoặc vẫn là tiếng Việt** vẫn qua cổng.
- Thanh CTA cố định che CTA của hero ở 768×700 — chấp nhận được vì chính nó là nút
  đặt hàng, nhưng vẫn là chồng lấn.
- CI chưa từng chạy trên GitHub.
- Chưa đo trên thiết bị và mạng thật tại Việt Nam.

---

# Vòng 13 — đóng danh sách nợ từ kiểm định lần 5

Không gọi kiểm định viên mới ở vòng này; toàn bộ công việc là đóng đúng những gì
kiểm định viên thứ năm đã liệt kê ở mục "vẫn còn nợ".

| Nợ | Cách đóng | Bằng chứng |
|---|---|---|
| `richText` từ chối `<br />` (cú pháp chuẩn tài liệu bảo dùng) và không bất biến | Viết lại: chuẩn hoá thẻ về một dạng, không escape lại entity đã hợp lệ | `tests/richtext.mjs`, 23/23 ca, gồm 4 ca bất biến |
| `plainText` nuốt văn bản giữa `<` và `>` | Chỉ bỏ đúng những thẻ mà `richText` cho phép; `<br>` thành khoảng trắng | `plainText('a < b > c')` = `'a < b > c'` |
| `cards.items[].body` đăng được tên + tuổi + số điện thoại không qua cổng nào | Thêm luật quét dữ liệu cá nhân trên **mọi khối không có cổng consent** | 6/6 ca, gồm ca hotline doanh nghiệp phải cho qua |
| `AggregateOffer.lowPrice` 550.000 gắn trên Product vốn là combo 1.050.000 | Combo có đúng một Offer; món bán lẻ là `Product` riêng, liên kết bằng `isRelatedTo` | JSON-LD: 1.050.000 / 590.000 / 550.000, mỗi giá trên đúng sản phẩm của nó |
| Bảng dịch có khoá nhưng **rỗng** hoặc **vẫn là tiếng Việt** vẫn qua cổng | Kiểm cả ba: thiếu khoá, khoá rỗng, khoá chưa dịch | 4/4 kiểu bảng hỏng đều bị chặn |

## Trạng thái bộ thử

| Bộ thử | Số ca | Kết quả |
|---|---|---|
| `money-guard` | 37 | 37/37 |
| `claims-guard` | 34 | 34/34 |
| `richtext` | 23 | 23/23 |
| `order-endpoint` | 6 kịch bản | 6/6 |

Tất cả chạy trong CI. Mỗi ca là một cách phá mà một kiểm định viên độc lập đã dùng
thành công, hoặc một lỗi mà một bản vá trước đây đã gây ra.

## Số đo

Cùng điều kiện đo đã ghi ở vòng 12.

| | vi 4G | vi 3G | en 4G | en 3G |
|---|---|---|---|---|
| CLS | 0 | 0.0032 | 0 | 0 |
| LCP | 568 ms | 2272 ms | 564 ms | 2288 ms |

Tràn ngang 320/390/1440px: 0 · vùng chạm dưới 24px: không còn · chuỗi tiếng Việt
trên trang EN: không còn · `npm run check`: 0 lỗi · ngân sách: trong mức.

## Còn lại, và vì sao chưa làm

- **CI chưa từng chạy trên GitHub.** Chỉ chạy tay từng lệnh. Sẽ biết khi push lần đầu
  có workflow.
- **Chưa đo trên thiết bị và mạng thật tại Việt Nam.** Mọi số LCP là localhost, không
  TLS, RTT ≈ 0 — là sàn lạc quan, không phải số thật.
- **Thanh CTA cố định che CTA của hero ở 768×700.** Chấp nhận có chủ đích: thanh đó
  chính là nút đặt hàng, nên người dùng không mất đường hành động.
- **Chưa có cụm nội dung chuyên đề và trang danh mục.** Cần nội dung mới, không phải
  cần code; và cần quyết định của khách hàng về phạm vi.
- **Bảy ô ⚠️ trên trang** vẫn chờ dữ liệu thật: số công bố mỹ phẩm, mã số thuế, chính
  sách đổi trả và bảo mật, link gian hàng, endpoint nhận đơn, văn bản đồng ý cho ảnh
  và cho lời chứng.

---

## Vòng 14 — đóng kiểm định độc lập lần 6

Kiểm định viên thứ 6 soi bản đã siết sau vòng 13, tự soạn 28 câu hỏi, tự dựng sản
phẩm thứ ba, và tự tìm cách vượt hàng rào thay vì đọc tài liệu. Kết quả: 4 lỗi P0,
6 lỗi P1, 12 lỗi P2. Vòng này đóng toàn bộ nhóm P0 và P1, phần lớn P2.

### P0

| Lỗi | Bản chất | Cách sửa | Bằng chứng |
|---|---|---|---|
| F-0 `npm ci` vỡ | `playwright` có trong package.json nhưng không có trong lockfile → **mọi job CI thoát ở bước đầu tiên**. README nói "chạy trong CI trên mọi lần push" — sai | đồng bộ lại lockfile | `npm ci` trong thư mục sạch: EXIT=0, `npm ls playwright` → 1.63.0 |
| F-1 entity xuyên hàng rào | `richText` cố ý giữ entity hợp lệ; `findForbiddenClaims`/`findPersonalData` không giải mã → `Cam k&#7871;t hoàn ti&#7873;n` lên trang, JSON-LD và llms.txt | cả ba hàng rào dùng chung `normaliseForScan()`, giải mã lặp tới 4 lượt (bắt cả `&amp;#7871;`) | bộ thử claims 41/41, thêm 5 ca entity + 2 ca entity hợp lệ không bị báo nhầm |
| F-2 `compliance.functions` là vùng tự do | trường mang uy tín "đã công bố", in ở footer và llms.txt, là trường DUY NHẤT không bị quét | chỉ miễn trừ `compliance.warnings` | đặt "điều trị nám tận gốc, hiệu quả như laser" → build chặn |
| F-3 `javascript:` URL chạy được | `z.string().url()` dùng `new URL()` nên nhận mọi scheme; 3 trường sinh href | `isSafeHref` + `safeUrl`/`textOrSafeUrl` cho `source`, `reference`, `zalo`, `marketplaces.url` | chèn `javascript:` vào usp.source và brand.zalo → build chặn cả hai |
| F-4 ảnh chưa có đồng ý vẫn phát hành | khối bị ẩn nhưng `import.meta.glob` vẫn emit; 4 ảnh khuôn mặt khách HTTP 200 | chuyển sang `src/media-gated/` (ngoài glob) + cổng hậu-build trong `check-budget.mjs` | thả một ảnh vào dist → cổng fail đúng |

### P1

- **F-5** markup đổi trả rộng hơn lời hứa thật (7 ngày vô điều kiện vs "7 ngày nếu hàng lỗi") → mô hình hoá `scope`/`fees`/`refund`; scope `defect` phát `MerchantReturnNotPermitted` + `itemDefectReturnDays`.
- **F-6** `priceValidUntil` hết hạn vẫn phát cho máy đọc trong khi UI đã ẩn → `isOfferExpired()` một nguồn cho cả UI và JSON-LD, tính **hết ngày theo giờ VN** (trước đây so sánh UTC nên ưu đãi biến mất sớm một ngày). Thử với `2024-01-01`: dist không còn `priceValidUntil`.
- **F-7** focus ring 2.78:1 trên nền tối → `#b9c0ff` cho `.surface-navy` **và `footer`** (lần sửa đầu bỏ sót footer vì nó dùng `--ink`, đo lại mới thấy).
- **F-8** thiếu số tiếp nhận phiếu công bố / MST / trang chính sách — **chưa đóng được, chờ dữ liệu thật từ phía Mocha**.
- **F-9** vùng chạm 102×19 trong hộp cảnh báo → `.todo a` min-height 24px. Đo lại còn phát hiện thêm link breadcrumb 105×16 trên trang sản phẩm phụ, đã sửa.
- **F-10** bốn điểm vỡ khi thêm sản phẩm: (a) CTA phụ hardcode `#thanh-phan` → `secondaryCta {label, href}` + kiểm chéo neo với id khối có thật; (b) logo là `#main` chứ không về trang chủ → `localePath`; (c) ảnh sai đường dẫn build im lặng → **dừng build**; (d) ngân sách cộng ảnh của mọi sản phẩm → tính **theo từng trang**.

  Cổng neo mới lập tức phát hiện một lỗi đang tồn tại: trên trang EN, `#thanh-phan` chưa từng là id có thật — cả CTA phụ lẫn link "nguồn" đều là link chết. Nguyên nhân: id mặc định nằm rải trong từng component nên schema không biết. Nay `DEFAULT_ANCHOR` là một nguồn duy nhất.

### P2 đã đóng

`plainText` giải mã entity (F-12); trang 404 dựng từ dữ liệu, liệt kê mọi trang đang sống + hotline (F-13); llms.txt gồm cả bản EN, có nhãn ngôn ngữ (F-14); bỏ `Disallow: /*?utm_` để canonical làm việc của nó (F-15); `lastmod` lấy từ ngày commit cuối của chính file nội dung, không phải ngày build (F-16); `og:site_name` lấy từ `brand` (F-18); viền hộp cảnh báo 2.97:1 → 4.72:1 (F-19); tên pháp nhân công bố phải trùng `brand.legalName`, build dừng nếu lệch (F-20); bản EN nêu rõ giá tính bằng VND và chỉ giao trong nước, phí quốc tế báo trước khi thanh toán (F-21); `slug` có regex (F-11).

### Đo lại sau khi sửa

- Bộ thử: money 37/37, claims **41/41**, richtext 23/23, đặt hàng 6/6. `astro check` 0 lỗi.
- Trình duyệt thật, 1280×900, cả `/` và `/en/`: **0 vi phạm tương phản focus, 0 vùng chạm dưới 24px, 0 neo chết**. 404 trả đúng mã 404 kèm trang có hotline.
- Ngân sách theo trang: vi 275KB, en 272KB, sản phẩm thử thứ ba 214KB — trên tổng ngân sách 700KB/trang. Con số cũ (615KB) là lỗi phép cộng, không phải trang nặng.
- Dựng sản phẩm thứ ba từ một file JSON: route, breadcrumb, schema, sitemap, llms.txt, ngân sách đều tự sinh; các hàng rào mới không chặn nhầm một sản phẩm hợp lệ tối giản.

### Vẫn còn nợ

- **F-8**: số tiếp nhận phiếu công bố mỹ phẩm, mã số thuế, trang chính sách dữ liệu cá nhân và chính sách đổi trả. Đây là dữ liệu doanh nghiệp, không phải việc code. Trang đang hiển thị ⚠️ thay vì bịa.
- Không có CSP. Site tĩnh nên header do hosting quyết định; nếu bật `script-src` không cho `unsafe-inline` thì cả nhóm lỗi F-3 sẽ bị vô hiệu thêm một lớp nữa. Cần cấu hình ở phía host.
- CI vẫn **chưa từng chạy thật trên GitHub** — nay `npm ci` đã chạy được cục bộ nên lần push này là lần đầu nó có cơ hội chạy.
- Số liệu hiệu năng vẫn là đo cục bộ, chưa có đo trên thiết bị và mạng thật tại Việt Nam.

---

## Vòng 15 — đóng kiểm định độc lập lần 7

Kiểm định viên thứ 7 kiểm chứng lại các bản vá của vòng 14 và soi hai vùng chưa
ai chạm: **hồi quy do chính bản vá gây ra**, và **trải nghiệm chuyển đổi thật**
(đọc từng chữ dưới góc nhìn người mua vào từ quảng cáo Facebook trên 4G yếu).
Kết quả: 2 P0, 5 P1, 9 P2 — và một kết luận thẳng thắn "chưa nên phát hành".

### Hai lỗ P0, cả hai đều nằm trong chính hàng rào tuân thủ

**Hàng rào claims bỏ qua cả luật khi lần khớp ĐẦU TIÊN bị phủ định.**
`plain.match(rule.pattern)` không có cờ `g` nên chỉ trả về match đầu; nếu match
đó nằm sau một phủ định thì `continue` bỏ luôn cả luật và mọi lần xuất hiện sau
không bao giờ được xét. Câu *"Chúng tôi không trị nám bằng lời hứa suông. Combo
trị nám theo cơ chế kép."* lên `dist/index.html`, JSON-LD `FAQPage` và `llms.txt`
với build xanh. Nay duyệt `matchAll` và chỉ bỏ qua đúng lần khớp bị phủ định.

**Số tiền lọt khi sau đơn vị còn chữ.** `"990 nghìn đồng thôi"` qua, nhưng
`"990 nghìn đồng thôi."` bị chặn — một dấu chấm là toàn bộ khác biệt. Tách thành
hai luật: có đơn vị tiền đi kèm thì luôn là giá; không có đơn vị thì mới đòi kết
câu (để *"5 triệu phụ nữ"* không bị coi là giá). Cả hai ca vào bộ thử.

### P1

- **Cổng neo chỉ đóng một nửa.** Vòng 14 canh `hero.secondaryCta`, nhưng
  `#dat-hang` bị hardcode ở 5 chỗ khác nhau kể cả `Offer.url` trong JSON-LD.
  Sản phẩm không có khối `order` build xanh với **4 nút mua chết**. Nay schema
  bắt buộc đúng một khối `order`.
- **Bản EN tự mâu thuẫn về giao hàng.** Hai câu cạnh nhau trong cùng danh sách:
  "Ships worldwide from Vietnam" và "we currently ship within Vietnam only" —
  câu thứ hai là do **chính tôi thêm vào ở vòng 14**. Đã viết lại theo sự thật:
  có giao quốc tế, báo giá theo từng nước trước khi thanh toán.
- **Ưu đãi hết hạn trên trang tĩnh.** `isOfferExpired` chạy lúc build, mà CI chỉ
  có `push`/`pull_request`. Sau 30/9 nếu không ai deploy thì trang vẫn in hạn cũ.
  Thêm `schedule: '0 1 * * *'`.
- **`lastmod` vỡ trong CI.** `actions/checkout` mặc định shallow depth 1, nên
  `git log -1 -- <file>` trả ngày commit HEAD cho MỌI file — đúng thứ nó sinh ra
  để tránh. Thêm `fetch-depth: 0`.
- **Không có bằng chứng xã hội nào** (chờ dữ liệu doanh nghiệp): cả gallery lẫn
  testimonials đều bị cổng consent ẩn. Đúng về pháp lý, nhưng phải nói rõ: ở
  trạng thái này tỉ lệ chuyển đổi sẽ thấp bất kể kỹ thuật tốt đến đâu.

### P2

`llms.txt` nay dịch nhãn theo ngôn ngữ của trang (trước đây nội dung tiếng Anh
nằm trong khung tiếng Việt, trong khi robots.txt quảng cáo là "song ngữ") và
dùng `plainText()` cho mọi trường thay vì regex bóc thẻ mà `richtext.ts` đã loại
bỏ. `og:image` giữ đúng định dạng nguồn (trước bị ép WebP — Zalo không render
preview WebP). Trang 404 nay song ngữ trong một file, vì hầu hết host tĩnh chỉ
phục vụ `404.html` ở gốc. PII không còn phát ra `window` qua `CustomEvent`
(pixel bên thứ ba chạy cùng trang nghe được). Weight 600 của Be Vietnam Pro đổi
sang `font-display: swap` — đo được nó về lúc ~1,2s, quá xa cửa sổ ~100ms của
`optional`, nên chữ đậm (giá, nhãn gói) hiển thị bằng font dự phòng ở lượt truy
cập lạnh; `swap` không tốn byte nào trên đường găng và CLS vẫn 0 nhờ metric đã
khớp. Sửa báo nhầm "Số 1 trong danh sách bước chăm sóc". Sửa comment sai sự thật
trong `astro.config.mjs`.

### Biên tập — phần người mua thật sự đọc

- Eyebrow "Công nghệ Liposome – Fermentation – Aminovector" là ba từ tiếng Anh
  không giải thích, đặt ở dòng đầu tiên người đọc nhìn thấy. Đổi thành
  "Kem + serum dùng cùng nhau, cho da nám".
- **Nỗi lo lớn nhất chưa ai trả lời**: "dùng đủ 8 tuần mà không ăn thua thì sao?"
  Trang né hẳn. Thêm FAQ trả lời thẳng: *không hoàn tiền vì không hợp*, nói rõ lý
  do (mỹ phẩm đã mở nắp không bán lại được), và nói tiếp nên làm gì.
- FAQ giá chép lại gần nguyên khối ưu đãi — rút còn dữ kiện.
- "Tôi cần tư vấn trước" vẫn bắt nhập địa chỉ giao hàng ≥8 ký tự dù chưa mua gì:
  ma sát vô cớ đúng ở bước cuối phễu. Nay ô địa chỉ tự bỏ bắt buộc theo gói đang
  chọn, có nhãn "không bắt buộc khi chỉ cần tư vấn", và đây là **kịch bản thứ 7**
  trong bộ thử đặt hàng.

### Đo lại

Bộ thử: money **41/41**, claims **46/46**, richtext 23/23, đặt hàng **7/7**.
`astro check` 0 lỗi. Ngân sách trong mức. Trình duyệt thật ở 390×844, cả hai
ngôn ngữ: 0 vi phạm tương phản focus, 0 vùng chạm dưới 24px, 0 neo chết, 0 tràn
ngang. CI vòng 14 đã chạy **xanh toàn bộ 10 bước** trên GitHub — lần đầu kể từ
vòng 10; ba vòng 11–13 đều chết ở `npm ci` mà tài liệu vẫn ghi là xanh.

### Vẫn còn nợ

Không đổi so với vòng 14: số tiếp nhận phiếu công bố, mã số thuế, trang chính
sách, văn bản đồng ý cho ảnh và lời chứng, link gian hàng sàn — đều là dữ liệu
doanh nghiệp. Thêm: nên bật CSP ở phía hosting; chưa đo được trên thiết bị và
mạng thật tại Việt Nam; `shippingDetails` của bản EN cố ý để trống vì phí quốc
tế là báo giá theo nước, khai một con số cố định sẽ là nói dối với máy đọc.

---

## Vòng 16 — đóng kiểm định độc lập lần 8

Kiểm định viên thứ 8 được giao đúng một việc: săn mẫu hình đã lặp ba vòng liền —
**bản vá của vòng trước tạo lỗi mới ở chính vùng vừa sửa**. Họ tìm thấy nó ở
**cả bốn** bản vá chính của vòng 15. Không còn P0; còn 4 P1 đang nói sai với
người mua hoặc với máy đọc.

### Bốn P1

**Ô địa chỉ có điều kiện làm hỏng cả một lớp sản phẩm.** `addressRequired()` đọc
radio `input[name="pack"]:checked`; sản phẩm không khai `variants` thì không có
radio nào, `picked` là `null`, và hàm trả `false` — **địa chỉ giao hàng thành
không bắt buộc cho mọi người**, đơn gửi về endpoint không có địa chỉ, người mua
không hề bị nhắc. Sửa: không có radio nghĩa là đơn mua bình thường → bắt buộc.

**Luật tiền chỉ vá một nửa.** Vòng 15 bỏ điều kiện kết câu cho nhánh *có* đơn vị
tiền nhưng giữ nguyên cho nhánh *không* có. `"giảm còn 890 nghìn nha"`,
`"1.5 triệu nhé"`, `"1 triệu rưỡi"`, `"giá 1 triệu 50"` đều lên `dist`, JSON-LD
và llms.txt với build xanh. Nay nhánh bare chặn trừ khi theo sau là danh từ đếm
được (`5 triệu phụ nữ`, `2 nghìn đơn`).

Và ở đây **cái bẫy `\b` xuất hiện lần thứ hai trong dự án**: bản vá đầu của tôi
viết `(?!\s*COUNTABLE\b)`, nhưng `\b` chỉ nhận ký tự ASCII nên sau "nữ" không có
biên từ — lookahead tự vô hiệu và `"5 triệu phụ nữ"` bị chặn nhầm. Lần đầu là
mẫu "bác sĩ khuyên dùng" ở vòng 10.

**FAQ "không hoàn tiền" chọi với chính trang, ở bản EN.** Câu tôi viết cho bản
tiếng Việt được bê sang bản EN, nơi `compliance.warnings` đã hứa quyền rút lui
14 ngày cho EU/UK — mà quyền rút lui *chính là* hoàn tiền vì đổi ý. Ba nguồn
(FAQ, cảnh báo, JSON-LD) nói ba điều khác nhau trên cùng một trang. Nguyên nhân
cấu trúc: `compliance.warnings` là trường **duy nhất được miễn mọi cổng quét**.
Sửa: `returnPolicy` nay nhận nhiều chính sách; bản EN khai hai — VN 7 ngày chỉ
hàng lỗi, và EU/UK 14 ngày đổi ý hoàn tiền đầy đủ, phí gửi về do khách chịu.
FAQ viết lại cho khớp cả hai.

**`llms.txt` bỏ mất `referenceNote`.** Vòng 14 bắt buộc trường này chính vì "dẫn
nghiên cứu dùng 5% để chống lưng cho công thức 1% là dẫn nguồn gây hiểu nhầm" —
rồi file dành riêng cho máy trích dẫn lại in link trần. Trang người đọc nói
thật, file máy đọc nói nửa sự thật. Nay in đủ `referenceNote` và `suitedFor`.

### P2

- **`matchAll` sinh báo nhầm mới**: "Sản phẩm không điều trị nám. Nếu bạn cần
  điều trị nám, hãy đến gặp bác sĩ da liễu" bị chặn — đúng thứ trang mỹ phẩm
  *nên* viết. Và **lỗ phủ định vòng 14 vẫn còn nửa**: bỏ dấu phẩy là lọt lại
  ("Bạn sẽ không ngờ combo trị nám nhanh đến thế"). Nguyên nhân chung là
  `NEGATED` cho phép `[\p{L}\s]{0,18}` chen giữa, nên phủ định gắn vào động từ
  khác vẫn tính. Nay chỉ nhận đúng các tổ hợp phủ định trực tiếp. Thêm: khoảng
  trắng đôi vượt mọi luật có dấu cách cứng → `normaliseForScan` gộp `\s+`.
- **Cổng "đúng một khối order" đóng nửa**: đặt `{"type":"faq","id":"dat-hang"}`
  là build xanh với hai `id="dat-hang"` và mọi nút mua nhảy vào FAQ. Và neo
  trong `ingredients.rows[].reference` không được kiểm. Nay: id trùng bị chặn,
  và **mọi chuỗi bắt đầu bằng `#` ở bất kỳ trường nào** đều phải trỏ tới khối có
  thật.
- **Luật order làm vỡ sản phẩm nháp** — nay chỉ áp cho `status: "published"`.
- **`schedule` cron không làm được việc nó được thêm vào để làm**: workflow
  không có bước deploy nào, và GitHub chỉ chạy schedule trên nhánh mặc định.
  Thay vì giả vờ, nay comment nói thẳng nó chỉ là chuông báo, và thêm
  `scripts/check-offer-window.mjs` fail CI khi hạn ưu đãi đã qua (cảnh báo
  trước 7 ngày).
- **`llms.txt` mới dịch nửa file** — khung tài liệu vẫn tiếng Việt cứng, kể cả
  tuyên bố tuân thủ quan trọng nhất. Nay song ngữ.
- **`og:image` thiếu kích thước** → thêm `width`/`height`/`type`/`alt`. Bản vá
  đầu của tôi lấy tỉ lệ ảnh hero trong khi og:image là ảnh packshot — đã sửa
  bằng `resolveAssetImage()` trả kích thước thật của chính ảnh được dùng.
- **`checked` đặt trên hai radio** nếu gói khuyến nghị không phải gói đầu.
- Bỏ câu comment tự mâu thuẫn trong `fonts.css`.

### Đo lại

Bộ thử: money **48/48**, claims **53/53**, richtext 23/23, đặt hàng 7/7.
`astro check` 0 lỗi. Ngân sách trong mức. Chuông hạn ưu đãi xanh.

Khẳng định "CLS vẫn 0 với `swap`" của vòng 15 nay **có bằng chứng**: đo 390×844,
1,6 Mbps, RTT 300ms, CPU ×4, cache lạnh — CLS 0 (vi) và 0,0037 (en), LCP 828ms,
và cả ba face (BVP 400, BVP 600, Fraunces 600) đều đã nạp và áp dụng.

Ba cổng mới đều được kiểm bằng cách cố tình phá: id trùng → chặn; neo sai trong
`reference` → chặn kèm danh sách neo có thật; bản nháp thiếu khối order → cho qua.

### Vẫn còn nợ

Không đổi: số tiếp nhận phiếu công bố, mã số thuế, trang chính sách, văn bản
đồng ý cho ảnh và lời chứng, link gian hàng sàn. Thêm: `.github/workflows/ci.yml`
vẫn không deploy — ai dựng hạ tầng phát hành cần nối bước đó, nếu không chuông
báo hạn ưu đãi kêu mà không ai sửa được trang. Nên bật CSP ở phía hosting.

---

## Vòng 17 — đóng kiểm định độc lập lần 9

Vòng này kiểm định viên tự chọn góc, không được định hướng. Họ xác nhận ba bản
vá P1 của vòng 16 đều **đúng** — mẫu hình "bản vá đẻ lỗi mới" lần đầu tiên không
lặp lại. Nhưng họ tìm ra ba lỗ P1 mới, và điểm chung đáng sợ: **cả ba đều mở
bằng thao tác bình thường của người biên tập, không phải thao tác phá hoại.**

### P1-1 — Hàng rào claims mù với tiếng Việt không dấu

Đây là cổng chống Nghị định 342/2025 — lý do tồn tại của cả dự án. Câu
`"Kem tri nam tan goc, xoa nam vinh vien. Duoc bac si da lieu khuyen dung."`
vượt cùng lúc ba luật với build xanh. Copy quảng cáo Việt Nam viết không dấu là
chuẩn mực, không phải trò lách.

Nay mọi luật chạy trên **hai bản** của cùng một chuỗi: bản gốc và bản bỏ dấu
(mẫu trong từ điển cũng được bỏ dấu tự động để hai bộ không bao giờ lệch nhau).
Mẫu phủ định cũng phải có bản không dấu — thiếu bước đó thì
`"khong co tac dung thay the thuoc"` bị coi là tuyên bố thay vì cảnh báo.

Cùng nhóm: chữ giãn cách từng ký tự (`Đ I Ề U  T R Ị  N Á M`). Dồn lại thì mất
ranh giới từ, nên chuỗi đã dồn được quét bằng bộ mẫu có dấu cách nới thành
`\s*`, và biến thể này **chỉ sinh khi văn bản thật sự có chữ giãn cách** — không
nới lỏng hàng rào cho nội dung bình thường.

Kiểm định viên gọi đây là **bẫy `\b` lần thứ ba**; lần này nó nằm trong
`/\b(trị|điều trị|…)/` khi ký tự đứng trước là chữ có dấu.

### P1-2 — Hàng rào dữ liệu cá nhân thủng ở hai chỗ đời thường nhất

Luật họ tên thiếu cờ `i` nên chỉ bắt `chị` viết thường — mà tên người gần như
luôn đứng đầu câu và viết hoa. Luật điện thoại đòi 10 chữ số liền nhau, trong
khi người ta viết `0912 345 678`. `"Chị Nguyễn Thu Hà, Quận 3, gọi 0912 345 678"`
đăng được qua `cards.items[].body` với build xanh.

Sửa: gộp dấu phân cách giữa các chữ số trước khi khớp; liệt kê hoa/thường tường
minh thay vì bật cờ `i` — **bật `i` làm `[A-ZĐÀ-Ỹ]` khớp cả chữ thường**, và
câu cảnh báo bắt buộc "hỏi ý kiến bác sĩ trước khi dùng" lập tức bị coi là họ tên.

Và một điều đáng ghi: sau khi vá, hotline doanh nghiệp bị chặn nhầm — hoá ra
trước đây nó qua được **chỉ vì viết cách nhau**, tức qua nhờ chính lỗ hổng. Nay
số của doanh nghiệp được miễn trừ tường minh từ `src/data/mocha.json`.

### P1-3 — `source` dạng chữ biến thành link chết, đúng ngày Mocha gửi dữ liệu

Schema cố ý cho phép `usp[].source` là chữ ("số phiếu công bố, tên đơn vị kiểm
nghiệm"), nhưng `Hero.astro` bọc mọi giá trị thành `href`. Đặt
`"Số tiếp nhận 123456/25/CBMP-HCM"` → trang có một link chết mang nhãn "có chứng
từ". Lỗi này sẽ nổ đúng ngày điền số công bố thật — tức là đúng món đang chờ.

### P2 đã đóng

- **Cổng neo đếm cả khối bị consent ẩn**: `#hieu-qua` được chấp nhận trong khi
  gallery đã bị ẩn khỏi trang, và chính thông điệp lỗi còn liệt kê nó là "neo có
  thật". Nay khối chưa có đồng ý không được tính là neo.
- **Báo nhầm câu nên viết**: "Nếu bạn cần điều trị nám, hãy đến gặp bác sĩ da
  liễu" bị chặn. Nới từ điển để cho qua là mở lỗ thật, nên thay vào đó có
  `compliance.reviewedClaims` — ngoại lệ phải khai kèm **lý do**, và chỉ miễn
  cho đúng đoạn văn bản đã khai. Câu trên nay nằm trên trang, có tên, có lý do.
- **JSON-LD đổi trả thiếu trường bắt buộc**: `ReturnShippingFees` mà không có
  số tiền → dùng `ReturnFeesCustomerResponsibility`; và nhánh hàng lỗi không còn
  khai "phí 0đ" khi dữ liệu nói khách chịu phí.
- **`availability` chỉ tồn tại trong JSON-LD**: đặt `OutOfStock` thì máy đọc
  thấy hết hàng còn trang vẫn mời đặt mua. Giao diện hết hàng chưa có, nên cổng
  chặn thay vì để phát hành một mâu thuẫn.
- **Giá viết bằng chữ** ("chín trăm chín mươi nghìn") lọt hàng rào tiền.
- **Ngày hạn lệch theo múi giờ máy build**: `isOfferExpired` cẩn thận với UTC+7
  từ vòng trước, `shortDate` thì không — máy build ở múi giờ âm in ra "29 thg 9".
  Nay ghim `Asia/Ho_Chi_Minh`; kiểm bằng cách build với `TZ=America/Los_Angeles`.
- **`og:image` bịa chiều cao** cho ảnh trong `public/` — thà không khai còn hơn
  khai sai với Facebook/Zalo.
- **Hai radio cùng `checked`** nếu khai hai `variants.recommended`.

### `public/_headers` — bảy vòng ghi "nên bật CSP ở phía hosting"

Kiểm định viên chỉ ra điều đáng ngượng: trên Cloudflare Pages và Netlify, đây là
**file trong repo**, không phải việc phải nhờ người vận hành. Nay có CSP,
`X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, HSTS và
cache-control cho tài nguyên có hash.

Kèm theo một cổng mới: `check-budget.mjs` đối chiếu `connect-src` với
`PUBLIC_ORDER_ENDPOINT` và fail nếu CSP sẽ chặn đơn hàng. (Bản đầu tôi viết
nhầm thành `form-action` — biểu mẫu gửi bằng `fetch()`, nên ràng buộc đúng là
`connect-src`; `form-action` chỉ áp cho POST điều hướng.)

### Đo lại

Bộ thử nay **160 ca**: money 55/55, claims 62/62, richtext 23/23, dữ liệu cá
nhân 20/20 (bộ mới), đặt hàng 7/7. `astro check` 0 lỗi. Ngân sách trong mức.
Chuông hạn ưu đãi xanh. Năm cổng mới đều được kiểm bằng cách cố tình phá:
source dạng chữ → render thành chữ, không thành link; neo tới khối bị ẩn →
chặn; hai gói recommended → chặn; endpoint khác miền so với CSP → chặn.

### Vẫn còn nợ

Dữ liệu doanh nghiệp (không đổi). Thêm: `ci.yml` vẫn không deploy; chưa có giao
diện trạng thái hết hàng; chưa đo trên thiết bị và mạng thật tại Việt Nam; và
ghi chú tích hợp cho người dựng endpoint — payload dùng `Content-Type:
application/json` nên trình duyệt sẽ gửi preflight `OPTIONS`, endpoint phải trả
2xx cho nó, nếu không mọi đơn đều rơi vào nhánh "gửi đơn không thành công".

---

## Vòng 18 — đóng kiểm định độc lập lần 10

Kiểm định viên thứ 10 có hai việc: phá lại từng bản vá của vòng 17, và đóng vai
kỹ sư trưởng nhận bàn giao. Họ **từ chối ký nhận**, và cả hai lỗi P0 đều do
chính vòng 17 sinh ra.

### P0-1 — CSP chặn 100% đơn hàng, cổng canh nó chết trong CI

`public/_headers` — thứ tôi giới thiệu là thành tựu lớn nhất của vòng 17 — có
`connect-src` không liệt kê endpoint nhận đơn. Đo bằng Playwright trên cùng một
`dist/`, chỉ khác việc máy chủ có gắn header đó hay không:

```
NO CSP:   endpoint hits=2, CSP violations=0 → "Đơn hàng đã được ghi nhận"
WITH CSP: endpoint hits=0, CSP violations=2 → "không thành công. Vui lòng gọi…"
```

Và cổng tôi viết ra đúng để chặn việc này đọc `process.env.PUBLIC_ORDER_ENDPOINT`,
trong khi CI gọi `node scripts/check-budget.mjs` **không có biến môi trường nào** —
nên nó không bao giờ có gì để đối chiếu. Nay cổng đọc endpoint từ **chính bản
build** (`data-action` trong HTML), CI đo thêm một bản build giống production, và
`tests/order-endpoint.mjs` có **kịch bản thứ 8: gửi đơn dưới CSP thật lấy từ
`public/_headers`** — theo kiểm định viên, đó là phép thử duy nhất bắt được lớp
lỗi này. Kiểm chứng ngược: đổi `script-src` bỏ `'unsafe-inline'` → bộ thử fail.

### P0-2 — Một chữ "dùng" đứng trước là qua hết mọi luật

Vòng 17 sinh mẫu phủ định không dấu bằng `stripDiacritics(NEGATED.source)`.
Nhưng **`đừng` và `dùng` bỏ dấu đều thành `dung`** — nên từ thông dụng nhất trên
một trang mỹ phẩm trở thành từ khoá miễn trừ:

```
PASSED  "Sản phẩm dùng thay thế laser."
PASSED  "Kem dùng thay thế thuốc bôi mỗi tối."
PASSED  "Chúng tôi dùng cam kết hoàn tiền nếu không hết nám."
BLOCKED "Kem trị nám tận gốc mỗi tối."     ← cùng câu, không có "dùng"
```

Cùng cơ chế: `chưa`/`chứa` → `chua`, `chẳng`/`chàng` → `chang`. Nay
`NEGATED_BARE` **viết tay**, chỉ gồm những từ mà bản không dấu không trùng nghĩa
với từ nào khác — `dung` bị loại khỏi danh sách.

### P1-3 — Bỏ dấu cả văn bản có dấu sinh 5 báo nhầm, bằng chuỗi không tồn tại

`nám|thâm|sạm` bỏ dấu thành `nam|tham|sam`, trùng `năm|nắm|Nam|sách`:

```
BLOCKED "Ưu đãi áp dụng đến hết năm 2026."   → thông điệp lỗi: "het nam"
BLOCKED "Bạn chưa nắm rõ cách dùng?"         → "chua nam"
```

Người biên tập sẽ Ctrl+F `het nam` trong file của mình và **không tìm thấy gì** —
chuỗi đó chỉ tồn tại trong bộ nhớ của bộ quét. "Hết năm 2026" là cách viết hạn
khuyến mãi phổ biến nhất tiếng Việt.

Sửa từ gốc: **bản bỏ dấu chỉ áp cho những câu vốn đã viết không dấu.** Một câu
đã có dấu thì người viết đang gõ tiếng Việt có dấu, không có lý do đọc nó theo
nghĩa không dấu. Tách câu, xét từng câu.

### Bẫy `\b` lần thứ TƯ — và cổng chặn nó tái diễn

Trong lúc sửa, phát hiện `/\b(trị|điều trị|chữa|đặc trị)\s+(nám|…)/` **vẫn** còn
`\b`: nhánh `điều trị` chưa bao giờ khớp, chỉ khớp nhờ nhánh ngắn `trị` ăn may,
và vỡ hẳn với chữ giãn cách. Đây là lần thứ tư cùng một cái bẫy trong dự án
(vòng 10: "bác sĩ khuyên dùng"; vòng 16: `(?!\s*phụ nữ\b)`; vòng 18: hai lần).

Nên nay có `tests/pattern-lint.mjs`: quét chính bộ mẫu, fail nếu `\b` đứng cạnh
ký tự ngoài ASCII — kể cả khi nó canh một nhóm `(a|b|c)` mà chỉ nhánh sau có dấu.
Kiểm chứng hai chiều: đưa lỗi cũ trở lại → exit 1.

### P1-1 — `reviewedClaims` là cửa hậu, và nó đã mở sẵn

Miễn trừ khớp theo **chuỗi khớp được**, không theo **vị trí**. Câu ngoại lệ hợp
lệ đã có trong `vi.json` chứa cụm `điều trị nám`, nên chỉ cần dán nó vào cuối
một đoạn là mọi lần xuất hiện khác của cùng cụm trong đoạn đó được tha:

```
PASSED "Kem điều trị nám tận gốc chỉ sau 2 tuần. Nếu bạn cần điều trị nám, hãy
        đến gặp bác sĩ da liễu."
```

Nay miễn theo **khoảng vị trí** của đúng đoạn đã khai, tính trong cùng hệ toạ độ
mà bộ quét dùng; và cụm bị bắt ở chế độ không dấu hoặc dồn khoảng trắng **không
bao giờ** được tha. Kiểm chứng: đúng payload của kiểm định viên nay bị chặn cả
ba lỗi (`điều trị nám`, `thay thế laser`, `0912345678`).

### P1-2 — Miễn trừ hotline giấu luôn số của khách

`findPersonalData` lấy đúng một match mỗi luật. Hotline doanh nghiệp đứng trước
→ `continue` → mọi số sau không bao giờ được xét:

```
PASSED "Hotline 0367 848 918. Chị Hà đặt hàng qua số 0912 345 678."
```

Nay duyệt mọi lần khớp trên cả hai bản (nguyên văn và bản gộp chữ số).

### Bàn giao — phần B của kiểm định

Kiểm định viên đóng vai người biên tập không biết code, chỉ đọc README, và mất
**ba vòng build-lỗi**: README nói "điền các trường bắt buộc" mà không chỗ nào
trong repo liệt kê chúng; và họ phải tự khai `image.width`/`height` mà không
biết lấy số pixel ở đâu — khai sai thì build vẫn xanh còn CLS vọt lên 0,0996.

Ba việc đã làm:

1. **`docs/truong-du-lieu.md` sinh tự động từ schema** (`npm run docs:fields`),
   và CI fail nếu nó lệch khỏi schema — tài liệu viết tay sẽ lệch sau vài vòng.
2. **`src/content/_template/vi.json`** — mẫu có chú thích ngay trong file, nằm
   ngoài `products/` nên không bao giờ lên trang. Kiểm chứng: chép mẫu, sửa 6
   trường, build xanh ngay lần đầu, trang render đủ.
3. **Kích thước ảnh đọc từ chính file** — người biên tập không cần biết pixel.
   Khai lệch (999×111 cho ảnh 1002×762) nay bị bỏ qua thay vì gây CLS.
   Kèm `.strict()` cho mọi khối: gõ `headding` được chỉ đích danh.

### Đo lại

Bộ thử nay **189 ca**: money 55/55, claims 72/72, richtext 23/23, dữ liệu cá
nhân 22/22, lint mẫu 17/17, đặt hàng **8/8** (thêm kịch bản CSP). `astro check`
0 lỗi. Ngân sách và chuông hạn ưu đãi xanh.

Trình duyệt thật, 390×844, 1,6 Mbps, RTT 300ms, CPU ×4, cache lạnh:
CLS 0,0014 (vi) / 0,0045 (en), LCP 888/844ms, 0 vi phạm tương phản focus,
0 vùng chạm dưới 24px, 0 neo chết, 0 id trùng, 0 tràn ngang.

### Vẫn còn nợ

Dữ liệu doanh nghiệp (không đổi). `ci.yml` vẫn không deploy. Chưa có giao diện
trạng thái hết hàng (cổng chặn `availability` khác `InStock` để không phát hành
mâu thuẫn). Chưa đo trên thiết bị và mạng thật tại Việt Nam. Ghi chú cho người
dựng endpoint: `Content-Type: application/json` sinh preflight `OPTIONS`, endpoint
phải trả 2xx cho nó.

---

## Vòng 19 — đóng kiểm định độc lập lần 11

Vòng 11 được giao đúng một việc mà vòng 10 đặt ra: xác nhận bốn bản vá của vòng
18 có đẻ lỗi mới không. Câu trả lời của họ: **có** — và họ đúng.

### P0-A — Bản vá P0-2 của vòng 18 là hồi quy, nặng hơn lỗ nó vá

Vòng 18 chữa báo nhầm `nám`↔`năm` bằng cách tắt chế độ quét không dấu cho **mọi
câu có một chữ có dấu**. Sai mức: tiêu chí phải theo **từ**, không theo câu. Đo
giữa hai commit liền nhau, 9 câu quảng cáo vi phạm:

| | vòng 17 (`4a59aba`) | vòng 18 (`849d187`) |
|---|---|---|
| `Kem tri nam tận gốc.` | CHẶN | **LỌT** |
| `Cam ket hoan tien neu khong het nam nhé.` | CHẶN | **LỌT** |
| `Duoc bac si da lieu khuyen dung ạ.` | CHẶN | **LỌT** |
| … (9 câu) | 9/9 chặn | **1/9 chặn** |

Trộn dấu và không dấu trong cùng câu là cách gõ phổ biến nhất của biên tập Việt,
nên đây là lỗ rộng chứ không hẹp. Kiểm định viên đưa được một câu vi phạm ba
luật lên `dist/index.html` với build xanh.

Sửa ở mức từ: quét bản bỏ dấu trên toàn văn, nhưng **chỉ tin lần khớp nếu trong
đúng đoạn khớp có ít nhất một từ vốn được gõ không dấu**. `"hết năm 2026"` (cả
hai từ đều có dấu) bị loại; `"tri nam tận gốc"` được nhận. Phép bỏ dấu giữ nguyên
độ dài từng ký tự nên chỉ số trỏ đúng vào bản gốc. Cả 9 ca vào bộ thử.

### P0-B — `reviewedClaims` vẫn là cửa hậu, chỉ cần đổi thứ tự câu

Vòng 18 đổi miễn trừ sang **theo vị trí** nhưng `findForbiddenClaims` vẫn trả
**đúng một hit mỗi luật** (`break`). Nếu hit duy nhất đó rơi vào khoảng đã khai
thì mọi vi phạm khác của cùng luật không bao giờ được báo — cửa hậu chỉ đổi điều
kiện từ "dán câu ngoại lệ vào cuối" sang "dán vào đầu".

Kiểm định viên đưa `"Combo này điều trị nám chỉ sau 2 tuần."` lên `dist` bằng
chính file production và chính khai báo `reviewedClaims` đang có trong repo.

Hai đường nữa: khai `text: "điều trị nám"` (đúng 12 ký tự, vừa đủ `min(12)` —
tức khai chính cụm bị cấm làm ngoại lệ), và dùng thẻ HTML để lệch toạ độ.

Sửa: trả **mọi** lần khớp, lọc theo vị trí sau; `text` phải ≥40 ký tự (một câu
đầy đủ, vì ngữ cảnh mới là thứ làm câu đó hợp lệ); tối đa 5 ngoại lệ — nhiều hơn
là dấu hiệu nội dung cần viết lại. Kiểm chứng cả bốn đường: đều bị chặn.

### P1-C — Cổng CSP không bao giờ có thể fail trong CI

Cổng chạy thật và chặn thật, nhưng bước CI truyền `https://mochatrinam.com/api/orders`
— đúng `SITE_ORIGIN`, nên nhánh `'self'` luôn đúng **bất kể `connect-src` viết
gì**. Cổng dựng để chặn lỗi vòng 10 chưa từng nhận một đầu vào có thể làm nó fail.
Nay CI có một bước khẳng định ngược: endpoint khác miền **phải** làm cổng fail,
không fail thì CI đỏ. *Một cổng không bao giờ fail được thì không phải là cổng.*

Kèm: `connect.includes(origin)` là so chuỗi con, nên `https://www.facebook.co`
(gõ thiếu `m`) được báo "ok" vì là chuỗi con của một nguồn có thật. Nay so khớp
chính xác từng nguồn.

### P1-D — Kịch bản 8 tự vô hiệu hoá đúng directive nó được viết ra để kiểm

`cspRaw.replace('connect-src', ...)` chèn localhost vô điều kiện, nên nó **không
thể** phát hiện `connect-src` thiếu origin endpoint. Nay chỉ nới khi origin chưa
có mặt, và thêm khẳng định rằng origin thật trong `data-action` của bản build
phải nằm trong `connect-src` gốc (loopback được miễn, vì bản build của bộ thử
buộc phải dùng localhost). Kiểm chứng: phá `style-src` hoặc `font-src` → bộ thử
báo hỏng.

### P1-E — `seo.ogImage` sai đường dẫn vẫn build xanh

`Picture.astro` dừng build khi ảnh không tồn tại, nhưng `resolveAssetUrl` thì
không — `og:image` và `Product.image` trỏ 404. Đúng lớp lỗi vòng 6, còn sót một
đường vào. Nay dừng build ở cả hai đường.

### P2 đã đóng

`.strict()` nay phủ **object sản phẩm cấp cao, `seo`, `compliance`, `claim`,
`shipping`, `variants`, `returnPolicy`** — trước chỉ có ở `blocks` và `image`,
nên gõ sai `compliance.productNotificationNumbe` (trường mang nghĩa pháp lý) hay
`seo.ogimage` bị bỏ âm thầm, trong khi tài liệu hứa "máy chỉ đích danh".

Và chế độ strict mới lập tức làm **chính thư mục mẫu của tôi vỡ** vì khoá chú
thích `_doc` — đúng điểm bất nhất vòng 11 nêu. Đã bỏ khoá đó, đưa hướng dẫn ra
`src/content/_template/README.md`; kiểm chứng lại: chép mẫu, sửa 6 trường, build
xanh ngay lần đầu.

`docs/truong-du-lieu.md` nay bung cả nhóm trường lồng nhau: **42 trường** thay vì
19 — trước đây `compliance` chỉ hiện một dòng "nhóm trường", nên người biên tập
chỉ tạo được sản phẩm nhờ thư mục mẫu, không nhờ tài liệu.

Ba lỗi từ điển có sẵn từ trước: `"chữa bệnh nám da"` (cụm không liền kề) lọt;
`"da bạn đang điều trị bằng thuốc bôi"` — khuyến nghị y tế hợp lệ — bị chặn;
`"Anh Chị Em thân mến"` bị coi là danh tính. Đều đã sửa và có ca thử.

`tests/order-endpoint.mjs` nay dọn cổng khi chết giữa đường, để lần chạy sau
không báo `EADDRINUSE` thay vì báo lỗi hàng rào thật.

### Đo lại

Bộ thử nay **203 ca**: money 55/55, claims 84/84, richtext 23/23, dữ liệu cá
nhân 24/24, lint mẫu 17/17, đặt hàng 8/8. `astro check` 0 lỗi. Ngân sách, chuông
hạn ưu đãi, tài liệu-khớp-schema đều xanh.

### Điều đáng ghi lại nhất từ vòng này

Kiểm định viên chỉ ra một điều quan trọng hơn mọi lỗi trong danh sách:

> "Cả 189 ca thử đều xanh trong khi ba lỗ P0 đang mở. Bộ thử chỉ chứa những câu
> của các vòng trước, nên nó chứng nhận rằng lỗi cũ không tái diễn — không chứng
> nhận rằng bản vá không mở lỗi mới."

Đó là lý do vòng này, ngoài ca thử, còn thêm hai thứ khác loại: một cổng **khẳng
định ngược** (CI đỏ nếu cổng CSP không fail được) và một **lint quét chính bộ
mẫu** (`pattern-lint`) thay vì quét nội dung. Cả hai kiểm tra *hàng rào có còn
là hàng rào*, không kiểm tra *nội dung có sạch*.
