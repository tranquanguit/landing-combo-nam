/**
 * Từ ngữ bị cấm trong nội dung mỹ phẩm.
 *
 * Cổng `evidence` chỉ áp cho `hero.usp[]`, nên mọi tuyên bố kết quả đặt ở
 * `faq.items[].a`, `cards.intro`, `steps.footnote`… đều lọt. Kiểm định viên đã
 * đưa được "98% khách hàng hết nám hoàn toàn", "chứng minh lâm sàng",
 * "cam kết hoàn tiền nếu không hết nám", "hiệu quả như laser" lên trang mà
 * build không hé răng.
 *
 * Không thể bắt mọi lời hứa bằng máy. Nhưng có thể bắt những cụm mà quy định
 * quảng cáo mỹ phẩm Việt Nam cấm rõ ràng, và những cụm biến mỹ phẩm thành thuốc.
 * Cơ sở: Thông tư 06/2011/TT-BYT và Nghị định 342/2025/NĐ-CP.
 */

import { normaliseForScan } from './money-scan.ts';

/**
 * Bóc thẻ và giải mã entity trước khi quét.
 *
 * Kiểm định lần 6: `richText()` cố ý giữ nguyên entity hợp lệ, nên
 * "&#273;i&#7873;u tr&#7883; nám" lên trang nguyên vẹn và trình duyệt giải mã
 * thành "điều trị nám" — trong khi hàng rào chỉ thấy dấu &. Hàng rào giá đã
 * giải mã từ vòng trước; hai hàng rào cùng họ nay dùng chung một chuẩn hoá.
 */
function forScan(text: string): string {
  // Thẻ thật bị bóc trong normaliseForScan. Dấu < > còn lại (sinh ra do giải mã
  // &lt; &gt;) chỉ đổi thành khoảng trắng, không bóc, để không che mất chữ.
  return normaliseForScan(text).replace(/[<>]/g, ' ');
}

export interface ForbiddenPattern {
  pattern: RegExp;
  why: string;
  instead: string;
}

export const FORBIDDEN: ForbiddenPattern[] = [
  /* ---------- Tiếng Anh ----------
     Từ điển ban đầu chỉ viết bằng tiếng Việt nên bản EN gần như không có hàng
     rào nào: "Removes melasma permanently", "cures dark spots", "FDA approved",
     "Money back guarantee" đều lên trang được. Đây là thị trường EU/UK, nơi
     claim mỹ phẩm bị xử phạt nặng nhất. */
  {
    pattern: /\b(cure|cures|cured|heal|heals|treat|treats|treatment of)\s+(melasma|dark spots?|pigmentation|acne)/i,
    why: 'biến mỹ phẩm thành thuốc chữa bệnh (US FDA, EU 1223/2009)',
    instead: 'helps visibly reduce the look of dark spots',
  },
  {
    pattern: /\b(remove|removes|erase|erases|eliminate|eliminates|clear(?:s)?)\s+(melasma|dark spots?|pigmentation)\b|\bpermanently\b|\bforever\b/i,
    why: 'tuyên bố kết quả tuyệt đối hoặc vĩnh viễn, không chứng minh được',
    instead: 'helps improve the appearance of uneven tone',
  },
  {
    pattern: /\bclinically proven\b|\bdermatologist(?:ally)?[\s-]?(recommended|tested|approved)\b|\bdoctor[\s-]?recommended\b/i,
    why: 'cần hồ sơ thử nghiệm lâm sàng thật; và Nghị định 342/2025 cấm dùng danh nghĩa nhân viên y tế',
    instead: 'dẫn nghiên cứu cụ thể kèm nồng độ đã thử nghiệm',
  },
  {
    pattern: /\bFDA[\s-]?(approved|certified|cleared)\b|\b(approved|certified) by the FDA\b/i,
    why: 'FDA không phê duyệt hay chứng nhận mỹ phẩm',
    instead: 'nêu số tiếp nhận phiếu công bố sản phẩm mỹ phẩm',
  },
  {
    pattern: /\bmoney[\s-]?back guarantee\b|\bguaranteed? results?\b|\bguaranteed to work\b/i,
    why: 'cam kết kết quả điều trị',
    instead: 'nêu chính sách đổi trả cụ thể kèm điều kiện',
  },
  {
    pattern: /\b(the best|number one|no\.?\s*1|world'?s leading|most effective)\b/i,
    why: 'so sánh tuyệt đối',
    instead: 'nêu điểm khác biệt kiểm chứng được',
  },
  {
    pattern: /\b\d{1,3}\s*%\s*(of\s+)?(customers?|users?|people|women)\b|\b100\s*%\s*effective\b/i,
    why: 'số liệu khảo sát phải nêu cỡ mẫu và cách thu thập',
    instead: 'đưa vào hero.usp với evidence: "survey" và qualifier nêu cỡ mẫu',
  },
  {
    pattern: /\b(like|same as|replaces?|as effective as)\s+(laser|peel|microneedling|injections?)\b/i,
    why: 'so sánh mỹ phẩm với thủ thuật y khoa',
    instead: 'mô tả tác dụng của hoạt chất',
  },
  {
    pattern: /\b(trị|điều trị|chữa|đặc trị)\s+(nám|thâm|mụn|sạm)/iu,
    why: 'biến mỹ phẩm thành thuốc chữa bệnh',
    instead: 'chăm sóc da nám, hỗ trợ làm mờ',
  },
  {
    pattern: /(hết|xoá|xóa|đánh bay|triệt tiêu|loại bỏ|chấm dứt|biến mất|tạm biệt)\s*(hoàn toàn\s*)?(nám|thâm|sạm|đốm nâu)|(sạch|khỏi|dứt điểm)\s+(nám|thâm)|không\s+tái\s+phát|vĩnh viễn/iu,
    why: 'tuyên bố kết quả tuyệt đối, không chứng minh được',
    instead: 'hỗ trợ làm mờ, hạn chế sạm màu quay lại',
  },
  {
    pattern: /\bchứng minh lâm sàng\b|\bkiểm nghiệm lâm sàng\b|\bclinically proven\b/iu,
    why: 'chỉ được nói khi có hồ sơ thử nghiệm lâm sàng thật, kèm số hiệu',
    instead: 'dẫn nghiên cứu cụ thể trong bảng thành phần',
  },
  {
    pattern: /(như|bằng|tương đương|thay thế cho|thay thế)\s*(liệu trình\s*)?(laser|peel|lăn kim|tiêm|thuốc)/iu,
    why: 'so sánh mỹ phẩm với thủ thuật y khoa',
    instead: 'mô tả tác dụng của hoạt chất',
  },
  {
    pattern: /\bcam kết\s+(hoàn tiền|hiệu quả|khỏi|hết)\b|\bhoàn tiền 100%\b/iu,
    why: 'cam kết kết quả điều trị',
    instead: 'nêu chính sách đổi trả cụ thể và điều kiện áp dụng',
  },
  {
    pattern: /(số\s*1|so\s*1|tốt nhất|hiệu quả nhất|duy nhất trên thị trường|number one)/iu,
    why: 'so sánh tuyệt đối, bị cấm theo Luật Quảng cáo',
    instead: 'nêu điểm khác biệt cụ thể, kiểm chứng được',
  },
  {
    pattern: /\b\d{1,3}\s*%\s*(khách hàng|người dùng|users?|người)\b/iu,
    why: 'số liệu khảo sát phải nêu cỡ mẫu, thời gian và cách thu thập',
    instead: 'đưa claim vào hero.usp với evidence: "survey" và qualifier nêu cỡ mẫu',
  },
  {
    // Không dùng \b quanh từ tiếng Việt: \b chỉ nhận ký tự ASCII, nên sau 'sĩ'
    // (kết thúc bằng ĩ) không có biên từ và mẫu không bao giờ khớp.
    // Cho phép vài từ chen giữa: 'bác sĩ da liễu khuyên dùng'.
    pattern: /(bác sĩ|dược sĩ|y sĩ|bệnh viện|phòng khám)[^.;!?]{0,30}?(khuyên dùng|tin dùng|chứng nhận|kiểm chứng|chứng thực)/iu,
    why: 'Nghị định 342/2025 cấm dùng danh nghĩa nhân viên/cơ sở y tế trong quảng cáo mỹ phẩm',
    instead: 'dẫn nghiên cứu công bố, hoặc chứng từ kiểm nghiệm',
  },
  {
    pattern: /\b(Bộ Y Tế|Sở Y Tế|FDA)\s*(cấp phép|chứng nhận|công nhận)/iu,
    why: 'mỹ phẩm chỉ được công bố, không được cấp phép; FDA không chứng nhận mỹ phẩm',
    instead: 'số tiếp nhận phiếu công bố sản phẩm mỹ phẩm',
  },
];

/**
 * Phủ định đảo ngược ý nghĩa. Câu cảnh báo bắt buộc theo luật —
 * "không phải là thuốc và không có tác dụng thay thế thuốc chữa bệnh" —
 * chứa đúng cụm bị cấm nhưng nói điều ngược lại.
 */
/*
 * Chỉ bỏ qua khi phủ định đứng NGAY TRƯỚC cụm bị cấm, trong cùng mệnh đề.
 *
 * Bản trước nhìn 40 ký tự bất kỳ phía trước nên "Không ngờ, trị nám chỉ sau 2
 * tuần" và "Chúng tôi không nói quá: 98% khách hàng hết nám" đều lách được.
 * Nay dấu phẩy, hai chấm hay dấu chấm đều cắt phạm vi phủ định.
 */
const NEGATED = /(không|chẳng|chưa|đừng|no|not|never)\s+(?:có\s+|là\s+|the\s+)?[\p{L}\s]{0,18}$/iu;

export function findForbiddenClaims(text: string): { match: string; why: string; instead: string }[] {
  const plain = forScan(text);
  const out: { match: string; why: string; instead: string }[] = [];
  for (const rule of FORBIDDEN) {
    const m = plain.match(rule.pattern);
    if (!m) continue;
    // Bỏ qua khi cụm nằm sau một phủ định trong cùng mệnh đề.
    if (NEGATED.test(plain.slice(0, m.index ?? 0))) continue;
    out.push({ match: m[0], why: rule.why, instead: rule.instead });
  }
  return out;
}


/**
 * Dữ liệu cá nhân trong nội dung.
 *
 * Cổng consent chỉ bảo vệ các khối có trường `consent` (ảnh, lời chứng). Kiểm
 * định viên đã đăng được "Chị Nguyễn Thu Ha, 38 tuoi, Quan 3, dt 0912345678"
 * qua `cards.items[].body` — một trường văn xuôi bình thường, không cổng nào
 * chạm tới. Luật này quét mọi trường: danh tính người thật chỉ được đặt trong
 * khối có consent, không được rải trong văn xuôi.
 */
export interface PersonalDataHit { match: string; kind: string }

const PERSONAL: { pattern: RegExp; kind: string }[] = [
  { pattern: /(?:^|[\s(])(?:0|\+84)\d{9}(?![\d])/u, kind: 'số điện thoại' },
  { pattern: /[\w.+-]+@[\w-]+\.[\w.]{2,}/u, kind: 'địa chỉ email' },
  { pattern: /\b\d{2}\s*tuổi\b|\b\d{2}\s*tuoi\b|\baged?\s+\d{2}\b/iu, kind: 'tuổi' },
  {
    pattern: /(?:^|[\s("“])(?:chị|anh|cô|bác|chú|em|Mrs?\.?|Ms\.?)\s+[A-ZĐÀ-Ỹ][\p{Ll}\p{M}]+\s+[A-ZĐÀ-Ỹ]/u,
    kind: 'họ tên đầy đủ kèm xưng hô',
  },
];

export function findPersonalData(text: string): PersonalDataHit[] {
  const plain = forScan(text);
  const out: PersonalDataHit[] = [];
  for (const rule of PERSONAL) {
    const m = plain.match(rule.pattern);
    if (m) out.push({ match: m[0].trim(), kind: rule.kind });
  }
  return out;
}
