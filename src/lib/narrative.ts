/**
 * Vai trò kể chuyện của từng khối — tách "khối LÀ GÌ" khỏi "khối ở ĐÂY để làm gì".
 *
 * Trước file này, nhịp thị giác của trang tính theo LOẠI khối: một bảng `ACT`
 * nằm trong `ProductLanding.astro` nói `ingredients` luôn là nền paper,
 * `steps` luôn là mist. Hệ quả đo được: 10 trên 12 sản phẩm đã xuất bản có
 * ĐÚNG một chuỗi khối giống hệt nhau
 *
 *     hero > problem > cards > ingredients > routine > steps > compare >
 *     order > faq > relatedProducts
 *
 * nên chúng cũng có đúng một chuỗi màu nền, đúng một nhịp giãn cách, và đọc
 * như mười hai bản sao của cùng một khuôn. Câu chuyện của kem chống nắng và
 * câu chuyện của bộ kit retinol không giống nhau, nhưng trang thì giống nhau.
 *
 * Lý do gốc: component TỰ QUYẾT ĐỊNH nó là phần nào của câu chuyện. `Ingredients`
 * luôn đóng vai "dẫn chứng" vì nó là bảng thành phần — kể cả khi ở trang này nó
 * đang đóng vai "cơ chế hoạt động", còn dẫn chứng thật nằm ở khối `documents`.
 *
 * Nên vai trò trở thành DỮ LIỆU:
 *
 *     { "type": "ingredients", "narrativeRole": "proof" }
 *
 * Cùng một component, hai trang, hai vai trò, hai nhịp. Không khai thì rơi về
 * `DEFAULT_ROLE` — mọi nội dung đang có chạy y như cũ, không phải sửa file nào.
 *
 * Đây KHÔNG phải một CMS và không có tầng điều phối nào: chỉ là một bảng tra
 * và một hàm thuần. Mọi thứ vẫn tính xong lúc build.
 */

/**
 * Câu hỏi mà khối trả lời cho người đọc, theo thứ tự họ thường hỏi.
 *
 * Danh sách cố tình ngắn. Mỗi vai phải ứng với một câu hỏi có thật của người
 * mua; thêm một vai mà không chỉ ra được câu hỏi của nó là bắt đầu dựng phân
 * loại cho vui.
 */
export const NARRATIVE_ROLES = [
  /** "Đây là cái gì, và có liên quan gì tới tôi?" — màn hình đầu tiên. */
  'orient',
  /** "Vì sao chuyện này đáng bận tâm?" */
  'problem',
  /** "Có hợp với tôi không, và ai KHÔNG nên dùng?" */
  'fit',
  /** "Nó hoạt động bằng cách nào?" */
  'mechanism',
  /** "Dựa vào đâu mà tin?" — chứng từ, thành phần, nguồn dẫn. */
  'proof',
  /** "Có gì cần cẩn thận, và giới hạn tới đâu?" */
  'safety',
  /** "Dùng thế nào cho đúng?" */
  'usage',
  /** "Bao lâu thì thấy, và thấy tới mức nào?" */
  'expectation',
  /** "So với lựa chọn kia thì khác gì?" */
  'comparison',
  /** "Bỏ ra ngần này thì nhận được gì?" */
  'value',
  /** "Ai đang bán, và nếu có chuyện thì tìm ai?" */
  'trust',
  /** "Mua thì chuyện gì xảy ra?" — biểu mẫu đặt hàng. */
  'decision',
  /** "Còn băn khoăn nào chưa được trả lời?" */
  'faq',
  /** "Bước hợp lý tiếp theo là gì?" */
  'next-step',
] as const;

export type NarrativeRole = (typeof NARRATIVE_ROLES)[number];

/**
 * Vai mặc định của từng loại khối.
 *
 * Đây là cách file nội dung cũ tiếp tục chạy: không khai `narrativeRole` thì
 * dùng bảng này. Giá trị chọn theo vai mà khối ấy ĐANG đóng trên các trang
 * hiện có, nên hành vi không đổi cho tới khi có người khai khác đi.
 */
export const DEFAULT_ROLE: Record<string, NarrativeRole> = {
  hero: 'orient',
  offer: 'value',
  problem: 'problem',
  cards: 'fit',
  ingredients: 'proof',
  documents: 'proof',
  timeline: 'expectation',
  routine: 'usage',
  steps: 'usage',
  compare: 'comparison',
  gallery: 'proof',
  testimonials: 'proof',
  feature: 'orient',
  order: 'decision',
  faq: 'faq',
  relatedProducts: 'next-step',
};

/** Bề mặt nền. Trùng với `rhythmFields.surface` trong schema. */
export type Surface = 'bone' | 'paper' | 'mist' | 'navy';
/** Nhịp dọc. Trùng với `rhythmFields.space` trong schema. */
export type Space = 'sm' | 'md' | 'lg';

/**
 * Bốn MẠCH của câu chuyện. Mỗi mạch một bề mặt.
 *
 * Việc của bề mặt không phải trang trí: khi mắt thấy nền đổi là biết câu
 * chuyện sang phần khác, tức đọc được cấu trúc trước khi đọc chữ. Nên số mạch
 * phải ít — bốn nền xen kẽ thì mỗi lần đổi còn mang nghĩa, mười bốn nền thì
 * không lần nào mang nghĩa cả.
 *
 * `undefined` = khối tự lo phần nền của mình (hero, offer, order).
 */
const ROLE_SURFACE: Record<NarrativeRole, Surface | undefined> = {
  // kể chuyện — vì sao bạn đang đọc trang này
  orient: undefined,
  problem: 'bone',
  fit: 'bone',
  // dẫn chứng — vì sao tin được
  mechanism: 'paper',
  proof: 'paper',
  expectation: 'paper',
  comparison: 'paper',
  trust: 'paper',
  // hướng dẫn — làm thế nào
  usage: 'mist',
  safety: 'mist',
  // quyết định
  value: undefined,
  decision: undefined,
  // khép lại
  faq: 'paper',
  'next-step': 'bone',
};

/**
 * Mật độ mặc định của từng vai — §46 "nhịp là một token có ý định".
 *
 * Không phải mọi khối đều đáng được chừa cùng một khoảng trống. Một bảng
 * thành phần dày cần chỗ thở TRƯỚC nó; một câu kết luận ngắn thì không. Trước
 * đây mọi khối dùng chung một giá trị, nên trang đọc đều tăm tắp.
 */
const ROLE_SPACE: Record<NarrativeRole, Space> = {
  orient: 'md',
  problem: 'lg',      // chỗ người đọc phải dừng lại và nhận ra mình
  fit: 'md',
  mechanism: 'md',
  proof: 'lg',        // phần nặng nhất của trang, cần thở
  safety: 'md',
  usage: 'md',
  expectation: 'md',
  comparison: 'lg',   // bảng cần khoảng trống để không dính vào chữ quanh nó
  value: 'md',
  trust: 'md',
  decision: 'lg',     // vùng quyết định đứng tách hẳn ra
  faq: 'md',
  'next-step': 'lg',
};

/**
 * Props nhịp mà mọi khối kể chuyện nhận từ `ProductLanding`.
 *
 * Trước đây ba trường này được spread vào component bằng `{...r(i)}` mà KHÔNG
 * khối nào khai chúng, nên `astro check` báo 24 lỗi ts(2339) và không ai thấy
 * — hợp đồng giữa layout và khối chỉ tồn tại trong đầu người viết. Khai ra một
 * chỗ, mọi khối dùng chung.
 */
export interface RhythmProps {
  surface?: Surface;
  space?: Space;
  sameSurface?: boolean;
  /** Vai của khối — phát ra `data-narrative-role` để cổng QA đọc được. */
  role?: NarrativeRole;
  /** Câu nối sang khối kế tiếp. */
  transition?: string;
  /** Lời mời hành động ở cuối khối, tại một mốc quyết định có thật. */
  cta?: { note?: string; label: string; href: string };
}

export interface BlockRhythm {
  surface?: Surface;
  space?: Space;
  /** Khối ngay trên cùng bề mặt: bỏ đệm trên để hai khối thành MỘT cụm. */
  sameSurface?: boolean;
  role: NarrativeRole;
}

/** Hình dạng tối thiểu mà `resolveRhythm` cần đọc. */
export interface RhythmInput {
  type: string;
  narrativeRole?: NarrativeRole;
  surface?: Surface;
  space?: Space;
}

/**
 * Tính nhịp cho cả trang, theo VAI và theo VỊ TRÍ.
 *
 * Hai khối liền nhau cùng bề mặt thì bỏ đệm ở chỗ nối — chúng thành một cụm có
 * chủ ý thay vì hai khối dính nhau do trùng màu. Chỗ chuyển mạch thì giãn ra.
 *
 * `surface`/`space` khai trong JSON vẫn thắng: bảng ở đây là mặc định hợp lý,
 * không phải luật. Nhưng đừng khai chỉ để "cho khác" — nền đổi mà không ứng
 * với đoạn nào của câu chuyện thì tệ hơn là không đổi.
 */
export function resolveRhythm(blocks: readonly RhythmInput[]): Map<number, BlockRhythm> {
  const out = new Map<number, BlockRhythm>();
  let prevSurface: Surface | undefined;

  blocks.forEach((block, i) => {
    const role = roleOf(block);
    const surface = block.surface ?? ROLE_SURFACE[role];

    if (!surface) {
      // Khối tự lo nền của mình. Nó vẫn CẮT mạch: khối sau nó không thể "cùng
      // bề mặt với khối trước" khi giữa hai khối có một vùng nền khác hẳn.
      out.set(i, { role });
      prevSurface = undefined;
      return;
    }

    const same = surface === prevSurface;
    out.set(i, {
      role,
      surface,
      space: block.space ?? (same ? 'sm' : ROLE_SPACE[role]),
      sameSurface: same,
    });
    prevSurface = surface;
  });

  return out;
}

/** Vai của một khối: khai tường minh, hoặc mặc định theo loại. */
export function roleOf(block: RhythmInput): NarrativeRole {
  return block.narrativeRole ?? DEFAULT_ROLE[block.type] ?? 'proof';
}

/* ------------------------------------------------------------------
   Nguyên mẫu câu chuyện (§3).

   Đây là MÔ TẢ, không phải khuôn ép. Không có đoạn mã nào bắt một sản phẩm
   phải đi đúng thứ tự dưới đây — ép thì lại quay về đúng chỗ cũ, mười hai
   trang một khuôn, chỉ là khuôn mới.

   Việc của bảng này có hai: (1) nói cho người biên tập biết một câu chuyện
   kiểu này thường đi qua những nhịp nào, và (2) cho cổng QA (`tests/narrative.mjs`)
   một mốc để đối chiếu, rồi BÁO chứ không chặn.
-------------------------------------------------------------------*/

export const STORY_ARCHETYPES = [
  /** Một sản phẩm đơn, người mua đã biết mình cần gì. */
  'single-product',
  /** Sản phẩm phải dùng theo lộ trình mới có nghĩa. */
  'routine',
  /** Bộ nhiều món — câu hỏi chính là "vì sao những món này đi với nhau". */
  'bundle',
  /** Phải dạy trước mới bán được: người đọc đang hiểu sai điều gì đó. */
  'education-led',
  /** Người đọc đang đứng giữa hai lựa chọn. */
  'comparison',
] as const;

export type StoryArchetype = (typeof STORY_ARCHETYPES)[number];

/** Nhịp mà mỗi nguyên mẫu thường đi qua, theo thứ tự. */
export const ARCHETYPE_BEATS: Record<StoryArchetype, readonly NarrativeRole[]> = {
  'single-product': [
    'orient', 'problem', 'fit', 'proof', 'usage', 'trust', 'value',
    'decision', 'faq', 'next-step',
  ],
  routine: [
    'orient', 'problem', 'mechanism', 'fit', 'usage', 'expectation',
    'proof', 'safety', 'decision', 'faq', 'next-step',
  ],
  bundle: [
    'orient', 'value', 'fit', 'mechanism', 'usage', 'expectation',
    'proof', 'trust', 'decision', 'faq', 'next-step',
  ],
  'education-led': [
    'orient', 'problem', 'expectation', 'fit', 'mechanism', 'proof',
    'usage', 'safety', 'decision', 'faq', 'next-step',
  ],
  comparison: [
    'orient', 'problem', 'comparison', 'fit', 'proof', 'usage',
    'decision', 'faq', 'next-step',
  ],
};

/**
 * Vai BẮT BUỘC phải có trên một trang đã xuất bản và bán được hàng.
 *
 * Ba vai này không phải sở thích biên tập:
 *  - `orient`   thiếu thì người đến từ quảng cáo không biết đã vào đúng chỗ chưa;
 *  - `decision` thiếu thì mọi nút mua trên trang là link chết (schema đã chặn);
 *  - `proof`    thiếu thì trang đang xin tiền mà không đưa ra căn cứ nào.
 */
export const REQUIRED_ROLES: readonly NarrativeRole[] = ['orient', 'proof', 'decision'];
