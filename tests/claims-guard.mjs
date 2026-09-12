/**
 * Bộ thử từ điển từ cấm. Mọi ca ở đây là câu mà kiểm định viên độc lập đã đưa
 * lọt được lên trang thật, hoặc câu hợp lệ từng bị chặn nhầm.
 */
import { findForbiddenClaims } from '../src/lib/claims-lexicon.ts';

const CHAN = [
  // tiếng Việt
  'Sản phẩm được bác sĩ da liễu khuyên dùng.',
  'Đã được chứng minh lâm sàng: 9/10 người hết nám.',
  'Cam kết hoàn tiền nếu không hết nám sau 8 tuần.',
  'Hiệu quả như laser mà không đau.',
  'Hiệu quả tương đương laser.',
  'Thay thế cho liệu trình laser.',
  '98% khách hàng hết nám hoàn toàn.',
  'Sản phẩm đã được Bộ Y Tế cấp phép lưu hành.',
  'Đây là kem nám tốt nhất thị trường Việt Nam.',
  'Xoá nám tận gốc.',
  'Đánh bay nám sau 4 tuần.',
  'Triệt tiêu nám vĩnh viễn.',
  'Loại bỏ hoàn toàn nám chân sâu.',
  'Chấm dứt nám sau một liệu trình.',
  'Tạm biệt nám vĩnh viễn.',
  'Không ngờ, trị nám chỉ sau 2 tuần.',
  'Chúng tôi không nói quá: 98% khách hàng hết nám.',
  // tiếng Anh
  'Removes melasma permanently.',
  'Cures dark spots in four weeks.',
  'FDA approved formula.',
  'The best melasma cream on the market.',
  'Dermatologist recommended.',
  'Money back guarantee if it does not work.',
  '100% effective on all skin types.',
  'Clinically proven to erase melasma.',
  '92% of customers saw results.',
  'As effective as laser treatment.',
];

const CHO_QUA = [
  'Mỹ phẩm này không có tác dụng thay thế thuốc chữa bệnh.',
  'Phụ nữ mang thai nên hỏi ý kiến bác sĩ trước khi dùng.',
  'Sản phẩm hỗ trợ làm mờ vùng da sạm nám, kết quả tùy cơ địa.',
  'Helps visibly reduce the look of dark spots.',
  'This is a cosmetic product and is not intended to treat any disease.',
  'Nám mảng thường cải thiện trong 4–8 tuần.',
  'Công thức không chứa corticoid, hydroquinone hay cồn khô.',
];

let bad = 0;
for (const s of CHAN) {
  if (!findForbiddenClaims(s).length) { console.error(`  LỌT   phải chặn: ${JSON.stringify(s)}`); bad++; }
}
for (const s of CHO_QUA) {
  const h = findForbiddenClaims(s);
  if (h.length) { console.error(`  NHẦM  phải cho qua: ${JSON.stringify(s)} → "${h[0].match}"`); bad++; }
}
console.log(`  ${CHAN.length + CHO_QUA.length - bad}/${CHAN.length + CHO_QUA.length} ca đúng ` +
            `(${CHAN.length} phải chặn, ${CHO_QUA.length} phải cho qua)`);
process.exit(bad ? 1 : 0);
