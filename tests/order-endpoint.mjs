/**
 * Kiểm nhánh gửi đơn khi ĐÃ cấu hình endpoint.
 *
 * Qua bốn vòng kiểm định, nhánh này chưa bao giờ chạy: mọi lần đo đều ở trạng
 * thái "chưa cấu hình". Kiểm thử dựng một endpoint thật và đi qua ba kịch bản
 * mà người dùng thật sẽ gặp: gửi thành công, máy chủ lỗi, và mạng đứt.
 */
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

/* Playwright là dependency dùng để kiểm thử, cài ở cấp hệ thống trong môi
   trường này. Resolve tường minh để chạy được ở cả hai nơi. */
import { launchBrowser } from './_launch.mjs';
const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = require('/opt/node22/lib/node_modules/playwright'));
}

import { requireOrderForm } from './_order-form-ready.mjs';
/* Không có biểu mẫu thì mọi page.fill bên dưới đều hết giờ sau 30 giây rồi
   báo sai nguyên nhân. Chặn ngay, và nói đúng thứ cần sửa. */
requireOrderForm();

/* Landing sản phẩm nằm ở /combo-nam/, không còn ở gốc: từ khi site có tầng
   trang chủ và tầng dòng sản phẩm, gốc là trang chủ thương hiệu. */
const PAGE_PORT = 8131;
const API_PORT = 8132;
const received = [];
let mode = 'ok';

const api = createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'content-type');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Max-Age', '600');
    if (req.method === 'OPTIONS') return res.writeHead(204).end();
    received.push({ method: req.method, body });
    if (mode === 'fail') return res.writeHead(500).end('{"error":"boom"}');
    res.writeHead(200, { 'Content-Type': 'application/json' }).end('{"ok":true}');
  });
});

/* Phục vụ dist bằng node, không mượn `python3 -m http.server` nữa.
   Trên Windows không có lệnh `python3` (chỉ có `python`), mà spawn lại chạy với
   stdio:'ignore' nên lỗi "không tìm thấy lệnh" bị nuốt mất: bộ thử chết ở
   ERR_CONNECTION_REFUSED và người đọc log đi tìm lỗi ở trang, không ở máy chủ. */
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.avif': 'image/avif',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml',
};
const pages = createServer(async (req, res) => {
  /* normalize() rồi bóc hết ../ và / ở đầu — không để leo ra ngoài dist. */
  let rel = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^[/\\.]+/, '');
  if (!rel || !extname(rel)) rel = join(rel, 'index.html');
  try {
    const buf = await readFile(join('dist', rel));
    res.writeHead(200, { 'Content-Type': MIME[extname(rel).toLowerCase()] ?? 'application/octet-stream' }).end(buf);
  } catch {
    res.writeHead(404).end('not found');
  }
});
await new Promise((r) => pages.listen(PAGE_PORT, r));
const pageServer = { kill: () => pages.close() };

api.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `\nCổng ${API_PORT} đang bị chiếm — có thể một lần chạy trước chết giữa đường.\n` +
      `Dọn bằng: lsof -ti:${API_PORT} | xargs -r kill\n`
    );
    process.exit(1);
  }
  throw err;
});
await new Promise((r) => api.listen(API_PORT, r));
await new Promise((r) => setTimeout(r, 1200));

const results = [];
const browser = await launchBrowser(chromium);

/* Dọn cổng khi bộ thử chết giữa đường.
   Kiểm định lần 11: một lần chạy bị ngắt để lại server chiếm cổng, lần sau chết
   với EADDRINUSE thay vì báo lỗi hàng rào — người đọc log sẽ đi sai hướng. */
let cleaned = false;
const cleanup = () => {
  if (cleaned) return;
  cleaned = true;
  try { api.close(); } catch { /* đã đóng */ }
  try { pageServer.kill(); } catch { /* đã chết */ }
  try { browser.close(); } catch { /* đã đóng */ }
};
process.on('exit', cleanup);
for (const sig of ['SIGINT', 'SIGTERM', 'uncaughtException', 'unhandledRejection']) {
  process.on(sig, (err) => {
    if (err instanceof Error) console.error(err.message);
    cleanup();
    process.exit(1);
  });
}

async function fillForm(page) {
  await page.fill('#name', 'Nguyễn Thu Hà');
  await page.fill('#phone', '0912345678');
  await page.fill('#address', '12 Lê Lợi, Phường Bến Nghé, Quận 1, TP.HCM');
  await page.check('#data-consent');
}

async function fillAndSubmit(page) {
  await fillForm(page);
  await page.click('#order-form button[type=submit]');
  await page.waitForTimeout(900);
}

// --- 1. Gửi thành công -------------------------------------------------
{
  mode = 'ok';
  received.length = 0;
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`http://localhost:${PAGE_PORT}/combo-nam/`, { waitUntil: 'networkidle' });
  await fillAndSubmit(page);
  const payload = received[0] ? JSON.parse(received[0].body) : null;
  results.push([
    'gửi thành công',
    received.length === 1 &&
      received[0].method === 'POST' &&
      payload?.phone === '0912345678' &&
      payload?.name === 'Nguyễn Thu Hà' &&
      (await page.locator('#form-success').isVisible()) &&
      !(await page.locator('#order-form').isVisible()),
    `${received.length} POST, trường gửi đi: ${payload ? Object.keys(payload).join(',') : '—'}`,
  ]);
  await page.close();
}

// --- 2. Máy chủ trả 500 ------------------------------------------------
{
  mode = 'fail';
  received.length = 0;
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`http://localhost:${PAGE_PORT}/combo-nam/`, { waitUntil: 'networkidle' });
  await fillAndSubmit(page);
  const saidSuccess = await page.locator('#form-success').isVisible();
  const saidError = await page.locator('#form-error').isVisible();
  const canRetry = await page.locator('#order-form button[type=submit]').isEnabled();
  results.push([
    'máy chủ lỗi 500',
    !saidSuccess && saidError && canRetry,
    `báo thành công: ${saidSuccess}, báo lỗi: ${saidError}, gửi lại được: ${canRetry}`,
  ]);
  await page.close();
}

// --- 3. Mạng đứt -------------------------------------------------------
{
  received.length = 0;
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`http://localhost:${PAGE_PORT}/combo-nam/`, { waitUntil: 'networkidle' });
  await page.route(`http://localhost:${API_PORT}/**`, (route) => route.abort('failed'));
  await fillAndSubmit(page);
  const saidSuccess = await page.locator('#form-success').isVisible();
  const saidError = await page.locator('#form-error').isVisible();
  results.push([
    'mạng đứt',
    !saidSuccess && saidError,
    `báo thành công: ${saidSuccess}, báo lỗi kèm hotline: ${saidError}`,
  ]);
  await page.close();
}

// --- 3b. Không tick ô đồng ý dữ liệu cá nhân thì không được gửi -------
{
  mode = 'ok';
  received.length = 0;
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`http://localhost:${PAGE_PORT}/combo-nam/`, { waitUntil: 'networkidle' });
  await page.fill('#name', 'Nguyễn Thu Hà');
  await page.fill('#phone', '0912345678');
  await page.fill('#address', '12 Lê Lợi, Quận 1');
  await page.click('#order-form button[type=submit]');
  await page.waitForTimeout(700);
  const focused = await page.evaluate(() => document.activeElement?.id);
  results.push([
    'chưa đồng ý dữ liệu',
    received.length === 0 && !(await page.locator('#form-success').isVisible()) && focused === 'data-consent',
    `${received.length} POST, focus chuyển tới: ${focused}`,
  ]);
  await page.close();
}

// --- 4. Lỗi rồi gửi lại thành công -------------------------------------
{
  mode = 'fail';
  received.length = 0;
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`http://localhost:${PAGE_PORT}/combo-nam/`, { waitUntil: 'networkidle' });
  await fillAndSubmit(page);
  const errorShown = await page.locator('#form-error').isVisible();
  mode = 'ok';
  await page.click('#order-form button[type=submit]');
  await page.waitForTimeout(900);
  const successNow = await page.locator('#form-success').isVisible();
  const errorStill = await page.locator('#form-error').isVisible();
  results.push([
    'lỗi rồi gửi lại được',
    errorShown && successNow && !errorStill,
    `lần 1 báo lỗi: ${errorShown}, lần 2 báo thành công: ${successNow}, lỗi cũ còn hiện: ${errorStill}`,
  ]);
  await page.close();
}

// --- 5. Focus sau khi gửi thành công -----------------------------------
{
  mode = 'ok';
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`http://localhost:${PAGE_PORT}/combo-nam/`, { waitUntil: 'networkidle' });
  await fillAndSubmit(page);
  const focused = await page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName);
  results.push(['focus chuyển sang thông báo', focused === 'form-success', `activeElement: ${focused}`]);
  await page.close();
}

// --- 7. Gói "chỉ cần tư vấn" không bắt nhập địa chỉ giao hàng ----------
{
  mode = 'ok';
  received.length = 0;
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(`http://localhost:${PAGE_PORT}/combo-nam/`, { waitUntil: 'networkidle' });

  // Gói có giá thì vẫn phải nhập địa chỉ.
  const paidRequires = await page.evaluate(() => {
    const paid = document.querySelector('input[name="pack"][data-price]:not([data-price=""])');
    paid.click();
    return document.getElementById('address').required;
  });

  // Gói không có giá (chỉ tư vấn) thì không.
  const adviceRequires = await page.evaluate(() => {
    const advice = document.querySelector('input[name="pack"][data-price=""]');
    advice.click();
    return document.getElementById('address').required;
  });

  /* Sự kiện `mocha:lead` chỉ được mang gói hàng, KHÔNG mang tên/điện thoại/địa
     chỉ: pixel quảng cáo chạy cùng trang và bất kỳ script nào cũng nghe được.
     Kiểm định lần 14: thêm ba trường đó vào lại thì cả 8 kịch bản vẫn xanh. */
  await page.evaluate(() => {
    window.__leadDetail = null;
    window.addEventListener('mocha:lead', (e) => { window.__leadDetail = e.detail; });
  });

  await page.fill('#name', 'Nguyễn Thu Hà');
  await page.fill('#phone', '0912345678');
  await page.check('#data-consent');
  await page.click('#order-form button[type=submit]');
  await page.waitForTimeout(900);
  const sent = received.length === 1 && !received[0].address;

  const leak = await page.evaluate(() => {
    const d = window.__leadDetail;
    if (!d) return 'không có sự kiện';
    const extra = Object.keys(d).filter((k) => k !== 'pack');
    return extra.length ? `rò trường: ${extra.join(', ')}` : '';
  });
  results.push(['mocha:lead chỉ mang gói hàng', leak === '', leak || 'chỉ có { pack }']);

  results.push([
    'tư vấn không địa chỉ',
    paidRequires && !adviceRequires && sent,
    `gói có giá bắt buộc: ${paidRequires}, gói tư vấn bắt buộc: ${adviceRequires}, gửi được: ${sent}`,
  ]);
  await page.close();
}

// --- 8. Gửi đơn khi trình duyệt ÁP CSP thật từ public/_headers -------
/*
 * Kiểm định lần 10: CSP trong public/_headers chặn 100% đơn hàng vì connect-src
 * không liệt kê endpoint. Mọi bộ thử trước chạy KHÔNG có CSP nên không thấy gì.
 * Đây là phép thử duy nhất bắt được lớp lỗi này: phục vụ đúng trang đó, kèm
 * đúng header đó, rồi bấm nút.
 */
{
  mode = 'ok';
  received.length = 0;

  const { readFileSync } = await import('node:fs');
  const headers = readFileSync('public/_headers', 'utf8');
  const cspRaw = (headers.split('\n').find((l) => l.includes('Content-Security-Policy')) ?? '')
    .replace(/^\s*Content-Security-Policy:\s*/, '').trim();
  /* Không có CSP thì kịch bản này vô nghĩa mà vẫn "ĐẠT" — kiểm định lần 12 xoá
     dòng Content-Security-Policy khỏi public/_headers và cả 8 kịch bản vẫn xanh. */
  if (!cspRaw) {
    results.push(['gửi đơn dưới CSP', false,
      'public/_headers KHÔNG có Content-Security-Policy — không còn gì để kiểm']);
  }
  /* Origin THẬT trong bản build phải nằm trong connect-src gốc — đây là chính
     lớp lỗi vòng 10 tìm ra, và bản trước tự viết lại directive đó nên mù đúng
     chỗ cần soi. */
  const distHtml = readFileSync('dist/index.html', 'utf8');
  const builtEndpoint = /data-action="([^"]+)"/.exec(distHtml)?.[1] ?? '';
  let builtOrigin = '';
  try { builtOrigin = new URL(builtEndpoint).origin; } catch { /* cùng miền */ }
  const connectSrc = /connect-src ([^;]*)/.exec(cspRaw)?.[1]?.trim().split(/\s+/) ?? [];
  /* Bản build của bộ thử bắt buộc dùng localhost, nên loopback được miễn khỏi
     khẳng định này — với endpoint thật thì `scripts/check-budget.mjs` là cổng,
     và CI có một bước riêng khẳng định cổng đó fail được. */
  const loopback = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(builtOrigin);
  const originAllowed = !builtOrigin || loopback || connectSrc.includes(builtOrigin) ||
    (connectSrc.includes("'self'") && builtOrigin === 'https://mochatrinam.com');

  /* Chỉ nới cho localhost của bộ thử, và CHỈ khi nó chưa có mặt — không bao giờ
     che việc origin thật thiếu trong policy. */
  const testOrigin = `http://localhost:${API_PORT}`;
  const csp = connectSrc.includes(testOrigin)
    ? cspRaw
    : cspRaw.replace('connect-src', `connect-src ${testOrigin}`);

  const { createServer } = await import('node:http');
  const { existsSync, statSync } = await import('node:fs');
  const CSP_PORT = 8133;
  const cspServer = createServer((req, res) => {
    let p = 'dist' + decodeURIComponent((req.url ?? '/').split('?')[0]);
    if (existsSync(p) && statSync(p).isDirectory()) p += '/index.html';
    if (!existsSync(p)) { res.writeHead(404); return res.end('x'); }
    res.writeHead(200, { 'Content-Security-Policy': csp });
    res.end(readFileSync(p));
  });
  await new Promise((r) => cspServer.listen(CSP_PORT, r));

  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const violations = [];
  page.on('console', (m) => { if (/Content Security Policy/i.test(m.text())) violations.push(m.text()); });
  await page.goto(`http://localhost:${CSP_PORT}/combo-nam/`, { waitUntil: 'networkidle' });

  /* Báo rõ thay vì chết bằng timeout 60 giây.
     Kiểm định lần 12: bỏ 'unsafe-inline' khỏi script-src thì biểu mẫu không bao
     giờ hiện, và log chỉ có "element is not visible" — CI đỏ nhưng vô nghĩa. */
  let formUsable = true;
  try {
    await page.waitForSelector('#order-form button[type=submit]:not([disabled])', { timeout: 8000 });
    await fillAndSubmit(page);
  } catch {
    formUsable = false;
  }

  const success = await page.evaluate(() => {
    const el = document.getElementById('form-success');
    return !!el && !el.hidden;
  });
  results.push([
    'gửi đơn dưới CSP',
    formUsable && received.length === 1 && success && violations.length === 0 && originAllowed,
    `biểu mẫu dùng được: ${formUsable}, đơn nhận được: ${received.length}, báo thành công: ${success}, ` +
    `vi phạm CSP: ${violations.length}, origin (${builtOrigin || 'cùng miền'})` +
    `${loopback ? ' [loopback, miễn]' : ` trong connect-src: ${originAllowed}`}`,
  ]);
  await page.close();
  cspServer.close();
}

await browser.close();
api.close();
pageServer.kill();

let failed = 0;
for (const [name, ok, detail] of results) {
  if (!ok) failed++;
  console.log(`  ${ok ? 'ĐẠT ' : 'HỎNG'}  ${name.padEnd(20)} ${detail}`);
}
console.log(failed ? `\n${failed}/${results.length} kịch bản hỏng.` : `\nCả ${results.length} kịch bản đúng.`);
process.exit(failed ? 1 : 0);
