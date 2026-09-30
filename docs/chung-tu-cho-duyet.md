# Giấy tờ: đã đăng, chờ đối chiếu, chờ quyết định

Nguồn: Google Drive "ĐẠI LÝ x MOCHA" (chia sẻ cho hệ thống đại lý), tải ngày
2026-09-30 vào `Documents/ads/mocha-drive/raw/giay-to/` (ngoài repo).

## 1. Đã đăng — số hiệu đọc từ CHỮ VIẾT TAY, cần đối chiếu bản gốc

Lớp chữ trong PDF là OCR hỏng, nên số tiếp nhận và ngày cấp được **đọc bằng mắt** trên
bản scan. Trước khi chạy quảng cáo, đối chiếu từng dòng với bản gốc (hoặc tra cứu tại
Sở Y tế cấp):

| Sản phẩm | Số tiếp nhận | Ngày cấp | Cơ quan | File trên Drive |
|---|---|---|---|---|
| Smart Brightening Cream (+ Combo Nám) | 1517/25/CBMP-LA | 29/05/2025 | Sở Y tế tỉnh Long An | `2025.PCB - SMART BRIGHTENING CREAM.pdf` |
| Smart Whitening Turmergel | 2626/25/CBMP-TN | 23/12/2025 | Sở Y tế tỉnh Tây Ninh | `CN MỚI.PCB - SMART WHITENING.12.2025.pdf` |
| Smart Target | 2522/25/CBMP-TN | 12/12/2025 | Sở Y tế tỉnh Tây Ninh | `CN MỚI.PCB - SMART TARGET.12.2025.pdf` |
| Ultra EGF Bio-Gel Mask | 2524/25/CBMP-TN | 12/12/2025 | Sở Y tế tỉnh Tây Ninh | `CN MỚI.PCB - ULTRA EGF BIO - GEL MASK.12.2025.pdf` |
| Bio-Deep Detox & Rebalance | 2410/25/CBMP-TN | 02/12/2025 | Sở Y tế tỉnh Tây Ninh | `CN MỚI.PCB - BIO-DEEP DETOX & REBALANCE.pdf` |
| Bio-Active Cleanser | 800/25/CBMP-TN | 20/08/2025 | Sở Y tế tỉnh Tây Ninh | `CN MỚI.PCB BIO - ACTIVE CLEANSER(1).pdf` |
| Biovector Brightening Cream | 1518/25/CBMP-LA | 29/05/2025 | Sở Y tế tỉnh Long An | `2025.PCB - BIOVECTOR BRIGHTENING CREAM.pdf` |
| Collagen Peptide Cream (+ kit Retinol) | 1409/25/CBMP-LA | 23/05/2025 | Sở Y tế tỉnh Long An | `2025 PCB - COLLAGEN PEPTIDE CREAM.pdf` |
| UV-Block Plus | 353/25/CBMP-TN | 30/07/2025 | Sở Y tế tỉnh Tây Ninh | `2025-PCB-UV-BLOCK PLUS.MOI.pdf` |
| A Perfect Skin Peel (kit Retinol) | 2521/25/CBMP-TN | 12/12/2025 | Sở Y tế tỉnh Tây Ninh | `PCB 12.2025.CN MỚI - A PERFECT SKIN PEEL.pdf` |
| Pro Vitamin B5 Perfection Serum (kit Retinol) | 0718/25/CBMP-LA | 31/03/2025 | Sở Y tế tỉnh Long An | `MỚI 2025PCB - PRO VITAMIN B5 PERFECTION SERRUM.pdf` |

Cũng đã đăng: **Phiếu kết quả thử nghiệm IRDOP** (VILAS 997) cho UV-Block Plus — SPF 50+,
PA ++++, ref. PPTx2443180702-550GD7, ngày 15/01/2025 (in máy, không phải chữ viết tay).
Phiếu không ghi số lô.

Chỉ đăng **trang 1** của mỗi phiếu công bố; chữ ký và tên người ký đã được làm mờ.

## 2. Số công bố điền vào trang sản phẩm mà KHÔNG có bản scan phiếu

| Sản phẩm | Số | Nguồn |
|---|---|---|
| Smart First Care Serum | 1458/24/CBMP-LA | In máy trên *Giấy xác nhận nội dung quảng cáo* của Sở Y tế TP.HCM (05/2025). Chưa tìm thấy phiếu công bố của serum trên Drive; có thể đã có số mới sau sáp nhập tỉnh. |

## 3. Chờ quyết định — CHƯA đăng

| Giấy | Vì sao chưa đăng | Cần gì |
|---|---|---|
| Phiếu công bố Smart Brightening Cream **567/26/CBMP-TN** (11/02/2026) | Mới hơn số đang khai trên trang (1517/25/CBMP-LA). Số nào đang áp dụng cho hàng đang bán là quyết định của Mocha. | Mocha xác nhận → đổi `compliance.productNotificationNumber` + đổi `status` của giấy `pcb-smart-brightening-cream-567-26` sang `published` (ảnh đã che nằm ở `src/media-gated/documents/`, chuyển sang `src/assets/documents/`). |
| 11 phiếu kiểm nghiệm **TÜV SÜD Việt Nam** (kim loại nặng, vi sinh — theo lô) | Điều 4 trang cuối mỗi phiếu: *"Báo cáo này sẽ không được sao chép toàn bộ hoặc từng phần và Khách hàng sẽ không tham chiếu đến Công ty TNHH TÜV SÜD Việt Nam hoặc báo cáo… trong bất kỳ quảng cáo hoặc khuyến mại nào."* | Văn bản chấp thuận của TÜV SÜD cho việc đăng trên website bán hàng. Khi có: ảnh cần che thêm tên người liên hệ của Mocha in trên phiếu và chữ ký hai người duyệt. Lưu ý phiếu UV-Block Plus lô 010925 ghi **Chì (Pb): 0,44 mg/kg** — phát hiện, không phải "không phát hiện". |
| 2 báo cáo thử kích ứng **Ellead** (Hàn Quốc) — Smart Brightening Cream, Smart Target: 34 tình nguyện viên, mức "Negligible" | Mỗi trang ghi *"property of Ellead Co., Ltd. It cannot be misused and/or photocopied"*. | Chấp thuận của Ellead. |
| **Giấy xác nhận nội dung quảng cáo** (Sở Y tế TP.HCM, 05/2025) — serum + kem nám | Giấy duyệt ĐÚNG nội dung đính kèm (trang 2–12). Đặt cạnh nội dung website khác bản đã duyệt là ngầm nói trang đã được duyệt. Số giấy viết tay chưa đọc chắc. | Mocha đối chiếu nội dung quảng cáo đang dùng với bản đã duyệt. |
| Bằng sáng chế hoạt chất (Sabiwhite US10864154, Aquaxyl US8288353, Corum Epi-On EP2295403, LABIO B9-Vitapol, attestation Solabia) | Là bằng của **nhà cung cấp nguyên liệu**, không phải của Mocha; nêu công dụng theo lời văn của bằng sáng chế dễ thành tuyên bố công dụng chưa được phép. | Quyết định có dùng hay không; nếu dùng, nhãn "Bằng sáng chế của nhà cung cấp hoạt chất". |

## 4. Không tải về

Video (114GB), ảnh **bác sĩ** (Nghị định 342/2025 cấm), ảnh **người nổi tiếng / KOC /
UGC / feedback khách** (cần văn bản đồng ý cho chính website này).
