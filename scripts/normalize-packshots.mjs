/**
 * Chuẩn hoá khung ảnh sản phẩm.
 *
 * VẤN ĐỀ ĐO ĐƯỢC. Mười hai ảnh sản phẩm được chụp và cắt ở những thời điểm khác
 * nhau, nên phần sản phẩm chiếm từ 24% tới 100% chiều rộng khung:
 *
 *   biovector          239×803  trong 1000×1000  ->  24% rộng
 *   bio-deep-detox     296×771  trong 1000×1000  ->  30%
 *   smart-target       499×884  trong 1000×1000  ->  50%
 *   brightening-cream  879×738  trong 1000×1000  ->  88%
 *   retinol-mixpeel   1146×838  trong 1200×1200  ->  96%
 *
 * Trong một lưới mà mọi thẻ cùng kích thước và ảnh dùng `object-fit: contain`,
 * phần trắng thừa đó KHÔNG bị cắt — nó được vẽ ra. Hệ quả: lọ này to gấp ba lọ
 * kia trên màn hình, và người đọc không hiểu vì sao. Đây là thứ phá sự hài hoà
 * mạnh hơn cả chuyện lệch màu nền.
 *
 * CÁCH SỬA. Cắt viền nền đồng nhất, rồi đệm lại cho sản phẩm chiếm đúng một tỉ
 * lệ cố định trên khung vuông.
 *
 * KHÔNG phóng to một pixel nào: kích thước khung tính TỪ kích thước sản phẩm
 * (`canvas = maxChiều / TI_LE`), nên thao tác duy nhất là bỏ bớt nền. Ảnh ra
 * nhỏ hơn về số pixel nhưng ĐẬM ĐẶC hơn về sản phẩm — và đó mới là độ phân
 * giải thật sự có ích.
 *
 * KHÔNG áp dụng cho ảnh chụp bối cảnh có nền màu (combo, smart-white-plus):
 * chúng không có viền đồng nhất để cắt, và chúng thuộc một ngôn ngữ hình ảnh
 * khác. Việc đó cần chụp lại, không sửa được bằng script.
 */
import sharp from 'sharp';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = 'src/assets/images';
/** Sản phẩm chiếm bao nhiêu phần cạnh dài của khung vuông. */
const TI_LE = 0.82;
/** Ngưỡng coi là "cùng màu nền". Thấp quá thì bóng đổ bị coi là nội dung. */
const NGUONG = 45;
/** Ảnh chụp bối cảnh, nền màu — không cắt được và không nên cắt. */
const BO_QUA = new Set(['packshot-combo.webp', 'packshot-combo.jpg', 'packshot-smart-white-plus.webp']);

const ghi = (...a) => console.log(...a);
const kb = (n) => (n / 1024).toFixed(0) + 'KB';

const files = readdirSync(DIR).filter((f) => f.startsWith('packshot') && f.endsWith('.webp'));
let doi = 0, boQua = 0;

for (const f of files) {
  const p = join(DIR, f);
  const ten = f.replace('packshot-', '').replace('.webp', '');

  if (BO_QUA.has(f)) {
    ghi(`  bỏ qua  ${ten.padEnd(22)} ảnh bối cảnh nền màu — cần chụp lại, không cắt được`);
    boQua++;
    continue;
  }

  /* Đọc vào bộ nhớ trước. sharp giữ file mở trong lúc đọc, nên ghi đè thẳng
     lên chính file đó trả về "unable to open for write" trên Windows. */
  const goc = readFileSync(p);
  const truoc = await sharp(goc).metadata();
  const cuKb = statSync(p).size;

  // 1. Cắt viền nền đồng nhất.
  let vung;
  try {
    vung = await sharp(goc).trim({ threshold: NGUONG }).toBuffer({ resolveWithObject: true });
  } catch {
    ghi(`  bỏ qua  ${ten.padEnd(22)} không tìm được viền đồng nhất`);
    boQua++;
    continue;
  }
  const { width: sw, height: sh } = vung.info;

  // Đã gần đúng tỉ lệ rồi thì đừng đụng vào: mỗi lần nén lại là một lần mất chất.
  const chiemHienTai = Math.max(sw, sh) / Math.max(truoc.width, truoc.height);
  if (Math.abs(chiemHienTai - TI_LE) < 0.015 && truoc.width === truoc.height) {
    ghi(`  giữ    ${ten.padEnd(22)} đã ở ${Math.round(chiemHienTai * 100)}%, không cần sửa`);
    boQua++;
    continue;
  }

  // 2. Khung vuông tính TỪ sản phẩm — không phóng to.
  const canh = Math.round(Math.max(sw, sh) / TI_LE);

  const ra = await sharp(vung.data)
    .extend({
      top: Math.round((canh - sh) / 2),
      bottom: canh - sh - Math.round((canh - sh) / 2),
      left: Math.round((canh - sw) / 2),
      right: canh - sw - Math.round((canh - sw) / 2),
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .webp({ quality: 82, effort: 6 })
    .toBuffer();

  writeFileSync(p, ra);
  const moiKb = statSync(p).size;

  ghi(`  sửa    ${ten.padEnd(22)} ${truoc.width}×${truoc.height} -> ${canh}×${canh}` +
    `   sản phẩm ${Math.round(sw / truoc.width * 100)}% -> ${Math.round(sw / canh * 100)}% rộng` +
    `   ${kb(cuKb)} -> ${kb(moiKb)}`);
  doi++;
}

ghi(`\n${doi} ảnh chuẩn hoá, ${boQua} giữ nguyên.`);
