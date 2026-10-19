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
    res.writeHead(200, { 'Content-Type': 'application/json' }).end('{"ok":true,"orderCode":"MC-THU-0001"}');
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
}

async function fillAndSubmit(page) {
  await fillForm(page);
  await page.click('#order-form button[type=submit]');
  await page.waitForTimeout(900);
}

/* Gửi thành công = sang TRANG CẢM ƠN (mốc chuyển đổi cho quảng cáo), URL không mang mã đơn. */
const THANKS = '/dat-hang-thanh-cong/';
async function onThanks(page) {
  await page.waitForURL((u) => u.pathname === THANKS, { timeout: 4000 }).catch(() => {});
  const u = new URL(page.url());
  return u.pathname === THANKS && !u.search && (await page.locator('main.thanks h1').isVisible());
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
      (await onThanks(page)),
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

// --- 3b. Đồng ý dữ liệu cá nhân: câu đồng ý nằm ngay trên nút, đơn mang đúng câu đó --
/* Không còn ô tích: bấm nút gửi đơn ngay dưới câu "Khi nhấn Đặt mua, tôi đồng ý…" là hành
   động đồng ý. Điều phải giữ: câu đó NHÌN THẤY ĐƯỢC ngay trên nút, nút trỏ tới nó
   (aria-describedby), và đơn gửi đi mang dataConsent + đúng nguyên văn câu khách đã đọc. */
{
  mode = 'ok';
  received.length = 0;
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`http://localhost:${PAGE_PORT}/combo-nam/`, { waitUntil: 'networkidle' });
  const note = page.locator('#consent-note');
  const visible = await note.isVisible();
  const noteText = (await note.innerText()).replace(/\s+/g, ' ').trim();
  const described = await page.locator('#order-form button[type=submit]').getAttribute('aria-describedby');
  const noCheckbox = (await page.locator('#order-form input[type=checkbox]').count()) === 0;
  await page.fill('#name', 'Nguyễn Thu Hà');
  await page.fill('#phone', '0912345678');
  await page.fill('#address', '12 Lê Lợi, Quận 1');
  await page.click('#order-form button[type=submit]');
  await page.waitForTimeout(900);
  let b = {};
  try { b = JSON.parse(received[0]?.body ?? '{}'); } catch { /* không phải JSON thì b rỗng, phép thử báo hỏng */ }
  results.push([
    'đồng ý dữ liệu: câu ngay trên nút, gửi kèm nguyên văn',
    visible && noCheckbox && described === 'consent-note' && received.length === 1
      && String(b.dataConsent) === 'true' && String(b.consentText).replace(/\s+/g, ' ').trim() === noteText,
    `hiện=${visible} · không ô tích=${noCheckbox} · ${received.length} POST · dataConsent=${b.dataConsent}`,
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
  const successNow = await onThanks(page);
  const errorStill = await page.locator('#form-error').isVisible();
  results.push([
    'lỗi rồi gửi lại được',
    errorShown && successNow && !errorStill,
    `lần 1 báo lỗi: ${errorShown}, lần 2 báo thành công: ${successNow}, lỗi cũ còn hiện: ${errorStill}`,
  ]);
  await page.close();
}

// --- 5. Không ghi được sessionStorage: ở lại trang, focus sang thông báo --
/* Chế độ riêng tư chặt chặn storage: không sang trang cảm ơn (không có gì để hiện mã đơn),
   mà báo ngay trên trang như trước, kèm mã đơn, và đưa focus tới đó. */
{
  mode = 'ok';
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.addInitScript(() => { Storage.prototype.setItem = () => { throw new Error('chặn'); }; });
  await page.goto(`http://localhost:${PAGE_PORT}/combo-nam/`, { waitUntil: 'networkidle' });
  await fillAndSubmit(page);
  const focused = await page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName);
  const stayed = new URL(page.url()).pathname === '/combo-nam/';
  const code = await page.locator('#order-code').innerText().catch(() => '');
  results.push(['không có storage: ở lại, focus thông báo', stayed && focused === 'form-success' && code === 'MC-THU-0001',
    `ở lại: ${stayed}, activeElement: ${focused}, mã: ${code}`]);
  await page.close();
}

// --- 6. Trang cảm ơn: hiện mã đơn + gói, chuyển đổi bắn ĐÚNG MỘT lần ---------
{
  mode = 'ok';
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  /* Ghi lại mọi sự kiện đo lường của từng lần tải trang vào sessionStorage (sống qua chuyển trang). */
  await page.addInitScript(() => {
    addEventListener('mocha:event', (e) => {
      const k = '__ev'; const a = JSON.parse(sessionStorage.getItem(k) ?? '[]');
      a.push({ name: e.detail.name, path: location.pathname, value: e.detail.params?.value });
      sessionStorage.setItem(k, JSON.stringify(a));
    });
  });
  await page.goto(`http://localhost:${PAGE_PORT}/combo-nam/`, { waitUntil: 'networkidle' });
  const price = await page.evaluate(() => Number(document.querySelector('input[name="pack"]:checked')?.dataset.price || 0));
  await fillAndSubmit(page);
  const arrived = await onThanks(page);
  const code = await page.locator('#thanks-code').innerText().catch(() => '');
  const pack = await page.locator('#thanks-pack').innerText().catch(() => '');
  await page.reload({ waitUntil: 'networkidle' });
  const ev = await page.evaluate(() => JSON.parse(sessionStorage.getItem('__ev') ?? '[]'));
  const leads = ev.filter((x) => x.name === 'generate_lead');
  results.push(['trang cảm ơn: mã đơn, gói, một chuyển đổi',
    arrived && code === 'MC-THU-0001' && pack.includes('Combo') && leads.length === 1 && leads[0].path === THANKS && leads[0].value === price,
    `tới: ${arrived}, mã: ${code}, gói: ${pack.slice(0, 30)}, generate_lead: ${leads.map((x) => `${x.path}=${x.value}`).join(' ')} (giá gói ${price})`]);
  await page.close();
}

// --- 6b. Khách sắp rời (điện thoại, vuốt ngược lên nhanh) -> để lại số -> trang cảm ơn tư vấn --
/* Đồng hồ giả: "12 giây xem thật" trôi trong tích tắc. Gửi về đúng đường nhận đơn với quick:true,
   không tên; sang /da-nhan-yeu-cau-tu-van/ có mã đơn. */
{
  mode = 'ok';
  received.length = 0;
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  await page.clock.install();
  await page.goto(`http://localhost:${PAGE_PORT}/combo-nam/`, { waitUntil: 'networkidle' });
  const hasDialog = (await page.locator('#exit-lead').count()) === 1;
  await page.clock.fastForward(13_000);
  /* Cuộn tức thì (trang bật scroll-behavior: smooth — lệnh cuộn bằng mã sẽ thành hoạt ảnh chậm). */
  await page.evaluate(() => scrollTo({ top: 2400, behavior: 'instant' }));
  await page.waitForTimeout(200);
  for (let i = 0; i < 4; i++) { await page.evaluate(() => scrollBy({ top: -150, behavior: 'instant' })); await page.waitForTimeout(30); }
  const opened = await page.locator('#exit-lead').evaluate((d) => d.open).catch(() => false);
  let body = {}; let path = ''; let code = '';
  if (opened) {
    await page.fill('#exit-phone', '0912 000 111');
    await page.click('#exit-form button[type=submit]');
    await page.waitForURL((u) => u.pathname === '/da-nhan-yeu-cau-tu-van/', { timeout: 5000 }).catch(() => {});
    try { body = JSON.parse(received[0]?.body ?? '{}'); } catch { /* báo hỏng bên dưới */ }
    path = new URL(page.url()).pathname;
    code = await page.locator('#thanks-code').innerText().catch(() => '');
  }
  results.push(['sắp rời: để lại số -> cảm ơn',
    hasDialog && opened && received.length === 1 && body.quick === true && body.name === '' && body.phone === '0912000111'
      && !!body.consentText && path === '/da-nhan-yeu-cau-tu-van/' && code === 'MC-THU-0001',
    `có hộp=${hasDialog} · mở=${opened} · ${received.length} POST · quick=${body.quick} · ${path} · mã=${code}`]);
  await ctx.close();
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
  /* Trang chuyển sang trang cảm ơn ngay sau sự kiện, nên chép chi tiết vào sessionStorage
     (sống qua chuyển trang trong cùng tab) rồi đọc ở trang sau. */
  await page.evaluate(() => {
    sessionStorage.removeItem('__lead');
    window.addEventListener('mocha:lead', (e) => { sessionStorage.setItem('__lead', JSON.stringify(e.detail)); });
  });

  await page.fill('#name', 'Nguyễn Thu Hà');
  await page.fill('#phone', '0912345678');
  await page.click('#order-form button[type=submit]');
  await page.waitForTimeout(900);
  const sent = received.length === 1 && !received[0].address;

  const leak = await page.evaluate(() => {
    const d = JSON.parse(sessionStorage.getItem('__lead') ?? 'null');
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

  const success = formUsable && await onThanks(page);
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
