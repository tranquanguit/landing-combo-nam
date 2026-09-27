/**
 * Đo độ phản hồi tương tác (INP) trên trình duyệt thật.
 *
 * Điểm chất lượng quảng cáo Google có tính trải nghiệm trang đích, mà INP là
 * một trong ba chỉ số Core Web Vitals. Đây là thứ không đoán được bằng cách đọc
 * code: một `addEventListener` đọc `scrollHeight` trong vòng lặp cuộn hay một
 * khối mới thêm vào có thể đẩy độ trễ lên mà không ai thấy.
 *
 * Ngưỡng đặt RỘNG có chủ ý. Số đo phụ thuộc máy chạy, nên siết sát mức đo được
 * hôm nay sẽ làm CI đỏ vì máy chậm chứ không vì trang tệ. Mốc ở đây là mốc
 * "còn tốt" của Google (200ms) và mốc tác vụ dài của trình duyệt (50ms): vượt
 * chúng là có chuyện thật, không phải nhiễu.
 *
 * Đo lúc 21/09: tệ nhất 48ms, p75 40ms, 0 tác vụ dài. Dư hơn bốn lần.
 */
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

import { launchBrowser } from './_launch.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const PORT = 8137;
/** Mốc "còn tốt" của Google cho INP. */
const INP_MAX = 200;
/** Tác vụ chặn luồng chính lâu hơn mức này là thứ người dùng cảm thấy. */
const LONGTASK_MAX = 50;

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.avif': 'image/avif',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml',
};

const server = createServer(async (req, res) => {
  let rel = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^[/\\.]+/, '');
  if (!rel || !extname(rel)) rel = join(rel, 'index.html');
  try {
    const buf = await readFile(join('dist', rel));
    res.writeHead(200, { 'Content-Type': MIME[extname(rel).toLowerCase()] ?? 'application/octet-stream' }).end(buf);
  } catch {
    res.writeHead(404).end('not found');
  }
});
await new Promise((r) => server.listen(PORT, r));

const browser = await launchBrowser(chromium);
const results = [];
let failed = 0;

function check(name, ok, detail) {
  results.push({ name, ok, detail });
  if (!ok) failed++;
}

/* Trang nào đo: landing sản phẩm (đích quảng cáo, nhiều khối nhất), trang dòng
   (có bảng so sánh) và trang chủ. Ba trang này gánh gần hết lưu lượng. */
for (const path of ['/combo-nam/', '/nam-tham/', '/']) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(`http://localhost:${PORT}${path}`, { waitUntil: 'networkidle' });

  await page.evaluate(() => {
    window.__ev = [];
    window.__long = [];
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) window.__ev.push({ n: e.name, d: e.duration });
    }).observe({ type: 'event', buffered: true, durationThreshold: 0 });
    /* KHÔNG buffered: chỉ đếm tác vụ dài xảy ra SAU khi trang đã tải xong, tức
       trong lúc người dùng tương tác. Bật buffered sẽ kéo cả tác vụ lúc khởi
       động vào — đó là TBT, một chỉ số khác, và gộp chung dưới tên INP là đo
       một thứ rồi gọi tên thứ khác. */
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) window.__long.push(e.duration);
    }).observe({ type: 'longtask' });
  });

  /* Đúng những thao tác người dùng thật làm: mở câu hỏi, đổi gói hàng, gõ vào
     ô nhập, bấm nút chuyển trang. Đo lúc trang đứng yên là đo một trang không
     ai đang dùng. */
  /* CHỈ bấm thứ không rời trang: một liên kết điều hướng đi sẽ cuốn theo cả
     bộ đo, và lần đo sau đó không còn gì để đọc. */
  for (const sel of ['details summary', 'input[type="radio"]', 'a[href^="#"]', 'button:not([type="submit"])']) {
    const els = await page.$$(sel);
    for (const el of els.slice(0, 4)) {
      try {
        await el.scrollIntoViewIfNeeded({ timeout: 1000 });
        await el.click({ timeout: 1500, noWaitAfter: true });
        await page.waitForTimeout(90);
      } catch { /* phần tử bị che hoặc điều hướng đi — không phải lỗi phản hồi */ }
    }
  }
  const nameField = await page.$('#name');
  if (nameField) {
    try {
      await nameField.scrollIntoViewIfNeeded({ timeout: 1000 });
      await nameField.type('Nguyễn Thu Hà', { delay: 35 });
    } catch { /* biểu mẫu chưa bật vì build không có endpoint */ }
  }
  await page.waitForTimeout(250);

  const m = await page.evaluate(() => {
    if (!window.__ev) return { n: 0, max: -1, p75: 0, long: [] };
    const kinds = ['click', 'pointerdown', 'pointerup', 'keydown', 'keyup', 'input', 'change'];
    const d = window.__ev.filter((e) => kinds.includes(e.n)).map((e) => e.d).sort((a, b) => a - b);
    return {
      n: d.length,
      max: d.length ? Math.round(d[d.length - 1]) : 0,
      p75: d.length ? Math.round(d[Math.min(d.length - 1, Math.floor(d.length * 0.75))]) : 0,
      long: window.__long.filter((x) => x > 50).map((x) => Math.round(x)),
    };
  });

  /* max === -1 nghĩa là bộ đo biến mất giữa chừng — coi là trượt, vì một phép
     đo không chạy còn nguy hiểm hơn một phép đo xấu: nó báo xanh. */
  check(`${path} — INP tệ nhất`, m.max >= 0 && m.max <= INP_MAX,
    `${m.max}ms / ${INP_MAX}ms (p75 ${m.p75}ms, ${m.n} tương tác)`);
  check(`${path} — tác vụ dài`, m.long.length === 0,
    m.long.length ? `${m.long.length} tác vụ > ${LONGTASK_MAX}ms: ${m.long.join(', ')}` : 'không có');

  await page.close();
}

await browser.close();
server.close();

console.log('\nĐộ phản hồi tương tác\n');
for (const r of results) {
  console.log(`  ${r.ok ? 'ĐẠT ' : 'TRƯỢT'} ${r.name.padEnd(34)} ${r.detail}`);
}
if (failed) {
  console.error(`\n${failed}/${results.length} phép đo trượt.\n`);
  process.exit(1);
}
console.log(`\n  ${results.length}/${results.length} phép đo đạt.\n`);
