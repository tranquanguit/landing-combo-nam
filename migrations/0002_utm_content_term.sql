-- Bổ sung hai tham số nguồn còn thiếu.
--
-- Bảng gốc có utm_source/medium/campaign nhưng không có content và term, nên
-- không phân biệt được hai mẩu quảng cáo trong CÙNG một chiến dịch — tức là
-- không trả lời được câu hỏi duy nhất mà việc chạy nhiều biến thể đặt ra.
--
-- Vẫn KHÔNG phải dữ liệu cá nhân: đây là nhãn của chiến dịch, không phải của
-- người. Vì vậy chúng được đọc từ URL lúc gửi đơn, không từ cookie theo dõi.

ALTER TABLE orders ADD COLUMN utm_content TEXT;
ALTER TABLE orders ADD COLUMN utm_term    TEXT;
