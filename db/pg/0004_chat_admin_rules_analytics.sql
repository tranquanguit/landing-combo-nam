-- Chat v2: cấu hình quản lý trên /admin, kịch bản tư vấn (rule), dữ liệu phân tích.
-- Mô hình dữ liệu + truy vấn mẫu: docs/chat-analytics.md

-- 1. Cấu hình ứng dụng (khoá -> JSON). Chat dùng khoá 'chat'.
--    Ưu tiên: giá trị ở đây > biến môi trường (biến môi trường chỉ là mặc định ban đầu).
CREATE TABLE IF NOT EXISTS app_settings (
  key         TEXT        PRIMARY KEY,
  value       JSONB       NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by  TEXT        NOT NULL
);

-- 2. Kịch bản tư vấn (rule-based). Phản hồi lưu ĐÚNG chuẩn docs/chat/response.schema.json,
--    nên một kịch bản và một phản hồi n8n đi qua cùng một bộ kiểm tra trước khi tới trang.
CREATE TABLE IF NOT EXISTS chat_rules (
  id               BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name             TEXT        NOT NULL,
  topic            TEXT        NOT NULL DEFAULT 'khac',
  enabled          BOOLEAN     NOT NULL DEFAULT true,
  priority         INTEGER     NOT NULL DEFAULT 50,          -- cao hơn thắng khi nhiều kịch bản cùng khớp
  locale           TEXT        NOT NULL DEFAULT 'vi' CHECK (locale IN ('vi', 'en', '*')),
  keywords         TEXT[]      NOT NULL DEFAULT '{}',        -- cụm từ; so khớp không dấu, theo ranh giới từ
  payloads         TEXT[]      NOT NULL DEFAULT '{}',        -- giá trị nút gợi ý (khớp tuyệt đối)
  path_prefix      TEXT,                                     -- chỉ áp ở trang bắt đầu bằng đường dẫn này
  requires_images  BOOLEAN     NOT NULL DEFAULT false,       -- chỉ khớp khi khách gửi ảnh
  is_fallback      BOOLEAN     NOT NULL DEFAULT false,       -- dùng khi không kịch bản nào khớp
  response         JSONB       NOT NULL,
  hits             INTEGER     NOT NULL DEFAULT 0,
  last_hit_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by       TEXT        NOT NULL DEFAULT 'seed'
);
CREATE INDEX IF NOT EXISTS idx_rules_active ON chat_rules (enabled, locale, priority DESC);

-- 3. Từng lượt: thêm cột phục vụ phân tích.
--    message_id: nối lượt khách với lượt bot trả lời nó
--    source:     rules | n8n | fallback (kịch bản thay n8n lỗi) | off | rate_limited | error
--    rule_id:    kịch bản đã trả lời (không khoá ngoại: xoá kịch bản không xoá lịch sử)
--    products:   slug các thẻ sản phẩm đã hiện
--    matched:    lượt bot — false = rơi vào câu dự phòng / n8n báo không hiểu
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS message_id TEXT;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS source     TEXT;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS rule_id    BIGINT;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS latency_ms INTEGER;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS products   TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS matched    BOOLEAN;
CREATE INDEX IF NOT EXISTS idx_chat_message_id ON chat_messages (message_id);
CREATE INDEX IF NOT EXISTS idx_chat_source ON chat_messages (source, created_at DESC);

-- 4. Phiên: một dòng mỗi cuộc trò chuyện, cập nhật theo từng lượt. KHÔNG chứa chữ
--    hội thoại, nên giữ lâu hơn bảng tin nhắn (CHAT_SESSION_RETENTION_DAYS, mặc định 400)
--    để so sánh theo mùa/chiến dịch sau khi chữ đã bị xoá.
CREATE TABLE IF NOT EXISTS chat_sessions (
  session_id       TEXT        PRIMARY KEY,
  visitor_id       TEXT        NOT NULL,
  locale           TEXT        NOT NULL,
  first_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  entry_path       TEXT,
  last_path        TEXT,
  utm_source       TEXT,
  utm_medium       TEXT,
  utm_campaign     TEXT,
  user_messages    INTEGER     NOT NULL DEFAULT 0,
  bot_messages     INTEGER     NOT NULL DEFAULT 0,
  images           INTEGER     NOT NULL DEFAULT 0,
  answered_rules   INTEGER     NOT NULL DEFAULT 0,
  answered_n8n     INTEGER     NOT NULL DEFAULT 0,
  unmatched        INTEGER     NOT NULL DEFAULT 0,   -- lượt rơi vào câu trả lời dự phòng
  degraded         INTEGER     NOT NULL DEFAULT 0,   -- n8n lỗi/chậm, chat tắt, gửi quá nhanh
  handoff          BOOLEAN     NOT NULL DEFAULT false,
  product_clicks   INTEGER     NOT NULL DEFAULT 0,
  order_clicks     INTEGER     NOT NULL DEFAULT 0,
  order_code       TEXT                               -- đơn đặt sau khi chat (cùng visitorId, ≤ 7 ngày)
);
CREATE INDEX IF NOT EXISTS idx_sessions_last ON chat_sessions (last_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_visitor ON chat_sessions (visitor_id, last_at DESC);

-- 5. Sự kiện trong khung chat + chuyển đổi.
CREATE TABLE IF NOT EXISTS chat_events (
  id          BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id  TEXT,
  visitor_id  TEXT        NOT NULL,
  type        TEXT        NOT NULL CHECK (type IN ('open', 'product_click', 'order_click', 'link_click', 'order_placed')),
  slug        TEXT,
  value       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_events_type ON chat_events (type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_session ON chat_events (session_id);
