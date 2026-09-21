<!-- Sinh tự động bởi scripts/check-assets.mjs — đừng sửa tay.
     Sửa đặc tả ở src/data/_anh-can-co.json rồi chạy `npm run docs:assets`. -->
# Ảnh cần có cho website

Đặt file vào `src/assets/images/` **đúng tên** ở cột đầu. Không cần khai kích
thước ở đâu cả — máy tự đọc số pixel từ chính file và tự sinh bản AVIF/WebP
nhiều kích cỡ khi build.

Kiểm lại bất cứ lúc nào: `npm run check:assets`

## Gửi ảnh từ máy Windows lên bằng cách nào

Phiên Claude dựng site chạy trong container trên cloud, không đọc được ổ đĩa
trên máy cá nhân. Có hai đường:

**Ít file:** kéo-thả thẳng vào khung chat.

**Nhiều file:** chạy trong PowerShell, đứng ở thư mục kho:

```powershell
.\scripts\gui-anh.ps1
```

Script đẩy nguyên trạng lên nhánh tạm `assets-inbox` kèm một bản kê. Nhánh đó
không bao giờ merge vào `main`, nên lịch sử nhánh chính không phình vì file
nhị phân. Việc chọn ảnh nào vào vị trí nào để phía dựng site làm.

## Vị trí ảnh

| Tên file | Vị trí | Bắt buộc | Tỉ lệ | Tối thiểu | Nặng tối đa | Trạng thái |
| --- | --- | --- | --- | --- | --- | --- |
| `logo.webp` | Logo thương hiệu | ✅ | tự do | 368×136 | 30KB | ✅ đạt |
| `packshot-combo.webp` | Ảnh bộ sản phẩm | ✅ | 4:3 | 1600×1200 | 120KB | ❌ rộng 1002px < 1600px; cao 762px < 1200px |
| `packshot-combo.jpg` | Ảnh bộ sản phẩm (bản JPEG cho og:image) | ✅ | 4:3 | 1200×900 | 200KB | ❌ rộng 1002px < 1200px; cao 762px < 900px |
| `nam_01.webp` | Nám mảng | ✅ | 4:3 | 800×600 | 60KB | ❌ cao 449px < 600px; tỉ lệ 1.78 ≠ 4:3 (1.33) |
| `nam_02.webp` | Nám chân sâu | ✅ | 4:3 | 800×600 | 60KB | ❌ rộng 500px < 800px; cao 316px < 600px; tỉ lệ 1.58 ≠ 4:3 (1.33) |
| `nam_03.webp` | Nám hỗn hợp | ✅ | 4:3 | 800×600 | 60KB | ❌ cao 533px < 600px; tỉ lệ 1.50 ≠ 4:3 (1.33) |
| `texture-kem.webp` | Chất kem cận cảnh | — | 16:9 | 1800×1012 | 110KB | ⬜ chưa có |
| `ung-dung.webp` | Thao tác dùng sản phẩm | — | 3:2 | 1200×800 | 90KB | ⬜ chưa có |
| `thuong-hieu.webp` | Ảnh thương hiệu cho trang chủ | — | 4:3 | 1600×1200 | 130KB | ⬜ chưa có |
| `packshot-first-care-serum.webp` | Ảnh sản phẩm — Serum Smart First Care | ✅ | tự do | 1200×1200 | 120KB | ✅ đạt |
| `packshot-brightening-cream.webp` | Ảnh sản phẩm — Kem nám Smart Brightening X3 | ✅ | tự do | 1200×1200 | 120KB | ❌ rộng 1000px < 1200px; cao 1000px < 1200px |
| `packshot-smart-target.webp` | Ảnh sản phẩm — Gel chấm mụn Smart Target | ✅ | tự do | 1200×1200 | 120KB | ❌ rộng 1000px < 1200px; cao 1000px < 1200px |
| `packshot-smart-white-plus.webp` | Ảnh sản phẩm — Smart Whitening Turmergel | ✅ | tự do | 1200×1200 | 120KB | ❌ rộng 900px < 1200px |
| `packshot-biovector.webp` | Ảnh sản phẩm — Biovector Brightening Cream | ✅ | tự do | 1200×1200 | 120KB | ❌ rộng 1000px < 1200px; cao 1000px < 1200px |
| `packshot-collagen-peptide.webp` | Ảnh sản phẩm — Collagen Peptide Cream | ✅ | tự do | 1200×1200 | 120KB | ❌ rộng 1000px < 1200px; cao 1000px < 1200px |
| `packshot-bio-gel-mask.webp` | Ảnh sản phẩm — Ultra EGF Bio-Gel Mask | ✅ | tự do | 1200×1200 | 120KB | ❌ rộng 1000px < 1200px; cao 1000px < 1200px |
| `packshot-bio-active-cleanser.webp` | Ảnh sản phẩm — Sữa rửa mặt Bio-Active Cleanser | ✅ | tự do | 1200×1200 | 120KB | ❌ rộng 1000px < 1200px; cao 1000px < 1200px |
| `packshot-bio-deep-detox.webp` | Ảnh sản phẩm — Nước tẩy trang Bio-Deep Detox | ✅ | tự do | 1200×1200 | 120KB | ❌ rộng 1000px < 1200px; cao 1000px < 1200px |
| `packshot-uv-block.webp` | Ảnh sản phẩm — Kem chống nắng UV-Block Plus | ✅ | tự do | 1200×1200 | 120KB | ❌ rộng 1000px < 1200px |
| `packshot-retinol-mixpeel.webp` | Ảnh sản phẩm — Retinol mixPEEL Kit | ✅ | tự do | 1200×1200 | 120KB | ✅ đạt |

## Từng vị trí cần ảnh như thế nào

### `logo.webp` — Logo thương hiệu

**Hiện ở:** Đầu trang mọi trang · Chân trang · JSON-LD Organization  
**Tỉ lệ:** tự do · **tối thiểu** 368×136px · **nặng tối đa** 30KB · **nền trong suốt**

Chữ MOCHA trên nền trong suốt. Không viền, không bóng đổ, không khung.

### `packshot-combo.webp` — Ảnh bộ sản phẩm

**Hiện ở:** Hero landing · Thẻ sản phẩm · Ảnh chia sẻ og:image mọi trang  
**Tỉ lệ:** 4:3 · **tối thiểu** 1600×1200px · **nặng tối đa** 120KB

Hũ kem và chai serum đứng cạnh nhau, nền sáng phẳng, đổ bóng mềm. Nhãn đọc được rõ. Chừa khoảng trống hai bên: ảnh bị cắt khác nhau ở hero (cắt dọc) và ở thẻ sản phẩm (cắt 4:3).

### `packshot-combo.jpg` — Ảnh bộ sản phẩm (bản JPEG cho og:image)

**Hiện ở:** og:image — Facebook và Zalo không đọc được WebP ở mọi phiên bản  
**Tỉ lệ:** 4:3 · **tối thiểu** 1200×900px · **nặng tối đa** 200KB

Cùng ảnh với bản .webp, xuất ra JPEG.

### `nam_01.webp` — Nám mảng

**Hiện ở:** Khối “Ba loại nám” trên landing  
**Tỉ lệ:** 4:3 · **tối thiểu** 800×600px · **nặng tối đa** 60KB

Cận cảnh vùng má có nám mảng — mảng nâu nhạt, bờ không rõ. KHÔNG có mặt người nhận diện được, KHÔNG có bác sĩ hay cơ sở y tế trong khung (Nghị định 342/2025/NĐ-CP).

### `nam_02.webp` — Nám chân sâu

**Hiện ở:** Khối “Ba loại nám” trên landing  
**Tỉ lệ:** 4:3 · **tối thiểu** 800×600px · **nặng tối đa** 60KB

Cận cảnh các nốt nâu sẫm bờ rõ. Cùng góc chụp, cùng ánh sáng với nam_01 và nam_03 — ba ảnh nằm cạnh nhau nên lệch tông là thấy ngay.

### `nam_03.webp` — Nám hỗn hợp

**Hiện ở:** Khối “Ba loại nám” trên landing  
**Tỉ lệ:** 4:3 · **tối thiểu** 800×600px · **nặng tối đa** 60KB

Cận cảnh vùng da có cả hai dạng trên.

### `texture-kem.webp` — Chất kem cận cảnh

**Hiện ở:** Dải ảnh tràn lề giữa landing · Trang dòng sản phẩm  
**Tỉ lệ:** 16:9 · **tối thiểu** 1800×1012px · **nặng tối đa** 110KB

Macro chất kem/serum — vệt kem, giọt serum trên nền sáng. Đây là ảnh làm trang bớt đơn điệu nhất: nó cho thấy sản phẩm là gì mà không cần một lời quảng cáo nào.

### `ung-dung.webp` — Thao tác dùng sản phẩm

**Hiện ở:** Khối “Cách dùng” trên landing  
**Tỉ lệ:** 3:2 · **tối thiểu** 1200×800px · **nặng tối đa** 90KB

Bàn tay lấy kem hoặc thoa lên má. Chỉ bàn tay và một phần da, không cần mặt. Ánh sáng tự nhiên.

### `thuong-hieu.webp` — Ảnh thương hiệu cho trang chủ

**Hiện ở:** Hero trang chủ  
**Tỉ lệ:** 4:3 · **tối thiểu** 1600×1200px · **nặng tối đa** 130KB

Toàn dải sản phẩm Mocha xếp cùng khung, hoặc một cảnh đặt sản phẩm có chiều sâu. Hiện trang chủ đang mượn tạm ảnh packshot — thay được bằng ảnh riêng thì trang chủ và landing mới không giống hệt nhau.

### `packshot-first-care-serum.webp` — Ảnh sản phẩm — Serum Smart First Care

**Hiện ở:** Hero landing sản phẩm · Thẻ sản phẩm trên trang dòng và trang chủ · og:image của trang sản phẩm  
**Tỉ lệ:** tự do · **tối thiểu** 1200×1200px · **nặng tối đa** 120KB

Ảnh chai serum trên nền sáng phẳng, đổ bóng mềm, nhãn đọc được rõ. Tỉ lệ để tự do vì lưới thẻ dùng khung 4:3 với object-fit: contain — ảnh không bị cắt. NHƯNG hero cắt theo khung dọc, nên chừa khoảng trống quanh sản phẩm và đừng đặt chi tiết quan trọng sát mép trái/phải. Chủ thể lệch tâm thì khai `focus` trong file JSON của sản phẩm.

### `packshot-brightening-cream.webp` — Ảnh sản phẩm — Kem nám Smart Brightening X3

**Hiện ở:** Hero landing sản phẩm · Thẻ sản phẩm trên trang dòng và trang chủ · og:image của trang sản phẩm  
**Tỉ lệ:** tự do · **tối thiểu** 1200×1200px · **nặng tối đa** 120KB

Ảnh hũ kem trên nền sáng phẳng, đổ bóng mềm, nhãn đọc được rõ. Tỉ lệ để tự do vì lưới thẻ dùng khung 4:3 với object-fit: contain — ảnh không bị cắt. NHƯNG hero cắt theo khung dọc, nên chừa khoảng trống quanh sản phẩm và đừng đặt chi tiết quan trọng sát mép trái/phải. Chủ thể lệch tâm thì khai `focus` trong file JSON của sản phẩm.

### `packshot-smart-target.webp` — Ảnh sản phẩm — Gel chấm mụn Smart Target

**Hiện ở:** Hero landing sản phẩm · Thẻ sản phẩm trên trang dòng và trang chủ · og:image của trang sản phẩm  
**Tỉ lệ:** tự do · **tối thiểu** 1200×1200px · **nặng tối đa** 120KB

Ảnh lọ gel trên nền sáng phẳng, đổ bóng mềm, nhãn đọc được rõ. Tỉ lệ để tự do vì lưới thẻ dùng khung 4:3 với object-fit: contain — ảnh không bị cắt. NHƯNG hero cắt theo khung dọc, nên chừa khoảng trống quanh sản phẩm và đừng đặt chi tiết quan trọng sát mép trái/phải. Chủ thể lệch tâm thì khai `focus` trong file JSON của sản phẩm.

### `packshot-smart-white-plus.webp` — Ảnh sản phẩm — Smart Whitening Turmergel

**Hiện ở:** Hero landing sản phẩm · Thẻ sản phẩm trên trang dòng và trang chủ · og:image của trang sản phẩm  
**Tỉ lệ:** tự do · **tối thiểu** 1200×1200px · **nặng tối đa** 120KB

Ảnh tuýp gel trên nền sáng phẳng, đổ bóng mềm, nhãn đọc được rõ. Tỉ lệ để tự do vì lưới thẻ dùng khung 4:3 với object-fit: contain — ảnh không bị cắt. NHƯNG hero cắt theo khung dọc, nên chừa khoảng trống quanh sản phẩm và đừng đặt chi tiết quan trọng sát mép trái/phải. Chủ thể lệch tâm thì khai `focus` trong file JSON của sản phẩm.

### `packshot-biovector.webp` — Ảnh sản phẩm — Biovector Brightening Cream

**Hiện ở:** Hero landing sản phẩm · Thẻ sản phẩm trên trang dòng và trang chủ · og:image của trang sản phẩm  
**Tỉ lệ:** tự do · **tối thiểu** 1200×1200px · **nặng tối đa** 120KB

Ảnh hũ kem trên nền sáng phẳng, đổ bóng mềm, nhãn đọc được rõ. Tỉ lệ để tự do vì lưới thẻ dùng khung 4:3 với object-fit: contain — ảnh không bị cắt. NHƯNG hero cắt theo khung dọc, nên chừa khoảng trống quanh sản phẩm và đừng đặt chi tiết quan trọng sát mép trái/phải. Chủ thể lệch tâm thì khai `focus` trong file JSON của sản phẩm.

### `packshot-collagen-peptide.webp` — Ảnh sản phẩm — Collagen Peptide Cream

**Hiện ở:** Hero landing sản phẩm · Thẻ sản phẩm trên trang dòng và trang chủ · og:image của trang sản phẩm  
**Tỉ lệ:** tự do · **tối thiểu** 1200×1200px · **nặng tối đa** 120KB

Ảnh hũ kem trên nền sáng phẳng, đổ bóng mềm, nhãn đọc được rõ. Tỉ lệ để tự do vì lưới thẻ dùng khung 4:3 với object-fit: contain — ảnh không bị cắt. NHƯNG hero cắt theo khung dọc, nên chừa khoảng trống quanh sản phẩm và đừng đặt chi tiết quan trọng sát mép trái/phải. Chủ thể lệch tâm thì khai `focus` trong file JSON của sản phẩm.

### `packshot-bio-gel-mask.webp` — Ảnh sản phẩm — Ultra EGF Bio-Gel Mask

**Hiện ở:** Hero landing sản phẩm · Thẻ sản phẩm trên trang dòng và trang chủ · og:image của trang sản phẩm  
**Tỉ lệ:** tự do · **tối thiểu** 1200×1200px · **nặng tối đa** 120KB

Ảnh hũ mặt nạ gel trên nền sáng phẳng, đổ bóng mềm, nhãn đọc được rõ. Tỉ lệ để tự do vì lưới thẻ dùng khung 4:3 với object-fit: contain — ảnh không bị cắt. NHƯNG hero cắt theo khung dọc, nên chừa khoảng trống quanh sản phẩm và đừng đặt chi tiết quan trọng sát mép trái/phải. Chủ thể lệch tâm thì khai `focus` trong file JSON của sản phẩm.

### `packshot-bio-active-cleanser.webp` — Ảnh sản phẩm — Sữa rửa mặt Bio-Active Cleanser

**Hiện ở:** Hero landing sản phẩm · Thẻ sản phẩm trên trang dòng và trang chủ · og:image của trang sản phẩm  
**Tỉ lệ:** tự do · **tối thiểu** 1200×1200px · **nặng tối đa** 120KB

Ảnh tuýp sữa rửa mặt trên nền sáng phẳng, đổ bóng mềm, nhãn đọc được rõ. Tỉ lệ để tự do vì lưới thẻ dùng khung 4:3 với object-fit: contain — ảnh không bị cắt. NHƯNG hero cắt theo khung dọc, nên chừa khoảng trống quanh sản phẩm và đừng đặt chi tiết quan trọng sát mép trái/phải. Chủ thể lệch tâm thì khai `focus` trong file JSON của sản phẩm.

### `packshot-bio-deep-detox.webp` — Ảnh sản phẩm — Nước tẩy trang Bio-Deep Detox

**Hiện ở:** Hero landing sản phẩm · Thẻ sản phẩm trên trang dòng và trang chủ · og:image của trang sản phẩm  
**Tỉ lệ:** tự do · **tối thiểu** 1200×1200px · **nặng tối đa** 120KB

Ảnh chai nước tẩy trang trên nền sáng phẳng, đổ bóng mềm, nhãn đọc được rõ. Tỉ lệ để tự do vì lưới thẻ dùng khung 4:3 với object-fit: contain — ảnh không bị cắt. NHƯNG hero cắt theo khung dọc, nên chừa khoảng trống quanh sản phẩm và đừng đặt chi tiết quan trọng sát mép trái/phải. Chủ thể lệch tâm thì khai `focus` trong file JSON của sản phẩm.

### `packshot-uv-block.webp` — Ảnh sản phẩm — Kem chống nắng UV-Block Plus

**Hiện ở:** Hero landing sản phẩm · Thẻ sản phẩm trên trang dòng và trang chủ · og:image của trang sản phẩm  
**Tỉ lệ:** tự do · **tối thiểu** 1200×1200px · **nặng tối đa** 120KB

Ảnh tuýp kem chống nắng trên nền sáng phẳng, đổ bóng mềm, nhãn đọc được rõ. Tỉ lệ để tự do vì lưới thẻ dùng khung 4:3 với object-fit: contain — ảnh không bị cắt. NHƯNG hero cắt theo khung dọc, nên chừa khoảng trống quanh sản phẩm và đừng đặt chi tiết quan trọng sát mép trái/phải. Chủ thể lệch tâm thì khai `focus` trong file JSON của sản phẩm.

### `packshot-retinol-mixpeel.webp` — Ảnh sản phẩm — Retinol mixPEEL Kit

**Hiện ở:** Hero landing sản phẩm · Thẻ sản phẩm trên trang dòng và trang chủ · og:image của trang sản phẩm  
**Tỉ lệ:** tự do · **tối thiểu** 1200×1200px · **nặng tối đa** 120KB

Ảnh bộ sản phẩm trên nền sáng phẳng, đổ bóng mềm, nhãn đọc được rõ. Tỉ lệ để tự do vì lưới thẻ dùng khung 4:3 với object-fit: contain — ảnh không bị cắt. NHƯNG hero cắt theo khung dọc, nên chừa khoảng trống quanh sản phẩm và đừng đặt chi tiết quan trọng sát mép trái/phải. Chủ thể lệch tâm thì khai `focus` trong file JSON của sản phẩm.

## Chứng từ (phiếu công bố, CGMP, phiếu kiểm nghiệm)

Đặt vào `src/assets/documents`. Phiếu công bố sản phẩm mỹ phẩm, chứng nhận CGMP-ASEAN, phiếu kiểm nghiệm. Đặt tại đây rồi khai trong khối "documents" của file sản phẩm.

Tối thiểu 1000px chiều rộng, nặng tối đa 180KB.

> ⚠️ Che hoặc xoá mọi dữ liệu cá nhân trước khi đưa lên: chữ ký, số điện thoại cá nhân, số căn cước. Đây là trang công khai.

## Ảnh trước/sau của khách

Ảnh trước/sau của khách. KHÔNG được vào bản build khi chưa có văn bản đồng ý của chính người trong ảnh; scripts/check-budget.mjs chặn và làm fail CI nếu lọt ra dist/.

Đặt vào `src/media-gated/images`, tỉ lệ 1:1, tối thiểu 900px.

