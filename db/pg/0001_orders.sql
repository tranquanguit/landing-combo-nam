-- Đơn hàng — PostgreSQL (triển khai Docker trên Ubuntu).
--
-- Cùng lược đồ và cùng nguyên tắc với migrations/0001_orders.sql (bản D1): lưu
-- ĐÚNG những gì cần để gọi lại cho khách và giao được hàng. Nghị định 13/2023
-- yêu cầu thu thập đúng mục đích đã báo — mỗi cột phục vụ "nhận và giao đơn".
-- Không lưu IP thô, User-Agent, cookie quảng cáo.
--
-- Thời gian lưu dạng TEXT ISO 8601 UTC như bản D1, để handler dùng chung không
-- phải biết mình đang chạy trên CSDL nào (so sánh chuỗi ISO = so sánh thời gian).

CREATE TABLE IF NOT EXISTS orders (
  id             INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_code     TEXT    NOT NULL UNIQUE,
  created_at     TEXT    NOT NULL,

  product_slug   TEXT    NOT NULL,
  locale         TEXT    NOT NULL,
  pack           TEXT    NOT NULL,
  pack_price     INTEGER,
  currency       TEXT    NOT NULL DEFAULT 'VND',

  name           TEXT    NOT NULL,
  phone          TEXT    NOT NULL,
  address        TEXT,
  country        TEXT,
  note           TEXT,

  -- Bằng chứng đồng ý: CSDL tự từ chối đơn không có đồng ý.
  data_consent   INTEGER NOT NULL CHECK (data_consent = 1),
  consent_text   TEXT    NOT NULL,

  utm_source     TEXT,
  utm_medium     TEXT,
  utm_campaign   TEXT,
  utm_content    TEXT,
  utm_term       TEXT,
  referrer_host  TEXT,

  status         TEXT    NOT NULL DEFAULT 'new'
                 CHECK (status IN ('new','contacted','confirmed','shipped','done','cancelled')),
  staff_note     TEXT,
  updated_at     TEXT
);

CREATE INDEX IF NOT EXISTS idx_orders_created ON orders (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status  ON orders (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_phone   ON orders (phone);

-- Chống bấm hai lần và spam: chỉ giữ IP đã băm + muối, cắt 16 ký tự.
CREATE TABLE IF NOT EXISTS rate_limit (
  key        TEXT PRIMARY KEY,
  count      INTEGER NOT NULL DEFAULT 1,
  window_at  TEXT    NOT NULL
);
