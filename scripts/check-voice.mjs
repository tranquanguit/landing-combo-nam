/**
 * Cổng văn phong tiếng Việt: chặn thói quen viết lặp một thủ pháp.
 *
 * VÌ SAO CÓ CỔNG NÀY
 *
 * Người đọc phàn nàn văn trên trang "bị hướng AI". Đo toàn bộ chữ hiển thị thì
 * những nghi ngờ quen thuộc đều KHÔNG đúng: từ rào đón thưa (chỉ 10% ô bảng
 * thành phần có "hỗ trợ"), độ dài câu đã rải đều (trung vị 13 từ, 12% câu dưới
 * 6 từ), trợ từ cuối câu thấp ở cả lời khách lẫn văn xuôi.
 *
 * Chỗ lệch nằm ở chỗ khác, và có hai lớp. Cổng này giữ cả hai.
 *
 * Cảm giác "văn AI" không đến từ dùng sai từ. Nó đến từ vốn thủ pháp hẹp đem
 * áp đều lên mọi đoạn: từng câu một thì hay, đọc liền trăm câu cùng khuôn thì
 * thành tiếng máy.
 *
 * Cả hai ngưỡng đặt theo TỆP chứ không theo toàn site, vì người đọc chỉ đọc
 * một trang. Một trăm câu rải trên hai mươi lăm trang nghe có vẻ thưa, nhưng
 * trên trang họ đang mở thì nó dày. Trang mới là đơn vị người đọc cảm nhận.
 *
 * Chỉ soi tiếng Việt. Trong tiếng Anh lối chen mệnh đề bằng em dash là bình
 * thường, đem luật tiếng Việt áp sang đó là sai.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = 'src/content';
const DASH = String.fromCharCode(8212);

/* ── Luật 1: khẳng định — mệnh đề hệ quả ──────────────────────────────────
 *
 *     [câu khẳng định] — [mệnh đề hệ quả nghe có vẻ thâm thuý]
 *
 *     "Bước chống nắng buổi sáng là bắt buộc — bỏ bước này thì hai bước kia
 *      gần như vô nghĩa."
 *     "Cửa sổ đổi trả 7 ngày chỉ áp dụng cho hàng lỗi — nói trước để bạn
 *      không bất ngờ."
 *
 * Lúc đo lần đầu: 125 câu, riêng trang combo-nam 9 câu.
 *
 * KHÔNG CẤM GẠCH NGANG. Gạch ngang có hai công dụng chính đáng và cổng bỏ qua
 * cả hai: nhãn kèm chú thích ngắn ("Serum Smart First Care — 1000ppm"), và
 * chen giữa hai gạch ("chấm năm điểm — trán, mũi, cằm, hai má — rồi dàn ra").
 * Chỉ đếm kiểu thứ ba: một gạch, đầu câu dài, rồi nối thêm cả một mệnh đề.
 */
const MAX_TACK_PER_FILE = 2;

/* ── Luật 2: mở câu bằng đại từ chỉ định ──────────────────────────────────
 *
 * Sau khi gỡ luật 1, đo lại thì "Đây là…" KHÔNG giảm mà TĂNG: 40 lên 44. Sửa
 * một khuôn bằng cách đổ sang khuôn khác thì người đọc chẳng được gì. Luật này
 * có mặt để chính việc sửa luật 1 không đẻ ra lỗi mới.
 *
 * Và nó không chỉ là thói quen dùng từ, nó bám theo VỊ TRÍ: cùng một ô
 * (blocks[0].lead, blocks[3].items[0].body, blocks[4].intro) mở bằng "Đây là"
 * trên hầu hết trang sản phẩm. Người đọc xem hai trang liền là nhận ra mình
 * đang đọc một cái khuôn điền sẵn.
 *
 * Ngưỡng 3, rộng hơn luật 1, vì đôi khi "Đây là" đúng là cách nói gọn nhất.
 * Ba lần trên một trang còn là trùng hợp; sáu lần là khuôn.
 */
const FRAME = /^(Đây là|Đây không|Đây chính là|Đó là lý do|Điều này)/;
const MAX_FRAME_PER_FILE = 3;

const files = [];
const walk = (d) => {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) { if (e.name !== '_template') walk(p); }
    else if (e.name === 'vi.json') files.push(p);
  }
};
walk(ROOT);

/** Câu này có phải kiểu "gắn mệnh đề sau gạch"? null nếu không. */
const tackOn = (s) => {
  const n = (s.match(new RegExp(DASH, 'g')) || []).length;
  if (n !== 1) return null;                       // 0 gạch, hoặc chen giữa hai gạch
  const [h, t] = s.split(DASH);
  const head = h.trim().split(/\s+/).filter(Boolean).length;
  const tail = t.trim().replace(/[.!?]+$/, '').split(/\s+/).filter(Boolean).length;
  if (head <= 6 && tail <= 9) return null;        // nhãn + chú thích ngắn
  if (tail < 5) return null;                      // chú thích ngắn gọn
  return true;
};

const tack = {};
const frames = {};
const visit = (node, path, file) => {
  if (typeof node === 'string') {
    for (const s0 of node.split(/(?<=[.!?])\s+/)) {
      const s = s0.trim();
      if (tackOn(s)) (tack[file] ??= []).push({ path, s });
      if (FRAME.test(s)) (frames[file] ??= []).push({ path, s });
    }
    return;
  }
  if (Array.isArray(node)) { node.forEach((v, i) => visit(v, `${path}[${i}]`, file)); return; }
  if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) visit(v, path ? `${path}.${k}` : k, file);
  }
};
for (const f of files) {
  const rel = f.split(/[\\/]/).slice(2).join('/');
  visit(JSON.parse(readFileSync(f, 'utf8')), '', rel);
}

const tally = (hits, max) => {
  let total = 0;
  const over = [];
  for (const [f, a] of Object.entries(hits).sort((x, y) => y[1].length - x[1].length)) {
    total += a.length;
    if (a.length > max) over.push([f, a]);
  }
  return { total, over };
};

const show = (title, note, { total, over }, max, fix) => {
  console.log(`\n── ${title} ──\n`);
  console.log(`   ${note}`);
  console.log(`   ${total} câu · ngưỡng: tối đa ${max} câu mỗi trang\n`);
  if (!over.length) { console.log('   ĐẠT  không trang nào vượt ngưỡng\n'); return 0; }
  for (const [f, a] of over) {
    console.log(`   LỖI  ${f}: ${a.length} câu (thừa ${a.length - max})`);
    for (const h of a) {
      console.log(`          ${h.path}`);
      console.log(`          ${h.s.length > 96 ? h.s.slice(0, 96) + '…' : h.s}`);
    }
    console.log('');
  }
  console.log(`   ${over.length}/${files.length} trang vượt ngưỡng. ${fix}\n`);
  return over.length;
};

const t = tally(tack, MAX_TACK_PER_FILE);
const fr = tally(frames, MAX_FRAME_PER_FILE);

let bad = 0;
bad += show(
  `Luật 1: thủ pháp "khẳng định ${DASH} mệnh đề hệ quả"`,
  `${files.length} trang tiếng Việt`, t, MAX_TACK_PER_FILE,
  'Cách sửa: tách hai câu, nối bằng "nên"/"thì"/"vì", hoặc dùng dấu hai chấm.');
bad += show(
  'Luật 2: mở câu bằng "Đây là" và họ hàng',
  'giữ cho việc sửa luật 1 không đẻ ra khuôn mới', fr, MAX_FRAME_PER_FILE,
  'Cách sửa: gọi thẳng chủ thể thay vì trỏ lại bằng "Đây là".');

process.exit(bad ? 1 : 0);
