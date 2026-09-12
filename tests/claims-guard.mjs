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
  'Kem nám số 1 thị trường Việt Nam.',
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
  // Kiểm định lần 6: entity đi xuyên hàng rào vì richText giữ nguyên entity hợp lệ.
  'Sản phẩm &#273;i&#7873;u tr&#7883; nám tận gốc.',
  'Hi\u1ec7u qu\u1ea3 nh&#432; laser.',
  'Cam k&#7871;t hoàn ti&#7873;n n&#7871;u không h&#7871;t nám.',
  'FDA &#97;pproved formula.',
  // Kiểm định lần 7: lần khớp đầu bị phủ định che mất mọi lần khớp sau.
  'Chúng tôi không trị nám bằng lời hứa suông. Combo trị nám theo cơ chế kép.',
  'Không phải kem trị nám nào cũng giống nhau; đây là kem trị nám thế hệ mới.',
  // Kiểm định lần 8: phủ định gắn vào động từ khác, không gắn vào cụm bị cấm.
  'Bạn sẽ không ngờ combo trị nám nhanh đến thế.',
  'Ai cũng không tin nổi kem trị nám này.',
  'không thể tưởng tượng hết nám hoàn toàn sau 4 tuần',
  'Cam  kết  hoàn  tiền nếu không hết nám.',
  // Kiểm định lần 9: tiếng Việt KHÔNG DẤU — cách viết quảng cáo bình thường.
  'Kem tri nam tan goc, xoa nam vinh vien chi sau 2 tuan.',
  'Duoc bac si da lieu khuyen dung.',
  'Cam ket hoan tien neu khong het nam.',
  'Da duoc Bo Y Te cap phep luu hanh.',
  'hieu qua nhu laser ma khong dau',
  // chữ giãn cách từng ký tự
  'Đ I Ề U  T R Ị  N Á M',
  // hai lượt mã hoá
  'Cam k&amp;#7871;t hoàn ti&amp;#7873;n n&amp;#7871;u không h&amp;#7871;t nám.',
];

const CHO_QUA = [
  'Mỹ phẩm này không có tác dụng thay thế thuốc chữa bệnh.',
  'Phụ nữ mang thai nên hỏi ý kiến bác sĩ trước khi dùng.',
  'Sản phẩm hỗ trợ làm mờ vùng da sạm nám, kết quả tùy cơ địa.',
  'Helps visibly reduce the look of dark spots.',
  'This is a cosmetic product and is not intended to treat any disease.',
  'Nám mảng thường cải thiện trong 4–8 tuần.',
  'Công thức không chứa corticoid, hydroquinone hay cồn khô.',
  'Số 1 trong danh sách bước chăm sóc là làm sạch.',
  'Bước số 1, rửa mặt. Bước số 2, dùng serum.',
  'Sản phẩm không phải là thuốc.',
  'Sản phẩm không chứa corticoid.',
  'My pham nay khong co tac dung thay the thuoc chua benh.',
  'San pham khong chua corticoid.',
  'Phu nu mang thai nen hoi y kien bac si truoc khi dung.',
  'Bước số 1: rửa mặt với nước mát.',
  // Entity hợp lệ trong câu bình thường không được báo nhầm.
  'Kem &amp; serum dùng cùng nhau.',
  'Ghi chú: giá &lt; mức niêm yết cũ.',
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
