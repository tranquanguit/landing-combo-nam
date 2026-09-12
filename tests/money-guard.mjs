/**
 * Bộ thử hàng rào giá.
 *
 * Mỗi ca ở đây là một cách viết mà kiểm định viên độc lập đã dùng để phá hàng
 * rào. Ca nào từng lọt thì nay phải chặn; ca nào từng bị chặn nhầm thì nay phải
 * cho qua. Chạy trong CI để không tái diễn.
 */
import { findHandwrittenMoney } from '../src/lib/money-scan.ts';

const CHAN = [
  '1.050.000 đồng', '1.050.000 Đồng', '460.000 dong', '1.050.000 VNÐ',
  '1.050.000 VND', '1.050.000 VNĐ', '1.050.000₫', '1.050.000đ', '1050000đ',
  'Combo 1.050.000', 'chỉ 1.050.000 thôi', 'Giá <strong>1.050.000</strong> đồng',
  '990k', '1.050K', '630 nghìn đồng', '1,2 triệu.', 'giá 1tr', '1tr05', '1.05 tr',
  '990 nghìn đồng thôi', 'chỉ 1 triệu đồng cho cả liệu trình',
  // Kiểm định lần 8: nhánh không có đơn vị tiền vẫn đòi kết câu nên lọt hết.
  'giảm còn 890 nghìn nha', '1.5 triệu nhé', '1 triệu rưỡi', 'giá 1 triệu 50',
  '$39.90', '39.90 USD', '39 dollars', 'USD 39.90', '1.050.000 Việt Nam đồng',
  'Giá ９９０．０００đ', 'Giá &#57;&#57;&#48;.&#48;&#48;&#48;đ', 'Giá 888.000​đ',
  'Giá ٩٩٠.٠٠٠đ', 'Giá <strong>1.950</strong><strong>.000</strong>đ',
];

const CHO_QUA = [
  'Hơn 5 triệu phụ nữ Việt Nam gặp vấn đề sạm nám.',
  'Video đã có hơn 2 triệu lượt xem.',
  '5 triệu người Việt bị nám.',
  'Hơn 3 nghìn khách hàng đã dùng.',
  '2 nghìn đơn mỗi tháng.',
  'Gọi 1900 1000 đồng hành cùng bạn.',
  'Hơn 5 triệu phụ nữ Việt Nam quan tâm tới nám.',
  'Tranexamic Acid 3% trong công thức.',
  'Kem chống nắng SPF 50 PA++++.',
  'Nghiên cứu Hakozaki 2002 dùng nồng độ 5%.',
  'Dùng đủ chu kỳ 8–12 tuần.',
  'Giá chỉ {{price}}, tiết kiệm {{save}}.',
  'Sản phẩm 30ml, dùng trong 60 ngày.',
];

let bad = 0;
for (const s of CHAN) {
  const hits = findHandwrittenMoney(s);
  if (!hits.length) { console.error(`  LỌT   phải chặn nhưng cho qua: ${JSON.stringify(s)}`); bad++; }
}
for (const s of CHO_QUA) {
  const hits = findHandwrittenMoney(s);
  if (hits.length) { console.error(`  NHẦM  phải cho qua nhưng chặn: ${JSON.stringify(s)} → ${hits.join(', ')}`); bad++; }
}
console.log(`  ${CHAN.length + CHO_QUA.length - bad}/${CHAN.length + CHO_QUA.length} ca đúng ` +
            `(${CHAN.length} ca phải chặn, ${CHO_QUA.length} ca phải cho qua)`);
process.exit(bad ? 1 : 0);
