/**
 * Nơi biểu mẫu đặt hàng gửi đơn tới.
 *
 * Mặc định là `/api/orders` CÙNG TÊN MIỀN: cả hai nơi triển khai đều phục vụ
 * đường dẫn này — máy chủ Docker (server/app.ts, ghi vào Postgres) và Cloudflare
 * Pages (functions/api/orders.ts, ghi vào D1). Cùng miền nên không phải nới CSP.
 *
 * Không có nơi nhận đơn (form ẩn, chỉ hiện hotline) trong hai trường hợp:
 *  - khai rõ `PUBLIC_ORDER_ENDPOINT=` (chuỗi rỗng) — tắt có chủ ý;
 *  - bản xem thử ở đường dẫn con (`PUBLIC_BASE_PATH`, GitHub Pages): trang tĩnh
 *    thuần, không có máy chủ nào nhận đơn.
 */
export function orderEndpoint(): string | null {
  const v = import.meta.env.PUBLIC_ORDER_ENDPOINT;
  if (v !== undefined) return v || null;
  if (import.meta.env.PUBLIC_BASE_PATH) return null;
  return '/api/orders';
}

/**
 * Endpoint chat (server/lib/chat.ts). Cùng quy tắc với đơn hàng: mặc định
 * `/api/chat` cùng miền; tắt khi khai `PUBLIC_CHAT_ENDPOINT=` hoặc ở bản xem thử
 * đường dẫn con (không có máy chủ). Tắt thì bong bóng chat không render.
 */
export function chatEndpoint(): string | null {
  const v = import.meta.env.PUBLIC_CHAT_ENDPOINT;
  if (v !== undefined) return v || null;
  if (import.meta.env.PUBLIC_BASE_PATH) return null;
  return '/api/chat';
}
