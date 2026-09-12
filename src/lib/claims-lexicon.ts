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

export interface ForbiddenPattern {
  pattern: RegExp;
  why: string;
  instead: string;
}

export const FORBIDDEN: ForbiddenPattern[] = [
  {
    pattern: /\b(trị|điều trị|chữa|đặc trị)\s+(nám|thâm|mụn|sạm)/iu,
    why: 'biến mỹ phẩm thành thuốc chữa bệnh',
    instead: 'chăm sóc da nám, hỗ trợ làm mờ',
  },
  {
    pattern: /\bhết\s+(nám|thâm|sạm)\b|\b(sạch|khỏi|dứt điểm)\s+(nám|thâm)\b|\bkhông\s+tái\s+phát\b/iu,
    why: 'tuyên bố kết quả tuyệt đối, không chứng minh được',
    instead: 'hỗ trợ làm mờ, hạn chế sạm màu quay lại',
  },
  {
    pattern: /\bchứng minh lâm sàng\b|\bkiểm nghiệm lâm sàng\b|\bclinically proven\b/iu,
    why: 'chỉ được nói khi có hồ sơ thử nghiệm lâm sàng thật, kèm số hiệu',
    instead: 'dẫn nghiên cứu cụ thể trong bảng thành phần',
  },
  {
    pattern: /\b(như|bằng|thay thế)\s+(laser|peel|lăn kim|tiêm|thuốc)\b/iu,
    why: 'so sánh mỹ phẩm với thủ thuật y khoa',
    instead: 'mô tả tác dụng của hoạt chất',
  },
  {
    pattern: /\bcam kết\s+(hoàn tiền|hiệu quả|khỏi|hết)\b|\bhoàn tiền 100%\b/iu,
    why: 'cam kết kết quả điều trị',
    instead: 'nêu chính sách đổi trả cụ thể và điều kiện áp dụng',
  },
  {
    pattern: /\b(số\s*1|tốt nhất|hiệu quả nhất|duy nhất trên thị trường|number one)\b/iu,
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
const NEGATED = /\b(không|chẳng|chưa|đừng)\b[^.;!?]{0,40}$/iu;

export function findForbiddenClaims(text: string): { match: string; why: string; instead: string }[] {
  const plain = text.replace(/<[^>]*>/g, ' ');
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
