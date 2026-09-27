/**
 * Cổng đáp ứng — đo trên trình duyệt thật, ở 16 bề ngang.
 *
 *   node scripts/check-responsive.mjs
 *   node scripts/check-responsive.mjs --md docs/responsive-qa.md
 *   node scripts/check-responsive.mjs --shots .responsive-shots
 *
 * Chỉ đo những thứ ĐẾM ĐƯỢC. "Trông có cân không" thì để mắt người; một luật
 * thẩm mỹ chặn build là luật sẽ bị tắt trong một tuần.
 *
 * Bốn phép đo, mỗi phép ứng với một lỗi đã từng xảy ra thật:
 *   1. tràn ngang   — thanh cuộn ngang ở khổ hẹp, lỗi hay gặp nhất và tệ nhất
 *   2. phần tử tràn — biết ĐÚNG phần tử nào gây tràn, không chỉ biết là có
 *   3. vùng chạm    — WCAG 2.2 AA (2.5.8) đòi tối thiểu 24×24 CSS px
 *   4. thanh CTA    — nó dính đáy, nên phải kiểm nó không che nút gửi đơn
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, extname } from 'node:path';
import { createRequire } from 'node:module';
import { launchBrowser } from '../tests/_launch.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const args = process.argv.slice(2);
const mdIndex = args.indexOf('--md');
const mdPath = mdIndex >= 0 ? args[mdIndex + 1] : null;
const shotIndex = args.indexOf('--shots');
const shotDir = shotIndex >= 0 ? args[shotIndex + 1] : null;
const PORT = 8171;

/* Bề ngang lấy từ máy thật, không phải từ "breakpoint đẹp": 320 là máy nhỏ
   nhất còn dùng, 430 là iPhone Pro Max, 834/912 là tablet, 1920 là màn rộng. */
const WIDTHS = [320, 360, 375, 390, 412, 430, 480, 768, 820, 834, 912, 1024, 1280, 1440, 1536, 1920];

const PAGES = [
  { path: '/', label: 'trang chủ' },
  { path: '/combo-nam/', label: 'landing combo (bundle)' },
  { path: '/uv-block-sunscreen/', label: 'landing đơn (single-product)' },
  { path: '/retinol-mixpeel-kit/', label: 'landing giáo dục (education-led)' },
  { path: '/nam-tham/', label: 'trang dòng' },
  { path: '/goc-tu-van/nam-noi-tiet-la-gi/', label: 'bài tư vấn' },
  { path: '/chinh-sach/chinh-sach-doi-tra/', label: 'trang chính sách' },
  { path: '/404.html', label: 'trang 404' },
];

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.avif': 'image/avif',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2',
  '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8', '.json': 'application/json',
};

const server = createServer((req, res) => {
  let rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (!extname(rel)) rel = join(rel, 'index.html');
  const file = join('dist', rel);
  if (!existsSync(file)) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(PORT, r));

if (shotDir) mkdirSync(shotDir, { recursive: true });

const browser = await launchBrowser(chromium);
const results = [];

for (const pg of PAGES) {
  for (const w of WIDTHS) {
    const ctx = await browser.newContext({
      viewport: { width: w, height: w < 768 ? 844 : 900 },
      deviceScaleFactor: 1,
      reducedMotion: 'reduce',
    });
    const page = await ctx.newPage();
    let r;
    try {
      await page.goto(`http://localhost:${PORT}${pg.path}`, { waitUntil: 'load', timeout: 30000 });
      r = await page.evaluate(() => {
        const vw = document.documentElement.clientWidth;
        const overflow = document.documentElement.scrollWidth - vw;

        /* Phần tử nào tràn: bỏ qua thứ CỐ Ý cuộn ngang (bảng trong khung
           overflow-x:auto) bằng cách chỉ tính phần tử có mép phải vượt khung
           mà không nằm trong một tổ tiên tự cuộn được. */
        const scrollableAncestor = (el) => {
          for (let p = el.parentElement; p; p = p.parentElement) {
            const ov = getComputedStyle(p).overflowX;
            if (ov === 'auto' || ov === 'scroll') return true;
          }
          return false;
        };
        const offenders = [];
        for (const el of document.querySelectorAll('body *')) {
          const b = el.getBoundingClientRect();
          if (b.width === 0 && b.height === 0) continue;
          if (b.right > vw + 1 || b.left < -1) {
            if (scrollableAncestor(el)) continue;
            offenders.push(
              el.tagName.toLowerCase() +
              (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/)[0] : '') +
              ` (${Math.round(b.left)}..${Math.round(b.right)})`,
            );
          }
          if (offenders.length >= 4) break;
        }

        /* Vùng chạm: WCAG 2.2 AA 2.5.8 — tối thiểu 24x24 CSS px.

           Ba nhóm được loại, và cả ba đều là miễn trừ THẬT chứ không phải nới
           tay cho dễ xanh:
             1. phần tử không hiển thị (checkVisibility) — không chạm vào được;
             2. phần tử nằm trong <details> đang đóng — menu thả xuống của thanh
                điều hướng. Bản đầu của cổng này báo 8 "vùng chạm nhỏ" mỗi trang
                vì đo các liên kết trong menu ĐANG ĐÓNG: hộp bao của chúng là
                12x75 do khung cha bị thu lại, một con số không nói gì về ngón
                tay người dùng;
             3. phần tử ẩn thị giác kiểu sr-only (clip rect rỗng) — liên kết bỏ
                qua điều hướng chỉ hiện khi được focus, và lúc đó nó đủ lớn.
           Liên kết nằm trong câu văn cũng được miễn, đúng như tiêu chí ghi. */
        const small = [];
        const clipped = (el) => {
          const c = getComputedStyle(el).clip;
          return c === 'rect(0px, 0px, 0px, 0px)';
        };
        for (const el of document.querySelectorAll('a[href], button, input, select, summary')) {
          const b = el.getBoundingClientRect();
          if (b.width === 0 || b.height === 0) continue;
          if (typeof el.checkVisibility === 'function' && !el.checkVisibility({
            visibilityProperty: true, opacityProperty: true, contentVisibilityAuto: true,
          })) continue;
          if (el.closest('details:not([open])')) continue;
          if (clipped(el) || el.closest('.sr-only')) continue;
          const inProse = el.closest('p, li');
          if (inProse && el.tagName === 'A') continue;
          if (b.width < 24 || b.height < 24) {
            small.push(`${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/)[0] : ''} ${Math.round(b.width)}x${Math.round(b.height)}`);
          }
          if (small.length >= 4) break;
        }

        /* Bảng thả xuống của điều hướng — ĐO CẢ KHI MENU ĐANG ĐÓNG.

           Bảng dùng visibility:hidden nên nó VẪN có hộp bố cục. Lần chẩn
           đoán trước đo ra các liên kết rộng 12–18px và tôi loại chúng đi với
           lý do "menu đang đóng thì số đo không nói gì về ngón tay". Lý do ấy
           đúng cho phép đo VÙNG CHẠM, nhưng sai cho BỐ CỤC: cột teo lúc đóng
           thì cũng teo lúc mở. Và đó đúng là lỗi đã lọt ra production — mỗi
           tên sản phẩm rớt thành một cột chữ dọc, mỗi dòng một ký tự.

           Một phần giao diện chỉ hiện sau tương tác vẫn là giao diện. */
        const menu = [];
        for (const panel of document.querySelectorAll('.panel-cols')) {
          const pb = panel.getBoundingClientRect();
          if (pb.width > 0 && pb.right > vw + 1) {
            menu.push(`bảng tràn phải ${Math.round(pb.right - vw)}px`);
          }
          for (const a of panel.querySelectorAll('a')) {
            const t = (a.textContent || '').trim();
            if (t.length <= 3) continue;
            const ab = a.getBoundingClientRect();
            if (ab.height === 0) continue;
            /* Dấu hiệu của "chữ bị xé thành cột dọc" là SỐ DÒNG, không phải
               bề rộng. Hai ngưỡng theo bề rộng đã thử đều báo nhầm: 80px cứng
               bắt nhầm nút gọn hai dòng, còn ngưỡng theo cỡ chữ bắt nhầm nhãn
               ngắn như "Zalo" hay "EN". Cả hai đều hẹp mà không hỏng.

               "Combo Nám Mocha" 15 ký tự render thành 15 dòng thì hỏng.
               Một tên sản phẩm dài xuống 2–3 dòng thì bình thường. */
            const cs2 = getComputedStyle(a);
            const lh = parseFloat(cs2.lineHeight) || (parseFloat(cs2.fontSize) || 16) * 1.2;
            const lines = Math.round(ab.height / lh);
            if (lines >= 4 && lines > t.length / 4) {
              menu.push(`"${t.slice(0, 22)}" bị xé thành ${lines} dòng cho ${t.length} ký tự`);
            }
            if (menu.length >= 4) break;
          }
        }
        /* Thanh CTA dính đáy không được che nút gửi đơn. */
        const sticky = document.querySelector('.sticky-cta, [data-sticky-cta]');
        let stickyCovers = false;
        if (sticky && getComputedStyle(sticky).display !== 'none') {
          const sb = sticky.getBoundingClientRect();
          const submit = document.querySelector('#order-form button[type="submit"]');
          if (submit) {
            submit.scrollIntoView({ block: 'center' });
            const ub = submit.getBoundingClientRect();
            stickyCovers = ub.bottom > sb.top && ub.top < sb.bottom;
          }
        }

        return {
          overflow, offenders, small, stickyCovers, menu,
          stickyVisible: !!sticky && getComputedStyle(sticky).display !== 'none',
          docWidth: document.documentElement.scrollWidth, vw,
        };
      });
      if (shotDir && [390, 768, 1280].includes(w)) {
        const name = (pg.path.replace(/[\/.]/g, '_') || 'home') + `_${w}.png`;
        await page.screenshot({ path: join(shotDir, name), fullPage: false });
      }
    } catch (e) {
      r = { error: String(e.message ?? e).split('\n')[0] };
    }
    results.push({ page: pg, width: w, ...r });
    await ctx.close();
  }
}
await browser.close();
server.close();

/* ---------------- báo cáo ---------------- */
const bad = results.filter((r) => r.error || r.overflow > 0 || r.small?.length || r.stickyCovers || r.menu?.length);
console.log(`\nQA đáp ứng — ${PAGES.length} trang × ${WIDTHS.length} bề ngang = ${results.length} phép đo\n`);
for (const pg of PAGES) {
  const rows = results.filter((r) => r.page.path === pg.path);
  const issues = rows.filter((r) => r.error || r.overflow > 0 || r.small?.length || r.stickyCovers);
  const mark = issues.length ? 'LỖI ' : 'ĐẠT ';
  console.log(`  ${mark} ${pg.path.padEnd(38)} ${pg.label}`);
  for (const r of issues) {
    const what = r.error ? `lỗi: ${r.error}`
      : [
        r.overflow > 0 ? `tràn ngang ${r.overflow}px (${r.docWidth} > ${r.vw})` : '',
        r.offenders?.length ? `do: ${r.offenders.join(', ')}` : '',
        r.small?.length ? `vùng chạm nhỏ: ${r.small.join(', ')}` : '',
        r.stickyCovers ? 'thanh CTA che nút gửi đơn' : '',
        r.menu?.length ? 'menu thả xuống: ' + r.menu.join('; ') : '',
      ].filter(Boolean).join(' | ');
    console.log(`         ${String(r.width).padStart(4)}px  ${what}`);
  }
}
console.log(`\n  ${results.length - bad.length}/${results.length} phép đo đạt.\n`);

if (mdPath) {
  const L = [];
  L.push('# QA đáp ứng');
  L.push('');
  L.push(`> Sinh tự động bằng \`npm run check:responsive -- --md ${mdPath}\`. Đừng sửa tay.`);
  L.push(`> Chạy ngày ${new Date().toISOString().slice(0, 10)} trên Chromium (Chrome cài sẵn trên máy).`);
  L.push('');
  L.push('## Cách đo');
  L.push('');
  L.push('Mỗi trang mở ở 16 bề ngang, lấy từ máy thật chứ không từ "breakpoint đẹp":');
  L.push('');
  L.push('```');
  L.push(WIDTHS.join('  '));
  L.push('```');
  L.push('');
  L.push('Bốn phép đo, mỗi phép ứng với một lỗi từng xảy ra thật:');
  L.push('');
  L.push('| Phép đo | Ngưỡng | Vì sao |');
  L.push('| --- | --- | --- |');
  L.push('| Tràn ngang | `scrollWidth <= clientWidth` | thanh cuộn ngang ở khổ hẹp là lỗi bố cục hay gặp và khó chịu nhất |');
  L.push('| Phần tử gây tràn | không có | biết đúng phần tử nào, không chỉ biết là có |');
  L.push('| Vùng chạm | ≥ 24×24 CSS px | WCAG 2.2 AA 2.5.8; link trong câu văn được miễn trừ |');
  L.push('| Thanh CTA dính đáy | không đè nút gửi đơn | nó nổi trên nội dung nên phải kiểm, không suy luận |');
  L.push('| Bảng thả xuống | không tràn; liên kết ≥ 80px | đo cả khi menu đóng — nó vẫn có hộp bố cục |');
  L.push('');
  L.push('Bảng có `overflow-x: auto` được loại khỏi phép đo tràn: chúng cuộn ngang');
  L.push('**có chủ ý**, và đó là cách đúng để một bảng nhiều cột sống trên màn hình hẹp.');
  L.push('');
  L.push('## Kết quả');
  L.push('');
  L.push('| Trang | Vai trò | Bề ngang đạt | Vấn đề |');
  L.push('| --- | --- | ---: | --- |');
  for (const pg of PAGES) {
    const rows = results.filter((r) => r.page.path === pg.path);
    const issues = rows.filter((r) => r.error || r.overflow > 0 || r.small?.length || r.stickyCovers);
    const detail = issues.length
      ? issues.map((r) => `${r.width}px: ${r.error ?? (r.overflow > 0 ? `tràn ${r.overflow}px` : '') }${r.small?.length ? ' vùng chạm nhỏ' : ''}${r.stickyCovers ? ' CTA che nút' : ''}`).join('; ')
      : 'không';
    L.push(`| \`${pg.path}\` | ${pg.label} | ${rows.length - issues.length}/${rows.length} | ${detail} |`);
  }
  L.push('');
  L.push(`**Tổng: ${results.length - bad.length}/${results.length} phép đo đạt.**`);
  L.push('');
  L.push('## Những gì phép đo này KHÔNG nói');
  L.push('');
  L.push('Không tràn ngang không có nghĩa là bố cục đẹp. Cổng này bắt lỗi hỏng,');
  L.push('không chấm thẩm mỹ: nhịp thị giác, chỗ xuống dòng của tiêu đề và sức nặng');
  L.push('của ảnh vẫn phải nhìn bằng mắt. Ảnh chụp ở `--shots` là để làm việc đó.');
  L.push('');
  const CR = String.fromCharCode(13), LF = String.fromCharCode(10);
  let body = L.join(LF) + LF;
  if (existsSync(mdPath) && readFileSync(mdPath, 'utf8').includes(CR + LF)) body = body.split(LF).join(CR + LF);
  writeFileSync(mdPath, body);
  console.log(`  Đã ghi ${mdPath}\n`);
}

process.exit(bad.length ? 1 : 0);
