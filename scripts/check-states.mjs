/**
 * Quét các TRẠNG THÁI chỉ hiện sau tương tác.
 *
 * Vùng mù đã làm lọt lỗi menu: mọi phép đo trước đây chạy trên trạng thái
 * NGHỈ của trang. Tệp này mở/bấm/điền rồi mới đo, và chụp ảnh từng trạng thái
 * để nhìn được bằng mắt.
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, extname } from 'node:path';
import { createRequire } from 'node:module';

const ROOT = process.cwd();
const shotIdx = process.argv.indexOf('--shots');
const OUT = shotIdx >= 0 ? process.argv[shotIdx + 1] : null;
const { launchBrowser } = await import('../tests/_launch.mjs');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const PAGE_PORT = 8930, API_PORT = 8132;
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.avif': 'image/avif', '.woff2': 'font/woff2' };
const pages = createServer((q, r) => {
  let rel = decodeURIComponent(new URL(q.url, 'http://x').pathname);
  if (!extname(rel)) rel = join(rel, 'index.html');
  const f = join(ROOT, 'dist', rel);
  if (!existsSync(f)) { r.writeHead(404); r.end('x'); return; }
  r.writeHead(200, { 'Content-Type': MIME[extname(f)] ?? 'application/octet-stream' });
  r.end(readFileSync(f));
});
await new Promise((r) => pages.listen(PAGE_PORT, r));

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST,OPTIONS' };
let apiMode = 'ok';
const api = createServer((q, r) => {
  if (q.method === 'OPTIONS') { r.writeHead(204, CORS); r.end(); return; }
  let body = ''; q.on('data', (c) => body += c);
  q.on('end', () => {
    if (apiMode === 'fail') { r.writeHead(500, CORS); r.end('{}'); return; }
    r.writeHead(200, { 'Content-Type': 'application/json', ...CORS });
    r.end(JSON.stringify({ ok: true, orderCode: 'MC-STATE-1' }));
  });
});
await new Promise((r) => api.listen(API_PORT, r));

if (OUT) mkdirSync(OUT, { recursive: true });
const browser = await launchBrowser(chromium, { headless: true });
let pass = 0; const fail = [];
const ok = (n, c, d = '') => { if (c) { pass++; console.log(`  ĐẠT  ${n.padEnd(46)}${d}`); } else { fail.push(`${n} — ${d}`); console.log(`  LỖI  ${n.padEnd(46)}${d}`); } };

/** Đo bố cục hỏng: chữ bị ép thành cột dọc, tràn, chồng lấp. */
const layoutProbe = () => ({
  overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  narrowLinks: [...document.querySelectorAll('a, button')]
    .filter((e) => {
      const t = (e.textContent || '').trim();
      if (t.length <= 3) return false;
      const b = e.getBoundingClientRect();
      /* Cùng dấu hiệu với check-responsive: số dòng, không phải bề rộng. */
      const cs2 = getComputedStyle(e);
      const lh = parseFloat(cs2.lineHeight) || (parseFloat(cs2.fontSize) || 16) * 1.2;
      const lines = Math.round(b.height / lh);
      return b.height > 0 && b.width > 0 && lines >= 4 && lines > t.length / 4;
    })
    .slice(0, 4)
    .map((e) => `${(e.textContent || '').trim().slice(0, 20)}=${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`),
});

/* ---------- 1. Ngăn điều hướng mobile, MỞ ---------- */
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto(`http://localhost:${PAGE_PORT}/combo-nam/`, { waitUntil: 'load' });
  await page.waitForTimeout(400);
  const t = await page.$('.drawer summary, [aria-label*="menu" i], .drawer');
  if (t) { await t.click(); await page.waitForTimeout(500); }
  const r = await page.evaluate(layoutProbe);
  if (OUT) await page.screenshot({ path: join(OUT, 'state-drawer-390.png') });
  ok('drawer mobile mở: không tràn ngang', r.overflow <= 0, `tràn=${r.overflow}`);
  ok('drawer mobile mở: không có chữ ép cột dọc', r.narrowLinks.length === 0, r.narrowLinks.join(', ') || 'sạch');
  await ctx.close();
}

/* ---------- 2. FAQ mở hết ---------- */
for (const w of [390, 1280]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: w < 768 ? 844 : 900 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto(`http://localhost:${PAGE_PORT}/combo-nam/`, { waitUntil: 'load' });
  await page.evaluate(() => { document.querySelectorAll('#faq details').forEach((d) => { d.open = true; }); });
  await page.waitForTimeout(400);
  const r = await page.evaluate(() => {
    const probe = {
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
    const sec = document.querySelector('#faq');
    const answers = [...sec.querySelectorAll('details[open] .answer, details[open] p')];
    probe.clipped = answers.filter((a) => {
      const b = a.getBoundingClientRect();
      return b.right > document.documentElement.clientWidth + 1 || b.width < 60;
    }).length;
    probe.n = answers.length;
    return probe;
  });
  await page.evaluate(() => document.querySelector('#faq').scrollIntoView());
  await page.waitForTimeout(300);
  if (OUT) await page.screenshot({ path: join(OUT, `state-faq-${w}.png`) });
  ok(`${w}px FAQ mở hết: không tràn`, r.overflow <= 0, `tràn=${r.overflow}`);
  ok(`${w}px FAQ mở hết: câu trả lời không bị cắt`, r.clipped === 0, `${r.clipped}/${r.n} bị cắt`);
  await ctx.close();
}

/* ---------- 3. Bảng so sánh cuộn hết sang phải ---------- */
for (const w of [390, 768]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 844 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto(`http://localhost:${PAGE_PORT}/uv-block-sunscreen/`, { waitUntil: 'load' });
  await page.waitForTimeout(400);
  const r = await page.evaluate(() => {
    const wrap = document.querySelector('#so-sanh .scroll, #so-sanh [tabindex="0"]');
    if (!wrap) return { none: true };
    wrap.scrollLeft = wrap.scrollWidth;
    const tb = wrap.querySelector('table');
    const cells = [...wrap.querySelectorAll('tbody td')].slice(-3)
      .map((c) => Math.round(c.getBoundingClientRect().width));
    return {
      scrollable: wrap.scrollWidth > wrap.clientWidth,
      atEnd: Math.abs(wrap.scrollLeft + wrap.clientWidth - wrap.scrollWidth) < 3,
      lastCells: cells, tableW: tb ? Math.round(tb.getBoundingClientRect().width) : 0,
    };
  });
  if (!r.none) {
    await page.evaluate(() => document.querySelector('#so-sanh').scrollIntoView());
    await page.waitForTimeout(300);
    if (OUT) await page.screenshot({ path: join(OUT, `state-compare-${w}.png`) });
    ok(`${w}px bảng so sánh: cuộn tới cuối được`, !r.scrollable || r.atEnd, `scrollable=${r.scrollable} atEnd=${r.atEnd}`);
    ok(`${w}px bảng so sánh: ô cuối không teo`, r.lastCells.every((c) => c >= 60), r.lastCells.join('/'));
  }
  await ctx.close();
}

/* ---------- 4. Form: trạng thái LỖI ---------- */
{
  apiMode = 'fail';
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto(`http://localhost:${PAGE_PORT}/combo-nam/`, { waitUntil: 'load' });
  await page.evaluate(() => document.querySelector('#dat-hang').scrollIntoView());
  await page.fill('#name', 'Nguyen Van Test');
  await page.fill('#phone', '0900000123');
  const a = await page.$('#address'); if (a) await a.fill('12 Duong Test');
  const c = await page.$('input[name=dataConsent]'); if (c) await c.check();
  await page.click('#order-form button[type=submit]');
  await page.waitForTimeout(1200);
  const r = await page.evaluate(() => {
    const err = document.getElementById('form-error');
    const b = err.getBoundingClientRect();
    return {
      shown: !err.hidden, w: Math.round(b.width), h: Math.round(b.height),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      btnEnabled: !document.querySelector('#order-form button[type=submit]').disabled,
      text: err.textContent.replace(/\s+/g, ' ').trim().slice(0, 60),
    };
  });
  if (OUT) await page.screenshot({ path: join(OUT, 'state-form-error-390.png') });
  ok('form lỗi: hiện thông báo', r.shown, r.text);
  ok('form lỗi: không tràn ngang', r.overflow <= 0, `tràn=${r.overflow}`);
  ok('form lỗi: gửi lại được', r.btnEnabled, `nút bật=${r.btnEnabled}`);
  await ctx.close();
}

/* ---------- 5. Form: trạng thái THÀNH CÔNG ---------- */
{
  apiMode = 'ok';
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto(`http://localhost:${PAGE_PORT}/combo-nam/`, { waitUntil: 'load' });
  await page.evaluate(() => document.querySelector('#dat-hang').scrollIntoView());
  await page.fill('#name', 'Nguyen Van Test');
  await page.fill('#phone', '0900000123');
  const a = await page.$('#address'); if (a) await a.fill('12 Duong Test');
  const c = await page.$('input[name=dataConsent]'); if (c) await c.check();
  await page.click('#order-form button[type=submit]');
  await page.waitForTimeout(1200);
  const r = await page.evaluate(() => {
    const okBox = document.getElementById('form-success');
    const b = okBox.getBoundingClientRect();
    return {
      shown: !okBox.hidden, inView: b.top < window.innerHeight && b.bottom > 0,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      code: (document.getElementById('order-code') || {}).textContent || '',
      focus: document.activeElement.id,
    };
  });
  if (OUT) await page.screenshot({ path: join(OUT, 'state-form-ok-390.png') });
  ok('form thành công: hiện và nằm trong khung nhìn', r.shown && r.inView, `focus=${r.focus} mã=${r.code}`);
  ok('form thành công: không tràn ngang', r.overflow <= 0, `tràn=${r.overflow}`);
  await ctx.close();
}

await browser.close(); pages.close(); api.close();
console.log(`\n${pass} đạt, ${fail.length} lỗi`);
if (fail.length) { console.log('Lỗi:\n  ' + fail.join('\n  ')); process.exit(1); }
