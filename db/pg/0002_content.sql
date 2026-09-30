-- Nhập liệu nội dung — PostgreSQL.
--
-- Postgres là NƠI NHẬP LIỆU; file JSON trong src/content/ là ĐẦU VÀO CỦA BUILD.
-- "Xuất bản" = ghi nội dung từ đây ra file rồi chạy astro build. Nhờ vậy mọi
-- hàng rào của schema (giá khớp chữ, tuyên bố phải có nguồn, đồng ý ảnh khách,
-- số công bố…) vẫn chặn ở đúng một chỗ, và một lần xuất bản hỏng không bao giờ
-- thay thế bản đang chạy.

-- Một dòng = một file nội dung. entry_id là đường dẫn tương đối trong thư mục
-- của collection, không có đuôi .json: "combo-nam/vi", "mocha", "coa-uv-2025".
CREATE TABLE IF NOT EXISTS content_entries (
  collection   TEXT        NOT NULL,
  entry_id     TEXT        NOT NULL,
  data         JSONB       NOT NULL,
  -- Văn bản JSON đúng như người biên tập lưu (giữ thứ tự khoá — JSONB không giữ),
  -- để xuất ra file không làm xáo trộn diff trong git.
  source       TEXT        NOT NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by   TEXT        NOT NULL DEFAULT 'import',
  PRIMARY KEY (collection, entry_id)
);

-- Mọi lần lưu đều để lại một bản: sửa sai thì khôi phục được, và biết ai sửa gì.
CREATE TABLE IF NOT EXISTS content_revisions (
  id           INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  collection   TEXT        NOT NULL,
  entry_id     TEXT        NOT NULL,
  source       TEXT,                       -- NULL = lần này là XOÁ
  saved_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  saved_by     TEXT        NOT NULL,
  note         TEXT
);
CREATE INDEX IF NOT EXISTS idx_rev_entry ON content_revisions (collection, entry_id, id DESC);

-- Ảnh nằm TRONG CSDL (bytea), không nằm rời trên đĩa: một lần pg_dump là sao
-- lưu đủ cả chữ lẫn ảnh. path là đường dẫn nội dung dùng trong JSON, ví dụ
-- "/images/packshot-uv-block.webp" -> src/assets/images/packshot-uv-block.webp.
CREATE TABLE IF NOT EXISTS media (
  path         TEXT        PRIMARY KEY CHECK (path ~ '^/(images|documents)/[a-z0-9][a-z0-9._-]*\.(webp|jpg|jpeg|png|avif)$'),
  bytes        BYTEA       NOT NULL,
  sha256       TEXT        NOT NULL,
  mime         TEXT        NOT NULL,
  width        INTEGER,
  height       INTEGER,
  uploaded_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  uploaded_by  TEXT        NOT NULL DEFAULT 'import'
);

-- Tài khoản quản trị. Mật khẩu băm scrypt (node:crypto), không bao giờ lưu thô.
CREATE TABLE IF NOT EXISTS admin_users (
  username     TEXT        PRIMARY KEY CHECK (username ~ '^[a-z0-9._-]{3,32}$'),
  password     TEXT        NOT NULL,       -- "scrypt$N$r$p$salt$hash"
  role         TEXT        NOT NULL DEFAULT 'editor' CHECK (role IN ('editor','admin')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Phiên đăng nhập: chỉ lưu SHA-256 của mã phiên; cookie mới giữ mã thật.
CREATE TABLE IF NOT EXISTS admin_sessions (
  token_hash   TEXT        PRIMARY KEY,
  username     TEXT        NOT NULL REFERENCES admin_users(username) ON DELETE CASCADE,
  expires_at   TIMESTAMPTZ NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS publish_runs (
  id           INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at  TIMESTAMPTZ,
  started_by   TEXT        NOT NULL,
  ok           BOOLEAN,
  log          TEXT
);
