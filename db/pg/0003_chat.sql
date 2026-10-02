-- Hội thoại chat (POST /api/chat <-> n8n).
--
-- Lưu CHỮ của từng lượt để nhân viên xem lại ở /admin/chats. KHÔNG lưu ảnh khách
-- gửi (ảnh vùng da là dữ liệu cá nhân nhạy cảm) — chỉ lưu số ảnh. Tự xoá sau
-- CHAT_RETENTION_DAYS ngày (mặc định 90). Không lưu IP thô: ip_hash là SHA-256
-- có muối, cắt 16 ký tự.

CREATE TABLE IF NOT EXISTS chat_messages (
  id          BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id  TEXT        NOT NULL,
  visitor_id  TEXT        NOT NULL,
  ip_hash     TEXT,
  role        TEXT        NOT NULL CHECK (role IN ('user', 'bot')),
  text        TEXT,
  payload     JSONB       NOT NULL DEFAULT '{}'::jsonb,
  locale      TEXT        NOT NULL DEFAULT 'vi',
  page_path   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chat_session ON chat_messages (session_id, id);
CREATE INDEX IF NOT EXISTS idx_chat_visitor ON chat_messages (visitor_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_chat_created ON chat_messages (created_at DESC);
