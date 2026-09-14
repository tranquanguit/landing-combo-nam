-- Cơ sở dữ liệu đơn hàng — Cloudflare D1 (SQLite).
--
-- Nguyên tắc: lưu ĐÚNG những gì cần để gọi lại cho khách và giao được hàng,
-- không lưu thêm. Nghị định 13/2023/NĐ-CP yêu cầu dữ liệu cá nhân phải thu thập
-- đúng mục đích đã báo; mỗi cột dưới đây đều phục vụ đúng mục đích "nhận và
-- giao đơn hàng" đã ghi trên biểu mẫu.
--
-- KHÔNG lưu: địa chỉ IP thô, User-Agent, cookie quảng cáo, mã khách hàng của
-- bên thứ ba. Rate limit dùng IP đã băm và tự hết hạn (bảng riêng bên dưới).

CREATE TABLE IF NOT EXISTS orders (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  -- Mã đơn đọc được qua điện thoại: MC-260914-A7K3
  order_code     TEXT    NOT NULL UNIQUE,
  created_at     TEXT    NOT NULL,              -- ISO 8601 UTC

  -- Đơn đặt gì
  product_slug   TEXT    NOT NULL,              -- khớp src/content/products/<slug>
  locale         TEXT    NOT NULL,              -- vi | en | th | id
  pack           TEXT    NOT NULL,              -- id gói khách chọn
  pack_price     INTEGER,                       -- VND tại thời điểm đặt; NULL = gói tư vấn
  currency       TEXT    NOT NULL DEFAULT 'VND',

  -- Khách là ai (dữ liệu cá nhân)
  name           TEXT    NOT NULL,
  phone          TEXT    NOT NULL,              -- đã chuẩn hoá 0xxxxxxxxx
  address        TEXT,                          -- NULL với gói chỉ tư vấn
  country        TEXT,
  note           TEXT,

  -- Bằng chứng đồng ý — NĐ 13/2023 đòi chứng minh được, không chỉ đòi có
  data_consent   INTEGER NOT NULL CHECK (data_consent = 1),
  consent_text   TEXT    NOT NULL,              -- đúng câu khách đã đọc lúc bấm

  -- Nguồn, để biết quảng cáo nào ra đơn. Không phải dữ liệu cá nhân.
  utm_source     TEXT,
  utm_medium     TEXT,
  utm_campaign   TEXT,
  referrer_host  TEXT,                          -- chỉ tên miền, không lưu URL đầy đủ

  -- Vận hành
  status         TEXT    NOT NULL DEFAULT 'new'
                 CHECK (status IN ('new','contacted','confirmed','shipped','done','cancelled')),
  staff_note     TEXT,
  updated_at     TEXT
);

CREATE INDEX IF NOT EXISTS idx_orders_created ON orders (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status  ON orders (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_phone   ON orders (phone);

-- Chống bấm hai lần và chống spam. Chỉ giữ IP đã băm (SHA-256 + muối), cắt còn
-- 16 ký tự — đủ để đếm, không đủ để truy ngược ra một người.
CREATE TABLE IF NOT EXISTS rate_limit (
  key        TEXT PRIMARY KEY,
  count      INTEGER NOT NULL DEFAULT 1,
  window_at  TEXT    NOT NULL
);
