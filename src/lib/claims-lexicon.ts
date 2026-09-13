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

/**
 * Bản không dấu của cùng một chuỗi.
 *
 * Kiểm định lần 9: toàn bộ hàng rào claims khớp trên chuỗi CÓ DẤU, trong khi
 * copy quảng cáo Việt Nam viết không dấu là chuyện bình thường chứ không phải
 * trò lách. "Kem tri nam tan goc, xoa nam vinh vien. Duoc bac si da lieu khuyen
 * dung." vượt cùng lúc ba luật với build xanh.
 *
 * Cũng xử luôn chữ giãn cách ("Đ I Ề U  T R Ị  N Á M"): ký tự đơn lẻ cách nhau
 * bằng dấu cách được dồn lại trước khi quét.
 */
/** Chuỗi đúng hệ toạ độ mà findForbiddenClaims trả `index` theo. */
export function scanText(text: string): string {
  return forScan(text);
}

export function stripDiacritics(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

/**
 * Chữ bị giãn cách từng ký tự: "Đ I Ề U  T R Ị  N Á M".
 *
 * Dồn lại thì mất luôn ranh giới từ ("ĐIỀUTRỊNÁM"), nên chuỗi dồn được quét
 * bằng một bộ mẫu có dấu cách nới thành `\s*`. Chỉ sinh biến thể này khi văn bản
 * THẬT SỰ có chữ giãn cách, để không nới lỏng hàng rào cho nội dung bình thường.
 */
const SPREAD = /(?:(?<![\p{L}])\p{L}\s+){3,}\p{L}(?![\p{L}])/gu;
function despaceSpread(text: string): string | null {
  if (!SPREAD.test(text)) { SPREAD.lastIndex = 0; return null; }
  SPREAD.lastIndex = 0;
  return text.replace(SPREAD, (m) => m.replace(/\s+/g, ''));
}
/** Nới mọi dấu cách trong mẫu thành `\s*` để khớp được chuỗi đã dồn. */
function loosenSpaces(source: string): string {
  // Cả dấu cách viết thẳng lẫn `\s+` trong mẫu đều phải thành `\s*`, vì chuỗi
  // đã dồn không còn khoảng trắng nào giữa các từ.
  return source.replace(/\\s\+/g, '\\s*').replace(/ /g, '\\s*');
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
    /* "F.D.A." viết tắt có dấu chấm cũng phải bắt — kiểm định lần 12. */
    pattern: /\bF\.?D\.?A\.?[\s-]?(approved|certified|cleared)\b|\b(approved|certified) by the F\.?D\.?A\.?\b/i,
    why: 'FDA không phê duyệt hay chứng nhận mỹ phẩm',
    instead: 'nêu số tiếp nhận phiếu công bố sản phẩm mỹ phẩm',
  },
  {
    pattern: /\bmoney[\s-]?back guarantee\b|\bguaranteed? results?\b|\bguaranteed to work\b/i,
    why: 'cam kết kết quả điều trị',
    instead: 'nêu chính sách đổi trả cụ thể kèm điều kiện',
  },
  {
    pattern: /\b(the best|best\s+\w+\s+cream|number\s*(one|1)|no\.?\s*1|world'?s leading|worldwide\s+no|most effective)\b/i,
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
    pattern: /(?<![\p{L}])(trị|điều trị|chữa|đặc trị)\s+(bệnh\s+)?(nám|thâm|mụn|sạm|nấm)/iu,
    why: 'biến mỹ phẩm thành thuốc chữa bệnh',
    instead: 'chăm sóc da nám, hỗ trợ làm mờ',
  },
  {
    /* Thêm dạng ĐẢO thứ tự ("nám biến mất hoàn toàn") — kiểm định lần 12. */
    pattern: /(hết|xoá|xóa|đánh bay|triệt tiêu|loại bỏ|chấm dứt|biến mất|tạm biệt)\s*(hoàn toàn\s*)?(nám|thâm|sạm|đốm nâu)|(nám|thâm|sạm|đốm nâu)\s+(biến mất|hết hẳn|sạch)\s*(hoàn toàn)?|(sạch|khỏi|dứt điểm)\s+(nám|thâm)|không\s+tái\s+phát|vĩnh viễn/iu,
    why: 'tuyên bố kết quả tuyệt đối, không chứng minh được',
    instead: 'hỗ trợ làm mờ, hạn chế sạm màu quay lại',
  },
  {
    pattern: /(?<![\p{L}])(?:chứng minh|kiểm nghiệm)\s+lâm sàng(?![\p{L}])|\bclinically proven\b/iu,
    why: 'chỉ được nói khi có hồ sơ thử nghiệm lâm sàng thật, kèm số hiệu',
    instead: 'dẫn nghiên cứu cụ thể trong bảng thành phần',
  },
  {
    /* "bằng thuốc" trong câu khuyến nghị y tế ("da bạn đang điều trị bằng thuốc
       bôi") không phải so sánh mỹ phẩm với thủ thuật — kiểm định lần 11. Chỉ
       tính khi nói về CHÍNH sản phẩm này. */
    pattern: /(như|tương đương|thay thế cho|thay thế)\s*(liệu trình\s*)?(laser|peel|lăn kim|tiêm|thuốc)|(?<![\p{L}])bằng\s+(laser|peel|lăn kim)/iu,
    why: 'so sánh mỹ phẩm với thủ thuật y khoa',
    instead: 'mô tả tác dụng của hoạt chất',
  },
  {
    pattern: /(?<![\p{L}])cam kết\s+(hoàn tiền|hiệu quả|khỏi|hết)(?![\p{L}])|(?<![\p{L}])hoàn tiền 100\s*%/iu,
    why: 'cam kết kết quả điều trị',
    instead: 'nêu chính sách đổi trả cụ thể và điều kiện áp dụng',
  },
  {
    /* "số 1" chỉ là so sánh tuyệt đối khi KHÔNG dùng theo nghĩa thứ tự.
       Kiểm định lần 7: "Số 1 trong danh sách bước chăm sóc là làm sạch" bị chặn
       nhầm — một hàng rào báo nhầm là hàng rào bị người biên tập mất niềm tin. */
    pattern: /((?:số|so)\s*1(?!\s*(?:trong|là|[.,:;)\u2013\u2014-]))|tốt nhất|hiệu quả nhất|duy nhất trên thị trường|number one)/iu,
    why: 'so sánh tuyệt đối, bị cấm theo Luật Quảng cáo',
    instead: 'nêu điểm khác biệt cụ thể, kiểm chứng được',
  },
  {
    pattern: /\b\d{1,3}\s*%\s*(khách hàng|người dùng|users?|người)(?![\p{L}])/iu,
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
    pattern: /(?<![\p{L}])(Bộ Y Tế|Sở Y Tế|FDA)\s*(cấp phép|chứng nhận|công nhận)/iu,
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
/*
 * Chỉ những cách phủ định THẬT SỰ đảo nghĩa mới được miễn.
 *
 * Kiểm định lần 8: `[\p{L}\s]{0,18}` cho phép bất kỳ chữ nào chen giữa, nên
 * "Bạn sẽ không ngờ combo trị nám nhanh đến thế" và "Ai cũng không tin nổi kem
 * trị nám này" đều lách được — phủ định gắn vào động từ khác, không gắn vào cụm
 * bị cấm. Nay chỉ nhận đúng các tổ hợp phủ định trực tiếp.
 */
const NEGATED = /(?:không|chẳng|chưa|đừng)\s+(?:phải\s+|có\s+)?(?:là\s+)?(?:thuốc\s+|tác dụng\s+|chứa\s+|dùng\s+để\s+|nhằm\s+|thay thế\s+)?$|(?:không|chẳng|chưa)\s+$|(?:not|never|no)\s+(?:a\s+|an\s+|the\s+)?(?:intended\s+to\s+|meant\s+to\s+|substitute\s+for\s+)?$/iu;

/** Văn bản có chứa dấu tiếng Việt hay không. */
const HAS_DIACRITICS = /[̀-ͯ]|[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i;

/**
 * Phủ định trong văn bản KHÔNG DẤU.
 *
 * Cố ý KHÔNG sinh bằng stripDiacritics(NEGATED): bỏ dấu thì `đừng` và `dùng`
 * đều thành `dung`, nên từ thông dụng nhất trên một trang mỹ phẩm trở thành từ
 * khoá miễn trừ — "Kem dùng thay thế thuốc bôi" qua sạch mọi luật (kiểm định
 * lần 10). Tương tự `chưa`/`chứa`, `chẳng`/`chàng`. Danh sách này viết tay, chỉ
 * gồm những từ mà bản không dấu KHÔNG trùng nghĩa với từ nào khác.
 */
const NEGATED_BARE = /(?:khong|chua)\s+(?:phai\s+|co\s+)?(?:la\s+)?(?:thuoc\s+|tac dung\s+|chua\s+|dung de\s+|nham\s+|thay the\s+)?$|(?:khong|chua)\s+$|(?:not|never|no)\s+(?:a\s+|an\s+|the\s+)?(?:intended to\s+|meant to\s+|substitute for\s+)?$/i;

/**
 * Những cách viết CÓ DẤU hợp lệ mà khi bỏ dấu trùng với từ bị cấm.
 *
 * Kiểm định lần 12 chỉ ra bản vá vòng 19 vẫn sai hướng: nó đòi đoạn khớp phải
 * có ít nhất một từ gõ không dấu, nên chỉ cần sai/thiếu dấu trên chính từ khoá
 * là lọt — "điều trị nạm", "hết nạm", "đặc trị nàm", "chữa nãm", "như lasé",
 * "cấp phếp" đều qua sạch. Đồng thời nó báo nhầm "sách nam giới".
 *
 * Đảo mặc định: một lần khớp trên bản bỏ dấu được TIN, trừ khi từ khoá trong đó
 * là một từ tiếng Việt hợp lệ đã biết. Hàng rào nên mặc định chặn cái nó không
 * nhận ra, không mặc định tha.
 */
/**
 * Những cách viết CÓ DẤU đúng chính tả mà khi bỏ dấu trùng nhau.
 *
 * Danh sách này CỐ Ý gồm cả chính các từ bị cấm (`nám`, `thâm`, `trị`, `chữa`…).
 * Lý do: cách đọc nguyên văn đã bắt mọi vi phạm viết đúng chính tả rồi. Cách đọc
 * bỏ dấu chỉ tồn tại để bắt chữ viết KHÔNG dấu hoặc SAI dấu. Nên với cách đọc
 * đó, một từ viết đúng chính tả — dù là từ bị cấm hay từ vô can — đều đã được
 * xử lý ở nơi khác và không cần đọc lại theo nghĩa bỏ dấu.
 *
 * Kiểm định lần 13: danh sách thiếu `thẩm`, `sẫm`, `khối` nên "Tạm biệt thẩm mỹ
 * viện đắt đỏ" và "Tạm biệt sẫm màu vùng gò má" bị chặn — một trong những câu
 * mở đầu phổ biến nhất của ngành, và `sẫm màu` là chính vốn từ mà thông báo lỗi
 * của hàng rào khuyên dùng.
 */
const LEGITIMATE_HOMOGRAPHS: Record<string, string[]> = {
  nam: ['năm', 'nắm', 'nằm', 'nấm', 'nám', 'nắng', 'nấng'],
  tham: ['thăm', 'thắm', 'thầm', 'thấm', 'thẩm', 'thẫm', 'thâm'],
  sam: ['sâm', 'sắm', 'sám', 'sẫm', 'sẩm', 'sạm'],
  mun: ['mùn', 'mụn'],
  tri: ['trí', 'trì', 'trĩ', 'trị'],
  chua: ['chứa', 'chùa', 'chưa', 'chữa'],
  sach: ['sách', 'sạch'],
  khoi: ['khối', 'khởi', 'khói', 'khôi', 'khỏi'],
  het: ['hét', 'hẹt', 'hết'],
};

/**
 * Chính tả ĐÚNG của những từ xuất hiện trong từ điển từ cấm.
 *
 * Phân biệt "trị nam" (vi phạm: động từ bị cấm viết đúng + tình trạng viết không
 * dấu) với "sách nam giới" (bình thường: "sách" không phải từ bị cấm nào — từ bị
 * cấm là "sạch"). Kiểm định lần 14 tìm ra lỗ này: `ACTION_KEYS` chỉ xét từ động
 * từ có viết không dấu hay không, nên "Kem trị nam tận gốc", "Chữa tham hiệu
 * quả", "Trị mun cấp tốc", "Hết nam sau 8 tuần" lọt sạch.
 */
/**
 * Từ khoá mà bản KHÔNG dấu của nó gần như chỉ có một nghĩa trong văn bản mỹ phẩm.
 *
 * "tri"/"xoa" không dấu thì hầu như luôn là "trị"/"xoá". Ngược lại "het", "nam",
 * "sach", "chua", "tham" không dấu là những từ cực kỳ phổ biến với nghĩa khác
 * ("hết năm", "sách nam giới", "chưa thăm", "đã chứa") — kiểm định lần 14 chỉ ra
 * bản trước tin mọi đoạn toàn-không-dấu, nên bốn câu hoàn toàn bình thường viết
 * không dấu bị chặn.
 *
 * Với đoạn toàn không dấu mà không có từ nào ở đây, hàng rào dựa vào các luật
 * KHÁC trong từ điển ("cam ket hoan tien", "bac si ... khuyen dung",
 * "98% khach hang", "Bo Y Te cap phep") — chúng không dựa vào cặp động từ +
 * tình trạng nên không bị ảnh hưởng.
 */
const UNAMBIGUOUS_UNACCENTED = new Set(['tri', 'xoa']);

/**
 * Từ trong đoạn khớp khiến cả đoạn hết mơ hồ dù mọi từ đều viết không dấu.
 *
 * "chua benh nam da" — "chua" một mình mơ hồ (chưa/chứa/chữa), nhưng đi với
 * "benh" thì chỉ còn một nghĩa: chữa bệnh.
 */
const DISAMBIGUATING = new Set(['benh', 'lieu', 'gioc']);

const FORBIDDEN_SPELLINGS = new Set([
  'trị', 'chữa', 'hết', 'xoá', 'xóa', 'sạch', 'khỏi',
  'nám', 'thâm', 'sạm', 'mụn', 'nấm',
]);

/**
 * Lần khớp trên bản bỏ dấu có đáng tin không?
 *
 * Tin khi có dấu hiệu văn bản không được gõ đúng chính tả tiếng Việt:
 *   1. một từ dễ lẫn viết CÓ dấu nhưng SAI chính tả ("nạm", "nàm", "phếp"); hoặc
 *   2. mọi từ dễ lẫn trong đoạn đều viết KHÔNG dấu ("tri nam", "het nam"); hoặc
 *   3. có từ viết không dấu VÀ trong đoạn có một từ viết đúng chính tả mà chính
 *      nó là từ bị cấm ("trị nam", "Hết nam", "Chữa tham").
 *
 * Không tin khi mọi từ dễ lẫn đều viết đúng chính tả và không từ nào là từ bị
 * cấm — nghĩa là cách đọc nguyên văn đã xét đoạn đó: "hết năm 2026",
 * "sách nam giới", "khối thâm hụt", "da chưa thâm".
 *
 * Đánh đổi cố ý, đã ghi: hai từ viết ĐÚNG chính tả nhưng ghép lại chỉ thành vi
 * phạm sau khi bỏ dấu ("Chứa nám", "Trì nam") không bị chặn — chặn chúng sẽ kéo
 * theo "chưa thâm", "chưa nắm rõ", "khối thâm hụt".
 *
 * Phép bỏ dấu giữ nguyên độ dài từng ký tự nên chỉ số trỏ đúng vào bản gốc.
 */
function foldedHitIsReal(original: string, from: number, to: number): boolean {
  const words = original.slice(from, to).split(/[^\p{L}\p{M}]+/u).filter((w) => w.length >= 2);
  let sawColliding = false;
  let sawUnaccented = false;
  let sawUnambiguousUnaccented = false;
  let sawDisambiguating = false;
  let sawAccentedOk = false;
  let sawForbiddenSpelling = false;

  for (const word of words) {
    const folded = stripDiacritics(word).toLowerCase();
    if (DISAMBIGUATING.has(folded)) sawDisambiguating = true;
    const legit = LEGITIMATE_HOMOGRAPHS[folded];
    if (!legit) continue;
    sawColliding = true;
    if (!HAS_DIACRITICS.test(word)) {
      sawUnaccented = true;
      if (UNAMBIGUOUS_UNACCENTED.has(folded)) sawUnambiguousUnaccented = true;
      continue;
    }
    if (!legit.includes(word.toLowerCase())) return true;          // (1) sai chính tả
    sawAccentedOk = true;
    if (FORBIDDEN_SPELLINGS.has(word.toLowerCase())) sawForbiddenSpelling = true;
  }

  if (!sawColliding) return true;
  // (2) toàn bộ không dấu VÀ có từ khoá chỉ một nghĩa ("tri", "xoa")
  if (sawUnaccented && !sawAccentedOk && (sawUnambiguousUnaccented || sawDisambiguating)) return true;
  if (sawUnaccented && sawForbiddenSpelling) return true;          // (3) từ bị cấm + không dấu
  return false;
}

export interface ClaimHit { match: string; why: string; instead: string; index: number }

export function findForbiddenClaims(text: string): ClaimHit[] {
  const base = forScan(text);
  const folded = stripDiacritics(base);
  const spread = despaceSpread(base);

  /* Ba cách đọc cùng một chuỗi:
     - nguyên văn;
     - bỏ dấu, chỉ nhận lần khớp có từ vốn không dấu (xem foldedHitIsReal);
     - dồn chữ giãn cách ("Đ I Ề U  T R Ị"), khớp bằng mẫu nới `\s*`. */
  const readings: { text: string; folded: boolean; loose: boolean; origin: string }[] = [
    { text: base, folded: false, loose: false, origin: base },
    { text: folded, folded: true, loose: false, origin: base },
  ];
  /* Ký tự zero-width bị xoá trong chuẩn hoá, nên "Điều<ZWSP>trị nám" thành
     "Điềutrị nám" và mẫu có dấu cách không khớp — kiểm định lần 12. Thêm một
     cách đọc coi zero-width là khoảng trắng. */
  if (/[\u200b-\u200d\u2060\ufeff]/.test(text)) {
    const spaced = forScan(text.replace(/[\u200b-\u200d\u2060\ufeff]/g, ' '));
    readings.push({ text: spaced, folded: false, loose: false, origin: spaced });
    readings.push({ text: stripDiacritics(spaced), folded: true, loose: false, origin: spaced });
  }
  if (spread) {
    readings.push({ text: spread, folded: false, loose: true, origin: spread });
    readings.push({ text: stripDiacritics(spread), folded: true, loose: true, origin: spread });
  }

  const out: ClaimHit[] = [];
  for (const rule of FORBIDDEN) {
    const flags = rule.pattern.flags.includes('g') ? rule.pattern.flags : rule.pattern.flags + 'g';
    const seen = new Set<string>();
    for (const r of readings) {
      let source = r.folded ? stripDiacritics(rule.pattern.source) : rule.pattern.source;
      if (r.loose) source = loosenSpaces(source);
      /* Duyệt MỌI lần khớp và trả MỌI lần khớp.
         Kiểm định lần 7: dừng ở lần khớp đầu thì một phủ định che được mọi lần
         sau. Kiểm định lần 11: trả đúng một hit mỗi luật thì cổng ngoại lệ
         `reviewedClaims` che được mọi lần sau — chỉ cần đặt câu ngoại lệ lên
         trước câu vi phạm. */
      for (const m of r.text.matchAll(new RegExp(source, flags))) {
        const at = m.index ?? 0;
        const before = r.text.slice(0, at);
        if (r.folded ? NEGATED_BARE.test(before) : NEGATED.test(before)) continue;
        if (r.folded && !foldedHitIsReal(r.origin, at, at + m[0].length)) continue;
        // Vị trí chỉ dùng được khi cách đọc giữ nguyên toạ độ gốc.
        const index = r.loose ? -1 : at;
        const key = `${m[0]}@${index}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ match: m[0], why: rule.why, instead: rule.instead, index });
      }
    }
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
/**
 * Chữ HOA tiếng Việt, liệt kê tường minh.
 *
 * Dải `À-Ỹ` (U+00C0–U+1EF9) chứa cả chữ thường có dấu như `ở`, `ạ`, nên
 * `[A-ZĐÀ-Ỹ]` khớp luôn chữ thường — kiểm định lần 14: "Chú Thích ở cuối trang"
 * bị coi là họ tên vì `ở` lọt vào lớp "chữ hoa".
 */
const UPPER = 'A-ZĐÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬÈÉẺẼẸÊỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰỲÝỶỸỴ';

/** Từ thường đi sau xưng hô nhưng không phải tên riêng của một người cụ thể. */
const NOT_A_NAME = '(?:Chị|Anh|Cô|Bác|Chú|Em|Gái|Nàng|Bạn|Sĩ|Ạ|Ơi|Đào|Nông|Thích|Hai|Ba|Tư|Nương|Hùng|Văn|Ngữ|Quốc|Tấm|Hằng|Bé|Dâu|Trai|Yêu|Đại|Ái|Giáo|Hồ)'

export interface PersonalDataHit { match: string; kind: string }

const PERSONAL: { pattern: RegExp; kind: string }[] = [
  // Khớp trên chuỗi ĐÃ gộp chữ số: người ta viết "0912 345 678", "0912.345.678".
  { pattern: /(?:^|[\s(])(?:0|\+84)\d{9}(?![\d])/u, kind: 'số điện thoại' },
  { pattern: /[\w.+-]+@[\w-]+\.[\w.]{2,}/u, kind: 'địa chỉ email' },
  { pattern: /\b\d{2}\s*tuổi(?![\p{L}])|\b\d{2}\s*tuoi\b|\baged?\s+\d{2}\b/iu, kind: 'tuổi' },
  {
    /* Thiếu cờ `i` nên chỉ bắt "chị" viết thường — mà tên người gần như luôn
       đứng đầu câu và viết hoa. Kiểm định lần 9 đăng được "Chị Nguyễn Thu Hà,
       Quận 3, gọi 0912 345 678" qua cards.items[].body với build xanh. */
    /* KHÔNG bật cờ `i`: nó làm [A-ZĐÀ-Ỹ] khớp cả chữ thường, và "hỏi ý kiến
       bác sĩ trước khi dùng" — câu cảnh báo bắt buộc — bị coi là họ tên. Viết
       hoa/thường liệt kê tường minh ở đúng chỗ cần. */
    /* Loại các cách gọi số nhiều/chung: "Anh Chị Em thân mến", "Cô Gái Mùa Thu"
       (tên chiến dịch) — kiểm định lần 11. */
    /* Xưng hô + MỘT tên riêng đã đủ nhận dạng ("Chị Hà", "Cô Lan").
       Kiểm định lần 13: bản trước đòi hai từ viết hoa nên "Chị Hà bảo da tôi
       sạm hẳn sau sinh" qua cả hai cổng. Danh sách loại trừ giữ cho các cách
       gọi chung không bị coi là danh tính. */
    pattern: new RegExp(`(?:^|[\\s("“])(?:[Cc]hị|[Aa]nh|[Cc]ô|[Bb]ác|[Cc]hú|[Ee]m|Mrs?\\.?|Ms\\.?)\\s+(?!${NOT_A_NAME}(?![\\p{Ll}]))[${UPPER}][\\p{Ll}\\p{M}]{1,}(?![\\p{L}])`, 'u'),
    kind: 'họ tên đầy đủ kèm xưng hô',
  },
];

/**
 * @param allowedNumbers Số điện thoại CỦA DOANH NGHIỆP, dạng chữ số liền nhau.
 *   Hotline in trên trang không phải dữ liệu cá nhân của khách. Bản trước cho
 *   hotline qua chỉ vì nó viết cách nhau — tức là qua nhờ một lỗ hổng, nên khi
 *   vá lỗ hổng thì hotline bị chặn nhầm.
 */
/**
 * @param opts.testimonyContext Ngữ cảnh là LỜI CHỨNG (khối `problem.quotes`).
 *   Ở đó "Chị Hà bảo da tôi sạm hẳn" là danh tính khách hàng và phải chặn. Trong
 *   văn xuôi thường thì cùng hình dạng đó lại là chuyện bình thường — "Anh Quốc
 *   và châu Âu đều siết claim", "Cô Tấm là nhân vật cổ tích", "Bác Hồ dạy chúng
 *   ta tiết kiệm", "Chị Hằng trên trời cao". Kiểm định lần 14 đo được 22/26 câu
 *   tiếng Việt bình thường bị chặn nhầm khi áp luật một-tên cho mọi nơi.
 */
export function findPersonalData(
  text: string,
  allowedNumbers: string[] = [],
  opts: { testimonyContext?: boolean } = {}
): PersonalDataHit[] {
  const plain = forScan(text);
  /* Số điện thoại viết cách hoặc chấm là cách viết phổ biến nhất, không phải
     cách né. Gộp dấu phân cách giữa các chữ số trước khi khớp — cùng phép chuẩn
     hoá mà biểu mẫu đặt hàng đã dùng. */
  const digitsJoined = plain.replace(/(\d)[\s.\-]+(?=\d)/g, '$1');
  const allow = new Set(allowedNumbers.map((n) => n.replace(/\D/g, '').replace(/^84/, '0')));
  const out: PersonalDataHit[] = [];
  for (const rule of PERSONAL) {
    if (rule.kind === 'họ tên đầy đủ kèm xưng hô' && !opts.testimonyContext) {
      /* Ngoài ngữ cảnh lời chứng: đòi HAI từ viết hoa (họ + tên) hoặc một tín
         hiệu thứ hai (tuổi, số điện thoại) — những thứ đã có luật riêng. */
      const twoWords = new RegExp(`(?:^|[\\s("“])(?:[Cc]hị|[Aa]nh|[Cc]ô|[Bb]ác|[Cc]hú|[Ee]m|Mrs?\\.?|Ms\\.?)\\s+(?!${NOT_A_NAME}(?![\\p{Ll}]))[${UPPER}][\\p{Ll}\\p{M}]+\\s+[${UPPER}]`, 'u');
      const m = plain.match(twoWords);
      if (m) out.push({ match: m[0].trim(), kind: rule.kind });
      continue;
    }
    const flags = rule.pattern.flags.includes('g') ? rule.pattern.flags : rule.pattern.flags + 'g';
    const re = new RegExp(rule.pattern.source, flags);
    /* Duyệt MỌI lần khớp trên cả hai bản. Kiểm định lần 10: bản trước lấy đúng
       một match; nếu match đầu là hotline doanh nghiệp thì `continue` bỏ luôn
       cả luật, nên "Hotline 0367 848 918. Chị Hà đặt qua số 0912 345 678" giấu
       được số của khách — đúng lối viết tự nhiên nhất. */
    for (const haystack of [plain, digitsJoined]) {
      for (const m of haystack.matchAll(re)) {
        const value = m[0].trim();
        if (rule.kind === 'số điện thoại') {
          const digits = value.replace(/\D/g, '').replace(/^84/, '0');
          if (allow.has(digits)) continue;
        }
        if (!out.some((h) => h.kind === rule.kind && h.match === value)) {
          out.push({ match: value, kind: rule.kind });
        }
      }
    }
  }
  return out;
}
