/**
 * POST /api/chat — cầu nối trình duyệt <-> webhook n8n.
 *
 * Trình duyệt không gọi thẳng n8n:
 *   - địa chỉ webhook + khoá bí mật ở lại máy chủ (N8N_WEBHOOK_URL, N8N_SHARED_SECRET);
 *   - không phải nới CSP connect-src của site;
 *   - máy chủ gắn định danh khách (visitorId cookie HttpOnly + ipHash) mà trang không đọc được;
 *   - phản hồi của n8n được KIỂM và CHUẨN HOÁ trước khi tới trang: khối lạ bị bỏ,
 *     link `javascript:` bị bỏ, ảnh miền khác bị bỏ (CSP chặn), thẻ sản phẩm dựng
 *     từ /chat-catalog.json theo slug — giá trên thẻ không thể lệch giá trên trang.
 *
 * Chuẩn JSON hai chiều: docs/chat/request.schema.json, docs/chat/response.schema.json.
 * Hướng dẫn nối n8n: docs/chat-n8n.md.
 */
import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { Sql } from './db.ts';
import { cookie } from './auth.ts';
import { currentSite } from './publish.ts';

export const CHAT_VERSION = '1.0';
const VID_COOKIE = 'mocha_vid';
const VID = /^v_[A-Za-z0-9_-]{22}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const LIMITS = { body: 7 * 1024 * 1024, text: 2000, images: 3, imageBytes: 2 * 1024 * 1024, history: 20, historyText: 1000 };
const RATE_WINDOW_MS = 10 * 60 * 1000;

export interface ChatEnv {
  N8N_WEBHOOK_URL?: string; N8N_SHARED_SECRET?: string; N8N_TIMEOUT_MS?: string;
  CHAT_MOCK?: string; IP_SALT?: string; ALLOWED_ORIGIN?: string; PUBLIC_SITE_URL?: string;
  COOKIE_SECURE?: string; CHAT_RETENTION_DAYS?: string;
  /** Số tin tối đa mỗi 10 phút, theo visitorId và theo ipHash. Mặc định 30. */
  CHAT_RATE_MAX?: string;
}

// ----------------------------------------------------------------- danh mục
interface CatalogProduct {
  slug: string; locale: string; name: string; shortName: string; tagline: string | null;
  price: number; priceText: string; compareAtPriceText: string | null; availability: string;
  url: string; orderUrl: string; image: string | null; imageAlt: string;
}
interface Catalog { brand: { phone: string; phoneDisplay: string; zalo: string | null; name: string }; products: CatalogProduct[] }
let cache: { file: string; mtime: number; data: Catalog } | null = null;
export function loadCatalog(root: string): Catalog {
  const file = join(currentSite(root), 'chat-catalog.json');
  if (!existsSync(file)) return { brand: { phone: '', phoneDisplay: '', zalo: null, name: 'Mocha' }, products: [] };
  const mtime = statSync(file).mtimeMs;
  if (!cache || cache.file !== file || cache.mtime !== mtime) cache = { file, mtime, data: JSON.parse(readFileSync(file, 'utf8')) };
  return cache.data;
}
const findProduct = (c: Catalog, slug: string, locale: string) =>
  c.products.find((p) => p.slug === slug && p.locale === locale) ?? c.products.find((p) => p.slug === slug);

// ----------------------------------------------------------------- tiện ích
const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } });
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, max) : '');
export const hashIp = (ip: string, salt: string) => createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 16);
const newVisitorId = () => 'v_' + randomBytes(16).toString('base64url').slice(0, 22);

const T = {
  vi: {
    busy: 'Hệ thống tư vấn đang bận một chút. Bạn thử lại sau ít phút, hoặc gọi/nhắn Zalo để chuyên viên trả lời ngay nhé.',
    off: 'Tư vấn trực tuyến đang tạm nghỉ. Bạn gọi hoặc nhắn Zalo để chuyên viên Mocha trả lời ngay nhé.',
    limited: 'Bạn gửi hơi nhanh. Đợi vài phút rồi nhắn tiếp, hoặc gọi hotline để được hỗ trợ ngay.',
    call: 'Gọi', zalo: 'Nhắn Zalo',
  },
  en: {
    busy: 'Our advice desk is busy right now. Please try again in a few minutes, or call / message us on Zalo.',
    off: 'Online advice is offline at the moment. Please call or message us on Zalo.',
    limited: 'You are sending messages a little fast. Please wait a few minutes, or call our hotline.',
    call: 'Call', zalo: 'Zalo',
  },
};
function contactLinks(c: Catalog, locale: 'vi' | 'en') {
  const out: any[] = [];
  if (c.brand.phone) out.push({ type: 'link', label: `${T[locale].call} ${c.brand.phoneDisplay}`, url: `tel:${c.brand.phone}` });
  if (c.brand.zalo) out.push({ type: 'link', label: T[locale].zalo, url: c.brand.zalo });
  return out;
}

// ----------------------------------------------------------------- yêu cầu từ trình duyệt
export interface ClientMessage {
  messageId: string; sessionId: string; locale: 'vi' | 'en'; event: 'message' | 'quick_reply';
  text: string; payload: string; images: { mime: string; base64: string; bytes: number; width?: number; height?: number }[];
  page: { path: string; title: string | null; utm: Record<string, string> };
  history: { role: 'user' | 'bot'; text: string }[];
}
const MAGIC: Record<string, (b: Buffer) => boolean> = {
  'image/jpeg': (b) => b[0] === 0xff && b[1] === 0xd8,
  'image/png': (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  'image/webp': (b) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP',
};
export function parseClient(body: any): { ok: true; msg: ClientMessage } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') return { ok: false, error: 'bad_json' };
  if (!UUID.test(String(body.messageId ?? ''))) return { ok: false, error: 'bad_message_id' };
  if (!UUID.test(String(body.sessionId ?? ''))) return { ok: false, error: 'bad_session_id' };
  const locale = body.locale === 'en' ? 'en' : 'vi';
  const event = body.event === 'quick_reply' ? 'quick_reply' : 'message';
  const text = str(body.text, LIMITS.text);
  const payload = str(body.payload, 200);
  const images: ClientMessage['images'] = [];
  for (const im of Array.isArray(body.images) ? body.images.slice(0, LIMITS.images + 1) : []) {
    if (images.length >= LIMITS.images) return { ok: false, error: 'too_many_images' };
    const mime = String(im?.mime ?? '');
    const b64 = String(im?.base64 ?? '').replace(/^data:[^,]+,/, '');
    if (!MAGIC[mime] || !/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) return { ok: false, error: 'bad_image' };
    const buf = Buffer.from(b64, 'base64');
    if (buf.length > LIMITS.imageBytes) return { ok: false, error: 'image_too_large' };
    if (!MAGIC[mime](buf)) return { ok: false, error: 'bad_image' };
    images.push({ mime, base64: b64, bytes: buf.length,
      ...(Number.isInteger(im.width) ? { width: im.width } : {}), ...(Number.isInteger(im.height) ? { height: im.height } : {}) });
  }
  if (!text && !images.length && !payload) return { ok: false, error: 'empty' };
  const rawPath = str(body.page?.path, 300);
  const path = rawPath.startsWith('/') && !rawPath.startsWith('//') ? rawPath.split(/[?#]/)[0] : '/';
  const utm: Record<string, string> = {};
  for (const k of ['source', 'medium', 'campaign', 'content', 'term']) {
    const v = str(body.page?.utm?.[k], 120); if (v) utm[k] = v;
  }
  const history = (Array.isArray(body.history) ? body.history : []).slice(-LIMITS.history)
    .map((h: any) => ({ role: h?.role === 'bot' ? 'bot' as const : 'user' as const, text: str(h?.text, LIMITS.historyText) }))
    .filter((h: any) => h.text);
  return { ok: true, msg: { messageId: body.messageId, sessionId: body.sessionId, locale, event, text, payload, images,
    page: { path, title: str(body.page?.title, 200) || null, utm }, history } };
}

/** JSON gửi n8n — đúng docs/chat/request.schema.json. */
export function n8nRequest(msg: ClientMessage, visitorId: string, ipHash: string | null, catalog: Catalog) {
  const p = catalog.products.find((x) => x.url === msg.page.path);
  return {
    version: CHAT_VERSION,
    event: msg.event,
    messageId: msg.messageId,
    sessionId: msg.sessionId,
    visitorId,
    ipHash,
    locale: msg.locale,
    sentAt: new Date().toISOString(),
    page: {
      path: msg.page.path,
      title: msg.page.title,
      product: p ? { slug: p.slug, name: p.name, price: p.price, priceText: p.priceText, url: p.url } : null,
      ...(Object.keys(msg.page.utm).length ? { utm: msg.page.utm } : {}),
    },
    message: {
      ...(msg.text ? { text: msg.text } : {}),
      ...(msg.payload ? { payload: msg.payload } : {}),
      ...(msg.images.length ? { images: msg.images } : {}),
    },
    history: msg.history,
  };
}

// ----------------------------------------------------------------- phản hồi từ n8n
const productCard = (p: CatalogProduct) => ({
  slug: p.slug, name: p.shortName, tagline: p.tagline, priceText: p.priceText, compareAtPriceText: p.compareAtPriceText,
  image: p.image, imageAlt: p.imageAlt, url: p.url, orderUrl: p.orderUrl, available: p.availability === 'InStock',
});
function safeLink(url: string): string | null {
  if (/^\/(?!\/)/.test(url)) return url;
  if (/^(tel:\+?[0-9 .-]{6,20}|mailto:[^\s@]+@[^\s@]+)$/i.test(url)) return url;
  try { const u = new URL(url); return u.protocol === 'https:' ? u.href : null; } catch { return null; }
}
function sameOriginImage(url: string, ownHosts: string[]): string | null {
  if (/^\/(?!\/)/.test(url)) return url;
  try {
    const u = new URL(url);
    return (u.protocol === 'https:' || u.protocol === 'http:') && ownHosts.includes(u.host) ? u.pathname + u.search : null;
  } catch { return null; }
}

export interface Normalized { messages: any[]; quickReplies: { label: string; payload: string }[]; handoff: boolean; dropped: number }
/** Chuẩn hoá theo docs/chat/response.schema.json. Không ném lỗi: phần sai bị bỏ và được đếm. */
export function normalizeResponse(raw: any, catalog: Catalog, locale: string, ownHosts: string[]): Normalized {
  const out: any[] = []; let dropped = 0;
  const list = Array.isArray(raw?.messages) ? raw.messages.slice(0, 10) : [];
  for (const m of list) {
    const type = m?.type;
    if (type === 'text') {
      const text = str(m.text, 4000); if (text) out.push({ type, text }); else dropped++;
    } else if (type === 'image') {
      const url = sameOriginImage(String(m.url ?? ''), ownHosts);
      if (url) out.push({ type, url, alt: str(m.alt, 300), caption: str(m.caption, 300) || undefined }); else dropped++;
    } else if (type === 'product') {
      const p = findProduct(catalog, String(m.slug ?? ''), locale);
      if (p) out.push({ type, product: productCard(p), note: str(m.note, 200) || undefined }); else dropped++;
    } else if (type === 'products') {
      const ps = (Array.isArray(m.slugs) ? m.slugs.slice(0, 6) : []).map((s: unknown) => findProduct(catalog, String(s), locale)).filter(Boolean) as CatalogProduct[];
      if (ps.length) out.push({ type, products: ps.map(productCard) }); else dropped++;
    } else if (type === 'link') {
      const url = safeLink(String(m.url ?? '')); const label = str(m.label, 60);
      if (url && label) out.push({ type, label, url }); else dropped++;
    } else dropped++;
  }
  const quickReplies = (Array.isArray(raw?.quickReplies) ? raw.quickReplies.slice(0, 6) : [])
    .map((q: any) => ({ label: str(q?.label, 40), payload: str(q?.payload, 200) || str(q?.label, 40) }))
    .filter((q: any) => q.label);
  return { messages: out, quickReplies, handoff: raw?.handoff === true, dropped };
}

// ----------------------------------------------------------------- chế độ thử (không có n8n)
/** CHAT_MOCK=1: trả lời mẫu để xem giao diện (chữ, thẻ sản phẩm, dải thẻ, ảnh, nút gợi ý). */
function mockReply(msg: ClientMessage, catalog: Catalog) {
  const loc = msg.locale;
  const here = catalog.products.find((p) => p.url === msg.page.path);
  const pick = (slugs: string[]) => slugs.filter((s) => findProduct(catalog, s, loc));
  const q = (msg.payload || msg.text).toLowerCase();
  if (msg.images.length) {
    return { version: CHAT_VERSION, messages: [
      { type: 'text', text: loc === 'vi'
        ? `Mình đã nhận **${msg.images.length} ảnh**. (Chế độ thử: chưa nối n8n nên chưa phân tích ảnh.) Với vùng sạm hai bên gò má, nhiều khách bắt đầu bằng combo kem + serum:`
        : `Got **${msg.images.length} photo(s)**. (Demo mode: n8n is not connected, so the photo is not analysed.) For patches on both cheeks, many customers start with the cream + serum set:` },
      { type: 'product', slug: 'combo-nam', note: loc === 'vi' ? 'Kem + serum, nồng độ in trên bao bì' : 'Cream + serum, concentrations printed on the pack' },
    ], quickReplies: [{ label: loc === 'vi' ? 'Cách dùng thế nào?' : 'How do I use it?', payload: 'how_to_use' }] };
  }
  if (/giá|price|bao nhiêu|combo/.test(q)) {
    return { version: CHAT_VERSION, messages: [
      { type: 'text', text: loc === 'vi' ? 'Các lựa chọn cho da nám, giá đã gồm giao hàng miễn phí:' : 'Options for melasma-prone skin, free delivery included:' },
      { type: 'products', slugs: pick(['combo-nam', 'smart-brightening-cream', 'smart-first-care-serum']) },
    ], quickReplies: [{ label: loc === 'vi' ? 'Khác nhau thế nào?' : 'What is the difference?', payload: 'compare' }] };
  }
  return { version: CHAT_VERSION, messages: [
    { type: 'text', text: loc === 'vi'
      ? `Chào bạn! Đây là **chế độ thử** (chưa nối n8n). Bạn vừa nhắn: "${msg.text.slice(0, 200)}".`
      : `Hi! This is **demo mode** (n8n not connected). You wrote: "${msg.text.slice(0, 200)}".` },
    ...(here ? [{ type: 'product', slug: here.slug, note: loc === 'vi' ? 'Sản phẩm trên trang bạn đang xem' : 'The product on this page' }] : []),
    ...(here?.image ? [{ type: 'image', url: here.image, alt: here.imageAlt, caption: loc === 'vi' ? 'Ảnh sản phẩm' : 'Product photo' }] : []),
    { type: 'link', label: loc === 'vi' ? 'Xem giấy tờ công bố' : 'See product documents', url: loc === 'vi' ? '/chung-nhan/' : '/en/certificates/' },
  ], quickReplies: [
    { label: loc === 'vi' ? 'Giá combo nám' : 'Melasma set price', payload: 'price' },
    { label: loc === 'vi' ? 'Gặp chuyên viên' : 'Talk to a person', payload: 'handoff' },
  ], handoff: q.includes('handoff') };
}

// ----------------------------------------------------------------- lưu + giới hạn nhịp
async function rateLimited(sql: Sql, key: string, max: number) {
  const now = Date.now();
  const row = (await sql.query<{ count: number; window_at: string }>('SELECT count, window_at FROM rate_limit WHERE key = $1', [key])).rows[0];
  const fresh = !!row && now - Date.parse(row.window_at) < RATE_WINDOW_MS;
  if (fresh && row.count >= max) return true;
  await sql.query(
    `INSERT INTO rate_limit (key, count, window_at) VALUES ($1, 1, $2)
     ON CONFLICT (key) DO UPDATE SET count = CASE WHEN $3 = 1 THEN rate_limit.count + 1 ELSE 1 END,
       window_at = CASE WHEN $3 = 1 THEN rate_limit.window_at ELSE $2 END`,
    [key, new Date(now).toISOString(), fresh ? 1 : 0]);
  return false;
}
let lastPurge = 0;
async function store(sql: Sql, env: ChatEnv, rows: { sessionId: string; visitorId: string; ipHash: string | null; role: string; text: string; payload: unknown; locale: string; path: string }[]) {
  for (const r of rows) {
    await sql.query(
      `INSERT INTO chat_messages (session_id, visitor_id, ip_hash, role, text, payload, locale, page_path)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)`,
      [r.sessionId, r.visitorId, r.ipHash, r.role, r.text || null, JSON.stringify(r.payload ?? {}), r.locale, r.path]);
  }
  if (Date.now() - lastPurge > 3600_000) {
    lastPurge = Date.now();
    await sql.query(`DELETE FROM chat_messages WHERE created_at < now() - ($1 || ' days')::interval`, [String(Number(env.CHAT_RETENTION_DAYS ?? 90))]);
  }
}

// ----------------------------------------------------------------- handler
export async function chatHandler(request: Request, sql: Sql, root: string, env: ChatEnv, fetchImpl: typeof fetch = fetch): Promise<Response> {
  if (request.method !== 'POST') return json({ ok: false, error: 'method' }, 405, { allow: 'POST' });
  const origin = request.headers.get('origin');
  if (env.ALLOWED_ORIGIN && origin && origin !== env.ALLOWED_ORIGIN) return json({ ok: false, error: 'origin_not_allowed' }, 403);
  if (Number(request.headers.get('content-length') ?? 0) > LIMITS.body) return json({ ok: false, error: 'too_large' }, 413);
  const raw = await request.text();
  if (raw.length > LIMITS.body) return json({ ok: false, error: 'too_large' }, 413);
  let body: unknown; try { body = JSON.parse(raw); } catch { return json({ ok: false, error: 'bad_json' }, 400); }
  const parsed = parseClient(body);
  if (!parsed.ok) return json({ ok: false, error: parsed.error }, 422);
  const msg = parsed.msg;

  /* Định danh khách: cookie HttpOnly do máy chủ cấp (trang không đọc được, không
     ai giả được bằng JS); ipHash chỉ là tín hiệu phụ — một IP 4G có thể là hàng
     nghìn khách (CGNAT), một khách đổi IP liên tục giữa 4G và wifi. */
  let visitorId = cookie(request, VID_COOKIE) ?? '';
  const setCookie: Record<string, string> = {};
  if (!VID.test(visitorId)) {
    visitorId = newVisitorId();
    setCookie['set-cookie'] = `${VID_COOKIE}=${visitorId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${env.COOKIE_SECURE === '0' ? '' : '; Secure'}`;
  }
  const ip = request.headers.get('cf-connecting-ip');
  const ipHash = ip && env.IP_SALT ? hashIp(ip, env.IP_SALT) : null;
  const catalog = loadCatalog(root);
  const reply = (n: Normalized, extra: Record<string, unknown> = {}, status = 200) =>
    json({ ok: true, version: CHAT_VERSION, sessionId: msg.sessionId, ...n, dropped: undefined, ...extra }, status, setCookie);

  const rateMax = Number(env.CHAT_RATE_MAX ?? 30);
  if (await rateLimited(sql, `chat:v:${visitorId}`, rateMax) || (ipHash && await rateLimited(sql, `chat:ip:${ipHash}`, rateMax))) {
    return reply({ messages: [{ type: 'text', text: T[msg.locale].limited }, ...contactLinks(catalog, msg.locale)], quickReplies: [], handoff: true, dropped: 0 }, { degraded: 'rate_limited' }, 429);
  }

  const req = n8nRequest(msg, visitorId, ipHash, catalog);
  const ownHosts = [new URL(request.url).host, ...(env.PUBLIC_SITE_URL ? [new URL(env.PUBLIC_SITE_URL).host] : [])];
  let rawReply: any; let degraded: string | undefined;
  if (env.N8N_WEBHOOK_URL) {
    const bodyOut = JSON.stringify(req);
    const ts = String(Math.floor(Date.now() / 1000));
    const headers: Record<string, string> = { 'content-type': 'application/json', 'x-mocha-chat-version': CHAT_VERSION, 'x-mocha-timestamp': ts };
    if (env.N8N_SHARED_SECRET) {
      headers['x-mocha-token'] = env.N8N_SHARED_SECRET;
      headers['x-mocha-signature'] = 'sha256=' + createHmac('sha256', env.N8N_SHARED_SECRET).update(`${ts}.${bodyOut}`).digest('hex');
    }
    try {
      const r = await fetchImpl(env.N8N_WEBHOOK_URL, { method: 'POST', headers, body: bodyOut, signal: AbortSignal.timeout(Number(env.N8N_TIMEOUT_MS ?? 25000)) });
      if (!r.ok) throw new Error(`n8n HTTP ${r.status}`);
      rawReply = await r.json();
      /* n8n "Respond to Webhook" đôi khi bọc kết quả trong mảng [ {...} ] */
      if (Array.isArray(rawReply)) rawReply = rawReply[0];
    } catch (e) {
      console.error('chat_upstream_failed', (e as Error).message.slice(0, 160));
      degraded = 'upstream';
    }
  } else if (env.CHAT_MOCK === '1') {
    rawReply = mockReply(msg, catalog);
  } else {
    degraded = 'not_configured';
  }

  let n = rawReply ? normalizeResponse(rawReply, catalog, msg.locale, ownHosts) : null;
  if (!n || !n.messages.length) {
    if (n && !degraded) degraded = 'empty_reply';
    n = { messages: [{ type: 'text', text: degraded === 'not_configured' ? T[msg.locale].off : T[msg.locale].busy }, ...contactLinks(catalog, msg.locale)],
      quickReplies: [], handoff: true, dropped: n?.dropped ?? 0 };
  }
  if (n.handoff && !n.messages.some((m) => m.type === 'link' && /^tel:/.test(m.url))) n.messages.push(...contactLinks(catalog, msg.locale));
  if (n.dropped) console.warn('chat_reply_dropped_blocks', n.dropped);

  /* Lưu chữ để nhân viên xem lại (/admin/chats). KHÔNG lưu ảnh — chỉ số ảnh. */
  await store(sql, env, [
    { sessionId: msg.sessionId, visitorId, ipHash, role: 'user', text: msg.text, locale: msg.locale, path: msg.page.path,
      payload: { messageId: msg.messageId, event: msg.event, payload: msg.payload || undefined, images: msg.images.length } },
    { sessionId: msg.sessionId, visitorId, ipHash, role: 'bot', text: n.messages.filter((m) => m.type === 'text').map((m) => m.text).join('\n'),
      locale: msg.locale, path: msg.page.path, payload: { messages: n.messages, quickReplies: n.quickReplies, handoff: n.handoff, degraded } },
  ]).catch((e) => console.error('chat_store_failed', (e as Error).message.slice(0, 160)));

  return reply(n, degraded ? { degraded } : {});
}
