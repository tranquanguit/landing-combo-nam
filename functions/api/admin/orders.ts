/**
 * /api/admin/orders — xem và cập nhật đơn.
 *
 *   GET   ?status=new&limit=50&cursor=123&format=json|csv
 *   PATCH { orderCode, status?, staffNote? }
 *
 * Đây là đường duy nhất đọc được dữ liệu cá nhân của khách, nên nó là đường
 * phải canh kỹ nhất: token bắt buộc, so sánh trong thời gian không đổi, không
 * bao giờ vào bộ nhớ đệm, không bao giờ được công cụ tìm kiếm lập chỉ mục.
 */
import { timingSafeEqual } from '../../_lib/orders.ts';

interface Env {
  DB: D1Database;
  ADMIN_TOKEN?: string;
}

const STATUSES = new Set(['new', 'contacted', 'confirmed', 'shipped', 'done', 'cancelled']);
const MAX_LIMIT = 200;

const secure = (body: BodyInit | null, status: number, type: string) =>
  new Response(body, {
    status,
    headers: {
      'content-type': type,
      'cache-control': 'no-store',
      // Dữ liệu khách không được xuất hiện trong kết quả tìm kiếm dù chỉ một lần.
      'x-robots-tag': 'noindex, nofollow, noarchive',
      'referrer-policy': 'no-referrer',
    },
  });

const json = (body: unknown, status = 200) =>
  secure(JSON.stringify(body), status, 'application/json; charset=utf-8');

/** Chưa đặt ADMIN_TOKEN thì KHOÁ HẲN, không phải mở toang. */
function authorise(request: Request, env: Env): Response | null {
  if (!env.ADMIN_TOKEN || env.ADMIN_TOKEN.length < 24) {
    return json({ ok: false, error: 'admin_disabled' }, 503);
  }
  const header = request.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!timingSafeEqual(token, env.ADMIN_TOKEN)) {
    return json({ ok: false, error: 'unauthorised' }, 401);
  }
  return null;
}

const CSV_COLUMNS = [
  'order_code', 'created_at', 'status', 'product_slug', 'locale', 'pack', 'pack_price',
  'name', 'phone', 'address', 'country', 'note',
  'utm_source', 'utm_medium', 'utm_campaign', 'referrer_host', 'staff_note',
] as const;

/**
 * Excel diễn giải ô bắt đầu bằng = + - @ là công thức. Một ô "=1+1" thành phép
 * tính; một ô dựng khéo hơn thì gọi được lệnh ngoài. Khách tự gõ được nội dung
 * các ô này, nên phải vô hiệu hoá trước khi xuất.
 */
const csvCell = (v: unknown): string => {
  if (v === null || v === undefined) return '';
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};

async function handleGet(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const cursor = Number(url.searchParams.get('cursor') || 0);
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 50), 1), MAX_LIMIT);

  if (status && !STATUSES.has(status)) return json({ ok: false, error: 'bad_status' }, 400);

  const where: string[] = [];
  const params: unknown[] = [];
  if (status) { where.push('status = ?'); params.push(status); }
  if (from) { where.push('created_at >= ?'); params.push(from); }
  if (to) { where.push('created_at <= ?'); params.push(to); }
  if (cursor > 0) { where.push('id < ?'); params.push(cursor); }

  const sql = `SELECT id, ${CSV_COLUMNS.join(', ')} FROM orders`
    + (where.length ? ` WHERE ${where.join(' AND ')}` : '')
    + ' ORDER BY id DESC LIMIT ?';
  const { results } = await env.DB.prepare(sql).bind(...params, limit).all();
  const rows = (results || []) as Record<string, unknown>[];

  if (url.searchParams.get('format') === 'csv') {
    // BOM để Excel tiếng Việt mở ra không thành ký tự lạ.
    const csv = '﻿' + [
      CSV_COLUMNS.join(','),
      ...rows.map((r) => CSV_COLUMNS.map((c) => csvCell(r[c])).join(',')),
    ].join('\r\n');
    return new Response(csv, {
      status: 200,
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="don-hang-${new Date().toISOString().slice(0, 10)}.csv"`,
        'cache-control': 'no-store',
        'x-robots-tag': 'noindex, nofollow, noarchive',
      },
    });
  }

  const nextCursor = rows.length === limit ? rows[rows.length - 1].id : null;
  return json({ ok: true, count: rows.length, nextCursor, orders: rows });
}

async function handlePatch(request: Request, env: Env): Promise<Response> {
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return json({ ok: false, error: 'bad_json' }, 400); }

  const orderCode = typeof body.orderCode === 'string' ? body.orderCode.trim() : '';
  if (!/^MC-\d{6}-[A-Z0-9]{4}$/.test(orderCode)) return json({ ok: false, error: 'bad_code' }, 400);

  const sets: string[] = [];
  const params: unknown[] = [];
  if (body.status !== undefined) {
    const s = String(body.status);
    if (!STATUSES.has(s)) return json({ ok: false, error: 'bad_status' }, 400);
    sets.push('status = ?'); params.push(s);
  }
  if (body.staffNote !== undefined) {
    sets.push('staff_note = ?'); params.push(String(body.staffNote).slice(0, 1000));
  }
  if (!sets.length) return json({ ok: false, error: 'nothing_to_update' }, 400);
  sets.push('updated_at = ?'); params.push(new Date().toISOString());

  const res = await env.DB.prepare(`UPDATE orders SET ${sets.join(', ')} WHERE order_code = ?`)
    .bind(...params, orderCode).run();
  const changed = res.meta?.changes ?? 0;
  if (!changed) return json({ ok: false, error: 'not_found' }, 404);
  return json({ ok: true, orderCode });
}

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  const denied = authorise(request, env);
  if (denied) return denied;
  if (request.method === 'GET') return handleGet(request, env);
  if (request.method === 'PATCH') return handlePatch(request, env);
  return secure('Method Not Allowed', 405, 'text/plain; charset=utf-8');
};
