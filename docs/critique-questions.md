# Bộ câu hỏi phản biện cố định (chạy lại mỗi vòng, tối thiểu 5 vòng)

Mỗi vòng: đọc lại toàn bộ sản phẩm hiện tại, trả lời **bằng bằng chứng đo được**
(số đo Lighthouse, đoạn code, kết quả kiểm thử), không trả lời bằng ý kiến.
Câu nào không chứng minh được → coi là **CHƯA ĐẠT** và phải tạo việc sửa.

## A. Tốc độ & kỹ thuật hiển thị
1. LCP trên 4G giả lập ở mobile là bao nhiêu ms? Phần tử LCP là gì, có được ưu tiên tải không?
2. INP p75 khi người dùng bấm CTA, mở FAQ, chọn gói hàng là bao nhiêu? Có tác vụ dài >50ms nào không?
3. CLS bằng bao nhiêu? Mọi ảnh/video/iframe/font đã có kích thước cố định trước khi tải chưa?
4. Tổng byte JS thực thi trên trang là bao nhiêu? Có thể bỏ bớt phần nào mà không mất chức năng?
5. Trang còn đọc được và đặt hàng được khi tắt JavaScript hoàn toàn không?
6. Ảnh đã đúng định dạng (AVIF/WebP), đúng kích thước responsive, đúng `sizes` chưa? Lãng phí bao nhiêu byte?
7. Font chữ có gây FOIT/FOUT không? Có subset tiếng Việt chưa? Bao nhiêu KB?
8. Trang hoạt động thế nào trên máy Android tầm thấp và mạng 3G ở tỉnh?

## B. Tìm kiếm truyền thống
9. Trang này nhắm đúng intent nào? Truy vấn nào nó thực sự có cơ hội xếp hạng, truy vấn nào là ảo tưởng?
10. Nội dung có trả lời trọn vẹn câu hỏi của người tìm kiếm mà không cần rời trang không?
11. E-E-A-T thể hiện ở đâu? Ai là tác giả/người thẩm định chuyên môn, có chứng minh được không?
12. Structured data có khai đúng sự thật không? Có mục nào rủi ro bị phạt rich result không?
13. Kiến trúc URL, internal link, breadcrumb có mở rộng được cho 20+ sản phẩm không?
14. Hreflang, canonical, sitemap cho VN/EN/SEA có đúng chuẩn không? Có bẫy trùng lặp nội dung không?

## C. AI search / GEO — được AI trích dẫn
15. Nếu người dùng hỏi trợ lý AI "kem trị nám nào tốt cho da nhạy cảm", trang này cung cấp **dữ kiện gì** để được trích?
16. Mỗi đoạn nội dung có tự đứng độc lập khi bị cắt ra khỏi ngữ cảnh không?
17. Dữ kiện có đi kèm con số, đơn vị, điều kiện, nguồn — thứ AI cần để trích dẫn an toàn không?
18. Nội dung có mâu thuẫn nội bộ hoặc mâu thuẫn với dữ liệu bên ngoài (sàn TMĐT, fanpage) không?
19. Có gì khiến một mô hình AI **từ chối** giới thiệu sản phẩm này (tuyên bố y tế quá đà, thiếu minh bạch) không?
20. Máy có đọc được thực thể thương hiệu, sản phẩm, biến thể, giá, tồn kho một cách rõ ràng không?

## D. Chuyển đổi & tâm lý người mua
21. Trong 3 giây đầu, người dùng có trả lời được "cái này là gì, cho ai, giá bao nhiêu, tin được không"?
22. Phản đối lớn nhất của người mua nám là gì, trang xử lý ở đâu, có đúng thứ tự trong hành trình không?
23. Bằng chứng nào là thật và kiểm chứng được, bằng chứng nào chỉ là tuyên bố suông?
24. Các thủ thuật khan hiếm (đếm ngược, "còn 8 suất") có trung thực không? Nếu khách quay lại ngày mai thì sao?
25. Form đặt hàng có ma sát thừa nào? Bỏ trường nào thì tăng tỉ lệ điền mà không mất dữ liệu cần?

## E. Pháp lý & rủi ro quảng cáo
26. Có tuyên bố nào biến mỹ phẩm thành thuốc chữa bệnh không (vi phạm quy định VN và chính sách ads)?
27. Ảnh trước–sau, testimonial có consent và có disclaimer đúng mức không?
28. Nội dung có vượt phạm vi công bố mỹ phẩm đã đăng ký không?
29. Bản EN/SEA có vi phạm quy định quảng cáo mỹ phẩm của thị trường đó không?

## F. Nền tảng đa sản phẩm
30. Thêm một sản phẩm Mocha mới tốn bao nhiêu thao tác? Có phải sửa code không?
31. Phần nào đang lặp lại giữa các landing mà lẽ ra phải là component/dữ liệu dùng chung?
32. Người không biết code có tự sửa nội dung, giá, quà tặng được không?
