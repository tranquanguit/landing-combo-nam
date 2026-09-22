/**
 * Đo nhịp câu của nội dung biên tập.
 *
 * VÌ SAO CẦN ĐO. `docs/giong-van.md` quy tắc 4 nói: "Văn AI có nhịp đều tăm
 * tắp: câu nào cũng 20–25 chữ, mệnh đề nào cũng cân đối. Đọc ba đoạn là buồn
 * ngủ." Quy tắc đó viết ra rồi vẫn bị vi phạm, vì không ai đo được. Một quy
 * tắc không đo được là một quy tắc không giữ được.
 *
 * NGƯỠNG CẢNH BÁO LÀ CÂU DÀI NHẤT, KHÔNG PHẢI TỈ LỆ CÂU NGẮN.
 *
 * Bản đầu tôi cảnh báo theo tỉ lệ câu ngắn, ngưỡng 22%. Sai, và sai lặng lẽ:
 * trang sản phẩm có hàng chục nhãn và dòng meta rất ngắn nên tỉ lệ vọt lên
 * 38–44%, còn trang văn xuôi thuần thì tự nhiên thấp hơn. Đem ngưỡng đo trên
 * loại nội dung này áp cho loại kia là so nhầm — nó gắn cờ "đều quá" cho cả
 * trang chính sách, nơi câu dài là bình thường.
 *
 * Câu dài nhất thì trung lập với loại nội dung. Một câu 66 chữ khó đọc dù nó
 * nằm ở landing bán hàng hay ở văn bản pháp lý.
 *
 * KHÔNG CHẶN BUILD. Nhịp văn là ngưỡng mềm, không phải chuyện đúng sai như giá
 * tiền hay tuyên bố bị cấm. Cổng này báo cáo để người viết nhìn thấy.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Câu ngắn hơn ngưỡng này là một "nhịp nghỉ". Chỉ để tham khảo, không cảnh báo. */
const NGAN = 8;
/** Dài hơn ngưỡng này thì một câu bắt người đọc giữ quá nhiều thứ trong đầu. */
const CAU_QUA_DAI = 42;

/**
 * Bỏ qua chuỗi liệt kê.
 *
 * Câu dài nhất trong cả kho là danh sách INCI 97 chữ của Biovector. Nó dài
 * thật, nhưng nó là DỮ LIỆU chứ không phải văn — không ai đọc một bảng thành
 * phần theo nhịp. Gắn cờ nó là dạy cổng kiểm báo động giả, và một cổng báo
 * động giả thì người ta bỏ qua cả những lần nó báo đúng.
 */
const laLietKe = (c) => (c.match(/,/g) || []).length >= 8;

/* Trường kỹ thuật, không phải văn — đo chúng chỉ làm nhiễu số liệu. */
const BO_QUA = new Set([
  'slug', 'locale', 'translationKey', 'status', 'sku', 'currency', 'href', 'src',
  'id', 'type', 'icon', 'when', 'evidence', 'availability', 'primaryKeyword',
  'updatedAt', 'publishedAt', 'validUntil', 'productNotificationNumber',
]);

const nhatChu = (o, ra = []) => {
  if (typeof o === 'string') ra.push(o);
  else if (Array.isArray(o)) o.forEach((x) => nhatChu(x, ra));
  else if (o && typeof o === 'object') {
    for (const [k, v] of Object.entries(o)) if (!BO_QUA.has(k)) nhatChu(v, ra);
  }
  return ra;
};

const boThe = (s) => s.replace(/<[^>]+>/g, ' ');

/* Tách câu TRÊN TỪNG CHUỖI, không nối cả file rồi mới tách.
   Phép đo đầu tiên của tôi nối mọi chuỗi JSON bằng dấu cách rồi mới tách, nên
   ranh giới giữa hai trường biến mất và hai câu rời bị đếm thành một câu dài
   gấp đôi. Nó cho ra "sản phẩm trung bình 22 chữ mỗi câu" trong khi số thật là
   11 — sai gấp đôi, và suýt dẫn tới việc viết lại toàn bộ nội dung đang ổn. */
const tachCau = (t) => boThe(t)
  .split(/(?<=[.!?…])\s+/)
  .map((c) => c.trim())
  .filter((c) => c.split(/\s+/).length >= 4 && !laLietKe(c));

export function doNhip(doiTuong) {
  const cau = nhatChu(doiTuong).flatMap(tachCau);
  const dai = cau.map((c) => c.split(/\s+/).length);
  if (!dai.length) return null;
  const tong = dai.reduce((a, b) => a + b, 0);
  const daiNhat = Math.max(...dai);
  return {
    soCau: dai.length,
    trungBinh: +(tong / dai.length).toFixed(1),
    daiNhat,
    cauDaiNhat: cau[dai.indexOf(daiNhat)],
    soNgan: dai.filter((n) => n <= NGAN).length,
    tiLeNgan: dai.filter((n) => n <= NGAN).length / dai.length,
  };
}

/* ---- chạy trực tiếp: quét toàn bộ nội dung ----
   `pathToFileURL` thay vì ghép chuỗi: trên Windows `import.meta.url` là
   file:///Q:/... (ba gạch chéo) còn ghép tay ra file://Q:/... (hai), nên phép
   so sánh luôn sai và script im lặng không làm gì — một cổng không bao giờ
   chạy còn tệ hơn không có cổng. */
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const thuMuc = ['products', 'lines', 'pages', 'guides', 'articles', 'policies'];
  const hang = [];

  for (const t of thuMuc) {
    const goc = join('src/content', t);
    if (!existsSync(goc)) continue;
    for (const muc of readdirSync(goc)) {
      const p = join(goc, muc, 'vi.json');
      if (!existsSync(p)) continue;
      const d = doNhip(JSON.parse(readFileSync(p, 'utf8')));
      if (d && d.soCau >= 20) hang.push({ ten: `${t}/${muc}`, ...d });
    }
  }

  console.log('\nNhịp câu — docs/giong-van.md quy tắc 4\n');
  console.log(
    '  ' + 'nội dung'.padEnd(36) + 'câu'.padStart(5) + 'TB chữ'.padStart(8) +
    'dài nhất'.padStart(10) + 'câu ngắn'.padStart(11));

  let canhBao = 0;
  const qua = [];
  for (const h of hang.sort((a, b) => b.daiNhat - a.daiNhat)) {
    const dat = h.daiNhat <= CAU_QUA_DAI;
    if (!dat) { canhBao++; qua.push(h); }
    console.log(
      `  ${dat ? 'ok  ' : 'dài '}${h.ten.padEnd(32)}` +
      `${String(h.soCau).padStart(5)}${String(h.trungBinh).padStart(8)}` +
      `${String(h.daiNhat).padStart(10)}` +
      `${(h.soNgan + ' (' + Math.round(h.tiLeNgan * 100) + '%)').padStart(11)}`);
  }

  console.log(`\n${hang.length - canhBao}/${hang.length} mục không có câu nào quá ${CAU_QUA_DAI} chữ.`);
  if (canhBao) {
    console.log(`\n${canhBao} mục có câu quá dài. Không chặn build — nhịp văn là ngưỡng mềm.`);
    for (const h of qua.slice(0, 3)) {
      console.log(`\n  ${h.ten} — ${h.daiNhat} chữ:\n    "${h.cauDaiNhat.slice(0, 150)}…"`);
    }
    console.log('\n  Cách sửa: tách câu dài thành hai, hoặc chuyển danh sách nối bằng');
    console.log('  dấu chấm phẩy thành từng câu riêng.\n');
  }
}
