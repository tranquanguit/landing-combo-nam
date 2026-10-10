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
