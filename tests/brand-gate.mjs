/**
 * Bộ thử đi qua collection `brand` (src/data/mocha.json).
 *
 * Kiểm định lần 14: ba cổng quét thêm vào `brand` ở vòng 21 — bản vá cho chính
 * phát hiện của vòng 13 — không có một ca thử nào canh. Tắt cả `.strict()` lẫn
 * ba vòng lặp quét thì mọi bộ thử vẫn xanh. Lỗ "mỗi vòng chỉ soi một cửa" chỉ
 * dịch từ mã sang bộ thử.
 */
import { collections } from '../src/content.config.ts';

const schema = collections.brand.schema;

const base = () => ({
  legalName: 'Công ty Dược Mỹ Phẩm Mocha Việt Nam',
  tradingName: 'Mocha Việt Nam',
  taxId: '0312345678',
  address: '290/2 Nam Kỳ Khởi Nghĩa, Phường Võ Thị Sáu, Quận 3, TP.HCM',
  phone: '+84367848918',
  phoneDisplay: '0367 848 918',
  email: 'kemnammocha@gmail.com',
  hours: '8h–20h, tất cả các ngày trong tuần',
  logo: '/images/logo.webp',
  marketplaces: [{ name: 'Shopee Mall Mocha' }],
});
const withDoc = (fn) => { const d = base(); fn(d); return d; };

const CASES = [
  { name: 'dữ liệu doanh nghiệp bình thường', doc: base(), expect: 'pass' },
  { name: 'mã số thuế 10 chữ số không bị coi là số điện thoại',
    doc: withDoc((d) => { d.taxId = '0312345678'; }), expect: 'pass' },
  { name: 'hotline của chính doanh nghiệp trong giờ làm việc',
    doc: withDoc((d) => { d.hours = 'Gọi 0367 848 918, 8h–20h'; }), expect: 'pass' },

  { name: 'tuyên bố bị cấm trong hours',
    doc: withDoc((d) => { d.hours += ' — Kem trị nám tốt nhất, cam kết hoàn tiền'; }), expect: 'fail' },
  { name: 'tuyên bố bị cấm trong tradingName',
    doc: withDoc((d) => { d.tradingName += ' (chứng minh lâm sàng, bác sĩ da liễu khuyên dùng)'; }), expect: 'fail' },
  { name: 'tuyên bố bị cấm trong marketplaces[] (quét đệ quy)',
    doc: withDoc((d) => { d.marketplaces = [{ name: 'Shopee - trị nám tốt nhất' }]; }), expect: 'fail' },
  { name: 'dữ liệu cá nhân của khách trong address',
    doc: withDoc((d) => { d.address += '. Chị Nguyễn Thu Hà, 38 tuổi, gọi 0912 345 678'; }), expect: 'fail' },
  { name: 'dữ liệu cá nhân trong marketplaces[] (quét đệ quy)',
    doc: withDoc((d) => { d.marketplaces = [{ name: 'Chị Nguyễn Thu Hà 0912 345 678' }]; }), expect: 'fail' },
  { name: 'số tiền viết tay trong hours',
    doc: withDoc((d) => { d.hours += ', giá chỉ 390.000đ'; }), expect: 'fail' },
  { name: 'khoá lạ ở cấp brand (.strict)',
    doc: withDoc((d) => { d.ghiChu = 'khoá lạ'; }), expect: 'fail', expectCode: 'unrecognized_keys' },
  { name: 'khoá lạ trong marketplaces[] (.strict)',
    doc: withDoc((d) => { d.marketplaces = [{ name: 'Shopee', urll: 'https://shopee.vn/mocha' }]; }),
    expect: 'fail', expectCode: 'unrecognized_keys' },
  { name: 'scheme javascript: trong zalo',
    doc: withDoc((d) => { d.zalo = 'javascript:alert(1)'; }), expect: 'fail' },
  { name: 'email sai định dạng',
    doc: withDoc((d) => { d.email = 'khong-phai-email'; }), expect: 'fail' },
];

let bad = 0;
for (const c of CASES) {
  const r = schema.safeParse(c.doc);
  const got = r.success ? 'pass' : 'fail';
  if (got === 'fail' && c.expectCode && !r.error.issues.some((i) => i.code === c.expectCode)) {
    bad++;
    console.error(`  LÝ DO SAI  ${c.name} — mong "${c.expectCode}", nhận ${JSON.stringify(r.error.issues.map((i) => i.code))}`);
    continue;
  }
  if (got !== c.expect) {
    bad++;
    const why = r.success ? '(qua schema, đáng ra phải chặn)' : `(bị chặn: ${r.error.issues[0]?.message?.slice(0, 90)})`;
    console.error(`  SAI   ${c.name} — mong ${c.expect}, nhận ${got} ${why}`);
  }
}
console.log(`  ${CASES.length - bad}/${CASES.length} ca đúng ` +
            `(${CASES.filter((c) => c.expect === 'fail').length} phải chặn, ` +
            `${CASES.filter((c) => c.expect === 'pass').length} phải cho qua)`);
process.exit(bad ? 1 : 0);
