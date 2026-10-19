/**
 * Hành trình khách trên website: trang nào, nút nào, dừng ở khối nào bao lâu, đến từ đâu.
 *
 * Trình duyệt chỉ gửi khi khách ĐÃ đồng ý đo lường (src/components/Analytics.astro). Máy chủ
 * không lưu IP (chỉ dùng chuỗi băm có muối để giới hạn tần suất, không ghi vào bảng), không
 * nhận chữ khách gõ. Mọi trường đều đi qua kiểm tra hình dạng: thứ gì không khớp thì bỏ, không
 * cố "sửa" — bảng này là số liệu thống kê, thiếu một sự kiện tốt hơn ghi một sự kiện rác.
 */
import type { Sql } from './db.ts';
import { limited } from './rate-limit.ts';
import { hashIp } from './chat.ts';

export const JS_COOKIE = 'mocha_js';                 // mã phiên hành trình: máy chủ gắn đơn hàng vào phiên
const ID = /^j_[A-Za-z0-9_-]{22}$/;
const TYPES = new Set(['page', 'leave', 'section', 'click', 'faq', 'form_start', 'order', 'thanks', 'chat', 'popup']);
const PATH = /^\/[A-Za-z0-9_\-./%]{0,200}$/;
const TARGET = /^[A-Za-z0-9_\-:.#/]{1,80}$/;
const BOT = /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|facebookexternalhit|bingpreview|python|curl|wget/i;
const WINDOW = 10 * 60 * 1000;
const MAX_BODY = 32 * 1024;
const MAX_EVENTS = 60;

export interface JourneyEnv { IP_SALT?: string; ALLOWED_ORIGIN?: string }

const clean = (s: unknown, max: number) =>
  typeof s === 'string' ? s.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '';
const host = (s: unknown) => {
  const v = clean(s, 120).toLowerCase();
  return /^[a-z0-9.-]{3,120}$/.test(v) ? v : null;
};
const utm = (s: unknown) => {
  const v = clean(s, 80);
  return /^[\p{L}\p{N} _.\-+:/|]{1,80}$/u.test(v) ? v : null;
};
const device = (w: unknown) => {
  const n = Number(w);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n < 768 ? 'mobile' : n < 1024 ? 'tablet' : 'desktop';
};

const none = () => new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });

/** POST /api/j — một lô sự kiện của MỘT phiên. Luôn trả 204: trình duyệt gửi bằng sendBeacon, không đọc phản hồi. */
export async function journeyHandler(request: Request, sql: Sql, env: JourneyEnv): Promise<Response> {
  if (request.method !== 'POST') return new Response(null, { status: 405, headers: { allow: 'POST' } });
  const origin = request.headers.get('origin');  if (env.ALLOWED_ORIGIN && origin && origin !== env.ALLOWED_ORIGIN) return none();
  if (BOT.test(request.headers.get('user-agent') ?? '')) return none();
  const ip = request.headers.get('cf-connecting-ip');
  if (ip && env.IP_SALT && await limited(sql, `j:ip:${hashIp(ip, env.IP_SALT)}`, 900, WINDOW)) return none();

  const raw = await request.text();
  if (raw.length > MAX_BODY) return none();
  let b: any; try { b = JSON.parse(raw); } catch { return none(); }
  if (!ID.test(String(b?.v ?? '')) || !ID.test(String(b?.s ?? '')) || !Array.isArray(b?.e)) return none();
  if (await limited(sql, `j:s:${b.s}`, 400, WINDOW)) return none();

  const now = Date.now();
  const events = (b.e as any[]).slice(0, MAX_EVENTS).flatMap((e) => {
    if (!e || !TYPES.has(e.t)) return [];
    const path = typeof e.p === 'string' && PATH.test(e.p) ? e.p : null;
    if (!path) return [];
    /* Đồng hồ máy khách có thể lệch; lệch quá một ngày thì dùng giờ máy chủ. */
    const a = Number(e.a);
    const at = Number.isFinite(a) && Math.abs(a - now) < 86_400_000 ? a : now;
    const target = typeof e.x === 'string' && TARGET.test(e.x) ? e.x : null;
    const d = Number(e.d);
    const duration = Number.isFinite(d) && d >= 0 ? Math.min(Math.round(d), 3_600_000) : null;
    return [{ type: e.t as string, at: new Date(at).toISOString(), path, target, label: clean(e.b, 100) || null, duration }];
  });
  if (!events.length) return none();

  const m = b.m ?? {};
  const first = events.find((e) => e.type === 'page');
  const ad = ['google', 'facebook', 'tiktok'].includes(m.ad) ? m.ad : null;
  await sql.query(
    `INSERT INTO journey_sessions (session_id, visitor_id, started_at, last_at, locale, device, landing_path,
       referrer_host, utm_source, utm_medium, utm_campaign, ad_click, is_returning)
     VALUES ($1, $2, $3, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     ON CONFLICT (session_id) DO NOTHING`,
    [b.s, b.v, events[0].at, /^[a-z]{2}$/.test(String(m.l)) ? m.l : null, device(m.w), first?.path ?? events[0].path,
      host(m.ref), utm(m.us), utm(m.um), utm(m.uc), ad, m.r === 1]);
  const pv = events.filter((e) => e.type === 'page').length;
  const active = events.filter((e) => e.type === 'leave').reduce((s, e) => s + (e.duration ?? 0), 0);
  const last = events.reduce((x, e) => (e.at > x ? e.at : x), events[0].at);
  const upd = await sql.query(
    `UPDATE journey_sessions SET last_at = GREATEST(last_at, $3::timestamptz), page_views = page_views + $4,
       events = events + $5, active_ms = active_ms + $6
     WHERE session_id = $1 AND visitor_id = $2 RETURNING session_id`,
    [b.s, b.v, last, pv, events.length, active]);
  /* Mã phiên của người khác: không ghi sự kiện vào đó. */
  if (!upd.rows.length) return none();

  const values: unknown[] = [];
  const rows = events.map((e, i) => {
    values.push(b.s, e.at, e.type, e.path, e.target, e.label, e.duration);
    const o = i * 7;
    return `($${o + 1}, $${o + 2}, $${o + 3}, $${o + 4}, $${o + 5}, $${o + 6}, $${o + 7})`;
  });
  await sql.query(`INSERT INTO journey_events (session_id, at, type, path, target, label, duration_ms) VALUES ${rows.join(', ')}`, values);
  return none();
}

function cookie(request: Request, name: string): string | null {
  const m = (request.headers.get('cookie') ?? '').match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : null;
}

/** Sau khi /api/orders nhận đơn: gắn mã đơn vào phiên hành trình đang mở (cookie mocha_js). */
export async function linkOrderToJourney(sql: Sql, request: Request, orderCode: string) {
  const sid = cookie(request, JS_COOKIE) ?? '';
  if (!ID.test(sid) || !orderCode) return;
  await sql.query(
    `UPDATE journey_sessions SET order_code = COALESCE(order_code, $2)
     WHERE session_id = $1 AND last_at > now() - interval '1 day'`, [sid, orderCode]);
}

/** Xoá hành trình cũ hơn JOURNEY_RETENTION_DAYS ngày (mặc định 90). Chạy mỗi giờ. */
export async function purgeJourney(sql: Sql, days = Number(process.env.JOURNEY_RETENTION_DAYS ?? 90)) {
  const d = Number.isFinite(days) && days > 0 ? Math.floor(days) : 90;
  await sql.query(`DELETE FROM journey_events WHERE at < now() - ($1 || ' days')::interval`, [String(d)]);
  await sql.query(`DELETE FROM journey_sessions WHERE last_at < now() - ($1 || ' days')::interval`, [String(d)]);
}
