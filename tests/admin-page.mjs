/**
 * Kiểm thử trang /admin bằng trình duyệt thật.
 *
 * Trang này là nơi duy nhất dữ liệu cá nhân của khách hiện lên màn hình, nên
 * nó phải được đi thử chứ không chỉ được đọc. Máy chủ thử nghiệm dưới đây gọi
 * CHÍNH hai handler sẽ deploy (functions/admin, functions/api/admin/orders)
 * trên SQLite thật — không có bản mô phỏng nào ở giữa.
 *
 *   node --experimental-strip-types --experimental-sqlite tests/admin-page.mjs
 */
import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { launchBrowser } from './_launch.mjs';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { onRequest as adminPage } from '../functions/admin/index.ts';
import { onRequest as adminApi } from '../functions/api/admin/orders.ts';
import { INSERT_SQL, insertParams } from '../functions/_lib/orders.ts';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }

const PORT = 8141;
const TOKEN = 'token-quan-tri-kiem-thu-du-32-ky-tu-tro-len';

const db = new DatabaseSync(':memory:');
/* Chạy MỌI migration theo thứ tự tên, không chỉ 0001.

   Bản trước ghim cứng 0001_orders.sql, nên ngày thêm 0002 thì cổng đỏ với
   thông báo "table orders has no column named utm_content" — một lỗi nói về
   bộ kiểm thử chứ không phải về mã. Đọc cả thư mục thì lần sau không ai phải
   nhớ sửa chỗ này.
*/
const MIGRATIONS = readdirSync(new URL('../migrations/', import.meta.url))
  .filter((f) => f.endsWith('.sql'))
  .sort();
for (const m of MIGRATIONS) {
  db.exec(readFileSync(new URL('../migrations/' + m, import.meta.url), 'utf8'));
}

const d1 = {
  prepare(sql) {
    const stmt = db.prepare(sql);
    let params = [];
    const api = {
      bind(...v) { params = v.map((x) => (x === undefined ? null : x)); return api; },
      async first() { return stmt.get(...params) ?? null; },
      async all() { return { results: stmt.all(...params), success: true }; },
      async run() { const r = stmt.run(...params); return { success: true, meta: { changes: Number(r.changes) } }; },
    };
    return api;
  },
};
const env = { DB: d1, ADMIN_TOKEN: TOKEN };

/* Ba đơn mẫu. Tên có dấu ngoặc nhọn để kiểm luôn việc trang không diễn giải
   nội dung khách gõ thành HTML. */
const seed = [
  ['MC-260914-AAAA', 'Nguyễn <b>Thu</b> Hà', '0912345678', 'combo-full', 1050000, 'facebook'],
  ['MC-260914-BBBB', 'Trần Văn Bình', '0987654321', 'combo-doi', 590000, 'google'],
  ['MC-260914-CCCC', 'Lê Thị Cúc', '0911222333', 'tu-van', null, null],
];
for (const [code, name, phone, pack, price, utm] of seed) {
  db.prepare(INSERT_SQL).run(...insertParams({
    orderCode: code, createdAt: new Date().toISOString(), productSlug: 'combo-nam',
    locale: 'vi', pack, packPrice: price, currency: 'VND', name, phone,
    address: '12 Lê Lợi, Quận 1', country: null, note: null,
    consentText: 'Tôi đồng ý...', utmSource: utm, utmMedium: null,
    utmCampaign: null, referrerHost: null,
  }).map((v) => (v === undefined ? null : v)));
}

/* Cầu nối Node http <-> handler kiểu fetch. */
const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const request = new Request(url, {
    method: req.method,
    headers: req.headers,
    body: chunks.length ? Buffer.concat(chunks) : undefined,
  });
  const handler = url.pathname.startsWith('/api/admin/orders') ? adminApi : adminPage;
  const out = await handler({ request, env });
  res.writeHead(out.status, Object.fromEntries(out.headers));
  res.end(Buffer.from(await out.arrayBuffer()));
});
await new Promise((r) => server.listen(PORT, r));

const browser = await launchBrowser(chromium);
const cleanup = () => { try { server.close(); } catch {} try { browser.close(); } catch {} };
process.on('exit', cleanup);

const results = [];
const check = (name, ok, detail) => results.push([name, ok, detail]);
const newPage = async () => {
  const p = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await p.goto(`http://localhost:${PORT}/admin`, { waitUntil: 'load' });
  return p;
};

/* ---- 1. Chưa có mã thì không thấy gì ---- */
{
  const p = await newPage();
  const html = await p.content();
  check('chưa đăng nhập thì trang rỗng',
    await p.locator('#gate').isVisible()
    && !(await p.locator('#app').isVisible())
    && !html.includes('0912345678') && !html.includes('Nguyễn'),
    'không có số điện thoại nào trong HTML');
  await p.close();
}

/* ---- 2. Mã sai thì bị đẩy ra ---- */
{
  const p = await newPage();
  await p.fill('#tok', 'ma-sai-hoan-toan');
  await p.click('#gate button[type=submit]');
  await p.waitForTimeout(400);
  check('mã sai bị từ chối',
    await p.locator('#gate-err').isVisible() && !(await p.locator('#app').isVisible()),
    await p.locator('#gate-err').textContent());
  await p.close();
}

/* ---- 3. Mã đúng thì thấy đơn ---- */
{
  const p = await newPage();
  await p.fill('#tok', TOKEN);
  await p.click('#gate button[type=submit]');
  await p.waitForSelector('#rows tr');
  const rows = await p.locator('#rows tr').count();
  const firstCode = await p.locator('#rows tr:first-child .code').textContent();
  check('đăng nhập đúng thì thấy đơn',
    rows === 3 && /^MC-\d{6}-[A-Z]{4}$/.test(firstCode.trim()),
    `${rows} dòng, đơn đầu ${firstCode.trim()}`);

  /* Tên khách có <b> phải hiện nguyên văn, không được thành chữ đậm. */
  const nameCell = p.locator('#rows tr', { hasText: 'MC-260914-AAAA' }).locator('td').nth(2);
  const boldInside = await nameCell.locator('b').count();
  check('nội dung khách gõ không thành HTML',
    boldInside === 0 && (await nameCell.textContent()).includes('<b>'),
    await nameCell.textContent());
  await p.close();
}

/* ---- 4. Đổi trạng thái ghi thẳng vào cơ sở dữ liệu ---- */
{
  const p = await newPage();
  await p.fill('#tok', TOKEN);
  await p.click('#gate button[type=submit]');
  await p.waitForSelector('#rows tr');
  await p.locator('#rows tr', { hasText: 'MC-260914-BBBB' }).locator('select').selectOption('contacted');
  await p.waitForTimeout(500);
  const row = db.prepare('SELECT status FROM orders WHERE order_code = ?').get('MC-260914-BBBB');
  check('đổi trạng thái lưu vào CSDL', row.status === 'contacted', `trong CSDL: ${row.status}`);
  await p.close();
}

/* ---- 5. Lọc theo trạng thái ---- */
{
  const p = await newPage();
  await p.fill('#tok', TOKEN);
  await p.click('#gate button[type=submit]');
  await p.waitForSelector('#rows tr');
  await p.selectOption('#status', 'contacted');
  await p.waitForTimeout(500);
  const rows = await p.locator('#rows tr').count();
  check('lọc theo trạng thái', rows === 1, `${rows} dòng khi lọc "đã gọi"`);
  await p.close();
}

/* ---- 6. Thoát thì xoá sạch mã khỏi tab ---- */
{
  const p = await newPage();
  await p.fill('#tok', TOKEN);
  await p.click('#gate button[type=submit]');
  await p.waitForSelector('#rows tr');
  await p.click('#out');
  const left = await p.evaluate(() => sessionStorage.getItem('mocha_admin_token'));
  check('thoát thì xoá mã khỏi tab',
    left === null && await p.locator('#gate').isVisible(), `sessionStorage: ${left}`);
  await p.close();
}

/* ---- 7. Mã không rơi vào localStorage hay cookie ---- */
{
  const p = await newPage();
  await p.fill('#tok', TOKEN);
  await p.click('#gate button[type=submit]');
  await p.waitForSelector('#rows tr');
  const leaked = await p.evaluate(() => JSON.stringify({
    local: { ...localStorage }, cookie: document.cookie,
  }));
  check('mã chỉ nằm trong sessionStorage', !leaked.includes('token-quan-tri'), leaked.slice(0, 60));
  await p.close();
}

/* ---- 8. Header chống lập chỉ mục ---- */
{
  const res = await fetch(`http://localhost:${PORT}/admin`);
  check('trang quản trị khai noindex',
    /noindex/.test(res.headers.get('x-robots-tag') || '')
    && res.headers.get('cache-control') === 'no-store',
    `${res.headers.get('x-robots-tag')}`);
}

let failed = 0;
for (const [name, ok, detail] of results) {
  if (!ok) failed++;
  console.log(`  ${ok ? 'ĐẠT ' : 'LỖI '} ${name.padEnd(36)} ${detail}`);
}
console.log(`\n${results.length - failed}/${results.length} kịch bản đúng.`);
cleanup();
process.exit(failed ? 1 : 0);
