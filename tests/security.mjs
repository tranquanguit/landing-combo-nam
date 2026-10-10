/**
 * Bộ thử các bản vá bảo mật của lần rà soát trước khi lên production (10/2026).
 * Mỗi phép thử là một kịch bản tấn công cụ thể đã được chứng minh trên mã cũ.
 *
 *   node --import ./scripts/shim/register.mjs tests/security.mjs   (cần dist/ đã build)
 */
import { join } from 'node:path';
import { connect, migrate } from '../server/lib/db.ts';
import { createUser, login } from '../server/lib/auth.ts';
import { createApp } from '../server/app.ts';
import { clientKey, limited, purgeRateLimit } from '../server/lib/rate-limit.ts';
import { callN8n } from '../server/lib/chat.ts';
import { defaults } from '../server/lib/chat-settings.ts';
import { makeOrderCode } from '../functions/_lib/orders.ts';

const ROOT = process.cwd();
let pass = 0; const fail = [];
const ok = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ĐẠT  ${name.padEnd(64)} ${detail}`); }
  else { fail.push(name); console.log(`  LỖI  ${name.padEnd(64)} ${detail}`); }
};
const sql = await connect('pglite:memory');
await migrate(sql, join(ROOT, 'db/pg'));
const H = 'http://mocha.test';
const env = { IP_SALT: 'muoi', COOKIE_SECURE: '0', CHAT_RATE_MAX: '5', ADMIN_TOKEN: 'token-bao-mat-du-dai-24-ky-tu-xx' };
const app = createApp({ sql, root: ROOT, env });
const form = (o) => new URLSearchParams(o).toString();
const count = async (t) => (await sql.query(`SELECT count(*)::int AS n FROM ${t}`)).rows[0].n;

// ---------------------------------------------------------------- 1. lấp đầy ổ đĩa qua chat
{
  const send = (cookie = '') => app(new Request(`${H}/api/chat`, { method: 'POST',
    headers: { 'content-type': 'application/json', 'cf-connecting-ip': '198.51.100.9', ...(cookie ? { cookie } : {}) },
    body: JSON.stringify({ messageId: crypto.randomUUID(), sessionId: crypto.randomUUID(), locale: 'vi', text: 'x'.repeat(1500), page: { path: '/' } }) }));
  const before = await count('chat_messages');
  let blocked = 0;
  for (let i = 0; i < 40; i++) if ((await send()).status === 429) blocked++;
  const added = await count('chat_messages') - before;
  ok('chat: gửi dồn không cookie bị chặn theo IP', blocked >= 30, `${blocked}/40 bị chặn`);
  ok('chat: yêu cầu bị chặn KHÔNG ghi gì vào CSDL', added === 5 * 2, `${added} dòng (chỉ 5 lượt được trả lời)`);
  ok('chat: bị chặn vẫn trả lời khách + hotline', (await (await send()).json()).messages?.length > 0);

  const ev = (vid) => app(new Request(`${H}/api/chat/event`, { method: 'POST',
    headers: { 'content-type': 'text/plain', 'cf-connecting-ip': '198.51.100.10', cookie: `mocha_vid=${vid}` },
    body: JSON.stringify({ sessionId: crypto.randomUUID(), type: 'open' }) }));
  const e0 = await count('chat_events');
  for (let i = 0; i < 320; i++) await ev('v_' + String(i).padStart(22, 'a'));
  ok('sự kiện chat: cookie tự đặt + đổi liên tục vẫn bị giới hạn theo IP', await count('chat_events') - e0 === 300, `${await count('chat_events') - e0} dòng`);
}

// ---------------------------------------------------------------- 2. giới hạn nhịp nguyên tử + dọn bảng
{
  const res = await Promise.all(Array.from({ length: 20 }, () => limited(sql, 'race:1', 5, 60_000)));
  ok('giới hạn nhịp: 20 yêu cầu song song chỉ 5 lọt', res.filter((x) => !x).length === 5, `${res.filter((x) => !x).length} lọt`);
  await sql.query("UPDATE rate_limit SET window_at = '2000-01-01T00:00:00.000Z' WHERE key = 'race:1'");
  ok('giới hạn nhịp: hết cửa sổ thì đếm lại', !(await limited(sql, 'race:1', 5, 60_000)));
  await sql.query("INSERT INTO rate_limit (key, count, window_at) VALUES ('cu', 1, '2000-01-01T00:00:00.000Z')");
  await purgeRateLimit(sql);
  ok('bảng rate_limit được dọn khoá hết hạn', !(await sql.query("SELECT 1 FROM rate_limit WHERE key = 'cu'")).rows.length);
  ok('IPv6 gom theo /64, IPv4 giữ nguyên', clientKey('2001:db8:abcd:12:1:2:3:4') === '2001:db8:abcd:12::/64'
    && clientKey('2001:db8::1') === '2001:db8:0:0::/64' && clientKey('::ffff:203.0.113.5') === '203.0.113.5' && clientKey('203.0.113.5') === '203.0.113.5',
    clientKey('2001:db8::1'));
}

// ---------------------------------------------------------------- 3. dò mật khẩu quản trị
{
  await createUser(sql, 'quan-tri', 'mat-khau-dung-0123', 'admin');
  const attempt = (pw, ip = '203.0.113.50', user = 'quan-tri') => app(new Request(`${H}/admin/login`, { method: 'POST', body: form({ username: user, password: pw }),
    headers: { 'content-type': 'application/x-www-form-urlencoded', origin: H, 'cf-connecting-ip': ip } }));
  const codes = [];
  for (let i = 0; i < 12; i++) codes.push((await attempt('sai-' + i)).status);
  ok('đăng nhập: quá 10 lần / IP / 15 phút -> 429', codes.slice(0, 10).every((c) => c === 401) && codes.slice(10).every((c) => c === 429), codes.join(','));
  ok('đăng nhập: bị khoá thì mật khẩu đúng cũng không vào (không lộ đúng/sai)', (await attempt('mat-khau-dung-0123')).status === 429);
  const r = [];
  for (let i = 0; i < 10; i++) r.push((await attempt('sai', `203.0.113.${100 + i}`)).status);
  ok('đăng nhập: đổi IP liên tục vẫn bị khoá theo tên (20 lần)', r.includes(429), r.join(','));
}

// ---------------------------------------------------------------- 4. script bên thứ ba trên cùng tên miền
{
  await createUser(sql, 'bien-tap', 'mat-khau-bien-tap-01', 'editor');
  const lr = await app(new Request(`${H}/admin/login`, { method: 'POST', body: form({ username: 'bien-tap', password: 'mat-khau-bien-tap-01' }),
    headers: { 'content-type': 'application/x-www-form-urlencoded', origin: H, 'cf-connecting-ip': '192.0.2.77' } }));
  const ck = lr.headers.get('set-cookie').split(';')[0];
  const get = (path, mode) => app(new Request(`${H}${path}`, { headers: { cookie: ck, ...(mode ? { 'sec-fetch-site': 'same-origin', 'sec-fetch-mode': mode } : {}) } }));
  ok('fetch() từ script (sec-fetch-mode: cors) không đọc được đơn hàng', (await get('/admin/orders', 'cors')).status === 403);
  ok('fetch() same-origin cũng bị chặn', (await get('/admin/orders', 'same-origin')).status === 403);
  ok('trình duyệt mở trang bình thường (navigate) vẫn vào được', (await get('/admin/orders', 'navigate')).status === 200);
  ok('công cụ không phải trình duyệt (fetch của Node, curl) vẫn dùng được', (await app(new Request(`${H}/admin/orders`, { headers: { cookie: ck, 'sec-fetch-mode': 'cors' } }))).status === 200);
  const r = await get('/admin/', 'navigate');
  ok('trang quản trị: COOP same-origin + không cho nhúng', r.headers.get('cross-origin-opener-policy') === 'same-origin' && r.headers.get('x-frame-options') === 'DENY');

  const split = createApp({ sql, root: ROOT, env: { ...env, ADMIN_HOST: 'admin.mocha.test' } });
  ok('ADMIN_HOST: /admin trên tên miền chính -> 404', (await split(new Request(`${H}/admin/login`))).status === 404);
  ok('ADMIN_HOST: /admin trên tên miền con -> mở được', (await split(new Request('http://admin.mocha.test/admin/login'))).status === 200);
  const home = await split(new Request('http://admin.mocha.test/combo-nam/'));
  ok('ADMIN_HOST: trang khác trên tên miền con -> về /admin/', home.status === 302 && home.headers.get('location') === '/admin/');
}

// ---------------------------------------------------------------- 5. đổi mật khẩu thu hồi phiên
{
  const t = await login(sql, 'bien-tap', 'mat-khau-bien-tap-01');
  await createUser(sql, 'bien-tap', 'mat-khau-moi-0123456', 'editor');
  const r = await app(new Request(`${H}/admin/`, { headers: { cookie: `mocha_admin=${encodeURIComponent(t)}` } }));
  ok('đổi mật khẩu -> phiên cũ phải đăng nhập lại', r.status === 303 && r.headers.get('location') === '/admin/login');
}

// ---------------------------------------------------------------- 6. chuyển hướng mở + SSRF qua chuyển hướng
{
  const r = await app(new Request(`${H}//evil.example/x`));
  ok('"//evil.example/x" không chuyển hướng sang tên miền khác', r.status === 308 && r.headers.get('location') === '/evil.example/x/', r.headers.get('location'));
  const s = { ...defaults({}), mode: 'n8n', webhookUrl: 'https://n8n.test/w' };
  let opts = null;
  const redirecting = async (_u, init) => { opts = init; return new Response(null, { status: 302, headers: { location: 'http://169.254.169.254/' } }); };
  const err = await callN8n(s, { x: 1 }, redirecting).then(() => null, (e) => e.message);
  ok('gọi n8n không theo chuyển hướng (SSRF)', opts?.redirect === 'manual' && /chuyển hướng/.test(err ?? ''), err ?? '');
}

// ---------------------------------------------------------------- 7. mã đơn theo giờ Việt Nam
ok('mã đơn lúc 01:00 sáng giờ VN mang ngày VN', makeOrderCode(new Date('2026-10-04T18:30:00Z'), () => 0).startsWith('MC-261005-'),
  makeOrderCode(new Date('2026-10-04T18:30:00Z'), () => 0));

await sql.close();
console.log(`\n${pass}/${pass + fail.length} phép thử đạt.`);
process.exit(fail.length ? 1 : 0);
