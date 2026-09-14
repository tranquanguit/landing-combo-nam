/**
 * POST /api/orders — nhận đơn và ghi vào D1.
 *
 * Vì sao cùng tên miền chứ không phải một dịch vụ ngoài: biểu mẫu gửi bằng
 * fetch(), nên endpoint khác miền phải được liệt kê trong connect-src của CSP,
 * và một vòng kiểm định trước đã mất 100% đơn hàng đúng vì chỗ đó. Cùng gốc
 * thì 'self' đã đủ, không CORS, không preflight, không có gì để quên.
 */
import {
  MAX_BODY_BYTES, validateOrder, insertParams, INSERT_SQL,
  DEDUPE_SQL, DEDUPE_WINDOW_MS, hashIp, referrerHost, makeOrderCode,
  RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS,
} from '../_lib/orders.ts';

interface Env {
  DB: D1Database;
  IP_SALT?: string;
  ALLOWED_ORIGIN?: string;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      // Trang xác nhận không được nằm trong bộ nhớ đệm nào.
      'cache-control': 'no-store',
    },
  });

async function handlePost(request: Request, env: Env): Promise<Response> {
  // Chỉ nhận đơn từ chính trang của mình. Không phải để chống CSRF (không có
  // cookie nào để lợi dụng) mà để website khác không bơm rác vào cơ sở dữ liệu.
  const allowed = env.ALLOWED_ORIGIN;
  const origin = request.headers.get('origin');
  if (allowed && origin && origin !== allowed) {
    return json({ ok: false, error: 'origin_not_allowed' }, 403);
  }

  const len = Number(request.headers.get('content-length') || 0);
  if (len > MAX_BODY_BYTES) return json({ ok: false, error: 'too_large' }, 413);

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return json({ ok: false, error: 'too_large' }, 413);

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('shape');
    body = parsed as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: 'bad_json' }, 400);
  }

  // ---- Giới hạn nhịp gửi -------------------------------------------------
  // Không có IP_SALT thì bỏ qua chứ không băm bằng chuỗi rỗng: một muối rỗng
  // cho ra bảng băm tra ngược được, tức là lưu IP mà tưởng là đã ẩn danh.
  const ip = request.headers.get('cf-connecting-ip');
  if (ip && env.IP_SALT) {
    const key = await hashIp(ip, env.IP_SALT);
    const now = Date.now();
    const row = await env.DB.prepare('SELECT count, window_at FROM rate_limit WHERE key = ?')
      .bind(key).first<{ count: number; window_at: string }>();
    const fresh = row && now - Date.parse(row.window_at) < RATE_LIMIT_WINDOW_MS;
    if (fresh && row.count >= RATE_LIMIT_MAX) {
      return json({ ok: false, error: 'rate_limited' }, 429);
    }
    await env.DB.prepare(
      `INSERT INTO rate_limit (key, count, window_at) VALUES (?, 1, ?)
       ON CONFLICT(key) DO UPDATE SET
         count = CASE WHEN ? THEN rate_limit.count + 1 ELSE 1 END,
         window_at = CASE WHEN ? THEN rate_limit.window_at ELSE ? END`,
    ).bind(key, new Date(now).toISOString(), fresh ? 1 : 0, fresh ? 1 : 0, new Date(now).toISOString())
      .run();
  }

  // ---- Kiểm tra ----------------------------------------------------------
  // Gói không có giá là gói "chỉ cần tư vấn" — không bắt nhập địa chỉ giao hàng.
  const requiresAddress = body.packPrice !== undefined
    && body.packPrice !== null
    && body.packPrice !== ''
    && Number(body.packPrice) > 0;

  const result = validateOrder(
    { ...body, referrerHost: referrerHost(request.headers.get('referer')) },
    { requiresAddress },
  );
  if (!result.ok) {
    // Trả về TÊN TRƯỜNG sai, không trả lại giá trị khách đã gõ: nhật ký lỗi
    // của Cloudflare không phải nơi để dữ liệu cá nhân đi qua.
    return json({ ok: false, error: 'invalid', fields: result.rejections }, 422);
  }
  const order = result.order;

  // ---- Bấm hai lần thì vẫn là một đơn ------------------------------------
  const since = new Date(Date.now() - DEDUPE_WINDOW_MS).toISOString();
  const dup = await env.DB.prepare(DEDUPE_SQL)
    .bind(order.phone, order.pack, since).first<{ order_code: string }>();
  if (dup) return json({ ok: true, orderCode: dup.order_code, deduped: true });

  // ---- Ghi ---------------------------------------------------------------
  // Mã đơn ngẫu nhiên có thể trùng; thử lại vài lần rồi mới chịu thua.
  let code = order.orderCode;
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) code = makeOrderCode(new Date());
    try {
      await env.DB.prepare(INSERT_SQL).bind(...insertParams({ ...order, orderCode: code })).run();
      return json({ ok: true, orderCode: code });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (!/UNIQUE|constraint/i.test(message)) {
        // Không ghi nội dung đơn vào log. Chỉ ghi mã lỗi.
        console.error('order_insert_failed', message.slice(0, 200));
        return json({ ok: false, error: 'server' }, 500);
      }
    }
  }
  console.error('order_code_collision');
  return json({ ok: false, error: 'server' }, 500);
}

/** Một cửa vào duy nhất, tự phân nhánh theo phương thức — không để hai handler
    cùng nhận một đường dẫn rồi phải đoán cái nào chạy trước. */
export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  if (request.method === 'POST') return handlePost(request, env);
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { allow: 'POST, OPTIONS' } });
  }
  return new Response('Method Not Allowed', { status: 405, headers: { allow: 'POST, OPTIONS' } });
};
