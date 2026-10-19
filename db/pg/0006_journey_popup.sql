-- Hành trình khách: thêm loại sự kiện 'popup' — popup khuyến mãi, lời mời chat, biểu mẫu
-- "để lại số" khi khách sắp rời, thông báo đơn gần đây (target dạng "promo:show", "exit:submit"…).
ALTER TABLE journey_events DROP CONSTRAINT IF EXISTS journey_events_type_check;
ALTER TABLE journey_events ADD CONSTRAINT journey_events_type_check
  CHECK (type IN ('page', 'leave', 'section', 'click', 'faq', 'form_start', 'order', 'thanks', 'chat', 'popup'));
