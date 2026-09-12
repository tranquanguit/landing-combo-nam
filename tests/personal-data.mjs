/**
 * Bộ thử hàng rào dữ liệu cá nhân.
 *
 * Kiểm định lần 9 đăng được "Chị Nguyễn Thu Hà, Quận 3, gọi 0912 345 678" qua
 * cards.items[].body với build xanh: luật họ tên chỉ bắt xưng hô viết thường
 * (mà tên người luôn đứng đầu câu), và luật điện thoại đòi 10 chữ số liền nhau
 * trong khi người ta viết có dấu cách.
 */
import { findPersonalData } from '../src/lib/claims-lexicon.ts';

/** Hotline của chính doanh nghiệp không phải dữ liệu cá nhân của khách. */
const BRAND = ['0367848918', '0367 848 918'];

const CHAN = [
  'Chị Nguyễn Thu Hà', 'chị Nguyễn Thu Hà', 'Cô Trần Thị Mai', 'Anh Lê Văn Nam',
  '0912 345 678', '0912.345.678', '0912-345-678', '0912345678',
  'Gọi 0912 345 678 để nghe chia sẻ', '+84912345678',
  'Chị Hà, 38 tuổi', 'ha.nguyen@gmail.com',
  'Chị Nguyễn Thu Hà, Quận 3, gọi 0912 345 678 để nghe chia sẻ.',
  // Kiểm định lần 10: hotline doanh nghiệp đứng trước giấu luôn số của khách.
  'Hotline 0367 848 918. Chị Hà đặt hàng qua số 0912 345 678.',
  'Hotline 0367 848 918 hoặc nhắn cho khách Lan 0912345678.',
];

const CHO_QUA = [
  'Gọi hotline 0367 848 918 để được tư vấn.',
  'Hotline 0367848918 làm việc 8h–20h.',
  'Phụ nữ mang thai nên hỏi ý kiến bác sĩ trước khi dùng.',
  'Bác sĩ da liễu sẽ tư vấn thêm cho trường hợp nám nặng.',
  'Combo dùng trong 8 tuần.',
  'Giao hàng 2–5 ngày tùy khu vực.',
  'Anh chị quan tâm có thể để lại lời nhắn.',
  // Kiểm định lần 11: xưng hô số nhiều và tên chiến dịch, không phải danh tính.
  'Anh Chị Em thân mến.',
  'Cô Gái Mùa Thu là tên chiến dịch.',
];

let bad = 0;
for (const s of CHAN) {
  if (!findPersonalData(s, BRAND).length) { console.error(`  LỌT   phải chặn: ${JSON.stringify(s)}`); bad++; }
}
for (const s of CHO_QUA) {
  const h = findPersonalData(s, BRAND);
  if (h.length) { console.error(`  NHẦM  phải cho qua: ${JSON.stringify(s)} → "${h[0].match}"`); bad++; }
}
console.log(`  ${CHAN.length + CHO_QUA.length - bad}/${CHAN.length + CHO_QUA.length} ca đúng ` +
            `(${CHAN.length} phải chặn, ${CHO_QUA.length} phải cho qua)`);
process.exit(bad ? 1 : 0);
