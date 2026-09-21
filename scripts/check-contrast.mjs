/**
 * Cổng tương phản màu.
 *
 * tokens.css có ghi tỉ lệ tương phản trong chú thích — nhưng đó là những con số
 * VIẾT TAY. Chúng đúng vào ngày ai đó tính ra, rồi im lặng sai đi ở lần đổi màu
 * kế tiếp, vì không gì buộc chúng phải đúng.
 *
 * Chuyện đó đã xảy ra thật: khối `timeline` thêm vào đêm 21/09 dùng #6d76e4 làm
 * nền cho chữ trắng cỡ nhỏ — 3,92:1, trượt AA. Không cổng nào bắt được, và nhìn
 * bằng mắt thì nó vẫn "xanh đậm, chữ trắng, chắc ổn".
 *
 * Script này đọc giá trị hex THẬT từ tokens.css rồi tính lại, nên bảng bên dưới
 * không thể lệch khỏi màu đang dùng. Nó không tự tìm ra mọi cặp trên trang —
 * việc đó cần render và dò từng pixel. Nó canh đúng những cặp đã khai, và mỗi
 * lần thêm màu mới thì khai thêm một dòng.
 *
 * Ngưỡng theo WCAG 2.1 AA: 4,5:1 cho chữ thường, 3:1 cho chữ lớn (>=18,66px đậm
 * hoặc >=24px) và cho thành phần giao diện không phải chữ.
 */
import { readFileSync } from 'node:fs';

const css = readFileSync('src/styles/tokens.css', 'utf8');

/** Đọc `--ten: #rrggbb;` từ tokens.css. Thiếu token là lỗi, không phải bỏ qua. */
function token(name) {
  const m = css.match(new RegExp(`--${name}\\s*:\\s*(#[0-9a-fA-F]{3,8})`));
  if (!m) {
    console.error(`  ✗  không tìm thấy token --${name} trong tokens.css`);
    process.exitCode = 1;
    return '#000000';
  }
  return m[1];
}

function rgb(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = [...h].map((c) => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminance(hex) {
  const [r, g, b] = rgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(fg, bg) {
  const a = luminance(fg);
  const b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const WHITE = '#ffffff';

/**
 * Cặp màu đang dùng thật trên trang.
 *
 * `min` là ngưỡng áp cho cặp đó: 4.5 khi là chữ thường, 3 khi là chữ lớn hoặc
 * là nét đồ hoạ mang nghĩa (viền ô nhập, dấu sáng/tối). Hạ một cặp xuống 3 phải
 * kèm lý do ngay tại dòng đó, không hạ vì cho tiện.
 */
const PAIRS = [
  // --- chữ trên nền ---
  ['ink', 'paper', 4.5, 'chữ thân bài trên nền giấy'],
  ['ink', 'bone', 4.5, 'chữ thân bài trên nền xương'],
  ['ink-navy', 'paper', 4.5, 'tiêu đề trên nền giấy'],
  ['ink-navy', 'bone', 4.5, 'tiêu đề trên nền xương'],
  ['ink-muted', 'paper', 4.5, 'chữ phụ trên nền giấy'],
  ['ink-muted', 'bone', 4.5, 'chữ phụ trên nền xương'],
  ['slate', 'paper', 4.5, 'chú thích nhỏ trên nền giấy'],
  ['slate', 'bone', 4.5, 'chú thích nhỏ trên nền xương'],
  ['cobalt', 'paper', 4.5, 'liên kết trên nền giấy'],
  ['cobalt', 'bone', 4.5, 'liên kết trên nền xương'],

  // --- chữ trắng trên nền đặc ---
  [WHITE, 'cobalt', 4.5, 'chữ trên nút chính và trên dải mốc thời gian 1'],
  [WHITE, 'cobalt-lift', 4.5, 'chữ trên dải mốc thời gian 2'],
  [WHITE, 'bar-late', 4.5, 'chữ trên dải mốc thời gian 3 (nhóm cần lâu nhất)'],
  [WHITE, 'ink-navy', 4.5, 'chữ trên dải nền đậm'],

  // --- nét đồ hoạ mang nghĩa, ngưỡng 3:1 theo WCAG 1.4.11 ---
  ['line-control', 'paper', 3, 'viền ô nhập — người dùng phải thấy ô ở đâu'],
  ['line-control', 'paper', 3, 'vạch trục mốc thời gian — khối này dùng nền paper'],
  ['amber-edge', 'amber-note', 4.5, 'chữ trong ô cảnh báo vàng'],
  ['amber-ink', 'amber-note', 4.5, 'chữ đậm trong ô cảnh báo vàng'],
  ['verify', 'paper', 4.5, 'chấm xác minh trên nền giấy'],
];

const fails = [];
const rows = [];

for (const [fg, bg, min, why] of PAIRS) {
  const f = fg.startsWith('#') ? fg : token(fg);
  const b = bg.startsWith('#') ? bg : token(bg);
  const r = ratio(f, b);
  const ok = r >= min;
  rows.push({ why, r, min, ok });
  if (!ok) fails.push(`${why}: ${r.toFixed(2)}:1, cần ${min}:1 (${f} trên ${b})`);
}

console.log('\nTương phản màu (WCAG 2.1 AA)\n');
for (const row of rows) {
  const tag = row.ok ? 'ĐẠT ' : 'TRƯỢT';
  console.log(`  ${tag} ${row.why.padEnd(52)} ${row.r.toFixed(2).padStart(6)}:1  (cần ${row.min})`);
}

if (fails.length) {
  console.error(
    `\n${fails.length}/${PAIRS.length} cặp trượt ngưỡng:\n` +
    fails.map((f) => `  ✗  ${f}`).join('\n') +
    '\n\nĐổi màu cho đạt, hoặc nếu là nét đồ hoạ chứ không phải chữ thì hạ ngưỡng ' +
    'xuống 3 KÈM lý do ghi ngay tại dòng đó.\n'
  );
  process.exit(1);
}
console.log(`\n  ${PAIRS.length}/${PAIRS.length} cặp đạt ngưỡng.\n`);
