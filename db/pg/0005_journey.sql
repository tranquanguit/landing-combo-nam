-- Hành trình của khách trên website (POST /api/j), xem ở /admin/journey.
--
-- CHỈ ghi khi khách đã bấm "Đồng ý" ở thanh đo lường (Nghị định 13/2023/NĐ-CP). Không lưu IP,
-- tên, số điện thoại hay nội dung khách gõ: chỉ đường dẫn trang, mã nút (data-cta), mã khối
-- nội dung, thời lượng, nguồn quảng cáo (utm) và loại thiết bị. visitor_id / session_id là
-- chuỗi ngẫu nhiên do trình duyệt sinh ra, không suy ra được người thật. Tự xoá sau
-- JOURNEY_RETENTION_DAYS ngày (mặc định 90).

CREATE TABLE IF NOT EXISTS journey_sessions (
  session_id     TEXT        PRIMARY KEY,
  visitor_id     TEXT        NOT NULL,
  started_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  locale         TEXT,
  device         TEXT        CHECK (device IN ('mobile', 'tablet', 'desktop')),
  landing_path   TEXT,
  referrer_host  TEXT,
  utm_source     TEXT,
  utm_medium     TEXT,
  utm_campaign   TEXT,
  ad_click       TEXT,                       -- 'google' | 'facebook' | 'tiktok' khi URL có gclid/fbclid/ttclid
  page_views     INTEGER     NOT NULL DEFAULT 0,
  events         INTEGER     NOT NULL DEFAULT 0,
  active_ms      BIGINT      NOT NULL DEFAULT 0,
  order_code     TEXT,
  is_returning   BOOLEAN     NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS idx_journey_sessions_started ON journey_sessions (started_at DESC);
CREATE INDEX IF NOT EXISTS idx_journey_sessions_visitor ON journey_sessions (visitor_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_journey_sessions_order ON journey_sessions (order_code);

CREATE TABLE IF NOT EXISTS journey_events (
  id           BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id   TEXT        NOT NULL,
  at           TIMESTAMPTZ NOT NULL,
  type         TEXT        NOT NULL CHECK (type IN ('page', 'leave', 'section', 'click', 'faq', 'form_start', 'order', 'thanks', 'chat')),
  path         TEXT,
  target       TEXT,
  label        TEXT,
  duration_ms  INTEGER
);
CREATE INDEX IF NOT EXISTS idx_journey_events_session ON journey_events (session_id, at, id);
CREATE INDEX IF NOT EXISTS idx_journey_events_at ON journey_events (at DESC);
