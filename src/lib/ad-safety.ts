/**
 * Hàng rào THỨ HAI: an toàn cho trang đích quảng cáo.
 *
 * Vì sao không siết thẳng `claims-lexicon.ts`
 * -------------------------------------------
 * Một câu hợp lệ trên website giáo dục vẫn có thể không dùng được trong một
 * mẩu quảng cáo. Bài "Nám nội tiết là gì" PHẢI nói về nám — đó là nội dung
 * biên tập, và chặn nó là chặn nhầm hướng. Nhưng cùng cụm ấy đặt vào lời hứa
 * quảng cáo thì thành chuyện khác.
 *
 * Nên dự án có hai tầng, không phải một tầng chặt hơn:
 *
 *     claims-lexicon.ts   — áp cho MỌI nội dung. Cấm tuyệt đối, chặn build.
 *     ad-safety.ts        — áp cho BỀ MẶT QUẢNG CÁO. Xếp loại, không chặn build.
 *
 * Tầng thứ hai không chặn build vì phần lớn phát hiện của nó cần người quyết
 * định, không phải máy: "trang này có nên chạy quảng cáo không" là câu hỏi
 * thương mại và pháp lý. Nó báo cáo, và con người ký.
 *
 * KHÔNG BAO GIỜ khai "đã được duyệt"
 * ----------------------------------
 * Không đoạn mã nào ở đây biết chính sách quảng cáo hiện hành nói gì vào ngày
 * bạn bấm chạy. Kết luận cao nhất nó được phép đưa ra là "sẵn sàng để người
 * phụ trách soát" — không phải "đủ điều kiện", càng không phải "đã duyệt".
 */

import { scanText, stripDiacritics } from './claims-lexicon.ts';

/** Phiên bản bộ luật. Đổi bộ luật thì đổi số này, để báo cáo cũ không bị đọc nhầm là mới. */
export const AD_POLICY_VERSION = '2026-09';

export type AdSeverity = 'blocked' | 'review';

export interface AdRule {
  id: string;
  pattern: RegExp;
  severity: AdSeverity;
  /** Vì sao nó rủi ro trên bề mặt quảng cáo. */
  why: string;
  /** Hướng viết lại, không phải một câu thay thế sẵn. */
  instead: string;
}

/**
 * Quét trên bản KHÔNG DẤU và chữ thường.
 *
 * Copy quảng cáo tiếng Việt viết không dấu là chuyện bình thường chứ không
 * phải trò lách, nên bộ mẫu dưới đây viết ở dạng không dấu và mọi chuỗi đầu
 * vào được chuẩn hoá về cùng dạng trước khi so.
 */
function norm(text: string): string {
  return stripDiacritics(scanText(text)).toLowerCase();
}

export const AD_RULES: AdRule[] = [
  /* ---------- Mạo nhận liên kết với OpenAI / ChatGPT (§53) ---------- */
  {
    id: 'openai-affiliation',
    pattern: /\b(chatgpt|openai)\b[^.]{0,40}\b(de xuat|goi y|khuyen dung|recommend|recommends|recommended|partner|doi tac|chung nhan|verified)\b|\b(duoc|được)\s+(chatgpt|openai)\b/i,
    severity: 'blocked',
    why: 'ngụ ý ChatGPT/OpenAI giới thiệu hoặc có quan hệ đối tác với thương hiệu',
    instead: 'bỏ hẳn tên nền tảng khỏi lời quảng cáo; nói điểm khác biệt của chính sản phẩm',
  },
  {
    id: 'ai-endorsement',
    pattern: /\b(ai|tri tue nhan tao)\s+(khuyen dung|de xuat|binh chon|chung nhan)\b/i,
    severity: 'blocked',
    why: 'mượn uy tín của một hệ thống AI như một bên chứng thực',
    instead: 'dẫn bằng chứng thật: số công bố, phiếu kiểm nghiệm, bảng thành phần',
  },

  /* ---------- Biến mỹ phẩm thành thuốc, trên bề mặt quảng cáo ---------- */
  {
    id: 'condition-as-promise',
    pattern: /\b(tri|dac tri|chua|dieu tri|xoa|xoa bo|loai bo|day lui|tan goc|het han)\s*(nam|mun|tham|sam|seo)\b/i,
    severity: 'blocked',
    why: 'đặt sản phẩm vào vai thuốc chữa một tình trạng da',
    instead: 'nói việc sản phẩm làm: hỗ trợ làm đều màu da, giảm nhìn thấy vết thâm',
  },
  {
    id: 'medical-authority',
    /* Khoảng hở giữa hai vế là BẮT BUỘC: dạng viết thật luôn có chữ xen vào
       ("bác sĩ DA LIỄU khuyên dùng"). Bản đầu nối hai vế bằng khoảng trắng nên
       luật chết hẳn — không khớp gì, và một luật chết trông y hệt một luật không
       có vi phạm. `tests/ad-safety.mjs` bắt được vì mỗi luật phải khớp được mồi. */
    pattern: /\b(bac si|duoc si|chuyen gia|phong kham|nha thuoc|benh vien)\b[^.!?]{0,24}\b(khuyen dung|khuyen cao|chi dinh|tin dung|dam bao)\b/i,
    severity: 'blocked',
    why: 'dùng danh nghĩa nhân viên y tế để quảng cáo mỹ phẩm (Nghị định 342/2025)',
    instead: 'nêu nguồn kiểm chứng được thay cho danh nghĩa nghề nghiệp',
  },

  /* ---------- Hứa kết quả ---------- */
  {
    id: 'absolute-outcome',
    pattern: /\b(cam ket|dam bao|chac chan|100%|tuyet doi)\s*(hieu qua|ket qua|khoi|sach|het)\b|\bhoan tien neu khong\b/i,
    severity: 'blocked',
    why: 'cam kết kết quả — không chứng minh được và là nhóm bị soi kỹ nhất',
    instead: 'nêu chính sách đổi trả cụ thể kèm điều kiện, tách khỏi lời hứa kết quả',
  },
  {
    id: 'timed-outcome',
    pattern: /\b(sau|trong|chi)\s*\d+\s*(ngay|tuan|thang)\b[^.]{0,30}\b(het|sach|khoi|mo han|bay mat|trang)\b/i,
    severity: 'review',
    why: 'gắn một kết quả dứt điểm vào một mốc thời gian cố định',
    instead: 'mô tả khoảng thời gian quan sát kèm điều kiện, không kèm kết quả tuyệt đối',
  },

  /* ---------- So sánh tuyệt đối ---------- */
  {
    id: 'superlative',
    pattern: /\b(tot nhat|so 1|so mot|hang dau|dan dau|duy nhat tren thi truong|khong doi thu)\b/i,
    severity: 'review',
    why: 'so sánh tuyệt đối cần dẫn chứng độc lập mới dùng được',
    instead: 'nêu một điểm khác biệt kiểm chứng được, ví dụ công khai tỉ lệ hoạt chất',
  },

  /* ---------- Gây áp lực mua ---------- */
  {
    id: 'pressure',
    pattern: /\b(nhanh tay|chi con \d+ suat|sap het hang|duy nhat hom nay|so luong co han)\b/i,
    severity: 'review',
    why: 'tạo khan hiếm giả; nếu không phản ánh tồn kho thật thì là thông tin sai',
    instead: 'nêu hạn khuyến mãi là một NGÀY thật, lấy từ trường validUntil',
  },

  /* ---------- Nhắm vào thuộc tính nhạy cảm của người đọc ---------- */
  {
    id: 'sensitive-targeting',
    pattern: /\b(ban dang bi|neu ban bi|danh cho nguoi bi)\s*(nam|mun|benh|roi loan)\b/i,
    severity: 'review',
    why: 'nói như thể đã biết tình trạng sức khoẻ của người đọc — nhóm thuộc tính nhạy cảm',
    instead: 'mô tả sản phẩm và hoàn cảnh sử dụng, để người đọc tự nhận ra mình',
  },

  /* ---------- Bằng chứng hình ảnh ---------- */
  {
    id: 'before-after',
    pattern: /\b(truoc va sau|before\s*[-\/&]?\s*after|anh thuc te khach hang)\b/i,
    severity: 'review',
    why: 'ảnh hai thời điểm là nhóm bị soi kỹ; cần đồng ý bằng văn bản và điều kiện chụp',
    instead: 'chỉ dùng khi có consent.obtained = true và có nêu điều kiện chụp',
  },
];

export interface AdHit {
  ruleId: string;
  severity: AdSeverity;
  match: string;
  why: string;
  instead: string;
  /** Đường dẫn tới trường chứa vi phạm, ví dụ blocks[0].heading. */
  path: string;
}

/** Quét một chuỗi bằng bộ luật quảng cáo. */
export function findAdRisks(text: string, path = ''): AdHit[] {
  const hay = norm(text);
  const hits: AdHit[] = [];
  for (const rule of AD_RULES) {
    const re = new RegExp(rule.pattern.source, rule.pattern.flags.replace('g', ''));
    const m = re.exec(hay);
    if (m) {
      hits.push({
        ruleId: rule.id, severity: rule.severity, match: m[0].trim(),
        why: rule.why, instead: rule.instead, path,
      });
    }
  }
  return hits;
}

/**
 * Bề mặt QUẢNG CÁO của một sản phẩm.
 *
 * Không phải mọi chữ trên trang đều là bề mặt quảng cáo. Phần giải thích dài
 * và phần cảnh báo bắt buộc là nội dung biên tập — quét chúng bằng luật quảng
 * cáo sẽ báo động giả hàng loạt rồi không ai đọc báo cáo nữa.
 *
 * Bề mặt quảng cáo = những gì quyết định người ta có bấm hay không, và những
 * gì máy tìm kiếm/trợ lý trích ra làm mô tả:
 *   - tiêu đề và mô tả SEO (hiện trong kết quả và thẻ chia sẻ)
 *   - hero: eyebrow, heading, lead, usp, nhãn CTA, trustBadges
 *   - lời hứa quảng cáo đã khai trong adContext.approvedAngles
 *   - nhãn gói bán và nhãn nút trong khối đặt hàng
 */
export function adSurfaces(product: any): { path: string; text: string }[] {
  const out: { path: string; text: string }[] = [];
  const push = (path: string, v: unknown) => {
    if (typeof v === 'string' && v.trim()) out.push({ path, text: v });
  };

  push('seo.title', product.seo?.title);
  push('seo.description', product.seo?.description);
  push('name', product.name);
  push('shortName', product.shortName);

  product.blocks?.forEach((b: any, i: number) => {
    if (b.type === 'hero') {
      push(`blocks[${i}].eyebrow`, b.eyebrow);
      push(`blocks[${i}].heading`, b.heading);
      push(`blocks[${i}].lead`, b.lead);
      push(`blocks[${i}].primaryCta`, b.primaryCta);
      push(`blocks[${i}].secondaryCta.label`, b.secondaryCta?.label);
      b.usp?.forEach((u: any, j: number) => push(`blocks[${i}].usp[${j}].text`, u.text));
      b.trustBadges?.forEach((t: string, j: number) => push(`blocks[${i}].trustBadges[${j}]`, t));
    }
    if (b.type === 'offer') {
      push(`blocks[${i}].heading`, b.heading);
      push(`blocks[${i}].body`, b.body);
    }
    if (b.type === 'order') {
      push(`blocks[${i}].heading`, b.heading);
      push(`blocks[${i}].body`, b.body);
    }
  });

  product.variants?.forEach((v: any, i: number) => {
    push(`variants[${i}].label`, v.label);
    push(`variants[${i}].note`, v.note);
  });

  product.adContext?.approvedAngles?.forEach((a: string, i: number) =>
    push(`adContext.approvedAngles[${i}]`, a));

  return out;
}

export type AdStatus = 'ready-for-review' | 'needs-revision' | 'not-suitable';

export interface AdPolicyProfile {
  policyVersion: string;
  status: AdStatus;
  /** Lý do, đã gộp theo mức nghiêm trọng. */
  hits: AdHit[];
  /** Lời hứa quảng cáo mà nội dung trang KHÔNG chống lưng được. */
  unsupportedAngles: string[];
  /** Thiếu dữ liệu để đánh giá. */
  missing: string[];
}

/* Từ để bỏ khi so khớp lời hứa với nội dung trang. Danh sách ngắn, chỉ gồm hư
   từ — cắt nhiều quá thì mọi câu đều "khớp" và phép đo mất nghĩa. */
const STOP = new Set([
  'va', 'voi', 'cho', 'cua', 'la', 'co', 'khong', 'mot', 'nhung', 'trong',
  'tren', 'duoc', 'tu', 'den', 'khi', 'thi', 'ma', 'de', 'nay', 'do', 'cac',
  'nhu', 'hon', 'ca', 'ban', 'ra', 'vao', 'cung', 'se', 'da', 'moi', 'tat',
  'the', 'nen', 'hay', 'bang', 'theo', 'sau', 'truoc', 'tai', 've', 'boi',
  'and', 'the', 'for', 'with', 'that', 'this', 'from', 'are', 'you', 'your',
  'its', 'has', 'have', 'not', 'but', 'who', 'what', 'when', 'them', 'they',
]);

function contentWords(text: string): Set<string> {
  return new Set(
    norm(text)
      .split(/[^a-z0-9%]+/)
      .filter((w) => w.length > 2 && !STOP.has(w)),
  );
}

/**
 * Tính toàn vẹn trang đích (§7).
 *
 * Mỗi lời hứa trong `approvedAngles` phải được CHÍNH nội dung trang chống lưng.
 * Phép đo là mức phủ từ nội dung: bao nhiêu phần trăm từ mang nghĩa của lời
 * hứa xuất hiện trong chữ thật của trang.
 *
 * Đây là một phép ĐO THÔ, và nó tự nhận như vậy: nó bắt được lời hứa nói về
 * thứ trang không hề nhắc tới — dạng lệch nguy hiểm nhất và cũng dễ xảy ra
 * nhất khi người viết quảng cáo không phải người viết trang. Nó KHÔNG thay
 * được người đọc, nên kết quả chỉ nâng mức lên "cần soát", không chặn.
 */
export function findUnsupportedAngles(product: any, threshold = 0.5): string[] {
  const angles: string[] = product.adContext?.approvedAngles ?? [];
  if (!angles.length) return [];

  const page = new Set<string>();
  const walk = (node: unknown): void => {
    if (typeof node === 'string') for (const w of contentWords(node)) page.add(w);
    else if (Array.isArray(node)) node.forEach(walk);
    else if (node && typeof node === 'object') {
      for (const [k, v] of Object.entries(node)) {
        if (k === 'adContext') continue;   // lời hứa không được tự chống lưng cho chính nó
        walk(v);
      }
    }
  };
  walk(product);

  const out: string[] = [];
  for (const angle of angles) {
    const words = [...contentWords(angle)];
    if (!words.length) continue;
    const covered = words.filter((w) => page.has(w)).length / words.length;
    if (covered < threshold) out.push(angle);
  }
  return out;
}

/** Hồ sơ an toàn quảng cáo của một sản phẩm. */
export function adPolicyProfile(product: any): AdPolicyProfile {
  const hits: AdHit[] = [];
  for (const { path, text } of adSurfaces(product)) {
    hits.push(...findAdRisks(text, path));
  }

  const missing: string[] = [];
  if (!product.adContext) missing.push('adContext chưa khai — chưa biết trang này đón ý định nào');
  if (!product.storyArchetype) missing.push('storyArchetype chưa khai');
  if (!product.compliance?.productNotificationNumber) {
    missing.push('compliance.productNotificationNumber trống — chưa có số công bố để đối chiếu');
  }

  const unsupportedAngles = findUnsupportedAngles(product);

  let status: AdStatus = 'ready-for-review';
  if (hits.some((h) => h.severity === 'blocked')) status = 'not-suitable';
  else if (hits.length || unsupportedAngles.length || missing.length) status = 'needs-revision';

  return { policyVersion: AD_POLICY_VERSION, status, hits, unsupportedAngles, missing };
}

/** Nhãn đọc được cho người, cố tình KHÔNG có mức nào nghĩa là "đã duyệt". */
export const AD_STATUS_LABEL: Record<AdStatus, string> = {
  'ready-for-review': 'sẵn sàng để người phụ trách soát',
  'needs-revision': 'cần sửa hoặc bổ sung trước khi soát',
  'not-suitable': 'chưa dùng được làm trang đích quảng cáo',
};
