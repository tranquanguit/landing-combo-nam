/**
 * GET /api/recent-orders?l=vi — đơn THẬT gần đây cho thông báo nhỏ góc trên bên trái
 * (src/components/RecentOrders.astro). Không bịa đơn nào: không có đơn thì trả danh sách rỗng
 * và trang không hiện gì.
 *
 * Ẩn danh hoàn toàn: chỉ trả TÊN SẢN PHẨM và "bao lâu trước" (làm tròn 5 phút) — không tên,
 * số điện thoại, địa chỉ, mã đơn hay giờ chính xác của khách nào.
 *
 * Chỉ tính đơn mua có giá (bỏ yêu cầu tư vấn / "để lại số") và chưa huỷ, trong 7 ngày. Đơn thử
 * nghiệm phải được chuyển sang "Huỷ" trong trang quản trị để không lọt vào đây.
 */
import type { Sql } from './db.ts';

const DAYS = 7;
const LIMIT = 12;
const TTL_MS = 60_000;
let cache: { at: number; locale: string; body: string }[] = [];

export async function recentOrdersHandler(request: Request, sql: Sql): Promise<Response> {
  if (request.method !== 'GET') return new Response(null, { status: 405, headers: { allow: 'GET' } });
  const locale = new URL(request.url).searchParams.get('l') === 'en' ? 'en' : 'vi';
  const hit = cache.find((c) => c.locale === locale && Date.now() - c.at < TTL_MS);
  const body = hit?.body ?? await build(sql, locale);
  if (!hit) cache = [...cache.filter((c) => c.locale !== locale), { at: Date.now(), locale, body }];
  return new Response(body, { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=60' } });
}

async function build(sql: Sql, locale: string): Promise<string> {
  const since = new Date(Date.now() - DAYS * 86_400_000).toISOString();
  const rows = (await sql.query<{ product_slug: string; created_at: string }>(
    `SELECT product_slug, created_at FROM orders
      WHERE created_at > $1 AND status <> 'cancelled' AND pack_price > 0
      ORDER BY id DESC LIMIT ${LIMIT}`, [since])).rows;
  if (!rows.length) return '{"items":[]}';
  /* Tên hiển thị theo ngôn ngữ của trang; sản phẩm và combo cùng một bảng nội dung. */
  const names = new Map<string, string>();
  for (const r of (await sql.query<{ entry_id: string; name: string }>(
    `SELECT entry_id, COALESCE(data->>'shortName', data->>'name') AS name FROM content_entries
      WHERE collection IN ('products', 'combos') AND data->>'status' = 'published'`)).rows) {
    names.set(r.entry_id, r.name);
  }
  const now = Date.now();
  const items = rows.flatMap((r) => {
    const name = names.get(`${r.product_slug}/${locale}`) ?? names.get(`${r.product_slug}/vi`);
    const t = Date.parse(r.created_at);
    if (!name || !Number.isFinite(t)) return [];
    return [{ name, ago: Math.max(0, Math.floor((now - t) / 300_000) * 5) }];   // phút, làm tròn xuống 5
  });
  return JSON.stringify({ items });
}

/** Cho bộ thử: xoá bộ nhớ đệm 60 giây. */
export function resetRecentOrdersCache() { cache = []; }
