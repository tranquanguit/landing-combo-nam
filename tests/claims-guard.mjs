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
  // Kiểm định lần 10: bỏ dấu mẫu khiến `đừng` và `dùng` cùng thành `dung`,
  // biến từ thông dụng nhất trên trang mỹ phẩm thành từ khoá miễn trừ.
  'Sản phẩm dùng thay thế laser.',
  'Kem dùng thay thế thuốc bôi mỗi tối.',
  'Chúng tôi dùng cam kết hoàn tiền nếu không hết nám.',
  'Dùng 98% khách hàng hài lòng.',
  'Bạn dùng bác sĩ da liễu khuyên dùng làm chuẩn.',
  /* Kiểm định lần 11 — TRỘN dấu và không dấu trong cùng câu.
     Đây là cách gõ phổ biến nhất của biên tập Việt. Vòng 17 chặn 9/9, bản vá
     vòng 18 chỉ chặn 1/9 vì nó tắt chế độ không dấu cho cả câu khi thấy một
     chữ có dấu. Ca thử này bắt buộc phải ở đây. */
  'Kem tri nam tận gốc.',
  'Xoa nam vinh vien, da sáng mịn.',
  'Cam ket hoan tien neu khong het nam nhé.',
  'Duoc bac si da lieu khuyen dung ạ.',
  '98% khach hang het nam hoàn toàn.',
  'Da duoc Bo Y Te cap phep lưu hành.',
  'Hieu qua nhu laser mà không đau.',
  'San pham dac tri nam – hàng chính hãng.',
  'tri&nbsp;nám tận gốc',
  // Kiểm định lần 11: cụm không liền kề.
  'Sản phẩm chữa bệnh nám da.', 'San pham nay chua benh nam da.',
  // Kiểm định lần 12: đảo thứ tự, viết tắt có dấu chấm, dạng so sánh khác.
  'Sản phẩm giúp nám biến mất hoàn toàn.', 'Nám hết hẳn sau 8 tuần.',
  'F.D.A. approved formula.', 'Best melasma cream, number 1 worldwide.',
  // sai một dấu trên chính từ khoá
  'Kem điều trị nạm tận gốc.', 'Đặc trị nàm chân sâu.', 'Chữa nãm da hiệu quả.',
  'Sản phẩm được Bộ Y Tế cấp phếp lưu hành.',
  // ký tự zero-width dán hai từ liền
  'Điều\u200Btrị nám tận gốc.',
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
  // Kiểm định lần 10: bỏ dấu cả văn bản CÓ dấu khiến nám↔năm, thâm↔thăm, sạm↔sách.
  'Ưu đãi áp dụng đến hết năm 2026.',
  'Nếu da chưa sạm, hãy dùng kem chống nắng mỗi ngày.',
  'Da chưa thâm thì nên phòng ngừa sớm.',
  'Bạn chưa nắm rõ cách dùng? Xem hướng dẫn.',
  'Đọc kỹ sách năm 2025.',
  // Kiểm định lần 11: khuyến nghị y tế hợp lệ, không phải so sánh với thủ thuật.
  'Hỏi ý kiến bác sĩ nếu da bạn đang điều trị bằng thuốc bôi.',
  // Kiểm định lần 12: cách viết có dấu hợp lệ trùng từ khoá sau khi bỏ dấu.
  'Danh mục sách nam giới bán chạy.',
  'Nấm da khác với nám da.',
  'Sản phẩm nằm trong nhóm dưỡng sáng.',
  'Bộ sách chăm sóc da năm nay.',
  'Best practices for sun care.',
  'Bước số 1: rửa mặt với nước mát.',
  // Entity hợp lệ trong câu bình thường không được báo nhầm.
  'Kem &amp; serum dùng cùng nhau.',
  'Ghi chú: giá &lt; mức niêm yết cũ.',
];

/*
 * Ca chặn KÈM lý do mong đợi.
 *
 * Kiểm định lần 12: một ca "xanh" chỉ khẳng định `length > 0`, nên nó không
 * chứng minh gì về luật nó nhắm tới — nhiều ca đang được một luật KHÁC bắt hộ.
 * Tắt luật "chứng minh lâm sàng" đi thì bộ thử vẫn xanh, vì hai ca của nó được
 * "hết nám" và "erase melasma" bắt thay. Những ca dưới đây khẳng định đúng cụm
 * bị bắt, nên mỗi luật có ít nhất một ca thật sự canh nó.
 */
const CHAN_CO_LY_DO = [
  ['Đã được chứng minh lâm sàng cho mọi loại da.', 'chứng minh lâm sàng'],
  ['Sản phẩm đã được kiểm nghiệm lâm sàng tại Pháp.', 'kiểm nghiệm lâm sàng'],
  ['Kem điều trị nám tận gốc.', 'điều trị nám'],
  ['Bác sĩ da liễu khuyên dùng sản phẩm này.', 'bác sĩ da liễu khuyên dùng'],
  ['Sản phẩm đã được Bộ Y Tế cấp phép lưu hành.', 'Bộ Y Tế cấp phép'],
  ['Đây là kem nám tốt nhất thị trường.', 'tốt nhất'],
  ['Cam kết hoàn tiền nếu không hết nám.', 'cam kết hoàn tiền'],
  ['Hiệu quả tương đương laser.', 'tương đương laser'],
  ['Triệt tiêu nám vĩnh viễn.', 'vĩnh viễn'],
  ['92% khách hàng thấy da sáng hơn.', '92% khách hàng'],
  ['Clinically proven to fade dark spots.', 'clinically proven'],
  ['FDA approved formula.', 'FDA approved'],
  ['Money back guarantee if it does not work.', 'money back guarantee'],
  ['Removes melasma permanently.', 'permanently'],
  ['Dermatologist recommended.', 'Dermatologist recommended'],
  ['The best melasma cream on the market.', 'the best'],
  ['As effective as laser treatment.', 'as effective as laser'],
  ['92% of customers saw results.', '92% of customers'],
  ['Cures dark spots in four weeks.', 'Cures dark spots'],
];

let bad = 0;
for (const s of CHAN) {
  if (!findForbiddenClaims(s).length) { console.error(`  LỌT   phải chặn: ${JSON.stringify(s)}`); bad++; }
}
for (const [s, expected] of CHAN_CO_LY_DO) {
  const hits = findForbiddenClaims(s);
  if (!hits.length) {
    console.error(`  LỌT   phải chặn: ${JSON.stringify(s)}`);
    bad++;
  } else if (!hits.some((h) => h.match.toLowerCase().includes(expected.toLowerCase()))) {
    console.error(`  LÝ DO SAI  ${JSON.stringify(s)} — mong bắt "${expected}", ` +
      `thực tế bắt ${JSON.stringify(hits.map((h) => h.match))}`);
    bad++;
  }
}
for (const s of CHO_QUA) {
  const h = findForbiddenClaims(s);
  if (h.length) { console.error(`  NHẦM  phải cho qua: ${JSON.stringify(s)} → "${h[0].match}"`); bad++; }
}
const total = CHAN.length + CHAN_CO_LY_DO.length + CHO_QUA.length;
console.log(`  ${total - bad}/${total} ca đúng ` +
            `(${CHAN.length} phải chặn, ${CHAN_CO_LY_DO.length} phải chặn ĐÚNG LÝ DO, ` +
            `${CHO_QUA.length} phải cho qua)`);
process.exit(bad ? 1 : 0);
