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
   * JS nội tuyến trên một trang.
   *
   * Nâng từ 4KB lên 6KB khi thêm lớp đo lường ở vòng 9. Đây là quyết định có
   * chủ đích, không phải nới ngưỡng vì vượt: một landing quảng cáo không đo
   * được chuyển đổi thì không tối ưu được chiến dịch. Đổi lại, lớp đo lường
   * không nạp script bên thứ ba nào trước tương tác đầu tiên, và ở thị trường
   * EU/UK thì không nạp gì cho tới khi người dùng đồng ý.
   *
   * Con số này đo byte thô (chi phí phân tích cú pháp); sau nén còn khoảng 1/3.
   */
  inlineJs: 6 * 1024,
  fontsTotal: 120 * 1024,  // tổng font tải lần đầu
  imageMax: 120 * 1024,    // một tệp ảnh đã build
};

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

const fonts = files.filter((f) => extname(f) === '.woff2')
  .reduce((n, f) => n + statSync(f).size, 0);
(fonts <= BUDGET.fontsTotal ? ok : fail).push(`font: ${fonts}B / ${BUDGET.fontsTotal}B`);

for (const f of files.filter((f) => /\.(avif|webp|jpg|jpeg|png)$/.test(f))) {
  const s = statSync(f).size;
  if (s > BUDGET.imageMax) fail.push(`${f}: ảnh ${s}B / ${BUDGET.imageMax}B`);
}

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
