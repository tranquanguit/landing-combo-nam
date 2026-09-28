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
const MAX_FRAME_PER_FILE = 2;

/* ── Luật 3: meta-copy và tư thế phòng thủ ────────────────────────────────
 *
 * Luật 1 và 2 đếm DẤU CÂU. Sửa xong thì hai con số ấy đẹp, nhưng người viết
 * content đọc lại vẫn thấy văn AI — vì dấu vân tay thật không nằm ở dấu câu,
 * nó nằm ở TƯ THẾ.
 *
 * Tư thế sai là khi trang nói về chính nó thay vì nói với khách:
 *
 *     "Bằng chứng chúng tôi có chỉ tới đây."
 *     "Nói rằng mình công khai nồng độ thì ai cũng nói được."
 *     "Phần này nằm ngay trước biểu mẫu là có chủ ý."
 *     "Ai đưa ra một con số chung cho tất cả mọi người là đang đoán."
 *
 * Từng câu thì hợp lý. Cả trang thì thành một thương hiệu đang phòng thủ, và
 * đang tranh luận với các website khác thay vì giúp khách quyết định. Đưa
 * bằng chứng ra là đủ; không cần nói rằng mình đang đưa bằng chứng.
 *
 * NGƯỠNG CÓ HAI MỨC, vì cùng một câu không gây hại như nhau ở mọi chỗ:
 *
 *   - trong thân bài: tối đa 1 câu mỗi trang (đôi khi nói một lần là đúng)
 *   - trong ô nổi bật — tiêu đề, mở đoạn, CTA, câu chuyển: KHÔNG câu nào
 *
 * Đo trên bản trước khi sửa cho thấy vì sao phải tách hai mức: meta-copy dày
 * gấp đôi ở ô nổi bật so với thân bài (2,4% với 1,2%). Đó là chỗ người ta
 * đọc chắc chắn, nên một câu ở tiêu đề nặng hơn nhiều một câu giữa đoạn.
 */
const META = [
  [/bằng chứng (chúng tôi|mình)/i, 'nói về bằng chứng của chính mình'],
  [/là có chủ ý/i, 'giải thích bố cục trang cho người đọc'],
  [/\bnói (trước|thẳng)\b/i, 'tuyên bố mình đang thẳng thắn'],
  [/ai cũng nói được/i, 'so mình với nhãn khác'],
  [/kể cả điều bất lợi/i, 'tự khen trung thực'],
  [/chúng tôi không (đoán|tự điền|bịa)/i, 'tự khen không đoán'],
  [/là đang đoán/i, 'chê bên khác đoán'],
  [/thì đang bán hàng/i, 'chê bên khác bán hàng'],
  [/những điều chúng tôi không/i, 'tuyên ngôn'],
  [/vì sao điều này quan trọng/i, 'giải thích vì sao mình viết câu này'],
  [/không ước lượng hộ/i, 'tự khen không đoán'],
];
const MAX_META_BODY = 1;
/** Ô người đọc chắc chắn nhìn: ở đây không được phép có câu nào. */
const SALIENT = /heading|title|eyebrow|lead|intro|cta|transition|footnote/i;

/* ── Luật 4: tiêu đề mục mở đầu bằng con số ───────────────────────────────
 *
 * Lúc đo lần đầu: 41 trong 177 tiêu đề mục, tức 23%, và chúng rơi vào ĐÚNG BA
 * Ô giống nhau trên hầu hết trang sản phẩm:
 *
 *     "Ba trường hợp, và lời khuyên thật lòng cho từng trường hợp"  ← ai nên mua
 *     "Sáu hoạt chất in trên vỏ hộp, và vai trò của từng cái"       ← thành phần
 *     "Ba bước, dùng 1–2 lần mỗi ngày"                              ← cách dùng
 *
 * Đọc một trang thì thấy gọn. Mở trang thứ hai là nhận ra đây là một tờ khai
 * điền sẵn, chỉ thay con số. Người viết content gọi đúng tên: "mọi thứ đều
 * được đóng thành block ba ý".
 *
 * Ngưỡng 1 chứ không phải 0. Đôi khi con số đúng là thứ đáng đưa lên đầu, ví
 * dụ một tuýp chống nắng nói rõ có bao nhiêu màng lọc. Một lần trên một trang
 * là lựa chọn; ba lần là khuôn.
 *
 * Chỉ soi tiêu đề MỤC, không soi nhãn thẻ hay tên bước. "Rửa sạch và thấm
 * khô" hay "Da dầu, lỗ chân lông to" thì đáng là danh từ trần — bản dò đầu
 * tiên của tôi gộp cả chúng vào và báo 216/267 tiêu đề có vấn đề, một con số
 * vô nghĩa.
 */
const NUM_HEAD = /^(Một|Hai|Ba|Bốn|Năm|Sáu|Bảy|Tám|Chín|Mười|[0-9]+)\s+\p{L}/u;
const HEAD_KEY = /^(blocks|sections)\[\d+\]\.heading$/;
const MAX_NUM_HEAD = 1;

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
const metaTop = {};
const metaBody = {};
const numHead = {};
const visit = (node, path, file) => {
  if (typeof node === 'string') {
    for (const s0 of node.split(/(?<=[.!?])\s+/)) {
      const s = s0.trim();
      if (tackOn(s)) (tack[file] ??= []).push({ path, s });
      if (FRAME.test(s)) (frames[file] ??= []).push({ path, s });
      for (const [re, why] of META) {
        if (!re.test(s)) continue;
        (SALIENT.test(path) ? metaTop : metaBody)[file] ??= [];
        (SALIENT.test(path) ? metaTop : metaBody)[file].push({ path, s, why });
        break;
      }
    }
    if (HEAD_KEY.test(path) && NUM_HEAD.test(node.trim())) {
      (numHead[file] ??= []).push({ path, s: node.trim() });
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
const mt = tally(metaTop, 0);
const mb = tally(metaBody, MAX_META_BODY);
const nh = tally(numHead, MAX_NUM_HEAD);

let bad = 0;
bad += show(
  `Luật 1: thủ pháp "khẳng định ${DASH} mệnh đề hệ quả"`,
  `${files.length} trang tiếng Việt`, t, MAX_TACK_PER_FILE,
  'Cách sửa: tách hai câu, nối bằng "nên"/"thì"/"vì", hoặc dùng dấu hai chấm.');
bad += show(
  'Luật 2: mở câu bằng "Đây là" và họ hàng',
  'giữ cho việc sửa luật 1 không đẻ ra khuôn mới', fr, MAX_FRAME_PER_FILE,
  'Cách sửa: gọi thẳng chủ thể thay vì trỏ lại bằng "Đây là".');

bad += show(
  'Luật 3: meta-copy trong ô nổi bật (tiêu đề, mở đoạn, CTA)',
  'ở đây không được phép có câu nào', mt, 0,
  'Cách sửa: bỏ hẳn câu đó. Đưa bằng chứng ra là đủ.');
bad += show(
  'Luật 3b: meta-copy trong thân bài',
  'nói một lần thì được, thành giọng thì không', mb, MAX_META_BODY,
  'Cách sửa: nói thẳng việc mình làm, đừng nói về việc mình đang nói.');

bad += show(
  'Luật 4: tiêu đề mục mở đầu bằng con số',
  'một lần là lựa chọn, ba lần là tờ khai điền sẵn', nh, MAX_NUM_HEAD,
  'Cách sửa: bỏ con số khỏi tiêu đề. Nội dung bên dưới vẫn đếm được.');

process.exit(bad ? 1 : 0);
