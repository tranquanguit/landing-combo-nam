# Mocha — website + máy chủ nhập liệu, chạy trên Ubuntu bằng Docker.
#
# Image chứa TOÀN BỘ mã nguồn + node_modules (không chỉ dist/), vì nút "Xuất bản"
# trong trang quản trị build lại site ngay trong container từ nội dung Postgres.
# Build một lần ở đây để container khởi động là có trang phục vụ ngay.
FROM node:24-bookworm-slim

ENV NODE_ENV=production \
    PORT=8080 \
    TRUST_PROXY=1 \
    ASTRO_TELEMETRY_DISABLED=1

WORKDIR /app

# Cài phụ thuộc trước để tận dụng cache layer. --omit=dev: không cần Playwright,
# astro check, PGlite trên máy chủ (PGlite chỉ dùng cho bộ thử).
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY . .

# Tên miền thật của site (canonical, sitemap, og:image). Biểu mẫu đặt hàng gửi về
# /api/orders của chính container này nên không cần nới CSP connect-src.
ARG PUBLIC_SITE_URL=https://mochatrinam.com
ENV PUBLIC_SITE_URL=${PUBLIC_SITE_URL} \
    PUBLIC_ORDER_ENDPOINT=/api/orders
RUN node node_modules/astro/bin/astro.mjs build \
 && node scripts/check-budget.mjs \
 && chown -R node:node /app

USER node
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "--import", "./scripts/shim/register.mjs", "server/main.ts"]
