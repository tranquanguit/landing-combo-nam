/**
 * POST /api/chat — trả lời khách trong bong bóng chat.
 *
 * Ba chế độ, chọn ở /admin/settings/chat (server/lib/chat-settings.ts):
 *   off    tạm nghỉ — mời gọi/nhắn Zalo;
 *   rules  kịch bản tư vấn (server/lib/chat-rules.ts, CRUD ở /admin/chat-rules);
 *   n8n    chuyển tới webhook n8n; n8n lỗi/chậm/trả rỗng thì kịch bản trả lời thay (nếu bật).
 *
 * Trình duyệt không gọi thẳng n8n:
 *   - địa chỉ webhook + khoá bí mật ở lại máy chủ (cấu hình trên trang quản trị);
 *   - không phải nới CSP connect-src của site;
 *   - máy chủ gắn định danh khách (visitorId cookie HttpOnly + ipHash) mà trang không đọc được;
 *   - phản hồi của n8n được KIỂM và CHUẨN HOÁ trước khi tới trang: khối lạ bị bỏ,
 *     link `javascript:` bị bỏ, ảnh miền khác bị bỏ (CSP chặn), thẻ sản phẩm dựng
 *     từ /chat-catalog.json theo slug — giá trên thẻ không thể lệch giá trên trang.
 *
 * Chuẩn JSON hai chiều: docs/chat/request.schema.json, docs/chat/response.schema.json.
 * Hướng dẫn nối n8n: docs/chat-n8n.md. Dữ liệu phân tích: docs/chat-analytics.md.
 */
import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { Sql } from './db.ts';
import { cookie } from './auth.ts';
import { currentSite } from './publish.ts';
import { getChatSettings, type ChatSettings, type ChatSettingsEnv } from './chat-settings.ts';
import { loadRules, pickRule, recordHit, renderResponse } from './chat-rules.ts';

export const CHAT_VERSION = '1.0';
const VID_COOKIE = 'mocha_vid';
const VID = /^v_[A-Za-z0-9_-]{22}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const LIMITS = { body: 7 * 1024 * 1024, text: 2000, images: 3, imageBytes: 2 * 1024 * 1024, history: 20, historyText: 1000 };
const RATE_WINDOW_MS = 10 * 60 * 1000;

/** N8N_* / CHAT_* chỉ là giá trị khởi đầu — trang quản trị ghi đè (chat-settings.ts). */
export interface ChatEnv extends ChatSettingsEnv {
  IP_SALT?: string; ALLOWED_ORIGIN?: string; PUBLIC_SITE_URL?: string; COOKIE_SECURE?: string;
}

// ----------------------------------------------------------------- danh mục
interface CatalogProduct {
  slug: string; locale: string; name: string; shortName: string; tagline: string | null;
  price: number; priceText: string; compareAtPriceText: string | null; availability: string;
  url: string; orderUrl: string; image: string | null; imageAlt: string;
}
export interface Catalog { brand: { phone: string; phoneDisplay: string; zalo: string | null; name: string }; products: CatalogProduct[] }
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

// ----------------------------------------------------------------- nguồn trả lời
/** Gọi webhook n8n với chữ ký HMAC. Ném lỗi khi HTTP lỗi / quá giờ / không phải JSON. */
export async function callN8n(s: ChatSettings, req: unknown, fetchImpl: typeof fetch = fetch): Promise<any> {
  const bodyOut = JSON.stringify(req);
  const ts = String(Math.floor(Date.now() / 1000));
  const headers: Record<string, string> = { 'content-type': 'application/json', 'x-mocha-chat-version': CHAT_VERSION, 'x-mocha-timestamp': ts };
  if (s.sharedSecret) {
    headers['x-mocha-token'] = s.sharedSecret;
    headers['x-mocha-signature'] = 'sha256=' + createHmac('sha256', s.sharedSecret).update(`${ts}.${bodyOut}`).digest('hex');
  }
  const r = await fetchImpl(s.webhookUrl, { method: 'POST', headers, body: bodyOut, signal: AbortSignal.timeout(s.timeoutMs) });
  if (!r.ok) throw new Error(`n8n HTTP ${r.status}`);
  const raw = await r.json();
  /* n8n "Respond to Webhook" đôi khi bọc kết quả trong mảng [ {...} ] */
  return Array.isArray(raw) ? raw[0] : raw;
}

const pageProduct = (c: Catalog, path: string) => c.products.find((p) => p.url === path) ?? null;

/** Trả lời bằng kịch bản. null = không có kịch bản nào (kể cả dự phòng). */
export async function answerByRules(sql: Sql, msg: Pick<ClientMessage, 'text' | 'payload' | 'locale' | 'page' | 'images'>, catalog: Catalog) {
  const rules = await loadRules(sql);
  const m = pickRule(rules, { text: msg.text, payload: msg.payload, locale: msg.locale, path: msg.page.path, images: msg.images.length });
  if (!m) return null;
  const p = pageProduct(catalog, msg.page.path);
  const raw = renderResponse(m.rule.response, {
    product: p ? { slug: p.slug, name: p.shortName, priceText: p.priceText, url: p.url } : null,
    brand: { phoneDisplay: catalog.brand.phoneDisplay, zalo: catalog.brand.zalo },
  });
  return { raw, rule: m.rule, hits: m.hits, fallback: m.fallback };
}

/** Nút "Thử kết nối" trên /admin/settings/chat: gửi một tin mẫu, đo thời gian, chuẩn hoá kết quả. */
export async function testN8n(s: ChatSettings, root: string, fetchImpl: typeof fetch = fetch) {
  const catalog = loadCatalog(root);
  const msg: ClientMessage = {
    messageId: randomUUID(), sessionId: randomUUID(), locale: 'vi', event: 'message', text: 'Tin thử kết nối từ trang quản trị', payload: '',
    images: [], page: { path: '/combo-nam/', title: 'Thử kết nối', utm: {} }, history: [],
  };
  const t0 = Date.now();
  try {
    const raw = await callN8n(s, { ...n8nRequest(msg, 'v_admin-connection-test0000', null, catalog), test: true }, fetchImpl);
    const n = normalizeResponse(raw, catalog, 'vi', []);
    return { ok: n.messages.length > 0, ms: Date.now() - t0, blocks: n.messages.length, dropped: n.dropped, normalized: n, error: n.messages.length ? null : 'Phản hồi không có khối hợp lệ nào' };
  } catch (e) {
    return { ok: false, ms: Date.now() - t0, blocks: 0, dropped: 0, normalized: null, error: (e as Error).message.slice(0, 200) };
  }
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

/** Nguồn của câu trả lời — cột chat_messages.source.
 *  rules: kịch bản · n8n · fallback: kịch bản thay n8n đang lỗi · off · rate_limited · error: không ai trả lời được */
export type Source = 'rules' | 'n8n' | 'fallback' | 'off' | 'rate_limited' | 'error';
interface Turn {
  msg: ClientMessage; visitorId: string; ipHash: string | null; n: Normalized;
  source: Source; ruleId: number | null; matched: boolean; latencyMs: number;
  /** gửi về trang */ degraded?: string;
  /** chỉ ghi lại: n8n lỗi nhưng kịch bản đã trả lời thay */ upstream?: string;
}
const slugsOf = (messages: any[]) => [...new Set(messages.flatMap((m) =>
  m.type === 'product' ? [m.product.slug] : m.type === 'products' ? m.products.map((p: any) => p.slug) : []))];

let lastPurge = 0;
async function store(sql: Sql, s: ChatSettings, t: Turn) {
  const { msg } = t;
  const common = [msg.sessionId, t.visitorId, t.ipHash, msg.locale, msg.page.path, msg.messageId];
  const ins = `INSERT INTO chat_messages (session_id, visitor_id, ip_hash, locale, page_path, message_id, role, text, payload, source, rule_id, latency_ms, products, matched)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::text::jsonb, $10, $11, $12, $13, $14)`;
  /* KHÔNG lưu ảnh — chỉ số ảnh. */
  await sql.query(ins, [...common, 'user', msg.text || null,
    JSON.stringify({ event: msg.event, payload: msg.payload || undefined, images: msg.images.length }), null, null, null, [], null]);
  await sql.query(ins, [...common, 'bot', t.n.messages.filter((m) => m.type === 'text').map((m) => m.text).join('\n') || null,
    JSON.stringify({ messages: t.n.messages, quickReplies: t.n.quickReplies, handoff: t.n.handoff, degraded: t.degraded, upstream: t.upstream }),
    t.source, t.ruleId, t.latencyMs, slugsOf(t.n.messages), t.matched]);

  const utm = msg.page.utm;
  const answeredRules = t.matched && (t.source === 'rules' || t.source === 'fallback') ? 1 : 0;
  const answeredN8n = t.matched && t.source === 'n8n' ? 1 : 0;
  const unmatched = !t.matched && (t.source === 'rules' || t.source === 'fallback' || t.source === 'n8n') ? 1 : 0;
  const degraded = t.degraded || t.upstream ? 1 : 0;
  await sql.query(
    `INSERT INTO chat_sessions (session_id, visitor_id, locale, entry_path, last_path, utm_source, utm_medium, utm_campaign,
       user_messages, bot_messages, images, answered_rules, answered_n8n, unmatched, degraded, handoff)
     VALUES ($1, $2, $3, $4, $4, $5, $6, $7, 1, 1, $8, $9, $10, $11, $12, $13)
     ON CONFLICT (session_id) DO UPDATE SET
       last_at = now(), last_path = EXCLUDED.last_path,
       utm_source = COALESCE(chat_sessions.utm_source, EXCLUDED.utm_source),
       utm_medium = COALESCE(chat_sessions.utm_medium, EXCLUDED.utm_medium),
       utm_campaign = COALESCE(chat_sessions.utm_campaign, EXCLUDED.utm_campaign),
       user_messages = chat_sessions.user_messages + 1, bot_messages = chat_sessions.bot_messages + 1,
       images = chat_sessions.images + EXCLUDED.images,
       answered_rules = chat_sessions.answered_rules + EXCLUDED.answered_rules,
       answered_n8n = chat_sessions.answered_n8n + EXCLUDED.answered_n8n,
       unmatched = chat_sessions.unmatched + EXCLUDED.unmatched,
       degraded = chat_sessions.degraded + EXCLUDED.degraded,
       handoff = chat_sessions.handoff OR EXCLUDED.handoff
     WHERE chat_sessions.visitor_id = EXCLUDED.visitor_id`,
    [msg.sessionId, t.visitorId, msg.locale, msg.page.path, utm.source ?? null, utm.medium ?? null, utm.campaign ?? null,
      msg.images.length, answeredRules, answeredN8n, unmatched, degraded, t.n.handoff]);

  if (Date.now() - lastPurge > 3600_000) {
    lastPurge = Date.now();
    /* Chữ hội thoại: giữ retentionDays (mặc định 90). Phiên + sự kiện không chứa chữ: giữ lâu hơn. */
    await sql.query(`DELETE FROM chat_messages WHERE created_at < now() - ($1 || ' days')::interval`, [String(s.retentionDays)]);
    await sql.query(`DELETE FROM chat_sessions WHERE last_at < now() - ($1 || ' days')::interval`, [String(s.sessionRetentionDays)]);
    await sql.query(`DELETE FROM chat_events WHERE created_at < now() - ($1 || ' days')::interval`, [String(s.sessionRetentionDays)]);
  }
}
export const _resetPurge = () => { lastPurge = 0; };

// ----------------------------------------------------------------- handler
function visitor(request: Request, env: ChatEnv) {
  let visitorId = cookie(request, VID_COOKIE) ?? '';
  const setCookie: Record<string, string> = {};
  if (!VID.test(visitorId)) {
    visitorId = newVisitorId();
    setCookie['set-cookie'] = `${VID_COOKIE}=${visitorId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${env.COOKIE_SECURE === '0' ? '' : '; Secure'}`;
  }
  return { visitorId, setCookie };
}

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
  const t0 = Date.now();

  /* Định danh khách: cookie HttpOnly do máy chủ cấp (trang không đọc được, không
     ai giả được bằng JS); ipHash chỉ là tín hiệu phụ — một IP 4G có thể là hàng
     nghìn khách (CGNAT), một khách đổi IP liên tục giữa 4G và wifi. */
  const { visitorId, setCookie } = visitor(request, env);
  const ip = request.headers.get('cf-connecting-ip');
  const ipHash = ip && env.IP_SALT ? hashIp(ip, env.IP_SALT) : null;
  const s = await getChatSettings(sql, env);
  const catalog = loadCatalog(root);
  const ownHosts = [new URL(request.url).host, ...(env.PUBLIC_SITE_URL ? [new URL(env.PUBLIC_SITE_URL).host] : [])];
  const finish = async (t: Omit<Turn, 'msg' | 'visitorId' | 'ipHash' | 'latencyMs'>, status = 200) => {
    if (t.n.handoff && !t.n.messages.some((m) => m.type === 'link' && /^tel:/.test(m.url))) t.n.messages.push(...contactLinks(catalog, msg.locale));
    if (t.n.dropped) console.warn('chat_reply_dropped_blocks', t.n.dropped);
    await store(sql, s, { ...t, msg, visitorId, ipHash, latencyMs: Date.now() - t0 })
      .catch((e) => console.error('chat_store_failed', (e as Error).message.slice(0, 160)));
    return json({ ok: true, version: CHAT_VERSION, sessionId: msg.sessionId, messages: t.n.messages, quickReplies: t.n.quickReplies,
      handoff: t.n.handoff, ...(t.degraded ? { degraded: t.degraded } : {}) }, status, setCookie);
  };
  const canned = (text: string): Normalized => ({ messages: [{ type: 'text', text }, ...contactLinks(catalog, msg.locale)], quickReplies: [], handoff: true, dropped: 0 });

  if (await rateLimited(sql, `chat:v:${visitorId}`, s.rateMax) || (ipHash && await rateLimited(sql, `chat:ip:${ipHash}`, s.rateMax))) {
    return finish({ n: canned(T[msg.locale].limited), source: 'rate_limited', ruleId: null, matched: false, degraded: 'rate_limited' }, 429);
  }
  if (s.mode === 'off') return finish({ n: canned(T[msg.locale].off), source: 'off', ruleId: null, matched: false, degraded: 'off' });

  let degraded: string | undefined;
  if (s.mode === 'n8n') {
    try {
      const rawReply = await callN8n(s, n8nRequest(msg, visitorId, ipHash, catalog), fetchImpl);
      const n = normalizeResponse(rawReply, catalog, msg.locale, ownHosts);
      /* n8n tự báo "không hiểu câu này" bằng "matched": false — để lọc câu hỏi chưa trả lời được. */
      if (n.messages.length) return finish({ n, source: 'n8n', ruleId: null, matched: rawReply?.matched !== false });
      degraded = 'empty_reply';
    } catch (e) {
      console.error('chat_upstream_failed', (e as Error).message.slice(0, 160));
      degraded = 'upstream';
    }
    if (!s.rulesFallback) return finish({ n: canned(T[msg.locale].busy), source: 'error', ruleId: null, matched: false, degraded });
  }

  const ans = await answerByRules(sql, msg, catalog).catch((e) => { console.error('chat_rules_failed', (e as Error).message.slice(0, 160)); return null; });
  const n = ans ? normalizeResponse(ans.raw, catalog, msg.locale, ownHosts) : null;
  if (!ans || !n?.messages.length) {
    return finish({ n: canned(T[msg.locale].busy), source: 'error', ruleId: null, matched: false, degraded: degraded ?? 'no_rule' });
  }
  recordHit(sql, ans.rule.id).catch(() => {});
  /* Khách vẫn nhận câu trả lời thật nên không gửi "degraded" về trang; lý do n8n lỗi
     vẫn được ghi (chat_messages.payload.upstream + chat_sessions.degraded). */
  return finish({ n, source: s.mode === 'n8n' ? 'fallback' : 'rules', ruleId: ans.rule.id, matched: !ans.fallback, upstream: degraded });
}

// ----------------------------------------------------------------- sự kiện trong khung chat
const EVENT_TYPES = new Set(['open', 'product_click', 'order_click', 'link_click']);
/** POST /api/chat/event — navigator.sendBeacon (text/plain JSON). Luôn trả 204: đo lường không được làm phiền khách. */
export async function chatEventHandler(request: Request, sql: Sql, env: ChatEnv): Promise<Response> {
  const none = new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
  if (request.method !== 'POST') return json({ ok: false, error: 'method' }, 405, { allow: 'POST' });
  const origin = request.headers.get('origin');
  if (env.ALLOWED_ORIGIN && origin && origin !== env.ALLOWED_ORIGIN) return none;
  const visitorId = cookie(request, VID_COOKIE) ?? '';
  if (!VID.test(visitorId)) return none;  /* chưa từng nhắn = chưa có cookie: không có gì để gắn vào */
  const raw = await request.text();
  if (raw.length > 2048) return none;
  let b: any; try { b = JSON.parse(raw); } catch { return none; }
  if (!EVENT_TYPES.has(b?.type) || !UUID.test(String(b?.sessionId ?? ''))) return none;
  if (await rateLimited(sql, `chatev:v:${visitorId}`, 200)) return none;
  const slug = /^[a-z0-9-]{1,80}$/.test(String(b.slug ?? '')) ? b.slug : null;
  await sql.query('INSERT INTO chat_events (session_id, visitor_id, type, slug, value) VALUES ($1, $2, $3, $4, $5)',
    [b.sessionId, visitorId, b.type, slug, str(b.value, 300) || null]);
  const col = b.type === 'product_click' ? 'product_clicks' : b.type === 'order_click' ? 'order_clicks' : null;
  if (col) await sql.query(`UPDATE chat_sessions SET ${col} = ${col} + 1 WHERE session_id = $1 AND visitor_id = $2`, [b.sessionId, visitorId]);
  return none;
}

/** Sau khi /api/orders nhận đơn: khách này có chat trong 7 ngày qua thì ghi chuyển đổi. */
export async function linkOrderToChat(sql: Sql, request: Request, orderCode: string) {
  const visitorId = cookie(request, VID_COOKIE) ?? '';
  if (!VID.test(visitorId) || !orderCode) return;
  const s = (await sql.query<{ session_id: string }>(
    `SELECT session_id FROM chat_sessions WHERE visitor_id = $1 AND last_at > now() - interval '7 days' ORDER BY last_at DESC LIMIT 1`, [visitorId])).rows[0];
  if (!s) return;
  await sql.query('INSERT INTO chat_events (session_id, visitor_id, type, value) VALUES ($1, $2, $3, $4)', [s.session_id, visitorId, 'order_placed', orderCode]);
  await sql.query('UPDATE chat_sessions SET order_code = COALESCE(order_code, $2) WHERE session_id = $1', [s.session_id, orderCode]);
}
