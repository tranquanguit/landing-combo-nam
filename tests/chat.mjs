/**
 * Bộ thử chat: POST /api/chat <-> n8n (giả), trên Postgres thật (PGlite).
 *
 * Kiểm cả hai chiều của chuẩn JSON (docs/chat/*.schema.json), định danh khách,
 * và — quan trọng nhất — rằng phản hồi của n8n KHÔNG được tin: link javascript:,
 * ảnh miền khác, slug bịa, giá bịa đều không lọt ra trang.
 *
 *   node --import ./scripts/shim/register.mjs tests/chat.mjs   (cần dist/ đã build)
 */
import { createHmac } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { connect, migrate } from '../server/lib/db.ts';
import { createApp } from '../server/app.ts';

const ROOT = process.cwd();
if (!existsSync(join(ROOT, 'dist/chat-catalog.json'))) { console.error('Chưa build: thiếu dist/chat-catalog.json'); process.exit(1); }
const catalog = JSON.parse(readFileSync(join(ROOT, 'dist/chat-catalog.json'), 'utf8'));
const combo = catalog.products.find((p) => p.slug === 'combo-nam' && p.locale === 'vi');

let pass = 0; const fail = [];
const ok = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ĐẠT  ${name.padEnd(60)} ${detail}`); }
  else { fail.push(name); console.log(`  LỖI  ${name.padEnd(60)} ${detail}`); }
};

const sql = await connect('pglite:memory');
await migrate(sql, join(ROOT, 'db/pg'));
const SECRET = 'khoa-chung-thu-nghiem';
let lastCall = null; let n8nReply = null; let n8nMode = 'ok';
const fakeFetch = async (url, init) => {
  lastCall = { url, headers: init.headers, body: JSON.parse(init.body) };
  if (n8nMode === 'down') throw new Error('ECONNREFUSED');
  if (n8nMode === '500') return new Response('boom', { status: 500 });
  return new Response(JSON.stringify(n8nReply), { status: 200, headers: { 'content-type': 'application/json' } });
};
const env = { N8N_WEBHOOK_URL: 'https://n8n.test/webhook/mocha-chat', N8N_SHARED_SECRET: SECRET, IP_SALT: 'muoi', COOKIE_SECURE: '0', CHAT_RATE_MAX: '20' };
const app = createApp({ sql, root: ROOT, env, fetch: fakeFetch });
const H = 'http://mocha.test';
const uuid = () => crypto.randomUUID();
const SESSION = uuid();
let jar = '';
const chat = async (body, { ip = '203.0.113.7', cookie = jar } = {}) => {
  const r = await app(new Request(`${H}/api/chat`, {
    method: 'POST', body: JSON.stringify({ messageId: uuid(), sessionId: SESSION, locale: 'vi', page: { path: '/combo-nam/', title: 'Combo' }, ...body }),
    headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip, ...(cookie ? { cookie } : {}) },
  }));
  const sc = r.headers.get('set-cookie'); if (sc) jar = sc.split(';')[0];
  return { r, j: await r.json() };
};
// ảnh JPEG nhỏ thật (FF D8 ...)
const JPEG = Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==', 'base64');

// ---------------------------------------------------------------- 1. yêu cầu gửi n8n đúng chuẩn
n8nReply = { version: '1.0', messages: [{ type: 'text', text: 'Chào bạn' }] };
let { r, j } = await chat({ text: 'Da tôi bị nám', images: [{ mime: 'image/jpeg', base64: JPEG.toString('base64'), bytes: JPEG.length }], page: { path: '/combo-nam/', utm: { source: 'fb' } } });
const req = lastCall.body;
ok('trả 200 + tin nhắn', r.status === 200 && j.messages?.[0]?.text === 'Chào bạn');
ok('gửi n8n: version, event, sessionId, messageId', req.version === '1.0' && req.event === 'message' && req.sessionId === SESSION && /^[0-9a-f-]{36}$/.test(req.messageId));
ok('gửi n8n: visitorId do máy chủ cấp', /^v_[A-Za-z0-9_-]{22}$/.test(req.visitorId), req.visitorId);
ok('gửi n8n: ipHash 16 hex, KHÔNG có IP thô', /^[0-9a-f]{16}$/.test(req.ipHash) && !JSON.stringify(req).includes('203.0.113.7'), req.ipHash);
ok('gửi n8n: sản phẩm của trang đang xem', req.page.product?.slug === 'combo-nam' && req.page.product.price === combo.price, req.page.product?.priceText);
ok('gửi n8n: ảnh base64 + mime + bytes', req.message.images?.[0]?.mime === 'image/jpeg' && req.message.images[0].bytes === JPEG.length);
ok('gửi n8n: utm', req.page.utm?.source === 'fb');
const sig = 'sha256=' + createHmac('sha256', SECRET).update(`${lastCall.headers['x-mocha-timestamp']}.${JSON.stringify(req)}`).digest('hex');
ok('header: X-Mocha-Token + chữ ký HMAC kiểm được', lastCall.headers['x-mocha-token'] === SECRET && lastCall.headers['x-mocha-signature'] === sig);
ok('cookie khách: HttpOnly, SameSite=Lax, 1 năm', /HttpOnly/.test(r.headers.get('set-cookie')) && /SameSite=Lax/.test(r.headers.get('set-cookie')) && /Max-Age=31536000/.test(r.headers.get('set-cookie')));
const vid1 = req.visitorId;
({ r } = await chat({ text: 'lần hai', history: [{ role: 'user', text: 'Da tôi bị nám' }, { role: 'bot', text: 'Chào bạn' }] }));
ok('lần sau: cùng visitorId (đọc cookie), không cấp lại', lastCall.body.visitorId === vid1 && !r.headers.get('set-cookie'));
ok('lịch sử hội thoại chuyển sang n8n', lastCall.body.history?.length === 2);
await chat({ text: 'khách khác' }, { cookie: '' });
ok('trình duyệt khác -> visitorId khác', lastCall.body.visitorId !== vid1);
jar = `mocha_vid=${vid1}`;

// ---------------------------------------------------------------- 2. phản hồi n8n được chuẩn hoá, không được tin
n8nReply = [{ version: '1.0', handoff: true, messages: [
  { type: 'text', text: '<img src=x onerror=alert(1)> **đậm**' },
  { type: 'product', slug: 'combo-nam', note: 'phù hợp', price: 1 },
  { type: 'product', slug: 'san-pham-bia' },
  { type: 'products', slugs: ['smart-brightening-cream', 'khong-co', 'smart-first-care-serum'] },
  { type: 'image', url: 'https://evil.example/x.png' },
  { type: 'image', url: combo.image, alt: 'combo' },
  { type: 'link', label: 'Bấm', url: 'javascript:alert(1)' },
  { type: 'link', label: 'Zalo', url: 'https://zalo.me/0367848918' },
  { type: 'video', url: '/x.mp4' },
], quickReplies: [{ label: 'Giá?', payload: 'price' }, { label: '' }] }];
({ r, j } = await chat({ text: 'gợi ý giúp' }));
const types = j.messages.map((m) => m.type).join(',');
ok('phản hồi bọc trong mảng [ {...} ] vẫn đọc được', r.status === 200 && j.messages.length > 0);
ok('chữ giữ nguyên văn (giao diện hiện bằng textContent)', j.messages[0].text.startsWith('<img src=x'));
ok('thẻ sản phẩm: tên/giá/link lấy từ catalog, bỏ giá bịa', j.messages[1].product?.priceText === combo.priceText && j.messages[1].product.url === '/combo-nam/' && !('price' in j.messages[1].product));
ok('slug bịa bị bỏ (khối product + 1 slug trong products)', !JSON.stringify(j).includes('san-pham-bia') && j.messages.find((m) => m.type === 'products')?.products.length === 2);
ok('ảnh miền khác bị bỏ, ảnh cùng miền giữ', !JSON.stringify(j).includes('evil.example') && j.messages.some((m) => m.type === 'image' && m.url === combo.image));
ok('link javascript: bị bỏ, https giữ', !JSON.stringify(j).includes('javascript:') && j.messages.some((m) => m.type === 'link' && m.label === 'Zalo'));
ok('khối không có trong chuẩn (video) bị bỏ', !types.includes('video'), types);
ok('handoff = true -> tự thêm nút gọi hotline', j.handoff === true && j.messages.some((m) => m.type === 'link' && /^tel:/.test(m.url)));
ok('quickReplies: nút rỗng bị bỏ', j.quickReplies.length === 1 && j.quickReplies[0].payload === 'price');

// ---------------------------------------------------------------- 3. n8n hỏng / chưa cấu hình
n8nMode = 'down'; ({ r, j } = await chat({ text: 'alo' }));
ok('n8n không kết nối được -> 200 + xin lỗi + hotline/Zalo', r.status === 200 && j.degraded === 'upstream' && j.messages.some((m) => /^tel:/.test(m.url ?? '')));
n8nMode = '500'; ({ j } = await chat({ text: 'alo' }));
ok('n8n trả 500 -> cùng cách xử lý', j.degraded === 'upstream');
n8nMode = 'ok'; n8nReply = { version: '1.0', messages: [{ type: 'link', label: 'x', url: 'javascript:void(0)' }] };
({ j } = await chat({ text: 'alo' }));
ok('n8n trả toàn khối hỏng -> không để khách trống tay', j.degraded === 'empty_reply' && j.messages.length > 0);
const off = createApp({ sql, root: ROOT, env: { IP_SALT: 'muoi' } });
const ro = await off(new Request(`${H}/api/chat`, { method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ messageId: uuid(), sessionId: uuid(), locale: 'vi', text: 'hi', page: { path: '/' } }) }));
const jo = await ro.json();
ok('chưa cấu hình N8N_WEBHOOK_URL -> "tạm nghỉ" + liên hệ', ro.status === 200 && jo.degraded === 'not_configured');

// ---------------------------------------------------------------- 4. kiểm tra đầu vào
const bad = async (body) => (await chat(body)).r.status;
ok('ảnh giả (không phải JPEG) -> 422', await bad({ text: 'x', images: [{ mime: 'image/jpeg', base64: Buffer.from('<svg onload=alert(1)>').toString('base64'), bytes: 20 }] }) === 422);
ok('quá 3 ảnh -> 422', await bad({ text: 'x', images: Array(4).fill({ mime: 'image/jpeg', base64: JPEG.toString('base64'), bytes: JPEG.length }) }) === 422);
ok('sessionId sai dạng -> 422', await bad({ sessionId: 'abc', text: 'x' }) === 422);
ok('tin rỗng -> 422', await bad({ text: '   ' }) === 422);
const rg = await app(new Request(`${H}/api/chat`));
ok('GET -> 405', rg.status === 405);

// ---------------------------------------------------------------- 5. lưu + giới hạn nhịp
const stored = (await sql.query('SELECT role, text, payload FROM chat_messages')).rows;
ok('lưu cả lượt khách và lượt bot', stored.some((x) => x.role === 'user') && stored.some((x) => x.role === 'bot'), `${stored.length} dòng`);
ok('KHÔNG lưu ảnh (chỉ số ảnh)', !JSON.stringify(stored).includes(JPEG.toString('base64').slice(0, 40)) && stored.some((x) => x.payload?.images === 1));
ok('KHÔNG lưu IP thô', !JSON.stringify((await sql.query('SELECT * FROM chat_messages')).rows).includes('203.0.113.7'));
let limited = 0;
for (let i = 0; i < 25; i++) { const x = await chat({ text: `spam ${i}` }, { ip: '198.51.100.20', cookie: '' }); if (x.r.status === 429) limited++; }
ok('gửi dồn dập theo IP bị chặn (429, kèm hotline)', limited > 0, `${limited}/25`);

await sql.close();
console.log(`\n${pass}/${pass + fail.length} phép thử đạt.`);
process.exit(fail.length ? 1 : 0);
