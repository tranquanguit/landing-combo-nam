/**
 * Kiểm nhánh gửi đơn khi ĐÃ cấu hình endpoint.
 *
 * Qua bốn vòng kiểm định, nhánh này chưa bao giờ chạy: mọi lần đo đều ở trạng
 * thái "chưa cấu hình". Kiểm thử dựng một endpoint thật và đi qua ba kịch bản
 * mà người dùng thật sẽ gặp: gửi thành công, máy chủ lỗi, và mạng đứt.
 */
import { createServer } from 'node:http';
import { createRequire } from 'node:module';

/* Playwright là dependency dùng để kiểm thử, cài ở cấp hệ thống trong môi
   trường này. Resolve tường minh để chạy được ở cả hai nơi. */
const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = require('/opt/node22/lib/node_modules/playwright'));
}

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

const { spawn } = await import('node:child_process');
const pageServer = spawn('python3', ['-m', 'http.server', String(PAGE_PORT)], {
  cwd: 'dist', stdio: 'ignore',
});

await new Promise((r) => api.listen(API_PORT, r));
await new Promise((r) => setTimeout(r, 1200));

const results = [];
const browser = await chromium.launch();

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
  await page.goto(`http://localhost:${PAGE_PORT}/`, { waitUntil: 'networkidle' });
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
  await page.goto(`http://localhost:${PAGE_PORT}/`, { waitUntil: 'networkidle' });
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
  await page.goto(`http://localhost:${PAGE_PORT}/`, { waitUntil: 'networkidle' });
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
  await page.goto(`http://localhost:${PAGE_PORT}/`, { waitUntil: 'networkidle' });
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
  await page.goto(`http://localhost:${PAGE_PORT}/`, { waitUntil: 'networkidle' });
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
  await page.goto(`http://localhost:${PAGE_PORT}/`, { waitUntil: 'networkidle' });
  await fillAndSubmit(page);
  const focused = await page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName);
  results.push(['focus chuyển sang thông báo', focused === 'form-success', `activeElement: ${focused}`]);
  await page.close();
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
