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
    pattern: /(?<![\p{L}])(trị|điều trị|chữa|đặc trị)\s+(nám|thâm|mụn|sạm)/iu,
    why: 'biến mỹ phẩm thành thuốc chữa bệnh',
    instead: 'chăm sóc da nám, hỗ trợ làm mờ',
  },
  {
    pattern: /(hết|xoá|xóa|đánh bay|triệt tiêu|loại bỏ|chấm dứt|biến mất|tạm biệt)\s*(hoàn toàn\s*)?(nám|thâm|sạm|đốm nâu)|(sạch|khỏi|dứt điểm)\s+(nám|thâm)|không\s+tái\s+phát|vĩnh viễn/iu,
    why: 'tuyên bố kết quả tuyệt đối, không chứng minh được',
    instead: 'hỗ trợ làm mờ, hạn chế sạm màu quay lại',
  },
  {
    pattern: /(?<![\p{L}])(?:chứng minh|kiểm nghiệm)\s+lâm sàng(?![\p{L}])|\bclinically proven\b/iu,
    why: 'chỉ được nói khi có hồ sơ thử nghiệm lâm sàng thật, kèm số hiệu',
    instead: 'dẫn nghiên cứu cụ thể trong bảng thành phần',
  },
  {
    pattern: /(như|bằng|tương đương|thay thế cho|thay thế)\s*(liệu trình\s*)?(laser|peel|lăn kim|tiêm|thuốc)/iu,
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
const HAS_DIACRITICS = /[\u0300-\u036f]|[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i;

/**
 * Phủ định trong văn bản KHÔNG DẤU.
 *
 * Cố ý KHÔNG sinh bằng stripDiacritics(NEGATED): bỏ dấu thì `đừng` và `dùng`
 * đều thành `dung`, nên từ thông dụng nhất trên một trang mỹ phẩm trở thành từ
 * khoá miễn trừ — "Kem dùng thay thế thuốc bôi" qua sạch mọi luật. Tương tự
 * `chưa`/`chứa` → `chua`, `chẳng`/`chàng` → `chang`.
 * Danh sách này viết tay, chỉ gồm những từ mà bản không dấu KHÔNG trùng nghĩa
 * với từ nào khác.
 */
const NEGATED_BARE = /(?:khong|chua)\s+(?:phai\s+|co\s+)?(?:la\s+)?(?:thuoc\s+|tac dung\s+|chua\s+|dung de\s+|nham\s+|thay the\s+)?$|(?:khong|chua)\s+$|(?:not|never|no)\s+(?:a\s+|an\s+|the\s+)?(?:intended to\s+|meant to\s+|substitute for\s+)?$/i;

/** Tách câu thô, đủ để quyết định quét câu nào ở chế độ không dấu. */
function sentences(text: string): { text: string; offset: number }[] {
  const out: { text: string; offset: number }[] = [];
  const re = /[^.!?;\n]+[.!?;\n]*/g;
  for (const m of text.matchAll(re)) {
    if (m[0].trim()) out.push({ text: m[0], offset: m.index ?? 0 });
  }
  return out.length ? out : [{ text, offset: 0 }];
}

export interface ClaimHit { match: string; why: string; instead: string; index: number }

export function findForbiddenClaims(text: string): ClaimHit[] {
  const base = forScan(text);

  /*
   * Bản bỏ dấu CHỈ áp cho những câu vốn đã viết không dấu.
   *
   * Kiểm định lần 10: bỏ dấu cả văn bản có dấu khiến `nám|thâm|sạm` trùng với
   * `năm|nắm|Nam|sách`, và "Ưu đãi áp dụng đến hết năm 2026" — cách viết hạn
   * khuyến mãi phổ biến nhất — bị chặn với thông điệp 'het nam', một chuỗi
   * không hề tồn tại trong file của người biên tập.
   *
   * Một câu đã có dấu thì người viết đang gõ tiếng Việt có dấu; không có lý do
   * đọc nó theo nghĩa không dấu. Câu KHÔNG có dấu nào mới cần đọc cả hai cách.
   */
  const pieces: { text: string; loose: boolean; bare: boolean }[] = [{ text: base, loose: false, bare: false }];
  for (const s of sentences(base)) {
    if (!HAS_DIACRITICS.test(s.text)) pieces.push({ text: s.text, loose: false, bare: true });
  }
  const spread = despaceSpread(base);
  if (spread) {
    pieces.push({ text: spread, loose: true, bare: false });
    if (!HAS_DIACRITICS.test(spread)) pieces.push({ text: spread, loose: true, bare: true });
  }

  const out: ClaimHit[] = [];
  for (const rule of FORBIDDEN) {
    const flags = rule.pattern.flags.includes('g') ? rule.pattern.flags : rule.pattern.flags + 'g';
    let hit: { text: string; index: number } | null = null;
    for (const piece of pieces) {
      let source = piece.bare ? stripDiacritics(rule.pattern.source) : rule.pattern.source;
      if (piece.loose) source = loosenSpaces(source);
      const plain = piece.bare ? stripDiacritics(piece.text) : piece.text;
      /* Duyệt MỌI lần xuất hiện, không chỉ lần đầu: nếu lần khớp đầu bị phủ
         định mà bỏ cả luật thì mọi lần sau không bao giờ được xét (vòng 7). */
      for (const m of plain.matchAll(new RegExp(source, flags))) {
        const before = plain.slice(0, m.index ?? 0);
        const negated = piece.bare ? NEGATED_BARE.test(before) : NEGATED.test(before);
        if (negated) continue;
        /* Vị trí quy về chuỗi gốc: bản bỏ dấu và bản dồn khoảng trắng có độ dài
           khác, nên tìm lại đoạn tương ứng bằng độ lệch tương đối. */
        hit = { text: m[0], index: piece.bare || piece.loose ? -1 : (m.index ?? 0) };
        break;
      }
      if (hit) break;
    }
    if (hit) out.push({ match: hit.text, why: rule.why, instead: rule.instead, index: hit.index });
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
    pattern: /(?:^|[\s("“])(?:[Cc]hị|[Aa]nh|[Cc]ô|[Bb]ác|[Cc]hú|[Ee]m|Mrs?\.?|Ms\.?)\s+[A-ZĐÀ-Ỹ][\p{Ll}\p{M}]+\s+[A-ZĐÀ-Ỹ]/u,
    kind: 'họ tên đầy đủ kèm xưng hô',
  },
];

/**
 * @param allowedNumbers Số điện thoại CỦA DOANH NGHIỆP, dạng chữ số liền nhau.
 *   Hotline in trên trang không phải dữ liệu cá nhân của khách. Bản trước cho
 *   hotline qua chỉ vì nó viết cách nhau — tức là qua nhờ một lỗ hổng, nên khi
 *   vá lỗ hổng thì hotline bị chặn nhầm.
 */
export function findPersonalData(text: string, allowedNumbers: string[] = []): PersonalDataHit[] {
  const plain = forScan(text);
  /* Số điện thoại viết cách hoặc chấm là cách viết phổ biến nhất, không phải
     cách né. Gộp dấu phân cách giữa các chữ số trước khi khớp — cùng phép chuẩn
     hoá mà biểu mẫu đặt hàng đã dùng. */
  const digitsJoined = plain.replace(/(\d)[\s.\-]+(?=\d)/g, '$1');
  const allow = new Set(allowedNumbers.map((n) => n.replace(/\D/g, '').replace(/^84/, '0')));
  const out: PersonalDataHit[] = [];
  for (const rule of PERSONAL) {
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
