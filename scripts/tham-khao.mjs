/**
 * Chụp một trang web về để tham khảo bố cục.
 *
 *   node scripts/tham-khao.mjs <url> [--wait 2000]
 *
 * Lưu vào refs/<tên-miền>/<đường-dẫn>/ : ảnh toàn trang desktop + mobile, HTML
 * sau khi trình duyệt dựng xong, và một file ghi chú rút ra cấu trúc trang.
 *
 * Vì sao cần: đọc mã của chính mình không cho biết trang trông ra sao, và đọc
 * mô tả của người khác không cho biết họ sắp xếp bằng chứng thế nào. Xem ảnh thì
 * biết. Toàn bộ refs/ nằm trong .gitignore — nội dung trong đó là của người khác.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const [, , target, ...rest] = process.argv;
if (!target) {
  console.error('Dùng: node scripts/tham-khao.mjs <url> [--wait 2000]');
  process.exit(1);
}

const waitFlag = rest.indexOf('--wait');
const settle = waitFlag >= 0 ? Number(rest[waitFlag + 1]) || 2000 : 1200;

const url = new URL(target);
const slug = url.pathname.replace(/^\/|\/$/g, '').replace(/[^\w.-]+/g, '-') || 'trang-chu';
const outDir = path.join('refs', url.hostname, slug);
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch();

/** Cuộn hết trang một lượt: phần lớn trang thương mại chỉ nạp ảnh khi cuộn tới. */
async function fullPageShot(width, height, file) {
  const page = await browser.newPage({ viewport: { width, height } });
  await page.goto(url.href, { waitUntil: 'networkidle', timeout: 60_000 });
  await page.addStyleTag({ content: 'html{scroll-behavior:auto!important}' }).catch(() => {});
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 500) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(settle);
  await page.screenshot({ path: path.join(outDir, file), fullPage: true });
  return page;
}

const desktop = await fullPageShot(1440, 900, 'desktop.png');
const mobile = await fullPageShot(390, 844, 'mobile.png');
await mobile.close();

await writeFile(path.join(outDir, 'trang.html'), await desktop.content(), 'utf8');

/* Ghi chú: chỉ lấy khung xương — tiêu đề các cấp, số ảnh, số khối dữ liệu có
   cấu trúc. Đủ để so sánh cách tổ chức trang, không phải để chép nội dung. */
const notes = await desktop.evaluate(() => ({
  title: document.title,
  description: document.querySelector('meta[name=description]')?.content ?? null,
  h1: [...document.querySelectorAll('h1')].map((e) => e.textContent.trim()),
  h2: [...document.querySelectorAll('h2')].map((e) => e.textContent.trim()).slice(0, 40),
  soAnh: document.images.length,
  soKhoiJsonLd: document.querySelectorAll('script[type="application/ld+json"]').length,
  chieuCaoTrang: document.documentElement.scrollHeight,
}));
await writeFile(
  path.join(outDir, 'ghi-chu.json'),
  JSON.stringify({ url: url.href, chupLuc: new Date().toISOString(), ...notes }, null, 2),
  'utf8',
);

await desktop.close();
await browser.close();

console.log(`Đã lưu vào ${outDir}/`);
console.log(`  desktop.png · mobile.png · trang.html · ghi-chu.json`);
console.log(`  H1: ${notes.h1[0] ?? '(không có)'} — ${notes.h2.length} mục H2, ${notes.soAnh} ảnh`);
