# Thiếu sót nội dung — những gì cần chủ doanh nghiệp cung cấp

> Sinh tự động bằng `npm run docs:gaps`. Đừng sửa tay — bổ sung dữ liệu thật
> rồi chạy lại, mục tương ứng sẽ tự biến mất.
> Quét ngày 2026-09-26.

## Nguyên tắc

Không mục nào dưới đây được lấp bằng nội dung tạm. Cụ thể, nền tảng này
**không** tạo chứng nhận giả, không dựng thẻ chứng từ rỗng, không gắn huy
hiệu "đã xác minh" khi chưa xác minh, và không viết lời chứng thay khách.
Thiếu dữ liệu thì khối tương ứng **không render** — trang im lặng về điều nó
không chứng minh được, thay vì nói to về điều nó không có.

| Mã | Loại | Sản phẩm | Cần cho | Trạng thái |
| --- | --- | --- | --- | --- |
| CG-001 | chứng từ pháp lý | bio-active-cleanser, bio-deep-detox-rebalance, biovector-brightening-cream, collagen-peptide-cream, retinol-mixpeel-kit, smart-first-care-serum, smart-target-acne-gel, smart-whitening-turmergel, ultra-egf-bio-gel-mask, uv-block-sunscreen | trust · ad-readiness | thiếu ở 10/12 sản phẩm |
| CG-002 | xác nhận pháp lý | combo-nam, smart-brightening-cream | trust · compliance | cần chủ doanh nghiệp xác nhận |
| CG-003 | ảnh chứng từ | toàn site | trust · conversion | 0 tệp trong src/assets/documents |
| CG-004 | văn bản đồng ý | combo-nam (vi) | trust · conversion | consent.obtained = false → khối không render |
| CG-005 | văn bản đồng ý | combo-nam (vi) | trust · conversion | consent.obtained = false → khối không render |
| CG-006 | lệch bản dịch | combo-nam | trust | chỉ có ở vi: gallery, testimonials | chỉ có ở en: không |

## CG-001 — Số tiếp nhận Phiếu công bố sản phẩm mỹ phẩm của từng sản phẩm

- **Loại:** chứng từ pháp lý
- **Sản phẩm:** bio-active-cleanser, bio-deep-detox-rebalance, biovector-brightening-cream, collagen-peptide-cream, retinol-mixpeel-kit, smart-first-care-serum, smart-target-acne-gel, smart-whitening-turmergel, ultra-egf-bio-gel-mask, uv-block-sunscreen
- **Trường:** `compliance.productNotificationNumber`
- **Vì sao cần:** Đây là dữ kiện pháp lý người mua Việt Nam tra cứu được, và là bằng chứng mạnh nhất một trang mỹ phẩm đưa ra được mà không cần hứa gì. Thiếu nó, trang chỉ còn lời của người bán.
- **Định dạng:** Chuỗi đúng như in trên phiếu, ví dụ 1234/25/CBMP-XX
- **Đặt ở đâu:** compliance ở chân trang, llms.txt, và khối chứng từ khi có ảnh
- **Bắt buộc cho:** trust · ad-readiness
- **Trạng thái hiện tại:** thiếu ở 10/12 sản phẩm

## CG-002 — Xác nhận số 1517/25/CBMP-LA dùng chung cho 2 trang là đúng

- **Loại:** xác nhận pháp lý
- **Sản phẩm:** combo-nam, smart-brightening-cream
- **Trường:** `compliance.productNotificationNumber`
- **Vì sao cần:** Một bộ gồm nhiều sản phẩm mà chỉ dẫn số công bố của MỘT thành phần là công bố thiếu. Có thể đúng (nếu bộ được công bố dưới số đó) — nhưng phải do doanh nghiệp xác nhận, không phải do trang suy đoán.
- **Định dạng:** Xác nhận bằng văn bản, hoặc số công bố riêng cho từng thành phần
- **Đặt ở đâu:** compliance của từng sản phẩm trong bộ
- **Bắt buộc cho:** trust · compliance
- **Trạng thái hiện tại:** cần chủ doanh nghiệp xác nhận

## CG-003 — Ảnh chụp hoặc bản quét phiếu công bố / phiếu kiểm nghiệm / chứng nhận cơ sở sản xuất

- **Loại:** ảnh chứng từ
- **Sản phẩm:** toàn site
- **Trường:** `khối blocks[].type = "documents"`
- **Vì sao cần:** Khối "documents" đã có sẵn trong schema và đã có component, nhưng KHÔNG sản phẩm đã xuất bản nào dùng — nên tầng bằng chứng mạnh nhất của trang hiện không tồn tại trên màn hình.
- **Định dạng:** PDF hoặc ảnh gốc, đọc được số hiệu; cạnh dài ≥ 1600px; giữ đúng tỉ lệ giấy
- **Đặt ở đâu:** src/assets/documents/, khai trong khối documents ở vai trò proof
- **Bắt buộc cho:** trust · conversion
- **Trạng thái hiện tại:** 0 tệp trong src/assets/documents

## CG-004 — Văn bản đồng ý của khách cho việc đăng ảnh, kèm điều kiện chụp

- **Loại:** văn bản đồng ý
- **Sản phẩm:** combo-nam (vi)
- **Trường:** `blocks[].type = "gallery" → consent.obtained`
- **Vì sao cần:** Khối đang bị ẩn hoàn toàn khỏi trang vì chưa có đồng ý — đúng hành vi, nhưng nghĩa là trang không có bằng chứng xã hội nào. Không được thay bằng nội dung bịa.
- **Định dạng:** Bản ký (ảnh/PDF) + ghi rõ cùng đèn, cùng góc, cùng mức trang điểm
- **Đặt ở đâu:** combo-nam/vi.json, khối gallery
- **Bắt buộc cho:** trust · conversion
- **Trạng thái hiện tại:** consent.obtained = false → khối không render

## CG-005 — Văn bản đồng ý của khách cho việc đăng tên, tuổi, nơi ở kèm lời chứng

- **Loại:** văn bản đồng ý
- **Sản phẩm:** combo-nam (vi)
- **Trường:** `blocks[].type = "testimonials" → consent.obtained`
- **Vì sao cần:** Khối đang bị ẩn hoàn toàn khỏi trang vì chưa có đồng ý — đúng hành vi, nhưng nghĩa là trang không có bằng chứng xã hội nào. Không được thay bằng nội dung bịa.
- **Định dạng:** Bản ký (ảnh/PDF) cho từng người, nêu rõ phạm vi sử dụng
- **Đặt ở đâu:** combo-nam/vi.json, khối testimonials
- **Bắt buộc cho:** trust · conversion
- **Trạng thái hiện tại:** consent.obtained = false → khối không render

## CG-006 — Quyết định xem gallery, testimonials có nên tồn tại ở cả hai ngôn ngữ không

- **Loại:** lệch bản dịch
- **Sản phẩm:** combo-nam
- **Trường:** `blocks[]`
- **Vì sao cần:** Cùng một sản phẩm đang kể hai cấu trúc khác nhau ở hai ngôn ngữ. Hiện các khối lệch đều là khối chưa có đồng ý nên không render — nhưng ngày có đồng ý, một bản sẽ có bằng chứng còn bản kia thì không.
- **Định dạng:** Bản dịch của khối, hoặc xác nhận khối chỉ dành cho một thị trường
- **Đặt ở đâu:** combo-nam/en.json
- **Bắt buộc cho:** trust
- **Trạng thái hiện tại:** chỉ có ở vi: gallery, testimonials | chỉ có ở en: không

