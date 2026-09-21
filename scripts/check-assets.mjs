/**
 * Kiểm ảnh thật có khớp đặc tả không, và sinh tài liệu từ CHÍNH đặc tả đó.
 *
 * Vì sao cần: ảnh là thứ duy nhất trên site không đi qua schema Zod. Người gửi
 * ảnh không phải người dựng trang, và "gửi nhầm ảnh 400px cho vị trí cần
 * 1600px" là lỗi chỉ lộ ra khi nhìn trang trên màn hình lớn — thường là sau
 * khi đã deploy.
 *
 *   node scripts/check-assets.mjs           # báo cáo; chỉ fail khi THIẾU file
 *   node scripts/check-assets.mjs --strict  # fail cả khi file có nhưng sai đặc tả
 *   node scripts/check-assets.mjs --md FILE # đồng thời ghi tài liệu Markdown
 *
 * Vì sao mặc định không fail khi ảnh sai kích thước: hôm nay TẤT CẢ ảnh trong
 * repo đều dưới chuẩn, và chặn build vì điều đó thì không ai deploy được trong
 * khi cũng không ai sửa được cho tới lúc có bộ ảnh gốc. Khi Mocha gửi ảnh đúng
 * đặc tả, đổi CI sang --strict để nó không trôi lại.
 */
import { readFileSync, existsSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const SPEC = JSON.parse(readFileSync('src/data/_anh-can-co.json', 'utf8'));
const DIR = 'src/assets/images';

/** "4:3" -> 4/3. "tự do" -> null. */
const ratioOf = (v) => {
  if (!v || v === 'tự do') return null;
  const [a, b] = v.split(':').map(Number);
  return Number.isFinite(a) && Number.isFinite(b) && b ? a / b : null;
};

const rows = [];
let hardFails = 0;
let softFails = 0;
let missingRequired = 0;   // thiếu hẳn file — luôn là lỗi chặn
let wrongRequired = 0;     // có file nhưng sai đặc tả — chỉ chặn với --strict
const strict = process.argv.includes('--strict');

for (const slot of SPEC.slots) {
  const file = path.join(DIR, slot.file);
  const note = [];
  let ok = true;

  if (!existsSync(file)) {
    rows.push({ slot, trangThai: slot.batBuoc ? 'THIẾU' : 'chưa có', chiTiet: 'chưa có file' });
    if (slot.batBuoc) { hardFails++; missingRequired++; } else softFails++;
    continue;
  }

  const kb = Math.round(statSync(file).size / 1024);
  let meta;
  try {
    meta = await sharp(file).metadata();
  } catch (err) {
    rows.push({ slot, trangThai: 'HỎNG', chiTiet: `không đọc được: ${err.message.slice(0, 60)}` });
    hardFails++;
    continue;
  }

  const { width: w, height: h } = meta;
  if (w < slot.rongToiThieu) { note.push(`rộng ${w}px < ${slot.rongToiThieu}px`); ok = false; }
  if (h < slot.caoToiThieu) { note.push(`cao ${h}px < ${slot.caoToiThieu}px`); ok = false; }

  /* Sai tỉ lệ thì ảnh bị cắt mất phần quan trọng, hoặc bị nhồi vào khung sai.
     Dung sai 3% cho khác biệt khi xuất file. */
  const want = ratioOf(slot.tiLe);
  if (want) {
    const got = w / h;
    if (Math.abs(got - want) / want > 0.03) {
      note.push(`tỉ lệ ${got.toFixed(2)} ≠ ${slot.tiLe} (${want.toFixed(2)})`);
      ok = false;
    }
  }

  /* Nặng quá là lỗi về tốc độ, không phải lỗi thẩm mỹ — nhưng ở đây nó chỉ
     cảnh báo, vì cổng ngân sách trong check-budget.mjs mới là nơi chặn thật
     (nó đo ảnh ĐÃ build, sau khi astro:assets nén lại). */
  if (kb > slot.nangToiDaKb) note.push(`nặng ${kb}KB > ${slot.nangToiDaKb}KB (cảnh báo)`);

  /* Nền trong suốt: WebP/PNG có kênh alpha. Logo đặt trên nền trắng ngà của
     trang, một nền trắng tinh cứng sẽ hiện thành ô vuông lệch màu. */
  if (slot.nenTrongSuot && !meta.hasAlpha) {
    note.push('không có nền trong suốt');
    ok = false;
  }

  const hard = !ok;
  if (hard && slot.batBuoc) hardFails++;
  else if (hard) softFails++;
  if (hard && slot.batBuoc) wrongRequired++;

  rows.push({
    slot,
    trangThai: hard ? (slot.batBuoc ? 'SAI' : 'sai (tuỳ chọn)') : 'đạt',
    chiTiet: note.length ? note.join('; ') : `${w}×${h}, ${kb}KB, ${meta.format}`,
  });
}

/* Ảnh có trong thư mục nhưng không thuộc vị trí nào: hoặc là ảnh thừa làm nặng
   repo, hoặc là ảnh ai đó thêm vào mà quên khai — cả hai đều đáng nói. */
const known = new Set(SPEC.slots.map((s) => s.file));
const extra = existsSync(DIR)
  ? readdirSync(DIR).filter((f) => /\.(webp|jpe?g|png|avif)$/i.test(f) && !known.has(f))
  : [];

console.log('\nẢnh theo đặc tả (src/data/_anh-can-co.json)\n');
for (const r of rows) {
  const mark = r.trangThai === 'đạt' ? 'ĐẠT ' : r.trangThai === 'chưa có' ? '….. ' : 'LỖI ';
  console.log(`  ${mark} ${r.slot.file.padEnd(24)} ${r.trangThai.padEnd(14)} ${r.chiTiet}`);
}
if (extra.length) console.log(`\n  ghi chú: ${extra.length} ảnh không thuộc vị trí nào: ${extra.join(', ')}`);

const gated = SPEC.anhCanVanBanDongY;
if (existsSync(gated.thuMuc)) {
  const n = readdirSync(gated.thuMuc).filter((f) => /\.(webp|jpe?g|png|avif)$/i.test(f)).length;
  if (n) console.log(`\n  ${n} ảnh đang chờ văn bản đồng ý trong ${gated.thuMuc} — chưa vào bản build.`);
}
const docsDir = SPEC.chungTu.thuMuc;
const docCount = existsSync(docsDir)
  ? readdirSync(docsDir).filter((f) => /\.(webp|jpe?g|png|avif|pdf)$/i.test(f)).length : 0;
console.log(`  ${docCount} chứng từ trong ${docsDir}.`);

console.log(`\n${rows.length - hardFails - softFails}/${rows.length} vị trí đạt; ` +
  `${hardFails} lỗi ở vị trí bắt buộc, ${softFails} ở vị trí tuỳ chọn.`);
if (wrongRequired && !strict) {
  console.log(`  (${wrongRequired} ảnh bắt buộc có file nhưng chưa đúng đặc tả — ` +
    `chạy với --strict để biến thành lỗi chặn khi đã có bộ ảnh gốc.)`);
}

/* ---------- tài liệu sinh tự động ---------- */
const mdArg = process.argv.indexOf('--md');
if (mdArg > -1 && process.argv[mdArg + 1]) {
  const cell = (v) => String(v).replace(/\|/g, '\\|');
  const md = [
    '<!-- Sinh tự động bởi scripts/check-assets.mjs — đừng sửa tay.',
    '     Sửa đặc tả ở src/data/_anh-can-co.json rồi chạy `npm run docs:assets`. -->',
    '# Ảnh cần có cho website',
    '',
    'Đặt file vào `src/assets/images/` **đúng tên** ở cột đầu. Không cần khai kích',
    'thước ở đâu cả — máy tự đọc số pixel từ chính file và tự sinh bản AVIF/WebP',
    'nhiều kích cỡ khi build.',
    '',
    'Kiểm lại bất cứ lúc nào: `npm run check:assets`',
    '',
    '## Gửi ảnh từ máy Windows lên bằng cách nào',
    '',
    'Phiên Claude dựng site chạy trong container trên cloud, không đọc được ổ đĩa',
    'trên máy cá nhân. Có hai đường:',
    '',
    '**Ít file:** kéo-thả thẳng vào khung chat.',
    '',
    '**Nhiều file:** chạy trong PowerShell, đứng ở thư mục kho:',
    '',
    '```powershell',
    '.\\scripts\\gui-anh.ps1',
    '```',
    '',
    'Script đẩy nguyên trạng lên nhánh tạm `assets-inbox` kèm một bản kê. Nhánh đó',
    'không bao giờ merge vào `main`, nên lịch sử nhánh chính không phình vì file',
    'nhị phân. Việc chọn ảnh nào vào vị trí nào để phía dựng site làm.',
    '',
    '## Vị trí ảnh',
    '',
    '| Tên file | Vị trí | Bắt buộc | Tỉ lệ | Tối thiểu | Nặng tối đa | Trạng thái |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...rows.map((r) => `| \`${r.slot.file}\` | ${cell(r.slot.ten)} | ${r.slot.batBuoc ? '✅' : '—'} `
      + `| ${r.slot.tiLe} | ${r.slot.rongToiThieu}×${r.slot.caoToiThieu} | ${r.slot.nangToiDaKb}KB `
      + `| ${r.trangThai === 'đạt' ? '✅ đạt' : r.trangThai === 'chưa có' ? '⬜ chưa có' : '❌ ' + cell(r.chiTiet)} |`),
    '',
    '## Từng vị trí cần ảnh như thế nào',
    '',
    ...SPEC.slots.flatMap((s) => [
      `### \`${s.file}\` — ${s.ten}`,
      '',
      `**Hiện ở:** ${s.hienO.join(' · ')}  `,
      `**Tỉ lệ:** ${s.tiLe} · **tối thiểu** ${s.rongToiThieu}×${s.caoToiThieu}px · **nặng tối đa** ${s.nangToiDaKb}KB`
        + (s.nenTrongSuot ? ' · **nền trong suốt**' : ''),
      '',
      s.chuDe,
      '',
    ]),
    '## Chứng từ (phiếu công bố, CGMP, phiếu kiểm nghiệm)',
    '',
    `Đặt vào \`${SPEC.chungTu.thuMuc}\`. ${SPEC.chungTu.ghiChu}`,
    '',
    `Tối thiểu ${SPEC.chungTu.rongToiThieu}px chiều rộng, nặng tối đa ${SPEC.chungTu.nangToiDaKb}KB.`,
    '',
    `> ⚠️ ${SPEC.chungTu.canhBao}`,
    '',
    '## Ảnh trước/sau của khách',
    '',
    SPEC.anhCanVanBanDongY.ghiChu,
    '',
    `Đặt vào \`${SPEC.anhCanVanBanDongY.thuMuc}\`, tỉ lệ ${SPEC.anhCanVanBanDongY.tiLe}, `
      + `tối thiểu ${SPEC.anhCanVanBanDongY.rongToiThieu}px.`,
    '',
  ].join('\n');
  writeFileSync(path.resolve(process.argv[mdArg + 1]), md + '\n');
  console.log(`Đã ghi ${process.argv[mdArg + 1]}`);
}

process.exit((strict ? hardFails : missingRequired) ? 1 : 0);
