/**
 * Phân tích chat — số liệu cho /admin/chats và xuất dữ liệu thô.
 *
 * Ba bảng (db/pg/0004_chat_admin_rules_analytics.sql, giải thích ở docs/chat-analytics.md):
 *   chat_messages  từng lượt (chữ, nguồn trả lời, kịch bản, thẻ đã hiện) — giữ retentionDays
 *   chat_sessions  một dòng mỗi cuộc, chỉ số đếm, KHÔNG có chữ — giữ sessionRetentionDays
 *   chat_events    mở khung, bấm thẻ, bấm đặt hàng, đơn đặt sau chat
 */
import type { Sql } from './db.ts';
import { timingSafeEqual } from '../../functions/_lib/orders.ts';

const since = (days: number) => [String(Math.max(1, Math.min(3650, Math.round(days))))];
const WINDOW = `now() - ($1 || ' days')::interval`;

export interface Kpis {
  sessions: number; visitors: number; userMessages: number; images: number;
  answeredRules: number; answeredN8n: number; unmatched: number; degraded: number;
  handoffs: number; productClicks: number; orderClicks: number; orders: number;
}

export async function chatAnalytics(sql: Sql, days = 30) {
  const p = since(days);
  const k = (await sql.query<any>(
    `SELECT count(*)::int AS sessions, count(DISTINCT visitor_id)::int AS visitors,
            coalesce(sum(user_messages), 0)::int AS "userMessages", coalesce(sum(images), 0)::int AS images,
            coalesce(sum(answered_rules), 0)::int AS "answeredRules", coalesce(sum(answered_n8n), 0)::int AS "answeredN8n",
            coalesce(sum(unmatched), 0)::int AS unmatched, coalesce(sum(degraded), 0)::int AS degraded,
            (count(*) FILTER (WHERE handoff))::int AS handoffs,
            coalesce(sum(product_clicks), 0)::int AS "productClicks", coalesce(sum(order_clicks), 0)::int AS "orderClicks",
            (count(*) FILTER (WHERE order_code IS NOT NULL))::int AS orders
       FROM chat_sessions WHERE last_at > ${WINDOW}`, p)).rows[0] as Kpis;

  const daily = (await sql.query<{ day: string; sessions: number; orders: number }>(
    `SELECT to_char((first_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date, 'YYYY-MM-DD') AS day, count(*)::int AS sessions,
            (count(*) FILTER (WHERE order_code IS NOT NULL))::int AS orders
       FROM chat_sessions WHERE first_at > ${WINDOW} GROUP BY 1 ORDER BY 1`, p)).rows;

  const sources = (await sql.query<{ source: string; n: number }>(
    `SELECT coalesce(source, 'khác') AS source, count(*)::int AS n FROM chat_messages
      WHERE role = 'bot' AND created_at > ${WINDOW} GROUP BY 1 ORDER BY n DESC`, p)).rows;

  const topRules = (await sql.query<{ id: number; name: string; topic: string; n: number }>(
    `SELECT r.id, r.name, r.topic, count(*)::int AS n FROM chat_messages m JOIN chat_rules r ON r.id = m.rule_id
      WHERE m.role = 'bot' AND m.created_at > ${WINDOW} GROUP BY r.id, r.name, r.topic ORDER BY n DESC LIMIT 12`, p)).rows;

  const shown = (await sql.query<{ slug: string; n: number }>(
    `SELECT slug, count(*)::int AS n FROM (SELECT unnest(products) AS slug FROM chat_messages
      WHERE role = 'bot' AND created_at > ${WINDOW}) x GROUP BY slug`, p)).rows;
  const clicks = (await sql.query<{ slug: string; type: string; n: number }>(
    `SELECT slug, type, count(*)::int AS n FROM chat_events
      WHERE slug IS NOT NULL AND type IN ('product_click', 'order_click') AND created_at > ${WINDOW} GROUP BY slug, type`, p)).rows;
  const products = new Map<string, { slug: string; shown: number; views: number; orders: number }>();
  const row = (slug: string) => products.get(slug) ?? products.set(slug, { slug, shown: 0, views: 0, orders: 0 }).get(slug)!;
  for (const s of shown) row(s.slug).shown += s.n;
  for (const c of clicks) row(c.slug)[c.type === 'order_click' ? 'orders' : 'views'] += c.n;

  /* Câu khách hỏi mà không kịch bản nào khớp (rơi vào câu dự phòng) hoặc n8n tự báo
     "matched": false — danh sách việc cần viết thêm kịch bản / dạy thêm n8n. */
  const unanswered = (await sql.query<{ text: string; n: number; last_at: string; locale: string; session_id: string }>(
    `SELECT min(u.text) AS text, count(*)::int AS n, max(b.created_at) AS last_at, min(u.locale) AS locale, max(b.session_id) AS session_id
       FROM chat_messages b JOIN chat_messages u ON u.message_id = b.message_id AND u.role = 'user'
      WHERE b.role = 'bot' AND b.matched = false AND u.text IS NOT NULL AND b.created_at > ${WINDOW}
      GROUP BY lower(u.text) ORDER BY n DESC, last_at DESC LIMIT 30`, p)).rows;

  return { days: Number(p[0]), kpis: k, daily, sources, topRules, products: [...products.values()].sort((a, b) => b.shown - a.shown).slice(0, 12), unanswered };
}

// ----------------------------------------------------------------- xuất dữ liệu
/**
 * GET /api/admin/chats?type=messages|sessions|events&from=YYYY-MM-DD&to=YYYY-MM-DD
 * Authorization: Bearer ADMIN_TOKEN. Trả NDJSON (một JSON mỗi dòng) — nạp thẳng vào
 * BigQuery, DuckDB (`read_json_auto`), pandas (`read_json(lines=True)`), hoặc n8n.
 */
const EXPORTS: Record<string, { table: string; time: string; cols: string }> = {
  messages: { table: 'chat_messages', time: 'created_at',
    cols: 'id, created_at, session_id, visitor_id, ip_hash, role, locale, page_path, message_id, source, rule_id, latency_ms, products, matched, text, payload' },
  sessions: { table: 'chat_sessions', time: 'last_at', cols: '*' },
  events: { table: 'chat_events', time: 'created_at', cols: '*' },
};
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export async function chatExportHandler(request: Request, sql: Sql, env: { ADMIN_TOKEN?: string }): Promise<Response> {
  const deny = (status: number, error: string) => new Response(JSON.stringify({ ok: false, error }), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
  if (request.method !== 'GET') return deny(405, 'method');
  /* Chưa đặt ADMIN_TOKEN thì KHOÁ HẲN — giống /api/admin/orders. */
  if (!env.ADMIN_TOKEN || env.ADMIN_TOKEN.length < 24) return deny(503, 'admin_token_not_configured');
  const h = request.headers.get('authorization') ?? '';
  if (!timingSafeEqual(h.startsWith('Bearer ') ? h.slice(7) : '', env.ADMIN_TOKEN)) return deny(401, 'unauthorized');
  const url = new URL(request.url);
  const spec = EXPORTS[url.searchParams.get('type') ?? 'messages'];
  if (!spec) return deny(400, 'bad_type');
  const from = url.searchParams.get('from'); const to = url.searchParams.get('to');
  if ((from && !DAY.test(from)) || (to && !DAY.test(to))) return deny(400, 'bad_date');
  const where: string[] = []; const params: string[] = [];
  if (from) { params.push(from); where.push(`${spec.time} >= $${params.length}::date`); }
  if (to) { params.push(to); where.push(`${spec.time} < ($${params.length}::date + 1)`); }
  const rows = (await sql.query<any>(
    `SELECT ${spec.cols} FROM ${spec.table} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY ${spec.time} LIMIT 200000`, params)).rows;
  return new Response(rows.map((r) => JSON.stringify(r)).join('\n') + (rows.length ? '\n' : ''), {
    headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store',
      'content-disposition': `attachment; filename="chat-${url.searchParams.get('type') ?? 'messages'}-${from ?? 'all'}.ndjson"` },
  });
}
