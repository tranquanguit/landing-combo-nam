/**
 * Bộ thử máy chủ Docker trên Postgres THẬT (PGlite = Postgres biên dịch sang
 * WASM: cùng parser, cùng kiểu, cùng ràng buộc). Không cần cài Postgres, không
 * mở cổng mạng: gọi thẳng createApp(Request) -> Response.
 *
 * Chạy: node --import ./scripts/shim/register.mjs tests/server-pg.mjs
 */
import { rmSync, readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { connect, migrate, toDollar } from '../server/lib/db.ts';
import { importFromFiles, exportToFiles, validate } from '../server/lib/content.ts';
import { createUser } from '../server/lib/auth.ts';
import { createApp } from '../server/app.ts';

const ROOT = process.cwd();
let pass = 0; const fail = [];
const ok = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ĐẠT  ${name.padEnd(58)} ${detail}`); }
  else { fail.push(`${name} — ${detail}`); console.log(`  LỖI  ${name.padEnd(58)} ${detail}`); }
};

const sql = await connect('pglite:memory');
await migrate(sql, join(ROOT, 'db/pg'));
const tables = (await sql.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'")).rows.map((r) => r.table_name);
ok('migration tạo đủ bảng', ['orders', 'rate_limit', 'content_entries', 'content_revisions', 'media', 'admin_users', 'admin_sessions', 'publish_runs'].every((t) => tables.includes(t)), tables.length + ' bảng');
await migrate(sql, join(ROOT, 'db/pg'));
ok('migration chạy lại không lỗi (mỗi file đúng một lần)', true);
ok('đổi tham số ? sang $n', toDollar('a = ? AND b = ?') === 'a = $1 AND b = $2');

const env = { IP_SALT: 'muoi-thu', ADMIN_TOKEN: 'token-thu-nghiem-dai-hon-24-ky-tu-xx' };
const app = createApp({ sql, root: ROOT, env });
const H = 'http://mocha.test';

// ---------------------------------------------------------------- đơn hàng
const order = {
  pack: 'combo', packPrice: 1050000, name: 'Nguyễn Thu Hà', phone: '0912345678', address: '12 Lê Lợi, Quận 1, TP.HCM',
  productSlug: 'combo-nam', locale: 'vi', dataConsent: true, consentText: 'Tôi đồng ý để Mocha lưu và dùng họ tên…',
};
const post = (body, ip = '203.0.113.9') => app(new Request(`${H}/api/orders`, {
  method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json', origin: H, 'cf-connecting-ip': ip },
}));
let r = await post(order); let j = await r.json();
ok('đơn hợp lệ ghi vào Postgres', r.status === 200 && /^MC-/.test(j.orderCode ?? ''), `${r.status} ${j.orderCode}`);
r = await post(order); j = await r.json();
ok('bấm hai lần vẫn là một đơn', j.deduped === true, JSON.stringify(j));
r = await post({ ...order, phone: '123' }); j = await r.json();
ok('số điện thoại sai -> 422, chỉ trả tên trường', r.status === 422 && !JSON.stringify(j).includes('123'), JSON.stringify(j));
r = await post({ ...order, dataConsent: false, phone: '0987654321' });
ok('không đồng ý dữ liệu -> không ghi', r.status !== 200, String(r.status));
const n = (await sql.query('SELECT count(*)::int AS n FROM orders')).rows[0].n;
ok('đúng một đơn trong CSDL', n === 1, `${n} đơn`);
let e = null;
try { await sql.query("INSERT INTO orders (order_code, created_at, product_slug, locale, pack, name, phone, data_consent, consent_text) VALUES ('X','t','p','vi','x','n','0',0,'c')"); } catch (x) { e = x; }
ok('CSDL tự chặn đơn data_consent = 0', !!e, e ? 'ràng buộc CHECK còn hiệu lực' : 'KHÔNG chặn');
for (let i = 0; i < 9; i++) await post({ ...order, phone: `09000000${10 + i}` }, '198.51.100.7');
r = await post({ ...order, phone: '0900000099' }, '198.51.100.7');
ok('chống spam theo IP đã băm', r.status === 429, String(r.status));
r = await app(new Request(`${H}/api/admin/orders`));
ok('API đơn hàng không có token -> 401', r.status === 401, String(r.status));
r = await app(new Request(`${H}/api/admin/orders`, { headers: { authorization: `Bearer ${env.ADMIN_TOKEN}` } }));
ok('API đơn hàng có token -> đọc được', r.status === 200, String(r.status));

// ---------------------------------------------------------------- nội dung
const imp = await importFromFiles(sql, ROOT, 'test');
ok('nạp nội dung repo vào CSDL', imp.entries > 40 && imp.media > 10, `${imp.entries} nội dung, ${imp.media} ảnh`);
const OUT = join(ROOT, '.tmp', 'export');
rmSync(OUT, { recursive: true, force: true });
await exportToFiles(sql, OUT);
const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((x) => x.isDirectory() ? walk(join(d, x.name)) : [join(d, x.name)]);
const files = walk(join(OUT, 'src'));
const diff = files.filter((f) => !readFileSync(f).equals(readFileSync(join(ROOT, f.slice(OUT.length)))));
ok('nhập rồi xuất = y nguyên từng byte', diff.length === 0, `${files.length} file, ${diff.length} khác`);
rmSync(join(ROOT, '.tmp'), { recursive: true, force: true });
const combo = JSON.parse(readFileSync(join(ROOT, 'src/content/products/combo-nam/vi.json'), 'utf8'));
ok('schema chấp nhận nội dung thật', (await validate(ROOT, 'products', combo)).length === 0);
const bad = structuredClone(combo); bad.blocks[0].lead = 'Chỉ còn 990k! ' + bad.blocks[0].lead;
const issues = await validate(ROOT, 'products', bad);
ok('schema chặn số tiền viết tay (hàng rào của build)', issues.some((i) => /990k/.test(i.message)), issues[0]?.message.slice(0, 60));
const typo = structuredClone(combo); typo.shortNmae = 'x';
ok('tên trường gõ sai -> thông báo tiếng Việt', (await validate(ROOT, 'products', typo)).some((i) => /gõ sai tên trường/.test(i.message)));

// ---------------------------------------------------------------- quản trị
r = await app(new Request(`${H}/admin/`));
ok('chưa đăng nhập -> về trang đăng nhập', r.status === 303 && r.headers.get('location') === '/admin/login');
await createUser(sql, 'bien-tap', 'mat-khau-bien-tap-01', 'editor');
const form = (o) => new URLSearchParams(o);
r = await app(new Request(`${H}/admin/login`, { method: 'POST', body: form({ username: 'bien-tap', password: 'mat-khau-bien-tap-01' }), headers: { 'content-type': 'application/x-www-form-urlencoded' } }));
ok('POST thiếu Origin bị chặn (CSRF)', r.status === 403, String(r.status));
r = await app(new Request(`${H}/admin/login`, { method: 'POST', body: form({ username: 'bien-tap', password: 'sai' }), headers: { 'content-type': 'application/x-www-form-urlencoded', origin: H } }));
ok('sai mật khẩu -> 401', r.status === 401, String(r.status));
r = await app(new Request(`${H}/admin/login`, { method: 'POST', body: form({ username: 'bien-tap', password: 'mat-khau-bien-tap-01' }), headers: { 'content-type': 'application/x-www-form-urlencoded', origin: H } }));
const setCookie = r.headers.get('set-cookie') ?? '';
ok('đăng nhập -> cookie HttpOnly SameSite=Strict', r.status === 303 && /HttpOnly/.test(setCookie) && /SameSite=Strict/.test(setCookie), setCookie.split(';').slice(1, 4).join(';'));
const ck = setCookie.split(';')[0];
const stored = (await sql.query('SELECT token_hash FROM admin_sessions')).rows.map((x) => x.token_hash);
ok('CSDL chỉ giữ băm của mã phiên', !stored.some((h) => ck.includes(h)) && stored.every((h) => /^[0-9a-f]{64}$/.test(h)));
const pw = (await sql.query("SELECT password FROM admin_users WHERE username = 'bien-tap'")).rows[0].password;
ok('mật khẩu lưu dạng scrypt, không lưu thô', pw.startsWith('scrypt$') && !pw.includes('mat-khau'));
const admin = (path, init = {}) => app(new Request(`${H}${path}`, { ...init, headers: { cookie: ck, origin: H, ...(init.headers ?? {}) } }));
r = await admin('/admin/');
ok('đăng nhập rồi -> vào tổng quan', r.status === 200 && /Tổng quan/.test(await r.text()));
r = await admin('/admin/');
ok('trang quản trị không cho lưu cache, không cho index', r.headers.get('cache-control') === 'no-store' && /noindex/.test(r.headers.get('x-robots-tag') ?? ''));
const source = readFileSync(join(ROOT, 'src/content/products/combo-nam/vi.json'), 'utf8');
r = await admin('/admin/edit', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: form({ c: 'products', id: 'combo-nam/vi', source: source.replace('"price": 1050000,', '"price": "một triệu",'), action: 'save' }) });
const txt = await r.text();
ok('lưu nội dung sai -> 422, không ghi', r.status === 422 && /Sai kiểu/.test(txt), String(r.status));
const still = (await sql.query("SELECT data->>'price' AS p FROM content_entries WHERE collection = 'products' AND entry_id = 'combo-nam/vi'")).rows[0].p;
ok('CSDL giữ nguyên giá cũ', still === '1050000', still);
r = await admin('/admin/edit', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: form({ c: 'products', id: 'combo-nam/vi', source, 'q:price': '1040000', note: 'thử', action: 'save' }) });
const now = (await sql.query("SELECT data->>'price' AS p FROM content_entries WHERE collection = 'products' AND entry_id = 'combo-nam/vi'")).rows[0].p;
const rev = (await sql.query("SELECT count(*)::int AS n FROM content_revisions WHERE entry_id = 'combo-nam/vi' AND saved_by = 'bien-tap'")).rows[0].n;
ok('lưu hợp lệ qua ô nhanh + ghi lịch sử', now === '1040000' && rev === 1, `giá ${now}, ${rev} bản lịch sử`);
/* Thông tin cửa hàng: một biểu mẫu cho tên/địa chỉ/MST/hotline/…, tổ chức công bố và số công bố. */
const brandFile = JSON.parse(readFileSync(join(ROOT, 'src/data/mocha.json'), 'utf8'));
r = await admin('/admin/store');
const storeHtml = await r.text();
ok('trang Thông tin cửa hàng mở được, hiện giá trị đang dùng', r.status === 200 && storeHtml.includes(brandFile.phoneDisplay) && storeHtml.includes(brandFile.email));
const storeForm = (over = {}) => {
  const f = {
    tradingName: brandFile.tradingName, address: brandFile.address, taxId: brandFile.taxId ?? '', hours: '',
    phoneDisplay: brandFile.phoneDisplay, zalo: brandFile.zalo ?? '', email: brandFile.email, moitNoticeUrl: '',
    'social:Facebook': 'https://www.facebook.com/vi-du', 'social:Instagram': '', 'social:TikTok': '', 'social:YouTube': '',
  };
  brandFile.declarants.forEach((d, i) => Object.assign(f, { [`d:${i}:id`]: d.id, [`d:${i}:label`]: d.label, [`d:${i}:brand`]: d.brand, [`d:${i}:name`]: d.name, [`d:${i}:address`]: d.address }));
  return form({ ...f, ...over });
};
const postStore = (body) => admin('/admin/store', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body });
r = await postStore(storeForm({ email: 'khong-phai-email' }));
const brandNow = async () => (await sql.query("SELECT data FROM content_entries WHERE collection = 'brand' AND entry_id = 'mocha'")).rows[0].data;
ok('Thông tin cửa hàng: email sai -> 422, không ghi', r.status === 422 && (await brandNow()).email === brandFile.email, String(r.status));
const hbIdx = brandFile.declarants.findIndex((d) => d.id === 'hairborn');
r = await postStore(storeForm({
  phoneDisplay: '0900 111 222', [`d:${hbIdx}:name`]: 'Công ty Ví Dụ', [`d:${hbIdx}:address`]: '1 Đường Thử, TP HCM',
  'p:hairborn-peel-ion:declarant': 'hairborn', 'p:hairborn-peel-ion:number': '9999/26/CBMP-TH', note: 'thử',
}));
const bn = await brandNow();
const nums = (await sql.query("SELECT data->'compliance'->>'productNotificationNumber' AS n FROM content_entries WHERE collection = 'products' AND entry_id LIKE 'hairborn-peel-ion/%'")).rows.map((x) => x.n);
ok('Thông tin cửa hàng: lưu hotline (tự suy số +84), tổ chức công bố, số công bố cho cả vi + en',
  r.status === 200 && bn.phone === '+84900111222' && bn.phoneDisplay === '0900 111 222'
  && bn.declarants.find((d) => d.id === 'hairborn').name === 'Công ty Ví Dụ'
  && bn.profiles.some((p) => p.name === 'Facebook' && p.url === 'https://www.facebook.com/vi-du')
  && nums.length === 2 && nums.every((n) => n === '9999/26/CBMP-TH'),
  `${bn.phone} · ${nums.join(', ')}`);
r = await postStore(storeForm({ [`d:${hbIdx}:id`]: '', [`d:${hbIdx}:label`]: '', [`d:${hbIdx}:brand`]: '', [`d:${hbIdx}:name`]: '', [`d:${hbIdx}:address`]: '' }));
ok('Thông tin cửa hàng: không xoá được tổ chức công bố còn sản phẩm dùng', r.status === 422 && /hairborn/.test(await r.text()), String(r.status));

/* Đồng bộ bản code mới (máy chủ tự chạy lúc khởi động) — tình huống deploy 2026-10-11:
   CSDL giữ bản cũ của sản phẩm do máy nạp, Thông tin cửa hàng đã sửa trong trang quản trị
   nhưng thiếu danh sách tổ chức công bố, một lời chứng đã bị xoá, ảnh bìa đã được làm lại. */
{
  const { syncFromFiles } = await import('../server/lib/content.ts');
  const repoUv = readFileSync(join(ROOT, 'src/content/products/uv-block-sunscreen/vi.json'), 'utf8');
  const oldUv = JSON.parse(repoUv); oldUv.blocks = oldUv.blocks.slice(0, 2);
  const oldSrc = JSON.stringify(oldUv, null, 2) + '\n';
  await sql.query("UPDATE content_entries SET data = $1::text::jsonb, source = $1, updated_by = 'seed' WHERE collection = 'products' AND entry_id = 'uv-block-sunscreen/vi'", [oldSrc]);
  const b0 = await brandNow(); delete b0.declarants;
  const b0src = JSON.stringify(b0, null, 2) + '\n';
  await sql.query("UPDATE content_entries SET data = $1::text::jsonb, source = $1, updated_by = 'bien-tap' WHERE collection = 'brand' AND entry_id = 'mocha'", [b0src]);
  await admin('/admin/edit', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: form({ c: 'testimonials', id: 'kcn-01-chi-t', action: 'delete', confirm: '1' }) });
  await sql.query("UPDATE media SET sha256 = 'cu', uploaded_by = 'seed' WHERE path = '/images/hero-uv-block-plus.webp'");
  await sql.query("UPDATE media SET sha256 = 'tu-tai-len', uploaded_by = 'bien-tap' WHERE path = '/images/logo.webp'");

  const rep = await syncFromFiles(sql, ROOT);
  const uvNow = (await sql.query("SELECT source FROM content_entries WHERE collection = 'products' AND entry_id = 'uv-block-sunscreen/vi'")).rows[0].source;
  ok('đồng bộ: mục máy nạp còn bản cũ -> cập nhật theo bản code mới', uvNow === repoUv && rep.updated.includes('products/uv-block-sunscreen/vi'));
  const cnPrice = (await sql.query("SELECT data->>'price' AS p FROM content_entries WHERE collection = 'products' AND entry_id = 'combo-nam/vi'")).rows[0].p;
  ok('đồng bộ: mục nhân viên đã sửa -> giữ nguyên, có tên trong báo cáo', cnPrice === '1040000' && rep.keptEdited.includes('products/combo-nam/vi'), cnPrice);
  const b1 = await brandNow();
  ok('đồng bộ: Thông tin cửa hàng đã sửa -> bổ sung tổ chức công bố, giữ hotline đã sửa',
    rep.merged.includes('brand/mocha') && b1.phoneDisplay === '0900 111 222' && b1.declarants?.some((d) => d.id === 'hairborn'),
    `${b1.phoneDisplay} · ${(b1.declarants ?? []).map((d) => d.id).join(',')}`);
  const tm = (await sql.query("SELECT 1 FROM content_entries WHERE collection = 'testimonials' AND entry_id = 'kcn-01-chi-t'")).rows.length;
  ok('đồng bộ: mục đã xoá trong trang quản trị -> không tự thêm lại', tm === 0);
  const m1 = (await sql.query("SELECT sha256, uploaded_by FROM media WHERE path = '/images/hero-uv-block-plus.webp'")).rows[0];
  const m2 = (await sql.query("SELECT sha256 FROM media WHERE path = '/images/logo.webp'")).rows[0];
  ok('đồng bộ: ảnh máy nạp -> cập nhật; ảnh nhân viên tải lên -> giữ',
    m1.sha256 !== 'cu' && m1.uploaded_by === 'sync' && m2.sha256 === 'tu-tai-len' && rep.mediaKept.includes('/images/logo.webp'));
  const rep2 = await syncFromFiles(sql, ROOT);
  ok('đồng bộ chạy lại lần hai -> không đổi gì', !rep2.added.length && !rep2.updated.length && !rep2.merged.length && !rep2.mediaUpdated,
    JSON.stringify({ a: rep2.added.length, u: rep2.updated.length, m: rep2.merged.length }));
}

/* Mã đo lường quảng cáo (Google Ads cho trang cảm ơn) nhập ở Thông tin cửa hàng. */
{
  r = await postStore(storeForm({ phoneDisplay: '0900 111 222', 't:googleAds': '123456789' }));
  ok('mã đo lường: Google Ads sai dạng -> 422, không ghi', r.status === 422 && !(await brandNow()).tracking, String(r.status));
  r = await postStore(storeForm({ phoneDisplay: '0900 111 222', 't:googleAds': 'AW-123456789', 't:googleAdsOrderLabel': 'AbC-12_xy', 't:ga4': '' }));
  const tr = (await brandNow()).tracking;
  ok('mã đo lường: lưu AW + nhãn chuyển đổi, bỏ ô trống', r.status === 200 && tr?.googleAds === 'AW-123456789' && tr.googleAdsOrderLabel === 'AbC-12_xy' && !('ga4' in tr), JSON.stringify(tr));
}

// ---------------------------------------------------------------- hành trình khách
{
  const { purgeJourney } = await import('../server/lib/journey.ts');
  const V = `j_${'a'.repeat(22)}`, S = `j_${'b'.repeat(22)}`, S2 = `j_${'c'.repeat(22)}`;
  const t0 = Date.now();
  const beacon = (body, headers = {}) => app(new Request(`${H}/api/j`, {
    method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: { 'content-type': 'text/plain', origin: H, 'user-agent': 'Mozilla/5.0 (iPhone)', 'cf-connecting-ip': '203.0.113.50', ...headers },
  }));
  const count = async (sid) => (await sql.query('SELECT count(*)::int AS n FROM journey_events WHERE session_id = $1', [sid])).rows[0].n;
  r = await beacon({ v: V, s: S, m: { l: 'vi', w: 390, ref: 'm.facebook.com', us: 'facebook', uc: 'nam-thang-10', ad: 'facebook', r: 0 }, e: [
    { t: 'page', a: t0 - 60000, p: '/combo-nam/', b: 'Combo Nám' },
    { t: 'section', a: t0 - 30000, p: '/combo-nam/', x: 'thanh-phan', b: 'Thành phần trong bộ', d: 25000 },
    { t: 'click', a: t0 - 20000, p: '/combo-nam/', x: 'order:hero-order', b: 'Đặt mua' },
    { t: 'form_start', a: t0 - 15000, p: '/combo-nam/' },
    { t: 'order', a: t0 - 10000, p: '/combo-nam/', b: 'Combo' },
    { t: 'leave', a: t0 - 9000, p: '/combo-nam/', d: 50000 },
    { t: 'ghi-tuy-y', a: t0, p: '/combo-nam/' },
    { t: 'click', a: t0, p: 'javascript:alert(1)' },
  ] });
  const ss = (await sql.query('SELECT * FROM journey_sessions WHERE session_id = $1', [S])).rows[0];
  ok('hành trình: nhận một lô, bỏ loại lạ và đường dẫn sai', r.status === 204 && (await count(S)) === 6
    && ss.device === 'mobile' && ss.utm_source === 'facebook' && ss.ad_click === 'facebook' && ss.page_views === 1 && Number(ss.active_ms) === 50000,
    `${await count(S)} sự kiện · ${ss?.device} · ${ss?.utm_source}`);
  await beacon({ v: `j_${'z'.repeat(22)}`, s: S, e: [{ t: 'page', a: t0, p: '/ghi-de/' }] });
  ok('hành trình: mã phiên của khách khác -> không ghi vào', (await count(S)) === 6);
  await beacon({ v: V, s: S2, e: [{ t: 'page', a: t0, p: '/' }] }, { 'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)' });
  ok('hành trình: bot -> bỏ', (await count(S2)) === 0);
  r = await beacon(JSON.stringify({ v: V, s: S2, e: [{ t: 'page', a: t0, p: '/', b: 'x'.repeat(40000) }] }));
  ok('hành trình: lô quá 32KB -> bỏ, vẫn 204', r.status === 204 && (await count(S2)) === 0, String(r.status));
  r = await app(new Request(`${H}/api/orders`, { method: 'POST', body: JSON.stringify({ ...order, phone: '0911222333' }),
    headers: { 'content-type': 'application/json', origin: H, 'cf-connecting-ip': '203.0.113.77', cookie: `mocha_js=${S}` } }));
  j = await r.json();
  const linked = (await sql.query('SELECT order_code FROM journey_sessions WHERE session_id = $1', [S])).rows[0].order_code;
  ok('hành trình: đơn gửi kèm cookie mocha_js -> gắn mã đơn vào phiên', !!j.orderCode && linked === j.orderCode, `${j.orderCode} ↔ ${linked}`);

  r = await admin('/admin/journey?days=7'); const jh = await r.text();
  ok('trang Hành trình khách: chỉ số, phễu, khối đọc lâu, nguồn, phiên có đơn',
    r.status === 200 && jh.includes('Phễu đặt hàng') && jh.includes('Thành phần trong bộ') && jh.includes('facebook') && jh.includes(j.orderCode), String(r.status));
  r = await admin(`/admin/journey/session?id=${S}`); const th = await r.text();
  ok('dòng thời gian của một phiên', r.status === 200 && th.includes('Bắt đầu điền biểu mẫu') && th.includes('25 giây') && th.includes('Gửi đơn'), String(r.status));
  r = await admin(`/admin/orders?q=${j.orderCode}`);
  ok('trang Đơn hàng: link “Xem hành trình” của đơn', (await r.text()).includes(`/admin/journey/session?id=${S}`));

  await sql.query("UPDATE journey_events SET at = now() - interval '100 days' WHERE session_id = $1", [S]);
  await sql.query("UPDATE journey_sessions SET last_at = now() - interval '100 days' WHERE session_id = $1", [S]);
  await purgeJourney(sql, 90);
  const left = (await sql.query('SELECT count(*)::int AS n FROM journey_sessions WHERE session_id = $1', [S])).rows[0].n;
  ok('hành trình: quá 90 ngày -> xoá cả phiên lẫn sự kiện', left === 0 && (await count(S)) === 0);
}

/* "Để lại số nhanh" (khách sắp rời trang) + đơn gần đây ẩn danh + bật tắt lời mời. */
{
  const postJson = (body, ip) => app(new Request(`${H}/api/orders`, { method: 'POST', body: JSON.stringify(body),
    headers: { 'content-type': 'application/json', origin: H, 'cf-connecting-ip': ip } }));
  const lead = { quick: true, name: '', phone: '0933444555', pack: 'Gọi lại: tư vấn sản phẩm này', productSlug: 'combo-nam', locale: 'vi',
    dataConsent: true, consentText: 'Khi nhấn Gọi lại cho tôi, tôi đồng ý…' };
  r = await postJson(lead, '203.0.113.81'); j = await r.json();
  const saved = (await sql.query('SELECT name, phone, pack, pack_price FROM orders WHERE order_code = $1', [j.orderCode ?? ''])).rows[0];
  ok('để lại số nhanh: chỉ số điện thoại, không bắt tên', r.status === 200 && saved?.name === '' && saved.phone === '0933444555' && saved.pack_price === null, JSON.stringify(j));
  r = await postJson({ ...lead, quick: false, phone: '0933444556' }, '203.0.113.82');
  ok('không có quick -> vẫn bắt tên', r.status === 422, String(r.status));
  r = await postJson({ ...lead, phone: '0933444557', packPrice: 1050000, address: '12 Lê Lợi, Quận 1' }, '203.0.113.83');
  ok('quick không áp cho đơn mua có giá -> vẫn bắt tên', r.status === 422, String(r.status));

  const { recentOrdersHandler, resetRecentOrdersCache } = await import('../server/lib/recent-orders.ts');
  const recent = async () => { resetRecentOrdersCache(); return (await recentOrdersHandler(new Request(`${H}/api/recent-orders?l=vi`), sql)).text(); };
  await sql.query("UPDATE orders SET status = 'cancelled' WHERE phone = '0912345678'");
  let txt = await recent();
  const items = JSON.parse(txt).items;
  const realPaid = (await sql.query("SELECT count(*)::int AS n FROM orders WHERE status <> 'cancelled' AND pack_price > 0")).rows[0].n;
  ok('đơn gần đây: chỉ đơn mua thật chưa huỷ, không lẫn yêu cầu tư vấn', items.length === Math.min(12, realPaid) && items.every((x) => x.name && Number.isInteger(x.ago) && x.ago % 5 === 0),
    `${items.length} mục / ${realPaid} đơn có giá`);
  const leak = ['0900000', '0911222333', 'Nguyễn', 'MC-', 'order', 'phone', 'created'].filter((x) => txt.includes(x));
  ok('đơn gần đây: không lộ tên, số, mã đơn, giờ chính xác', leak.length === 0, leak.join(',') || Object.keys(items[0] ?? {}).join(','));
  await sql.query("UPDATE orders SET status = 'cancelled'");
  txt = await recent();
  ok('đơn gần đây: không có đơn thật -> danh sách rỗng (không bịa)', txt === '{"items":[]}', txt);

  r = await postStore(storeForm({ phoneDisplay: '0900 111 222', 't:googleAds': 'AW-123456789', 't:googleAdsOrderLabel': 'AbC-12_xy',
    'e:present': '1', 'e:promoPopup': '1', 'e:promoDelaySec': '6', 'e:chatDelaySec': '15', 'e:exitLead': '1', 'e:recentOrdersGapSec': '30' }));
  const eg = (await brandNow()).engagement;
  ok('tương tác: lưu bật/tắt + số giây (ô bỏ trống = tắt)', r.status === 200 && eg?.promoPopup === true && eg.promoDelaySec === 6
    && eg.chatInvite === false && eg.exitLead === true && eg.recentOrders === false && eg.recentOrdersGapSec === 30, JSON.stringify(eg));
  r = await postStore(storeForm({ phoneDisplay: '0900 111 222', 'e:present': '1', 'e:recentOrders': '1', 'e:recentOrdersGapSec': '2' }));
  ok('tương tác: khoảng cách thông báo dưới 8 giây -> 422', r.status === 422 && (await brandNow()).engagement.recentOrdersGapSec === 30, String(r.status));

  const V = `j_${'d'.repeat(22)}`, S = `j_${'e'.repeat(22)}`;
  r = await app(new Request(`${H}/api/j`, { method: 'POST', headers: { origin: H, 'user-agent': 'Mozilla/5.0 (iPhone)' },
    body: JSON.stringify({ v: V, s: S, e: [{ t: 'page', a: Date.now(), p: '/combo-nam/' }, { t: 'popup', a: Date.now(), p: '/combo-nam/', x: 'promo:show', b: 'Combo' }] }) }));
  const pe = (await sql.query("SELECT count(*)::int AS n FROM journey_events WHERE session_id = $1 AND type = 'popup'", [S])).rows[0].n;
  r = await admin('/admin/journey?days=7'); const jh2 = await r.text();
  ok('hành trình: ghi sự kiện popup, trang quản trị có thẻ “Popup & lời mời”', pe === 1 && jh2.includes('Popup &amp; lời mời') && /Popup khuyến mãi<\/td><td>Hiện: <b>1/.test(jh2), `${pe}`);
}

r = await admin('/admin/users');
ok('biên tập viên không vào được trang tài khoản', r.status === 403, String(r.status));

// ---------------------------------------------------------------- file tĩnh
if (existsSync(join(ROOT, 'dist/combo-nam/index.html'))) {
  r = await app(new Request(`${H}/combo-nam/`, { headers: { 'accept-encoding': 'br' } }));
  ok('trang tĩnh: CSP của public/_headers + nén br', r.status === 200 && /default-src 'self'/.test(r.headers.get('content-security-policy') ?? '') && r.headers.get('content-encoding') === 'br');
  r = await app(new Request(`${H}/combo-nam`));
  ok('thiếu dấu / cuối -> 308', r.status === 308 && r.headers.get('location') === '/combo-nam/');
  r = await app(new Request(`${H}/khong-co-trang-nay/`));
  ok('trang không có -> 404.html', r.status === 404);
  /* Mọi file CSS/JS mà trang tham chiếu phải trả 200. Astro đặt tên bundle
     chính là "_..<hash>.css"; bản đầu của bộ chặn path traversal dò chuỗi ".."
     và trả 404 cho đúng file đó — trang lên mà không có định dạng nào. */
  const html = readFileSync(join(ROOT, 'dist/combo-nam/index.html'), 'utf8');
  const assetsRef = [...new Set([...html.matchAll(/(?:href|src)="(\/_astro\/[^"]+\.(?:css|js))"/g)].map((m) => m[1]))];
  const bad = [];
  for (const a of assetsRef) { const x = await app(new Request(`${H}${a}`)); if (x.status !== 200) bad.push(`${a} ${x.status}`); }
  ok('mọi CSS/JS trang tham chiếu đều trả 200', assetsRef.length > 0 && bad.length === 0, bad.join(', ') || `${assetsRef.length} file`);
  r = await app(new Request(`${H}/..%2f..%2fpackage.json`));
  ok('không đi ra ngoài dist/ (path traversal)', r.status === 404 || r.status === 308, String(r.status));
} else console.log('  (bỏ qua phần file tĩnh — chưa build)');

// Driver `postgres` JSON.stringify lại tham số kiểu jsonb: `$1::jsonb` + chuỗi JSON = lưu thành chuỗi.
// PGlite không mắc, nên bộ thử này không tự thấy — chặn bằng cách đọc mã (xem server/lib/db.ts).
{
  const { readdirSync, readFileSync: rf } = await import('node:fs');
  const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : e.name.endsWith('.ts') ? [join(d, e.name)] : []));
  const hits = ['server', 'functions'].flatMap((d) => walk(join(ROOT, d)))
    .flatMap((f) => rf(f, 'utf8').split('\n').map((l, i) => [f, i + 1, l]))
    .filter(([, , l]) => /\$\d+::jsonb/.test(l)).map(([f, n]) => `${f.slice(ROOT.length + 1)}:${n}`);
  ok('tham số jsonb luôn viết $n::text::jsonb', !hits.length, hits.join(', '));
}

await sql.close();
console.log(`\n${pass}/${pass + fail.length} phép thử đạt.`);
if (fail.length) process.exit(1);
