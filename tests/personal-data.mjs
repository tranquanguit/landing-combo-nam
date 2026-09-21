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
  /* Tuổi của một người cụ thể vẫn phải chặn ở mọi vị trí — luật ngưỡng tuổi
     bên dưới không được mở đường cho những câu này. */
  'Khách 45 tuổi dùng sau hai tháng', 'Nguyễn Thu Hà 29 tuổi',
  'Chị Nguyễn Thu Hà, Quận 3, gọi 0912 345 678 để nghe chia sẻ.',
  // Kiểm định lần 10: hotline doanh nghiệp đứng trước giấu luôn số của khách.
  'Hotline 0367 848 918. Chị Hà đặt hàng qua số 0912 345 678.',
  'Hotline 0367 848 918 hoặc nhắn cho khách Lan 0912345678.',
  'Tôi 38 tuoi, da sạm sau sinh',
];

/* Văn xuôi thường: xưng hô + một từ viết hoa KHÔNG phải danh tính.
   Kiểm định lần 14 liệt kê 22 câu bị chặn nhầm; đây là mẫu đại diện. */
const CHO_QUA = [
  'Anh Quốc và châu Âu đều siết claim mỹ phẩm.',
  'Chú Thích ở cuối trang.',
  'Cô Dâu nên dưỡng da trước ngày cưới.',
  'Em Bé sơ sinh có da rất mỏng.',
  'Anh Đào Nhật Bản nở vào tháng ba.',
  'Bác Hồ dạy chúng ta tiết kiệm.',
  'Chị Hằng trên trời cao.',
  'Cô Tấm là nhân vật cổ tích.',
  'Chị Hai ở quê gửi nghệ lên.',
  'Em Trai tôi cũng dùng kem này.',
  'Anh Hùng bàn phím thì nhiều.',
  'Cô Nương ơi.',
  'Bác Nông Dân trồng nghệ.',
  'Anh Văn và tiếng Nhật.',
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
  'Bác Sĩ Tư Vấn miễn phí.',
  'Em có thể nhắn tin cho chúng tôi.',
  /* NGƯỠNG tuổi trong văn bản pháp lý không phải dữ liệu cá nhân: nó là điều
     khoản, không nói về ai cả. Trang chính sách bảo vệ dữ liệu cần viết được
     câu này, và bản trước của luật chặn đúng chính sách đó. */
  'Không dành cho người dưới 16 tuổi.',
  'The products are not intended for anyone under 16.',
  'Áp dụng từ 18 tuổi trở lên.',
  'Chỉ bán cho khách trên 18 tuổi.',
];

/*
 * Ngữ cảnh LỜI CHỨNG (khối `problem.quotes`): xưng hô + MỘT tên riêng đã đủ
 * nhận dạng. Ngoài ngữ cảnh đó thì cùng hình dạng lại là chuyện bình thường
 * ("Chị Hằng trên trời cao", "Cô Tấm là nhân vật cổ tích") — kiểm định lần 14
 * đo được 22/26 câu tiếng Việt bình thường bị chặn nhầm khi áp luật một-tên cho
 * mọi nơi.
 */
const CHAN_LOI_CHUNG = [
  'Chị Hà bảo da tôi sạm hẳn sau sinh',
  'Cô Lan kể nám lan rộng hai bên gò má',
  'Anh Nam đặt hàng lúc 9h',
];
const CHO_QUA_LOI_CHUNG = [
  'Sau sinh da tôi sạm hẳn, ai cũng hỏi',
  'Nám mảng hai bên gò má làm tôi ngại ra đường',
];

let bad = 0;
for (const s of CHAN_LOI_CHUNG) {
  if (!findPersonalData(s, BRAND, { testimonyContext: true }).length) {
    console.error(`  LỌT   lời chứng phải chặn: ${JSON.stringify(s)}`); bad++;
  }
}
for (const s of CHO_QUA_LOI_CHUNG) {
  const h = findPersonalData(s, BRAND, { testimonyContext: true });
  if (h.length) { console.error(`  NHẦM  lời chứng phải cho qua: ${JSON.stringify(s)} → "${h[0].match}"`); bad++; }
}
for (const s of CHAN) {
  if (!findPersonalData(s, BRAND).length) { console.error(`  LỌT   phải chặn: ${JSON.stringify(s)}`); bad++; }
}
for (const s of CHO_QUA) {
  const h = findPersonalData(s, BRAND);
  if (h.length) { console.error(`  NHẦM  phải cho qua: ${JSON.stringify(s)} → "${h[0].match}"`); bad++; }
}
const total = CHAN.length + CHO_QUA.length + CHAN_LOI_CHUNG.length + CHO_QUA_LOI_CHUNG.length;
console.log(`  ${total - bad}/${total} ca đúng ` +
            `(${CHAN.length} chặn, ${CHO_QUA.length} cho qua, ` +
            `${CHAN_LOI_CHUNG.length} chặn trong lời chứng, ${CHO_QUA_LOI_CHUNG.length} cho qua trong lời chứng)`);
process.exit(bad ? 1 : 0);
