/**
 * Cổng bề rộng cột chữ, tính bằng KÝ TỰ THẬT.
 *
 * VÌ SAO CÓ CỔNG NÀY
 *
 * Đơn vị ch không phải một ký tự, nó là bề rộng chữ số 0. Ở Be Vietnam Pro
 * chữ số rộng bất thường: 16px thì 1ch = 10,82px còn ký tự tiếng Việt trung
 * bình 7,96px, tức 1ch = 1,36 ký tự. Vì thế `max-width: 68ch` viết ra với ý
 * "68 ký tự" lại cho một cột 92 ký tự thật, và không ai nhận ra bằng mắt —
 * con số trong CSS trông vẫn hợp lý.
 *
 * Cái bẫy này im lặng và quay lại dễ: chỉ cần ai đó viết thêm một max-width
 * tính bằng ch, hoặc đổi sang font có chữ số rộng hơn nữa. Nên phải đo trên
 * trang đã render, không đọc CSS.
 *
 * PHẠM VI HẸP LÀ CHỦ Ý
 *
 * Bản dò đầu tiên quét mọi <p>, <li>, <dd> và báo 149 chỗ vượt ngưỡng. Kiểm
 * lại thì phần lớn là phép đo sai: nó gộp tiêu đề với nội dung trong thẻ
 * card và hàng định nghĩa rồi tưởng đó là một cột chữ — dấu vết là những
 * chuỗi dính liền kiểu "thâm sạmNám", "0–3 ngàyBa ngày".
 *
 * Một cổng báo sai thì tệ hơn không có cổng: lần sau nó kêu, người ta sẽ bỏ
 * qua. Nên ở đây chỉ đo đúng hai chỗ người ta thật sự ĐỌC DÀI, và chỉ đo các
 * đoạn văn thuần không chứa phần tử con.
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, extname } from 'node:path';
import { createRequire } from 'node:module';

const { launchBrowser } = await import('../tests/_launch.mjs');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

/** Trên mức này thì mắt bắt đầu lạc dòng khi quét về đầu dòng sau. */
const MAX_CHARS = 80;

/** Chỉ hai vùng đọc dài. Thêm chỗ mới thì thêm vào đây có chủ ý. */
const COLUMNS = [
  { sel: '.prose p', name: 'thân bài (.prose)' },
  { sel: '.answer p, .answer li', name: 'câu trả lời FAQ (.answer)' },
];

const PORT = 8977;
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.woff2': 'font/woff2', '.webp': 'image/webp', '.avif': 'image/avif', '.svg': 'image/svg+xml',
};
const srv = createServer((q, r) => {
  let rel = decodeURIComponent(new URL(q.url, 'http://x').pathname);
  if (!extname(rel)) rel = join(rel, 'index.html');
  const f = join('dist', rel);
  if (!existsSync(f)) { r.writeHead(404); r.end('x'); return; }
  r.writeHead(200, { 'Content-Type': MIME[extname(f)] ?? 'application/octet-stream' });
  r.end(readFileSync(f));
});
await new Promise((r) => srv.listen(PORT, r));

const walk = (d, o = []) => {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) walk(p, o);
    else if (e.name === 'index.html') o.push(p);
  }
  return o;
};
/* Chỉ trang tiếng Việt: tỉ lệ ch/ký tự là của tiếng Việt, và bản tiếng Anh
   dùng chung CSS nên sửa một lần là xong cả hai. */
const routes = walk('dist')
  .map((f) => f.split(/[\\/]/).join('/').split('dist/')[1].replace(/index\.html$/, ''))
  .map((r) => '/' + r)
  .filter((r) => !r.startsWith('/en/') && !r.startsWith('/kien-truc'));

const browser = await launchBrowser(chromium, { headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
const page = await ctx.newPage();

const rows = [];
for (const route of routes) {
  await page.goto(`http://localhost:${PORT}${route}`, { waitUntil: 'load', timeout: 20000 });
  const hits = await page.evaluate((COLUMNS) => {
    /* Câu tiếng Việt thật, đủ dấu: mật độ ký tự trên pixel khác tiếng Anh. */
    const SAMPLE = 'Bước chống nắng buổi sáng là bắt buộc, bỏ bước này thì hai bước kia gần như vô nghĩa.';
    const cv = document.createElement('canvas').getContext('2d');
    const res = [];
    for (const { sel, name } of COLUMNS) {
      for (const el of document.querySelectorAll(sel)) {
        /* Chỉ đoạn văn thuần: có phần tử con khối thì không còn là một cột. */
        if (el.querySelector('p, li, dd, dt, h1, h2, h3, h4, div')) continue;
        const t = el.textContent.trim();
        if (t.length < 60) continue;
        const cs = getComputedStyle(el);
        cv.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
        const per = cv.measureText(SAMPLE).width / SAMPLE.length;
        if (!per || !isFinite(per)) continue;
        const w = el.getBoundingClientRect().width
          - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
        res.push({ name, chars: Math.round(w / per), w: Math.round(w), fs: cs.fontSize, t: t.slice(0, 46) });
      }
    }
    return res;
  }, COLUMNS);
  for (const h of hits) rows.push({ route, ...h });
}
await browser.close();
srv.close();

console.log(`\n── Bề rộng cột chữ (${routes.length} trang tiếng Việt @1440px) ──\n`);
console.log(`   Đơn vị ch không phải ký tự. Cổng đo trên trang đã render.`);
console.log(`   Ngưỡng: tối đa ${MAX_CHARS} ký tự thật một dòng.\n`);

if (!rows.length) {
  console.log('   LỖI  không đo được cột nào — selector đã lạc khỏi mã nguồn?\n');
  process.exit(1);
}

const byName = {};
for (const r of rows) (byName[r.name] ??= []).push(r);
let bad = 0;
for (const [name, a] of Object.entries(byName)) {
  const worst = a.reduce((m, x) => (x.chars > m.chars ? x : m));
  const ok = worst.chars <= MAX_CHARS;
  if (!ok) bad++;
  console.log(`   ${ok ? 'ĐẠT ' : 'LỖI '} ${name.padEnd(26)} ${a.length} đoạn · ` +
    `rộng nhất ${worst.chars} ký tự (${worst.w}px @ ${worst.fs})`);
  if (!ok) {
    for (const x of a.filter((x) => x.chars > MAX_CHARS).slice(0, 5)) {
      console.log(`          ${x.route}  ${x.chars} kt  "${x.t}"`);
    }
  }
}
console.log('');
if (bad) {
  console.log(`   ${bad} vùng vượt ngưỡng. Đặt max-width theo var(--measure-prose),`);
  console.log(`   đừng viết thẳng con số ch — xem chú thích trong tokens.css.\n`);
  process.exit(1);
}
process.exit(0);
