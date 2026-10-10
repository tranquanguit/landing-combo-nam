/**
 * Giới hạn nhịp dùng chung cho máy chủ Docker (chat, sự kiện chat, đăng nhập quản trị).
 * Bảng rate_limit (db/pg/0001_orders.sql) dùng chung với /api/orders.
 *
 * MỘT câu lệnh: tăng đếm và đọc lại trong cùng một lần ghi, nên hai yêu cầu song song
 * không cùng lọt qua (bản cũ đọc rồi mới ghi). Cửa sổ cố định: hết cửa sổ thì đếm lại từ 1.
 */
import type { Sql } from './db.ts';

/** true = đã vượt `max` lần trong cửa sổ `windowMs`. */
export async function limited(sql: Sql, key: string, max: number, windowMs: number): Promise<boolean> {
  const now = Date.now();
  const r = await sql.query<{ count: number }>(
    `INSERT INTO rate_limit (key, count, window_at) VALUES ($1, 1, $2)
     ON CONFLICT (key) DO UPDATE SET
       count = CASE WHEN rate_limit.window_at::timestamptz > $3::timestamptz THEN rate_limit.count + 1 ELSE 1 END,
       window_at = CASE WHEN rate_limit.window_at::timestamptz > $3::timestamptz THEN rate_limit.window_at ELSE $2 END
     RETURNING count`,
    [key, new Date(now).toISOString(), new Date(now - windowMs).toISOString()]);
  return r.rows[0].count > max;
}

/** Xoá khoá đã hết hạn — không có bước này bảng phình theo mỗi IP / mỗi khách từng ghé. */
export async function purgeRateLimit(sql: Sql) {
  await sql.query(`DELETE FROM rate_limit WHERE window_at::timestamptz < now() - interval '1 day'`);
}

/**
 * IP dùng để giới hạn nhịp: IPv6 lấy theo khối /64 (một nhà mạng cấp cả khối cho một
 * thuê bao — đổi 64 bit cuối là có địa chỉ mới, không được tính là một người mới).
 * IPv4 (kể cả dạng ::ffff:a.b.c.d) giữ nguyên.
 */
export function clientKey(ip: string): string {
  const v4 = ip.match(/(?:^|:)(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (v4) return v4[1];
  if (!ip.includes(':')) return ip;
  const [head, tail] = ip.split('%')[0].split('::');
  const h = head ? head.split(':') : [];
  const t = tail !== undefined ? (tail ? tail.split(':') : []) : [];
  const full = [...h, ...Array(Math.max(0, 8 - h.length - t.length)).fill('0'), ...t];
  return full.slice(0, 4).map((x) => (x || '0').toLowerCase().replace(/^0+(?=.)/, '')).join(':') + '::/64';
}
