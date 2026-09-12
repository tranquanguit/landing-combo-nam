import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { gzipSync } from 'node:zlib';

/**
 * Ngân sách trọng lượng. Trước đây con số này chỉ nằm trong tài liệu, nên nó
 * không ràng buộc được gì. Vượt ngân sách là fail CI.
 */
const BUDGET = {
  htmlGzip: 24 * 1024,     // mỗi trang HTML sau khi nén
  /**
   * JS nội tuyến trên một trang, đo byte thô đã minify (chi phí phân tích cú
   * pháp); sau nén còn khoảng một phần ba.
   *
   * LỊCH SỬ THAY ĐỔI NGƯỠNG — ghi lại để việc nới không diễn ra âm thầm.
   * Một kiểm định viên độc lập đã chỉ ra: "một cổng mà người vi phạm tự sửa
   * được ngưỡng trong cùng commit thì không ràng buộc được ai". Đúng. Nên mỗi
   * lần nâng phải nêu lý do và nêu đã cắt được gì trước khi nâng.
   *
   *  4 KB — ban đầu (vòng 8): chỉ có kiểm tra biểu mẫu.
   *  6 KB — vòng 9: thêm lớp đo lường chuyển đổi. Không cắt được gì trước đó.
   *  7 KB — vòng 12: thêm luồng đồng ý hai chiều (đồng ý / từ chối / rút lại),
   *         trạng thái gửi đơn và chuyển focus sau khi gửi. TRƯỚC KHI NÂNG đã
   *         cắt: theo dõi độ sâu cuộn (cũng là nguồn cưỡng bức reflow), hai
   *         bảng ánh xạ sự kiện trùng nhau, và handler dọn listener thừa —
   *         tổng cộng khoảng 590 byte. Phần còn lại là chức năng đang dùng.
   */
  inlineJs: 7 * 1024,
  fontsTotal: 120 * 1024,  // tổng font tải lần đầu
  imageMax: 120 * 1024,    // một tệp ảnh đã build
  mediaMax: 1.5 * 1024 * 1024, // một tệp video/audio
  /** Tổng mọi tài nguyên trong dist, trừ ảnh biến thể không dùng tới. */
  pageTotal: 700 * 1024,
};

/* Những thứ ngân sách cũ không đếm và vì thế không ràng buộc được gì:
   video, svg, gif, font ngoài woff2, iframe bên thứ ba, và tổng trọng lượng. */
const HEAVY_MEDIA = /\.(mp4|webm|mov|m4v|mp3|wav|ogg)$/i;
const IMAGE = /\.(avif|webp|jpg|jpeg|png|gif|svg)$/i;
const FONT = /\.(woff2|woff|ttf|otf|eot)$/i;

const dist = 'dist';
const fail = [];
const ok = [];

const walk = (dir) => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? walk(p) : [p];
});

const files = walk(dist);

for (const f of files.filter((f) => f.endsWith('.html'))) {
  const raw = readFileSync(f);
  const gz = gzipSync(raw, { level: 9 }).length;
  const js = [...raw.toString().matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)]
    .filter((m) => !m[0].includes('application/ld+json'))
    .reduce((n, m) => n + Buffer.byteLength(m[1]), 0);
  (gz <= BUDGET.htmlGzip ? ok : fail).push(`${f}: HTML gzip ${gz}B / ${BUDGET.htmlGzip}B`);
  (js <= BUDGET.inlineJs ? ok : fail).push(`${f}: JS nội tuyến ${js}B / ${BUDGET.inlineJs}B`);
}

const fonts = files.filter((f) => FONT.test(f))
  .reduce((n, f) => n + statSync(f).size, 0);
(fonts <= BUDGET.fontsTotal ? ok : fail).push(`font: ${fonts}B / ${BUDGET.fontsTotal}B`);

for (const f of files.filter((f) => IMAGE.test(f))) {
  const s = statSync(f).size;
  if (s > BUDGET.imageMax) fail.push(`${f}: ảnh ${s}B / ${BUDGET.imageMax}B`);
}

for (const f of files.filter((f) => HEAVY_MEDIA.test(f))) {
  const s = statSync(f).size;
  if (s > BUDGET.mediaMax) fail.push(`${f}: media ${s}B / ${BUDGET.mediaMax}B`);
}

/* Tài nguyên bên thứ ba nhúng sẵn trong HTML: iframe, script, stylesheet, font CDN.
   Chúng không nằm trong dist nên mọi luật cân file đều không thấy. */
for (const f of files.filter((f) => f.endsWith('.html'))) {
  const html = readFileSync(f).toString();
  const iframes = [...html.matchAll(/<iframe[^>]*\bsrc=["']([^"']+)/gi)].map((m) => m[1]);
  if (iframes.length) fail.push(`${f}: có ${iframes.length} iframe nhúng sẵn (${iframes[0]})`);
  /* Chỉ tính thứ thật sự tải về lúc dựng trang: script và stylesheet/font.
     canonical và hreflang cũng là thẻ link nhưng không tải gì. */
  const external = [
    ...[...html.matchAll(/<script[^>]*\bsrc=["'](https?:\/\/[^"']+)/gi)].map((m) => m[1]),
    ...[...html.matchAll(/<link[^>]*\brel=["'](?:stylesheet|preload|preconnect)["'][^>]*\bhref=["'](https?:\/\/[^"']+)/gi)].map((m) => m[1]),
  ];
  if (external.length) fail.push(`${f}: nạp tài nguyên bên ngoài lúc tải (${external.join(', ')})`);
}

/* Tổng trọng lượng một lượt tải: HTML + font + biến thể ảnh lớn nhất mỗi ảnh gốc. */
const heaviest = new Map();
for (const f of files.filter((f) => IMAGE.test(f))) {
  const base = f.replace(/_[A-Za-z0-9-]+\.(avif|webp|jpg|jpeg|png)$/, '');
  heaviest.set(base, Math.max(heaviest.get(base) ?? 0, statSync(f).size));
}
const pageWeight = [...heaviest.values()].reduce((a, b) => a + b, 0)
  + fonts
  + Math.max(...files.filter((f) => f.endsWith('.html')).map((f) => statSync(f).size));
(pageWeight <= BUDGET.pageTotal ? ok : fail).push(
  `tổng một lượt tải (ước tính): ${pageWeight}B / ${BUDGET.pageTotal}B`);

/* Trang tạm dùng để thử hàng rào không được lọt lên production. */
const scratch = files
  .filter((f) => f.endsWith('index.html'))
  .filter((f) => /\/(zz-|test-|probe-)/.test(f));
if (scratch.length) {
  fail.push(`trang tạm lọt vào bản build: ${scratch.join(', ')}`);
}

for (const line of ok) console.log('  ok  ' + line);
if (fail.length) {
  console.error('\nVượt ngân sách:\n' + fail.map((l) => '  ✗  ' + l).join('\n'));
  process.exit(1);
}
console.log('\nTrong ngân sách.');
