import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { withBase } from './lib/base.ts';
import { MONEY_TOKENS } from './lib/money-text.ts';
import { findHandwrittenMoney } from './lib/money-scan.ts';
import { findForbiddenClaims, findPersonalData } from './lib/claims-lexicon.ts';
import { DEFAULT_ANCHOR } from './lib/block-anchors.ts';
import { NARRATIVE_ROLES, STORY_ARCHETYPES } from './lib/narrative.ts';
import { readFileSync } from 'node:fs';

/* Số liên hệ của chính doanh nghiệp không phải dữ liệu cá nhân của khách. */
/**
 * Thông tin liên hệ CỦA CHÍNH DOANH NGHIỆP — được phép xuất hiện trong nội dung.
 *
 * Hàng rào dữ liệu cá nhân tồn tại để một số điện thoại hay email của KHÁCH
 * không lọt vào file nội dung rồi được xuất bản. Nhưng hotline, email và mã số
 * thuế của bên bán thì đã in ở chân mọi trang và bắt buộc phải công khai theo
 * quy định về thương mại điện tử. Chặn chúng là chặn nhầm hướng: trang liên hệ
 * sẽ không viết nổi, và người viết sẽ tìm cách lách thay vì sửa.
 *
 * Danh sách đọc từ `mocha.json` chứ không gõ tay ở đây — đổi số hotline mà quên
 * đổi danh sách thì hàng rào lại chặn đúng số đang dùng.
 */
const BRAND_NUMBERS: string[] = (() => {
  try {
    const b = JSON.parse(readFileSync('src/data/mocha.json', 'utf8'));
    return [b.phone, b.phoneDisplay, b.email, b.taxId].filter(Boolean);
  } catch {
    return [];
  }
})();

/* ------------------------------------------------------------------
   Khối nội dung dùng chung cho mọi landing.
   Mỗi sản phẩm tự chọn khối nào, theo thứ tự nào, qua mảng `blocks`.
   Thêm sản phẩm mới = thêm 1 file JSON, không sửa code.
-------------------------------------------------------------------*/

const money = z.number().int().positive();

/**
 * Tuyên bố về sản phẩm. Mỗi tuyên bố phải khai mình dựa trên cái gì.
 *
 * Đây không phải siêu dữ liệu trang trí: schema từ chối build nếu một tuyên bố
 * khai có chứng từ mà không dẫn được nguồn, hoặc khai theo khảo sát mà không nêu
 * cỡ mẫu. Tuyên bố không có gì chống lưng thì không được lên màn hình đầu.
 */
/**
 * Chỉ cho phép link an toàn.
 *
 * Kiểm định lần 6 đặt "javascript:window.__pwned=1" vào `usp[].source`,
 * `ingredients.reference` và `brand.zalo` rồi bấm được trên trang thật. Zod
 * `.url()` dùng `new URL()` nên chấp nhận mọi scheme, kể cả javascript: và data:.
 */
const SAFE_SCHEME = /^https?:$/;
export function isSafeHref(v: string): boolean {
  if (v.startsWith('#') || v.startsWith('/')) return true;
  try {
    return SAFE_SCHEME.test(new URL(v).protocol);
  } catch {
    return false;
  }
}
/** Link bắt buộc phải là http(s), neo trong trang, hoặc đường dẫn nội bộ. */
const safeUrl = z.string().refine(isSafeHref, {
  message: 'Link phải là http(s), neo #trong-trang hoặc đường dẫn /noi-bo. ' +
    'Scheme khác (javascript:, data:, vbscript:) bị chặn vì chạy được mã trên trang.',
}).transform(withBase);
/* `.transform` sau `.refine`: người biên tập viết `/nam-tham/` trong JSON và
   không cần biết site có chạy ở đường dẫn con hay không. Đây là chỗ DUY NHẤT
   mọi link do người viết đi qua, nên thêm tiền tố ở đây thay vì nhớ gọi một
   hàm ở hàng chục component. Link tuyệt đối và neo #: withBase trả nguyên. */
/** Chuỗi có thể là link hoặc chỉ là chữ (số phiếu, tên đơn vị kiểm nghiệm). */
const textOrSafeUrl = z.string().refine((v) => !/^[a-z][a-z0-9+.-]*:/i.test(v) || isSafeHref(v), {
  message: 'Nguồn viết dạng scheme: thì chỉ được http(s). Muốn ghi chữ thường thì đừng dùng dấu hai chấm sau một từ.',
});

const returnPolicyEntry = z.object({
  /** Một hoặc nhiều mã quốc gia ISO-3166 alpha-2. */
  country: z.union([z.string().length(2), z.array(z.string().length(2)).min(1)]),
  days: z.number().int().positive(),
  /** 'defect' = chỉ đổi khi hàng lỗi/sai/chưa mở seal. 'any' = đổi ý cũng được. */
  scope: z.enum(['defect', 'any']).default('defect'),
  /** Ai trả phí gửi về. */
  fees: z.enum(['free', 'customer']).default('free'),
  refund: z.enum(['exchange', 'full', 'store-credit']).default('exchange'),
}).strict();

const claim = z.object({
  text: z.string(),
  /**
   * verified   — có chứng từ kiểm chứng được (phiếu kiểm nghiệm, số công bố)
   * study      — dựa trên nghiên cứu công bố, phải dẫn link
   * survey     — khảo sát nội bộ, phải nêu cỡ mẫu và cách thu thập
   * ingredient — suy ra từ bảng thành phần, không hứa kết quả
   */
  evidence: z.enum(['verified', 'study', 'survey', 'ingredient']),
  /** Nguồn kiểm chứng: số phiếu công bố, link nghiên cứu, tên đơn vị kiểm nghiệm. */
  source: textOrSafeUrl.optional(),
  /** Điều kiện đi kèm: cỡ mẫu, thời gian dùng, cách thu thập. */
  qualifier: z.string().optional(),
}).strict().superRefine((c, ctx) => {
  if ((c.evidence === 'verified' || c.evidence === 'study') && !c.source) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Tuyên bố "${c.text.slice(0, 48)}…" khai evidence="${c.evidence}" nhưng không có source. ` +
        `Dẫn được nguồn thì mới được khai, không thì hạ xuống "ingredient".`,
    });
  }
  if (c.evidence === 'survey' && !c.qualifier) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Tuyên bố "${c.text.slice(0, 48)}…" khai evidence="survey" nhưng không nêu cỡ mẫu. ` +
        `Một con số khảo sát không có mẫu số là một con số vô nghĩa.`,
    });
  }
});

const image = z.object({
  src: z.string(),
  alt: z.string(),
  /* Không bắt buộc: kích thước đọc thẳng từ file ảnh trong src/assets. Chỉ cần
     khai khi ảnh nằm trong public/ (không đi qua pipeline ảnh). */
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  caption: z.string().optional(),
  /**
   * Cắt ảnh ở đâu, khi khối dùng khung tỉ lệ và `fit="cover"`.
   *
   * Giá trị của `object-position`, ví dụ 'center 30%'. Chỉ khai khi chủ thể
   * lệch tâm — mặc định canh giữa đúng cho phần lớn ảnh. Đây là cách duy nhất
   * người biên tập nói được "đừng cắt mất cái nhãn" mà không phải sửa CSS.
   */
  focus: z.string().max(40).optional(),
}).strict();

/* Khai TRƯỚC `blocks`: khối `relatedProducts` tham chiếu slug, và một const
   khai sau chỗ dùng sẽ ném 'Cannot access before initialization' lúc sinh
   kiểu — không phải lúc kiểm kiểu. */
const slugField = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug chỉ gồm chữ thường, số và gạch nối');

/** Id neo dùng cho liên kết trong trang. Để trống thì component dùng id mặc định. */
const anchorId = z.string().regex(/^[a-z0-9-]+$/).optional();

/**
 * Nhịp thị giác, khai được cho từng khối.
 *
 * Mặc định do `ProductLanding` tính theo vai trò của khối và vị trí của nó, và
 * đúng cho phần lớn trang. Hai trường này để đè khi một trang cần khác — ví dụ
 * một khối cần đứng tách hẳn ra vì nó là chỗ người đọc phải dừng lại.
 *
 * KHÔNG khai chúng chỉ để "cho khác": nền đổi mà không có lý do thì người đọc
 * vẫn nhận ra ranh giới, chỉ là ranh giới đó không ứng với đoạn nào của câu
 * chuyện — tệ hơn là không có ranh giới nào.
 */
const rhythmFields = {
  surface: z.enum(['bone', 'paper', 'mist', 'navy']).optional(),
  space: z.enum(['sm', 'md', 'lg']).optional(),
  /**
   * Vai của khối trong câu chuyện — xem `src/lib/narrative.ts`.
   *
   * Tách "khối LÀ GÌ" khỏi "khối ở ĐÂY để làm gì". Cùng một bảng thành phần có
   * thể là `proof` ở trang này (bằng chứng chính) và `mechanism` ở trang kia
   * (giải thích cách hoạt động, còn bằng chứng nằm ở khối chứng từ). Nhịp thị
   * giác tính theo VAI, nên hai trang ấy đọc khác nhau mà không phải sửa CSS.
   *
   * Không khai thì rơi về `DEFAULT_ROLE` theo loại khối — mọi nội dung đang có
   * giữ nguyên hành vi.
   */
  narrativeRole: z.enum(NARRATIVE_ROLES).optional(),
  /**
   * Một câu nối sang khối kế tiếp.
   *
   * Việc của nó là trả lời "vì sao phần sau tồn tại" trước khi người đọc phải
   * tự đoán. Dùng TIẾT CHẾ: đặt câu nối ở mọi khối thì nó thành một loại nhiễu
   * mới, và người đọc học cách bỏ qua nó.
   */
  transition: z.string().max(180).optional(),
  /**
   * Lời mời hành động đặt ở CUỐI khối.
   *
   * Vì sao là dữ liệu chứ không phải luật: số lượng CTA phải phụ thuộc câu
   * chuyện, không phải một quy tắc kiểu "cứ 500px một nút". Đo được trên
   * /combo-nam/: giữa CTA ở hero (y=939) và khối ưu đãi (y=14.444) có 13.505px
   * — khoảng 16 màn hình điện thoại — không một lời mời nào, trong khi trang
   * đi qua ít nhất sáu điểm người mua thật sự ra quyết định.
   *
   * Thanh CTA dính đáy vẫn luôn ở đó, nên người đọc KHÔNG phải không mua được.
   * Thiếu là thiếu một câu nói đúng lúc: thanh dính đáy đưa cùng hai hành động
   * ở mọi giai đoạn, nên nó là thanh công cụ, không phải lời mời.
   *
   * Chỉ nhận neo trong trang: mọi đường mua đều về `#dat-hang`, không sinh
   * thêm đích đến mới. Neo này đi qua đúng cổng kiểm neo đã có — trỏ tới khối
   * không tồn tại thì build dừng.
   */
  cta: z.object({
    /** Câu dẫn ngắn đặt trên hành động. Nối tiếp nội dung vừa đọc. */
    note: z.string().min(8).max(110).optional(),
    label: z.string().min(2).max(44),
    href: z.string().regex(/^#[a-z0-9-]+$/, 'CTA trong khối chỉ nhận neo dạng #ten-khoi'),
  }).strict().optional(),
};

const blocks = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('hero'),
    eyebrow: z.string().optional(),
    heading: z.string(),
    lead: z.string(),
    usp: z.array(claim).max(4),
    image,
    primaryCta: z.string(),
    /** CTA phụ: nhãn + neo. Neo được kiểm chéo với id các khối có thật. */
    secondaryCta: z.object({
      label: z.string(),
      href: z.string().regex(/^#[a-z0-9-]+$/, 'neo dạng #ten-khoi'),
    }).strict().optional(),
    trustBadges: z.array(z.string()).max(5).default([]),
  }).strict(),
  z.object({
    type: z.literal('offer'),
    eyebrow: z.string().optional(),
    heading: z.string(),
    body: z.string(),
    /** Hạn khuyến mãi là ngày thật, không phải đồng hồ đếm ngược reset mỗi lần tải trang. */
    validUntil: z.string().date().optional(),
    notes: z.array(z.string()).default([]),
  }).strict(),
  z.object({
    type: z.literal('problem'),
    ...rhythmFields,
    id: anchorId,
    eyebrow: z.string().optional(),
    heading: z.string(),
    intro: z.string().optional(),
    /**
     * Câu trích mô tả nỗi lo chung của người mua, KHÔNG phải lời chứng của
     * người thật. Cổng consent chỉ áp cho `gallery` và `testimonials`, nên nếu
     * ở đây cho phép nêu tên/tuổi/nơi ở thì chỉ cần đổi `type` là lách được.
     * Schema chặn luôn từ đầu: câu trích ở khối này không được chứa danh tính.
     */
    quotes: z.array(z.string().superRefine((q, ctx) => {
      /* Dùng ĐÚNG hàng rào dữ liệu cá nhân, không viết lại một regex song song.
         Kiểm định lần 13: bản trước tự khai
         /\b(chị|anh|cô|bác|chú|em)\s+[A-ZĐÀ-Ỹ].../u — thiếu cờ hoa, nên "Chị Hà
         bảo da tôi sạm hẳn sau sinh" qua sạch. Đó chính là lỗi mà vòng 9 đã sửa
         trong `findPersonalData`, bị chép lại thành bản thứ hai rồi sửa một bản
         mà quên bản kia. Một hàng rào, một chỗ. */
      const hits = findPersonalData(q, BRAND_NUMBERS, { testimonyContext: true });
      if (hits.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            `Câu trích trong khối "problem" nêu danh tính người thật: ` +
            `"${hits[0].match}" (${hits[0].kind}). ` +
            `Lời chứng của khách phải nằm ở khối "testimonials", nơi có cổng consent. ` +
            `Khối này chỉ dành cho nỗi lo chung, viết ẩn danh.`,
        });
      }
    })),
    explainer: z.object({ heading: z.string(), body: z.array(z.string()) }).strict(),
  }).strict(),
  z.object({
    type: z.literal('cards'),
    ...rhythmFields,
    id: anchorId,
    eyebrow: z.string().optional(),
    heading: z.string(),
    intro: z.string().optional(),
    columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(3),
    items: z.array(z.object({
      heading: z.string(),
      body: z.string(),
      meta: z.string().optional(),
      icon: z.string().optional(),
      image: image.optional(),
    }).strict()),
  }).strict(),
  z.object({
    type: z.literal('ingredients'),
    ...rhythmFields,
    id: anchorId,
    eyebrow: z.string().optional(),
    heading: z.string(),
    intro: z.string().optional(),
    caption: z.string().optional(),
    rows: z.array(z.object({
      name: z.string(),
      /**
       * Hoạt chất này nằm trong sản phẩm nào của bộ.
       *
       * Với một combo, gộp thành phần của hai sản phẩm vào một bảng mà không
       * nói rõ cái nào ở đâu là làm người đọc tưởng cả hai đều có đủ. Đây
       * cũng là chỗ bản trước sai: nồng độ in trên bao bì serum bị gán cho kem.
       */
      inProduct: z.string().optional(),
      role: z.string(),
      suitedFor: z.string(),
      reference: safeUrl.optional(),
      /**
       * Nồng độ và bối cảnh mà nghiên cứu được dẫn thật sự đã thử nghiệm.
       * Bắt buộc phải ghi khi nó khác với nồng độ trong sản phẩm — dẫn một nghiên
       * cứu dùng 5% để chống lưng cho công thức 1% là dẫn nguồn gây hiểu nhầm.
       */
      referenceNote: z.string().optional(),
    }).strict()),
  }).strict(),
  z.object({
    type: z.literal('steps'),
    ...rhythmFields,
    id: anchorId,
    eyebrow: z.string().optional(),
    heading: z.string(),
    intro: z.string().optional(),
    totalTime: z.string().optional(),
    items: z.array(z.object({ heading: z.string(), body: z.string() }).strict()),
    footnote: z.string().optional(),
  }).strict(),
  z.object({
    type: z.literal('gallery'),
    id: anchorId,
    eyebrow: z.string().optional(),
    heading: z.string(),
    intro: z.string().optional(),
    disclaimer: z.string().optional(),
    /**
     * Bắt buộc với ảnh khách hàng: xác nhận đã có văn bản đồng ý.
     * Không có consent thì không được đăng ảnh người thật — đây là ràng buộc
     * pháp lý, nên nó nằm trong schema chứ không nằm trong hướng dẫn biên tập.
     */
    consent: z.object({
      obtained: z.boolean(),
      statement: z.string(),
      /** Điều kiện chụp: cùng đèn, cùng góc, có trang điểm hay không. */
      conditions: z.string().optional(),
    }).strict(),
    images: z.array(image),
  }).strict(),
  z.object({
    type: z.literal('testimonials'),
    id: anchorId,
    eyebrow: z.string().optional(),
    heading: z.string(),
    intro: z.string().optional(),
    /**
     * Lời chứng nêu tên, tuổi, nơi ở là dữ liệu cá nhân y như ảnh chân dung.
     * Cùng một chuẩn: không có văn bản đồng ý thì không đăng.
     */
    consent: z.object({
      obtained: z.boolean(),
      statement: z.string(),
    }).strict(),
    items: z.array(z.object({
      quote: z.string(),
      name: z.string(),
      meta: z.string().optional(),
      avatar: image.optional(),
      /** Bắt buộc với nội dung có tài trợ (FTC, và để minh bạch tại VN). */
      sponsored: z.boolean().default(false),
      video: z.object({ src: z.string(), poster: z.string() }).strict().optional(),
    }).strict()),
  }).strict(),
  z.object({
    type: z.literal('order'),
    eyebrow: z.string().optional(),
    heading: z.string(),
    body: z.string(),
    points: z.array(z.string()),
  }).strict(),
  /**
   * Bước tiếp theo ở cuối trang.
   *
   * Trước khối này, một landing kết thúc bằng FAQ rồi tới chân trang — người
   * đọc xong mà chưa mua thì không còn chỗ nào để đi. Với trang đích của quảng
   * cáo, đó là chỗ tiền quảng cáo rơi ra ngoài.
   *
   * Chỉ khai slug; tên, giá và ảnh lấy từ chính sản phẩm được trỏ tới, để
   * không có hai chỗ cùng giữ một dữ kiện rồi lệch nhau.
   */
  /**
   * Bảng so sánh ngay trên landing.
   *
   * Tầng dòng đã có bảng này, nhưng người đến thẳng landing từ quảng cáo không
   * đi qua trang dòng — họ thấy đúng một sản phẩm và không có gì để đối chiếu.
   * Với đơn hàng vài trăm nghìn tới gần hai triệu, "so với cái kia thì sao"
   * là câu hỏi xảy ra TRƯỚC khi bấm đặt hàng, không phải sau.
   *
   * Cột lấy từ `items`. Không khai lại tên hay giá ở đây: chép giá vào bảng là
   * tạo một bản sao sẽ lệch khỏi giá thật sau lần đổi giá đầu tiên.
   */
  z.object({
    type: z.literal('compare'),
    id: anchorId,
    ...rhythmFields,
    eyebrow: z.string().optional(),
    heading: z.string(),
    intro: z.string().optional(),
    items: z.array(slugField).min(2).max(3),
    criteria: z.array(z.object({
      label: z.string(),
      values: z.array(z.string().min(1)).min(2),
    }).strict()).min(2),
    footnote: z.string().optional(),
  }).strict().superRefine((b, ctx) => {
    /* Cùng hàng rào chống trượt cột như bảng ở tầng dòng: lệch một ô là bảng
       vẫn trông đúng trên màn hình nhưng gán đặc điểm của sản phẩm này sang
       sản phẩm khác — sai lặng lẽ, và đúng loại sai không ai soát ra. */
    for (const [i, c] of b.criteria.entries()) {
      if (c.values.length !== b.items.length) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['criteria', i],
          message: `Tiêu chí "${c.label}" có ${c.values.length} ô nhưng bảng có ${b.items.length} cột. ` +
            `Thiếu hoặc thừa một ô là bảng trượt cột, gán đặc điểm sang nhầm sản phẩm.` });
      }
    }
  }),

  z.object({
    type: z.literal('relatedProducts'),
    id: anchorId,
    ...rhythmFields,
    eyebrow: z.string().optional(),
    heading: z.string(),
    intro: z.string().optional(),
    /* Tối đa 3: đây là gợi ý bước tiếp theo, không phải một trang danh mục thứ
       hai. Đưa 8 lựa chọn cho người vừa đọc xong 2.000 chữ là bắt họ quyết định
       lại từ đầu. */
    items: z.array(slugField).min(1).max(3),
  }).strict(),

  z.object({
    type: z.literal('faq'),
    ...rhythmFields,
    id: anchorId,
    eyebrow: z.string().optional(),
    heading: z.string(),
    items: z.array(z.object({ q: z.string(), a: z.string() }).strict()),
  }).strict(),

  /**
   * Dải ảnh tràn lề, không có chữ đè lên.
   *
   * Việc của nó là cho mắt nghỉ giữa hai vùng chữ dày, và cho thấy sản phẩm là
   * gì mà không cần một lời quảng cáo nào. Không đặt chữ lên ảnh: chữ trên ảnh
   * không kiểm soát được độ tương phản khi ảnh đổi, và máy tìm kiếm không đọc
   * được nó.
   */
  z.object({
    type: z.literal('feature'),
    id: anchorId,
    image: z.object({
      src: z.string(),
      alt: z.string().min(1, 'Ảnh tràn lề vẫn cần alt: người dùng trình đọc màn hình cũng đang đọc trang này.'),
    }).strict(),
    caption: z.string().optional(),
  }).strict(),

  /**
   * Chứng từ: phiếu công bố, chứng nhận cơ sở sản xuất, phiếu kiểm nghiệm.
   *
   * Đây là bằng chứng mạnh nhất một trang mỹ phẩm có thể đưa ra, và là thứ
   * người mua Việt Nam thật sự tìm. Ảnh mở được ở kích thước đầy đủ để đọc
   * được số hiệu — một ảnh thu nhỏ không đọc được thì không chứng minh gì.
   */
  z.object({
    type: z.literal('documents'),
    ...rhythmFields,
    id: anchorId,
    eyebrow: z.string().optional(),
    heading: z.string(),
    intro: z.string().optional(),
    items: z.array(z.object({
      image: z.object({ src: z.string(), alt: z.string().min(1) }).strict(),
      label: z.string(),
      /** Số hiệu in trên chính chứng từ, để người đọc đối chiếu được. */
      reference: z.string().optional(),
      issuedBy: z.string().optional(),
    /* Bỏ trống `items` = lấy giấy tờ từ collection `documents` theo `appliesTo`
       (cách nên dùng: giấy tờ khai một lần, dùng lại ở mọi trang). Khai `items`
       chỉ khi cần một bộ giấy riêng cho đúng trang này. */
    }).strict()).min(1).optional(),
    footnote: z.string().optional(),
  }).strict(),
  /**
   * Mốc thời gian so sánh giữa các nhóm.
   *
   * Nội dung của site nói đi nói lại rằng lý do số một khiến người ta bỏ dở là
   * đặt kỳ vọng của nhóm này lên nhóm kia. Một bảng chữ nói điều đó; một dải
   * thời gian đặt cạnh nhau thì cho thấy ngay khoảng cách 4 tuần và 16 tuần
   * khác nhau thế nào.
   *
   * Số liệu vẫn nằm ở dạng CHỮ trong danh sách bên dưới hình. SVG chỉ là lớp
   * nhìn: trình đọc màn hình bỏ qua nó, còn máy tìm kiếm và trợ lý AI đọc được
   * đúng những con số ấy mà không phải hiểu một biểu đồ.
   */
  z.object({
    type: z.literal('timeline'),
    ...rhythmFields,
    id: anchorId,
    eyebrow: z.string().optional(),
    heading: z.string(),
    intro: z.string().optional(),
    /** Mốc lớn nhất của trục, tính theo đơn vị của `unitLabel`. */
    max: z.number().int().positive(),
    unitLabel: z.string(),
    items: z.array(z.object({
      label: z.string(),
      from: z.number().int().nonnegative(),
      to: z.number().int().positive(),
      note: z.string().optional(),
    }).strict().superRefine((it, ctx) => {
      if (it.to <= it.from) {
        ctx.addIssue({ code: z.ZodIssueCode.custom,
          message: `"${it.label}": mốc kết thúc (${it.to}) phải lớn hơn mốc bắt đầu (${it.from}).` });
      }
    })).min(2),
    footnote: z.string().optional(),
  }).strict().superRefine((b, ctx) => {
    const over2 = b.items.filter((i) => i.to > b.max);
    if (over2.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom,
        message: `Mốc của "${over2[0].label}" (${over2[0].to}) vượt quá trục ${b.max}. ` +
          `Dải sẽ bị vẽ tràn ra ngoài khung — nâng "max" lên.` });
    }
  }),
  /**
   * Lộ trình sáng và tối đặt cạnh nhau.
   *
   * Khối `steps` trả lời "dùng thế nào", khối này trả lời "khi nào dùng cái
   * gì" — hai câu hỏi khác nhau mà trước đây gộp làm một dòng "1–2 lần mỗi
   * ngày". Đặt hai cột cạnh nhau cho thấy ngay điều mà cả trang nhắc đi nhắc
   * lại: bước chống nắng chỉ có ở cột sáng, và nó là bước duy nhất không thể
   * bỏ.
   */
  z.object({
    type: z.literal('routine'),
    ...rhythmFields,
    id: anchorId,
    eyebrow: z.string().optional(),
    heading: z.string(),
    intro: z.string().optional(),
    columns: z.array(z.object({
      when: z.enum(['morning', 'night']),
      label: z.string(),
      steps: z.array(z.object({
        label: z.string(),
        note: z.string().optional(),
        /** Bước không được bỏ. Hiện một dấu riêng, không phải để trang trí. */
        essential: z.boolean().default(false),
      }).strict()).min(2),
    }).strict()).length(2),
    footnote: z.string().optional(),
  }).strict().superRefine((b, ctx) => {
    const when = b.columns.map((c) => c.when);
    if (new Set(when).size !== 2) {
      ctx.addIssue({ code: z.ZodIssueCode.custom,
        message: 'Hai cột phải là một "morning" và một "night"; hai cột cùng loại thì bố cục mất nghĩa.' });
    }
  }),
]);

const products = defineCollection({
  // Không để loader tự suy id từ trường `slug`: các bản dịch dùng chung slug
  // nên sẽ đè lên nhau. Id phải là <slug>/<locale>.
  loader: glob({
    pattern: '**/*.json',
    base: './src/content/products',
    generateId: ({ entry }) => entry.replace(/\.json$/, ''),
  }),
  schema: z.object({
    /* Slug đi thẳng vào URL và sitemap: chỉ chữ thường, số và gạch nối.
       Kiểm định lần 6: slug tự do gây vỡ build bằng NoMatchingStaticPathFound
       khó hiểu, hoặc sinh URL hỏng khi có khoảng trắng/dấu. */
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug chỉ gồm chữ thường, số và gạch nối'),
    locale: z.enum(['vi', 'en', 'th', 'id']),
    /** Nhóm các bản dịch của cùng một sản phẩm lại, dùng để sinh hreflang. */
    translationKey: z.string(),
    status: z.enum(['draft', 'published']).default('draft'),

    /** Dòng sản phẩm chứa sản phẩm này. Trang dòng sẽ tự gom, không khai hai chiều. */
    line: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
    /**
     * Bài tư vấn liên quan, hiện ở cuối trang sản phẩm.
     *
     * Trang sản phẩm là trang đích của quảng cáo, nên nó cũng là nơi người đọc
     * dừng lại nhiều nhất. Không có đường nào dẫn sang nội dung giải thích thì
     * trang thành ngõ cụt: người còn đang phân vân chỉ có hai lựa chọn là điền
     * biểu mẫu hoặc thoát. Bài viết ở đây đã tồn tại sẵn — chỉ là trước đây
     * liên kết một chiều, từ bài về sản phẩm chứ không có chiều ngược lại.
     */
    relatedArticles: z.array(z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)).default([]),
    /**
     * Truy vấn mà trang này sở hữu. Hai trang cùng khai một truy vấn sẽ ăn thịt
     * nhau trên kết quả tìm kiếm — cổng bên dưới chặn việc đó ngay lúc build.
     */
    primaryKeyword: z.string().min(3).optional(),
    /**
     * Biến thể dành riêng cho quảng cáo: noindex + canonical trỏ về trang gốc.
     * Không khai thì 5 biến thể của cùng một landing sẽ cạnh tranh với chính
     * trang gốc và Google chọn nhầm trang để hiển thị.
     */
    canonicalOf: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),

    /**
     * Nguyên mẫu câu chuyện của trang — xem `src/lib/narrative.ts`.
     *
     * KHÔNG ép thứ tự khối. Nó nói cho người biên tập và cho cổng QA biết trang
     * này định kể kiểu gì, để `tests/narrative.mjs` đối chiếu rồi BÁO chứ không
     * chặn. Ép thứ tự thì lại về đúng chỗ cũ: mười hai trang một khuôn, chỉ là
     * khuôn mới.
     */
    storyArchetype: z.enum(STORY_ARCHETYPES).optional(),

    /**
     * Bối cảnh quảng cáo mà trang này được dựng để đón.
     *
     * KHÔNG hiển thị ra trang. Bốn việc nó làm:
     *  1. ghi lại trang đích này phục vụ ý định nào, để người sau không phải đoán;
     *  2. cho phép đối chiếu lời quảng cáo với nội dung thật (`scripts/check-ad-integrity.mjs`);
     *  3. làm đầu vào cho `docs/ad-readiness.md`;
     *  4. chặn việc một mẩu quảng cáo hứa rộng hơn những gì trang chống lưng được.
     *
     * Đây KHÔNG phải danh sách từ khoá. Quảng cáo trong hội thoại bắt Ý ĐỊNH,
     * không bắt cụm khớp chính xác; nhồi từ khoá vào đây chỉ tạo một bản sao
     * sai lệch của thứ vốn không tồn tại.
     */
    adContext: z.object({
      /** Nhu cầu chính, viết như người mua tự nói ra. */
      primaryNeed: z.string().min(8),
      /** Hoàn cảnh cụ thể của người đọc khi họ tới đây. */
      audienceSituations: z.array(z.string().min(8)).min(1).max(6),
      /** Bối cảnh hội thoại mà trang này là câu trả lời hợp lý. */
      contextHints: z.array(z.string().min(8)).max(8).default([]),
      /**
       * Lời hứa được phép dùng trong quảng cáo.
       *
       * Mỗi câu ở đây phải được CHÍNH nội dung trang chống lưng. Cổng
       * `check-ad-integrity` đối chiếu từng câu với hero và seo của trang.
       */
      approvedAngles: z.array(z.string().min(8)).min(1).max(6),
      /**
       * Hướng tiếp cận KHÔNG được dùng, mô tả bằng lời trung tính.
       *
       * Viết "hứa khỏi hẳn sau một liệu trình" chứ ĐỪNG trích nguyên câu bị
       * cấm: mọi chuỗi trong file này đều đi qua hàng rào claims, nên trích
       * nguyên văn sẽ làm hỏng build đúng ở chỗ đang cố ghi lại điều phải
       * tránh. Dự án không có cơ chế miễn trừ, và đó là chủ ý.
       */
      riskyAngles: z.array(z.string().min(8)).default([]),
      /** Neo trong trang mà quảng cáo nên trỏ tới, nếu không phải đầu trang. */
      preferredDestination: z.string().regex(/^#[a-z0-9-]+$/).optional(),
    }).strict().optional(),

    name: z.string(),
    shortName: z.string().optional(),
    sku: z.string(),
    /** Tên từng sản phẩm con trong combo, dùng cho schema và phần quà tặng. */
    /* `image` là packshot RIÊNG của món đó. Không bắt buộc: bản trình bày
       chuẩn không dùng tới. Bản `flagship` dựng sân khấu hero và khối "trong
       hộp có gì" từ chính các ảnh này — khai một lần ở đây thay vì bắt người
       biên tập khai lại ảnh trong từng khối. */
    includes: z.array(z.object({ name: z.string(), note: z.string().optional(), image: image.optional() }).strict()).default([]),
    gifts: z.array(z.object({ name: z.string(), note: z.string().optional(), image: image.optional() }).strict()).default([]),

    price: money,
    compareAtPrice: money.optional(),
    currency: z.string().default('VND'),
    /** Trạng thái bán thật, không mặc định InStock trong mã sinh schema. */
    availability: z.enum(['InStock', 'OutOfStock', 'PreOrder', 'BackOrder']).default('InStock'),
    shipping: z.object({
      country: z.string().length(2),
      rate: z.number().int().nonnegative(),
      transitDaysMin: z.number().int().positive(),
      transitDaysMax: z.number().int().positive(),
    }).strict().optional(),
    /**
     * Chính sách đổi trả, phải khớp ĐÚNG lời hứa trên trang.
     *
     * Kiểm định lần 6: markup khai cửa sổ đổi trả 7 ngày vô điều kiện, miễn phí,
     * cho mọi lý do, trong khi trang chỉ hứa "7 ngày NẾU sản phẩm lỗi". Markup
     * rộng hơn lời hứa thật là đúng loại rủi ro Google kiểm chéo cho merchant.
     */
    /**
     * Chính sách đổi trả, phải khớp ĐÚNG lời hứa trên trang.
     *
     * Nhận một hoặc NHIỀU chính sách: kiểm định lần 8 chỉ ra bản EN hứa quyền
     * rút lui 14 ngày cho EU/UK (tức hoàn tiền vì đổi ý) trong phần cảnh báo,
     * trong khi FAQ nói "không hoàn tiền vì đổi ý" và JSON-LD nói điều thứ ba.
     * Ba nguồn, ba lời hứa, trên cùng một trang.
     */
    returnPolicy: z.union([returnPolicyEntry, z.array(returnPolicyEntry).min(1)]).optional(),
    /** Các lựa chọn mua hiển thị trong form đặt hàng. */
    variants: z.array(z.object({
      label: z.string(),
      note: z.string().optional(),
      price: money.nullable(),
      recommended: z.boolean().default(false),
    }).strict()).default([])
      .refine((vs) => vs.filter((v) => v.recommended).length <= 1,
        'Chỉ một gói được đặt recommended: true — hai gói sẽ sinh hai radio cùng checked.'),

    seo: z.object({
      title: z.string().max(70),
      description: z.string().max(170),
      ogImage: z.string().optional(),
    }).strict(),

    /** Thông tin bắt buộc theo Nghị định 342/2025/NĐ-CP. Thiếu thì build cảnh báo. */
    compliance: z.object({
      productNotificationNumber: z.string().optional(),
      declaringOrganization: z.string(),
      declaringAddress: z.string(),
      functions: z.string(),
      warnings: z.array(z.string()).min(1),

    }).strict(),

    blocks: z.array(blocks).min(1),
  }).strict().superRefine((p, ctx) => {
    /**
     * Giá chỉ được nhắc bằng token ({{price}}, {{compareAtPrice}}, {{save}}).
     * Bất kỳ số tiền nào viết tay trong nội dung đều bị chặn — không cần đoán
     * nó đúng hay sai, vì đã có cách viết duy nhất được phép.
     *
     * Đây là thay đổi hình dạng bài toán sau ba vòng siết regex thất bại:
     * hàng rào cũ vừa lọt 10 cách viết né, vừa chặn nhầm những câu hợp lệ như
     * "gọi 1900 1000 đồng hành cùng bạn".
     */
    const found = new Map<string, string[]>();
    const scan = (node: unknown, path: string): void => {
      if (typeof node === 'string') {
        const hits = findHandwrittenMoney(node);
        if (hits.length) found.set(path, hits);
      } else if (Array.isArray(node)) {
        node.forEach((v, i) => scan(v, `${path}[${i}]`));
      } else if (node && typeof node === 'object') {
        for (const [k, v] of Object.entries(node)) scan(v, path ? `${path}.${k}` : k);
      }
    };
    const { price, compareAtPrice, currency, variants, ...rest } = p;
    scan(rest, '');
    scan(variants.map((v) => ({ label: v.label, note: v.note })), 'variants');

    /* Từ ngữ bị cấm, quét trên MỌI trường chuỗi — cổng evidence chỉ soi
       hero.usp[] nên mọi tuyên bố kết quả đặt chỗ khác đều lọt. */
    /* KHÔNG có cơ chế ngoại lệ.
       Ba vòng kiểm định liền (9, 10, 11) và cả vòng 12 đều phá được cổng
       `reviewedClaims`: miễn theo chuỗi, rồi miễn theo vị trí, rồi bắt khai câu
       đầy đủ ≥40 ký tự — mỗi lần vá lại còn một đường khác, vì bản chất nó là
       một nút tắt cho chính hàng rào đắt nhất của dự án. Câu duy nhất từng cần
       nó ("Nếu bạn cần điều trị nám, hãy đến gặp bác sĩ da liễu") viết lại được
       mà không mất nghĩa. Nội dung phải vừa với hàng rào, không phải ngược lại. */
    const claims = new Map<string, { match: string; why: string; instead: string }[]>();
    const scanClaims = (node: unknown, path: string): void => {
      if (typeof node === 'string') {
        const hits = findForbiddenClaims(node);
        if (hits.length) claims.set(path, hits);
      } else if (Array.isArray(node)) {
        node.forEach((v, i) => scanClaims(v, `${path}[${i}]`));
      } else if (node && typeof node === 'object') {
        for (const [k, v] of Object.entries(node)) scanClaims(v, path ? `${path}.${k}` : k);
      }
    };
    // Chỉ `compliance.warnings` được miễn: đó là cảnh báo bắt buộc theo luật,
    // câu nào cũng có thể chứa từ như "bác sĩ" hay "chữa bệnh" theo nghĩa phủ định.
    // Kiểm định lần 6: miễn trừ cả khối compliance khiến `functions` — chữ hiển
    // thị ở footer và llms.txt dưới nhãn "công dụng ĐÃ CÔNG BỐ", tức trường
    // mang uy tín cơ quan quản lý — thành vùng tự do duy nhất trong file.
    // Nhưng PHẢI quét variants — chúng bị loại khỏi `rest` cho luật giá, và ở
    // vòng trước việc tái dùng `rest` khiến nhãn gói bán thành vùng tự do.
    const { compliance, ...marketing } = rest as Record<string, unknown>;
    scanClaims(marketing, '');
    const comp = compliance as Record<string, unknown> | undefined;
    if (comp) {
      const { warnings, ...declared } = comp;
      scanClaims(declared, 'compliance');
    }
    scanClaims(variants.map((v) => ({ label: v.label, note: v.note })), 'variants');


    /* Mọi neo #trong-trang phải trỏ tới một khối có thật.
       Kiểm định lần 6: CTA phụ của hero hardcode href="#thanh-phan", nên sản phẩm
       thứ ba (không có khối ingredients) có một nút "Xem bảng thành phần" không đi
       đâu cả — và build vẫn xanh. */
    const anchors = new Set<string>(['main']);
    p.blocks.forEach((blk) => {
      /* Khối có cổng consent chưa được đồng ý thì KHÔNG render, nên neo của nó
         không tồn tại trên trang. Kiểm định lần 9: "#hieu-qua" được cổng chấp
         nhận trong khi gallery đã bị ẩn — và chính thông điệp lỗi còn liệt kê
         nó là "neo có thật". */
      if ('consent' in blk && (blk as { consent?: { obtained?: boolean } }).consent?.obtained !== true) return;
      const explicit = 'id' in blk ? (blk.id as string | undefined) : undefined;
      const anchor = explicit ?? DEFAULT_ANCHOR[blk.type];
      if (anchor) anchors.add(anchor);
    });
    /* Neo do CHÍNH COMPONENT sinh ra, không nằm trong dữ liệu nên không ai canh.
       Kiểm định lần 7: `#dat-hang` bị hardcode ở SiteHeader, Hero, Offer,
       StickyCta và trong Offer.url của JSON-LD. Sản phẩm không có khối `order`
       build xanh với 4 nút mua chết và Offer.url trỏ vào hư không. */
    // Bản nháp đang soạn dở chưa cần đủ khối; chỉ chặn khi đã xuất bản.
    if (p.status === 'published' && !p.blocks.some((blk) => blk.type === 'order')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Sản phẩm phải có đúng một khối type="order". Header, hero, khối ưu đãi, ' +
          'thanh CTA dính đáy và Offer.url trong JSON-LD đều trỏ tới #dat-hang; ' +
          'thiếu khối này thì mọi nút mua trên trang đều là link chết.',
      });
    }
    if (p.blocks.filter((blk) => blk.type === 'order').length > 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Chỉ được có một khối type="order": hai khối sẽ sinh hai id="dat-hang" trùng nhau.',
      });
    }

    /* Hai khối cùng id sẽ sinh hai phần tử cùng anchor; neo trỏ tới cái đầu.
       Kiểm định lần 8: đặt {"type":"faq","id":"dat-hang"} là build xanh và mọi
       nút mua nhảy vào FAQ thay vì biểu mẫu đặt hàng. */
    const seenAnchor = new Map<string, number>();
    p.blocks.forEach((blk, i) => {
      const explicit = 'id' in blk ? (blk.id as string | undefined) : undefined;
      const anchor = explicit ?? DEFAULT_ANCHOR[blk.type];
      if (!anchor) return;
      const first = seenAnchor.get(anchor);
      if (first !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `blocks[${i}] dùng id "${anchor}" đã có ở blocks[${first}]. ` +
            `Hai khối cùng id thì mọi liên kết #${anchor} chỉ tới được khối đầu tiên.`,
        });
      } else {
        seenAnchor.set(anchor, i);
      }
    });

    /* Hàng rào "chưa dựng giao diện hết hàng" ĐÃ GỠ.

       Nó từng chặn mọi `availability` khác `InStock`, vì lúc đó trường này chỉ
       đi vào JSON-LD: máy đọc thấy hết hàng còn trang vẫn mời đặt mua. Chặn ở
       cổng là đúng khi giao diện chưa tồn tại.

       Nay `Order.astro` đã có trạng thái đó: khoá ô nhập, khoá nút, không render
       thẻ <form>, và nói thẳng lý do kèm hotline. Giữ hàng rào nữa thì nó chặn
       đúng thứ nó được dựng ra để chờ. */

    const wanted: [string, string][] = [];
    /* Mọi chuỗi bắt đầu bằng "#" ở BẤT KỲ trường nào đều là neo trong trang.
       Bản trước chỉ soi hero.secondaryCta và hero.usp[].source, nên
       ingredients.rows[].reference = "#khong-ton-tai" lên trang thành link chết
       với build xanh. */
    const collectAnchors = (node: unknown, path: string): void => {
      if (typeof node === 'string') {
        if (/^#[a-z0-9-]+$/i.test(node)) wanted.push([path, node]);
      } else if (Array.isArray(node)) {
        node.forEach((v, i) => collectAnchors(v, `${path}[${i}]`));
      } else if (node && typeof node === 'object') {
        for (const [k, v] of Object.entries(node)) collectAnchors(v, path ? `${path}.${k}` : k);
      }
    };
    collectAnchors(p.blocks, 'blocks');
    for (const [path, href] of wanted) {
      if (!anchors.has(href.slice(1))) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${path} trỏ tới "${href}" nhưng không khối nào có id đó. ` +
            `Các neo có thật: ${[...anchors].map((a) => '#' + a).join(', ')}.`,
        });
      }
    }

    /* Dữ liệu cá nhân chỉ được đặt trong khối có cổng consent. Các khối có
       consent tự chịu trách nhiệm, nên bỏ chúng ra khỏi phạm vi quét này. */
    const gated = new Set(['gallery', 'testimonials']);
    const personal = new Map<string, { match: string; kind: string }[]>();
    const scanPersonal = (node: unknown, path: string): void => {
      if (typeof node === 'string') {
        const hits = findPersonalData(node, BRAND_NUMBERS);
        if (hits.length) personal.set(path, hits);
      } else if (Array.isArray(node)) {
        node.forEach((v, i) => scanPersonal(v, `${path}[${i}]`));
      } else if (node && typeof node === 'object') {
        for (const [k, v] of Object.entries(node)) scanPersonal(v, path ? `${path}.${k}` : k);
      }
    };
    p.blocks.forEach((blk, i) => {
      if (!gated.has(blk.type)) scanPersonal(blk, `blocks[${i}]`);
    });

    if (personal.size) {
      const lines = [...personal].flatMap(([path, hits]) =>
        hits.map((h) => `${path}: "${h.match}" — ${h.kind}`));
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          `Dữ liệu cá nhân nằm ngoài khối có cổng đồng ý:\n    ${lines.join('\n    ')}\n  ` +
          `Lời chứng của khách phải đặt trong khối "testimonials" (có trường consent). ` +
          `Số điện thoại và email của doanh nghiệp thì để trong src/data/mocha.json.`,
      });
    }

    if (claims.size) {
      const lines = [...claims].flatMap(([path, hits]) =>
        hits.map((h) => `${path}: "${h.match}" — ${h.why}. Thay bằng: ${h.instead}`));
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Nội dung chứa tuyên bố bị cấm với mỹ phẩm:\n    ${lines.join('\n    ')}`,
      });
    }

    if (found.size) {
      const lines = [...found].map(([path, hits]) => `${path}: ${hits.join(', ')}`);
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          `Không viết số tiền trực tiếp trong nội dung:\n    ${lines.join('\n    ')}\n  ` +
          `Dùng token ${MONEY_TOKENS.join(', ')} — component sẽ thay bằng số đã định dạng, ` +
          `nên giá chỉ tồn tại ở đúng một nơi và không thể lệch.`,
      });
    }
  }),
});

/* ------------------------------------------------------------------
   Ba tầng nội dung còn lại: trang chủ, dòng sản phẩm, bài tư vấn.

   Bài học đắt nhất của dự án (kiểm định lần 13, bằng mutation testing): một
   collection mới KHÔNG có hàng rào là một vùng tự do, và không ai phát hiện ra
   bằng cách đọc mã. Nên ba collection dưới đây đi qua đúng ba phép quét mà
   `products` phải qua — tuyên bố bị cấm, dữ liệu cá nhân, giá viết tay — ngay
   từ dòng đầu tiên, chứ không phải "bổ sung sau".
-------------------------------------------------------------------*/


const seoField = z.object({
  title: z.string().max(70),
  description: z.string().max(170),
  ogImage: z.string().optional(),
}).strict();

/** Một mục nội dung biên tập: tiêu đề phụ + các đoạn văn. */
const proseSection = z.object({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  heading: z.string(),
  body: z.array(z.string().min(1)).min(1),
  /**
   * Liên kết đi kèm mục, khai riêng chứ KHÔNG viết `<a>` vào `body`.
   *
   * `richText` chỉ cho qua strong/em/b/i/br/sup/sub và escape mọi thẻ khác —
   * đó là hàng rào XSS dựng từ kiểm định lần 6, không phải thiếu sót. Viết thẻ
   * `a` vào body thì nó hiện nguyên văn ra màn hình dưới dạng chữ.
   *
   * Khai ở đây thì `href` đi qua `safeUrl`, nên javascript:/data: bị chặn mà
   * vẫn nối được trang với nhau — thứ SEO cần và người đọc cũng cần.
   */
  links: z.array(z.object({
    label: z.string().min(1),
    href: safeUrl,
  }).strict()).default([]),
}).strict();

const faqField = z.array(z.object({
  q: z.string(), a: z.string(),
}).strict()).default([]);

/**
 * Quét toàn bộ chuỗi của một mục nội dung.
 * Dùng chung cho pages/lines/articles — một hàm, không phải ba bản sao sẽ
 * lệch nhau sau vài tháng.
 */
/* `z.RefinementCtx` không dùng được làm namespace kiểu ở đây; khai đúng phần
   giao diện mà hàm này cần là đủ, và rõ hơn cho người đọc. */
type IssueSink = { addIssue: (issue: { code: any; path?: (string | number)[]; message: string }) => void };

function scanEditorial(node: unknown, ctx: IssueSink, path = ''): void {
  if (typeof node === 'string') {
    for (const hit of findForbiddenClaims(node)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path],
        message: `"${hit.match}" — ${hit.why}. Thay bằng: ${hit.instead}` });
    }
    for (const hit of findPersonalData(node, BRAND_NUMBERS)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path],
        message: `"${hit.match}" là ${hit.kind}. Nội dung biên tập không được chứa ` +
          `dữ liệu cá nhân của khách.` });
    }
    for (const hit of findHandwrittenMoney(node)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path],
        message: `"${hit}" là số tiền viết tay. Giá chỉ tồn tại trong file sản phẩm; ` +
          `trang dòng và bài viết lấy giá từ đó, không chép lại.` });
    }
  } else if (Array.isArray(node)) {
    node.forEach((v, i) => scanEditorial(v, ctx, `${path}[${i}]`));
  } else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) scanEditorial(v, ctx, path ? `${path}.${k}` : k);
  }
}

const pages = defineCollection({
  loader: glob({
    pattern: '**/*.json',
    base: './src/content/pages',
    generateId: ({ entry }) => entry.replace(/\.json$/, ''),
  }),
  schema: z.object({
    slug: slugField,
    locale: z.enum(['vi', 'en', 'th', 'id']),
    translationKey: z.string(),
    status: z.enum(['draft', 'published']).default('draft'),
    seo: seoField,
    hero: z.object({
      eyebrow: z.string().optional(),
      heading: z.string(),
      lead: z.string(),
      image: z.string().optional(),
      imageAlt: z.string().optional(),
      primaryCta: z.object({ label: z.string(), href: safeUrl }).strict().optional(),
      /* Ba dòng cam kết dưới nút: chỗ này trước đây bỏ trống nên nửa dưới màn
         hình đầu tiên không nói gì cả. Giới hạn 4 dòng để không biến thành
         một danh sách tính năng — màn hình đầu tiên chỉ chịu được vài ý. */
      proof: z.array(z.string()).max(4).default([]),
    }).strict(),
    /* Thứ tự hiển thị do file quyết định, không do thứ tự đọc thư mục —
       thư mục thì đổi theo hệ điều hành, còn trang chủ thì không được đổi. */
    lines: z.array(slugField).default([]),
    featured: z.array(slugField).default([]),
    articles: z.array(slugField).default([]),
    about: z.object({
      eyebrow: z.string().optional(),
      heading: z.string(),
      body: z.array(z.string()).min(1),
    }).strict().optional(),
    /* Mục nội dung của chính trang chủ. Trang chủ chỉ có hero + about là 678 từ
       — quá mỏng để đấu Google cho từ khoá thương hiệu, và là trang đích của
       phần lớn quảng cáo. Dùng lại `proseSection` nên đi qua đúng các hàng rào
       nội dung đã có. */
    sections: z.array(proseSection).default([]),
    faq: faqField,
  }).strict().superRefine((page, ctx) => scanEditorial(page, ctx)),
});

const lines = defineCollection({
  loader: glob({
    pattern: '**/*.json',
    base: './src/content/lines',
    generateId: ({ entry }) => entry.replace(/\.json$/, ''),
  }),
  schema: z.object({
    slug: slugField,
    locale: z.enum(['vi', 'en', 'th', 'id']),
    translationKey: z.string(),
    status: z.enum(['draft', 'published']).default('draft'),
    /** Trang dòng là nơi bắt truy vấn không mang tên thương hiệu, nên bắt buộc khai. */
    primaryKeyword: z.string().min(3),
    seo: seoField,
    eyebrow: z.string().optional(),
    heading: z.string(),
    /**
     * Nhãn trên thanh điều hướng, khi `heading` quá dài hoặc quá mơ hồ để đứng
     * cạnh các mục khác. Thanh menu có vài chục pixel cho mỗi mục; tiêu đề trang
     * có cả một dòng. Bắt hai thứ đó dùng chung một chuỗi là để một trong hai
     * chỗ chịu thiệt.
     */
    navLabel: z.string().optional(),
    /**
     * Thứ tự trên điều hướng và trên trang chủ. Số nhỏ đứng trước.
     *
     * Không có trường này thì thứ tự là bảng chữ cái của slug — tức là ngẫu
     * nhiên đối với người đọc, và đẩy dòng bán chạy nhất xuống giữa danh sách.
     */
    order: z.number().int().default(99),
    lead: z.string(),
    /** Sản phẩm hiển thị, theo thứ tự này. Bỏ trống thì tự gom theo product.line. */
    products: z.array(slugField).default([]),
    sections: z.array(proseSection).default([]),
    /**
     * Bảng so sánh các lựa chọn trong dòng.
     *
     * Đây là thứ người gõ "nên chọn loại nào" đang tìm, và là dạng nội dung
     * trợ lý AI trích lại nhiều nhất — vì nó đã ở sẵn dạng câu trả lời có cấu
     * trúc, không cần đọc hiểu cả trang rồi tự lập bảng.
     *
     * Cột lấy từ `products`, đúng thứ tự đó. Không khai lại tên hay giá ở đây:
     * chép giá vào bảng là tạo ra một bản sao sẽ lệch khỏi giá thật sau lần
     * đổi giá đầu tiên — và `findHandwrittenMoney` chặn luôn từ lúc build.
     */
    compare: z.object({
      eyebrow: z.string().optional(),
      heading: z.string(),
      intro: z.string().optional(),
      criteria: z.array(z.object({
        label: z.string(),
        values: z.array(z.string().min(1)).min(2),
        /**
         * Tiêu chí này trả lời "ai hợp với sản phẩm nào".
         *
         * Khối chọn ở cuối trang dòng dựng TỪ tiêu chí được đánh dấu, không
         * viết lại bằng chữ mới. Lý do: một bản mô tả thứ hai về cùng một việc
         * sẽ lệch khỏi bảng so sánh sau lần sửa nội dung đầu tiên, và khi đó
         * trang tự mâu thuẫn với chính nó ngay trong một màn hình cuộn.
         *
         * Không đánh dấu thì khối chọn không hiện — thà không có còn hơn có
         * bằng chữ bịa.
         */
        fit: z.boolean().default(false),
      }).strict()).min(2),
      footnote: z.string().optional(),
    }).strict().superRefine((c, ctx) => {
      const n = c.criteria.filter((x) => x.fit).length;
      if (n > 1) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['criteria'],
          message: `${n} tiêu chí cùng khai fit: true. Khối chọn chỉ dựng được từ MỘT tiêu chí; ` +
            `hai tiêu chí thì không biết lấy cái nào, và im lặng chọn bừa là cách sai.` });
      }
    }).optional(),
    faq: faqField,
    articles: z.array(slugField).default([]),
  }).strict().superRefine((line, ctx) => {
    scanEditorial(line, ctx);
    /* Mỗi tiêu chí phải có đúng một ô cho mỗi sản phẩm. Lệch một ô là bảng
       trượt cột — thứ trông vẫn "đúng" trên màn hình nhưng gán đặc điểm của
       sản phẩm này sang sản phẩm khác. */
    if (line.compare) {
      const cols = line.products.length;
      for (const [i, c] of line.compare.criteria.entries()) {
        if (cols && c.values.length !== cols) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['compare', 'criteria', i],
            message: `Tiêu chí "${c.label}" có ${c.values.length} ô nhưng dòng có ${cols} sản phẩm. ` +
              `Thiếu hoặc thừa một ô là bảng trượt cột, gán đặc điểm sang nhầm sản phẩm.` });
        }
      }
    }
    /* Một trang dòng không có sản phẩm nào và cũng không có nội dung biên tập
       là một trang rỗng — thứ Google gọi là thin content và là rủi ro lớn nhất
       khi nhân bản cấu trúc này ra nhiều dòng. */
    if (!line.products.length && !line.sections.length && line.status === 'published') {
      ctx.addIssue({ code: z.ZodIssueCode.custom,
        message: 'Dòng sản phẩm đã xuất bản phải có ít nhất một sản phẩm hoặc một mục nội dung. ' +
          'Trang rỗng bị Google xếp là nội dung mỏng và kéo theo cả những trang khác.' });
    }
  }),
});

const articles = defineCollection({
  loader: glob({
    pattern: '**/*.json',
    base: './src/content/articles',
    generateId: ({ entry }) => entry.replace(/\.json$/, ''),
  }),
  schema: z.object({
    slug: slugField,
    locale: z.enum(['vi', 'en', 'th', 'id']),
    translationKey: z.string(),
    status: z.enum(['draft', 'published']).default('draft'),
    primaryKeyword: z.string().min(3),
    seo: seoField,
    title: z.string(),
    lead: z.string(),
    publishedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    updatedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    sections: z.array(proseSection).min(1),
    faq: faqField,
    relatedLine: slugField.optional(),
    relatedProducts: z.array(slugField).default([]),
  }).strict().superRefine((a, ctx) => {
    scanEditorial(a, ctx);
    /* Bài quá ngắn không trả lời được câu hỏi nào và chỉ làm loãng site. */
    const words = a.sections.flatMap((sec) => sec.body).join(' ').split(/\s+/).length;
    if (a.status === 'published' && words < 350) {
      ctx.addIssue({ code: z.ZodIssueCode.custom,
        message: `Bài mới có ${words} từ. Bài tư vấn đã xuất bản cần ít nhất 350 từ — ` +
          `ngắn hơn thì không trả lời trọn một câu hỏi, và đó là nội dung mỏng.` });
    }
    if (a.updatedAt && a.updatedAt < a.publishedAt) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['updatedAt'],
        message: 'updatedAt sớm hơn publishedAt.' });
    }
  }),
});

/**
 * Trang chính sách: đổi trả, bảo vệ dữ liệu cá nhân.
 *
 * Tách khỏi `pages` vì hình dạng khác hẳn — không hero, không danh sách sản
 * phẩm, chỉ là văn bản có mục. Và vì chúng có một trường mà không trang nào
 * khác cần: `updatedAt`. Người đọc chính sách luôn hỏi "bản này từ bao giờ", và
 * Nghị định 13/2023/NĐ-CP cũng đòi thông báo khi chính sách thay đổi.
 */
const policies = defineCollection({
  loader: glob({
    pattern: '**/*.json',
    base: './src/content/policies',
    generateId: ({ entry }) => entry.replace(/\.json$/, ''),
  }),
  schema: z.object({
    slug: slugField,
    locale: z.enum(['vi', 'en', 'th', 'id']),
    translationKey: z.string(),
    status: z.enum(['draft', 'published']).default('draft'),
    seo: seoField,
    title: z.string(),
    lead: z.string(),
    updatedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    /**
     * Trang đứng ở gốc (`/lien-he/`) thay vì trong `/chinh-sach/`.
     *
     * Trang liên hệ dùng chung khuôn với chính sách — cùng là văn bản có mục,
     * không có gì để dựng thêm. Nhưng nó KHÔNG phải một chính sách: chôn nó
     * dưới `/chinh-sach/` là đặt thứ người ta tìm nhiều nhất vào chỗ khó tìm
     * nhất, và nói sai với máy tìm kiếm về vai trò của trang.
     */
    topLevel: z.boolean().default(false),
    sections: z.array(proseSection).min(1),
    /* Những chỗ doanh nghiệp còn phải tự điền (thời hạn lưu, điều kiện đổi
       trả). Khai ra để trang tự hiện cảnh báo thay vì im lặng phát hành một
       chính sách còn lỗ hổng. */
    pending: z.array(z.string()).default([]),
  }).strict().superRefine((d, ctx) => scanEditorial(d, ctx)),
});

/**
 * Nội dung biên tập của trang góc tư vấn.
 *
 * Trang này trước chỉ có tiêu đề, một câu dẫn và danh sách bài — 223 từ tiếng
 * Việt, 165 từ tiếng Anh. Đó là thin content: một trang hub không tự nói được
 * điều gì thì Google không có lý do xếp hạng nó, và nó kéo theo cả những trang
 * bài viết bên dưới. Mục nội dung để ở file dữ liệu chứ không nhét vào i18n:
 * i18n là chuỗi giao diện, không phải nơi chứa bài viết.
 */
const guides = defineCollection({
  loader: glob({
    pattern: '**/*.json',
    base: './src/content/guides',
    generateId: ({ entry }) => entry.replace(/\.json$/, ''),
  }),
  schema: z.object({
    locale: z.enum(['vi', 'en', 'th', 'id']),
    translationKey: z.string(),
    status: z.enum(['draft', 'published']).default('draft'),
    sections: z.array(proseSection).min(1),
    faq: faqField,
  }).strict().superRefine((d, ctx) => scanEditorial(d, ctx)),
});

const brand = defineCollection({
  /* Bỏ qua file bắt đầu bằng "_": src/data còn chứa đặc tả ảnh, vốn không phải
     một thương hiệu. Không loại ra thì loader coi nó là một entry brand thiếu
     mọi trường bắt buộc và build dừng với thông báo khó hiểu. */
  loader: glob({ pattern: ['**/*.json', '!_*.json'], base: './src/data' }),
  schema: z.object({
    legalName: z.string(),
    tradingName: z.string(),
    taxId: z.string().optional(),
    address: z.string(),
    phone: z.string(),
    phoneDisplay: z.string(),
    zalo: safeUrl.optional(),
    email: z.string().email(),
    hours: z.string(),
    logo: z.string(),
    /**
     * Hồ sơ chính thức của thương hiệu trên nền tảng khác, phát ra `sameAs`.
     *
     * Đây là cách duy nhất nói với Google và trợ lý AI rằng website này và
     * fanpage/kênh kia là CÙNG một thực thể. Không có nó, mỗi nơi là một thực
     * thể rời rạc và không nơi nào mượn được uy tín của nơi nào.
     *
     * Chỉ khai hồ sơ thật sự do thương hiệu vận hành. Gắn một URL không kiểm
     * soát được vào `sameAs` là tự nhận về mọi thứ đăng ở đó.
     */
    profiles: z.array(z.object({
      name: z.string(),
      url: safeUrl,
    }).strict()).default([]),
    marketplaces: z.array(z.object({ name: z.string(), url: safeUrl.optional() }).strict()).default([]),
  }).strict().superRefine((b, ctx) => {
    /*
     * Dữ liệu thương hiệu phải qua ĐÚNG những hàng rào mà sản phẩm phải qua.
     *
     * Kiểm định lần 13 (bằng mutation testing): collection này không có
     * `.strict()`, không `superRefine`, không quét claims, PII hay tiền — trong
     * khi nội dung của nó render ở footer MỌI trang, trong llms.txt và JSON-LD.
     * Sáu vi phạm cùng lúc ("Kem trị nám tốt nhất, cam kết hoàn tiền", "bác sĩ
     * da liễu khuyên dùng", tên + tuổi + số điện thoại khách, giá viết tay, một
     * trường lạ) qua sạch với build xanh và 257 ca thử vẫn xanh.
     *
     * Mười ba vòng kiểm định đều soi hàng rào qua đúng một cửa: collection
     * `products`. Đây là cửa còn lại.
     */
    const ownNumbers = [b.phone, b.phoneDisplay].filter(Boolean) as string[];
    /* `logo` là đường dẫn file; `email`/`phone`/`phoneDisplay` là dữ liệu liên hệ
       của chính doanh nghiệp; `taxId` là mã số thuế — 10 chữ số bắt đầu bằng 0,
       đúng hình dạng số điện thoại Việt Nam, nên kiểm định lần 14 chỉ ra cổng sẽ
       chặn build ngay ngày doanh nghiệp điền trường mà chính schema mời điền. */
    const SKIP = new Set(['logo', 'email', 'phone', 'phoneDisplay', 'taxId']);

    /* Quét ĐỆ QUY. Bản trước chỉ xét chuỗi ở cấp một nên `marketplaces[]` —
       "Kênh bán chính hãng" hiện ở footer mọi trang — hoàn toàn không được quét. */
    const scanBrand = (node: unknown, path: string, topKey: string): void => {
      if (typeof node === 'string') {
        if (SKIP.has(topKey)) return;
        for (const hit of findForbiddenClaims(node)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path],
            message: `"${hit.match}" — ${hit.why}. Thay bằng: ${hit.instead}` });
        }
        for (const hit of findPersonalData(node, ownNumbers)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path],
            message: `"${hit.match}" là ${hit.kind}. Dữ liệu cá nhân của khách không được đặt ` +
              `trong thông tin doanh nghiệp.` });
        }
        for (const hit of findHandwrittenMoney(node)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path],
            message: `"${hit}" là số tiền viết tay. Giá chỉ được nhắc bằng token trong file sản phẩm.` });
        }
      } else if (Array.isArray(node)) {
        node.forEach((v, i) => scanBrand(v, `${path}[${i}]`, topKey));
      } else if (node && typeof node === 'object') {
        for (const [k, v] of Object.entries(node)) scanBrand(v, `${path}.${k}`, topKey);
      }
    };
    for (const [key, value] of Object.entries(b)) scanBrand(value, key, key);
  }),
});

/**
 * Chứng từ: phiếu công bố, phiếu kiểm nghiệm, chứng nhận nhà máy, giấy tờ pháp
 * nhân, bằng sáng chế hoạt chất.
 *
 * MỘT file cho MỘT giấy tờ, không khai theo từng trang: giấy chứng nhận nhà
 * máy áp dụng cho mọi sản phẩm, khai trong từng trang là 12 bản sao để lệch
 * nhau. Trang sản phẩm tự gom giấy tờ theo `appliesTo` (xem `docsFor` trong
 * src/lib/documents.ts).
 *
 * Tên giấy, số hiệu, cơ quan cấp là DỮ KIỆN PHÁP LÝ: ghi đúng như in trên
 * giấy, không dịch theo ngôn ngữ trang. Nhãn loại giấy mới là chuỗi giao diện.
 */
export const DOCUMENT_KINDS = ['notification', 'test-report', 'gmp', 'business', 'trademark', 'patent', 'other'] as const;
const documents = defineCollection({
  loader: glob({
    pattern: '**/*.json',
    base: './src/content/documents',
    generateId: ({ entry }) => entry.replace(/\.json$/, ''),
  }),
  schema: z.object({
    slug: slugField,
    status: z.enum(['draft', 'published']).default('draft'),
    kind: z.enum(DOCUMENT_KINDS),
    /** Tên giấy đúng như in, ví dụ "Phiếu công bố sản phẩm mỹ phẩm". */
    title: z.string().min(3),
    /** Sản phẩm/mẫu mà giấy nói tới, đúng như in — "A Perfect Skin Peel". Một bộ có nhiều giấy cùng tên. */
    subject: z.string().min(2).optional(),
    /** Số hiệu in trên giấy. Phiếu công bố: số tiếp nhận, ví dụ 1517/25/CBMP-LA. */
    reference: z.string().min(2).optional(),
    issuedBy: z.string().min(2),
    issuedAt: z.string().date(),
    /** Giấy có hạn thì khai; quá hạn lúc build thì giấy tự ẩn và build cảnh báo. */
    validUntil: z.string().date().optional(),
    /** Lô sản xuất được kiểm nghiệm — phiếu kiểm nghiệm chỉ đúng cho lô đó. */
    lot: z.string().optional(),
    /** `"all"` hoặc danh sách slug sản phẩm (dùng chung giữa các ngôn ngữ). */
    appliesTo: z.union([z.literal('all'), z.array(slugField).min(1)]),
    /** Chỉ tiêu và kết quả, chép ĐÚNG như in. Không tóm tắt, không suy diễn. */
    findings: z.array(z.object({ label: z.string(), result: z.string() }).strict()).default([]),
    /** Ảnh từng trang của giấy, đủ độ phân giải để đọc được số hiệu. */
    pages: z.array(z.object({ src: z.string(), alt: z.string().min(1) }).strict()).min(1),
    /** Trang tra cứu công khai của cơ quan cấp, nếu có. */
    lookupUrl: safeUrl.optional(),
    /**
     * Xác nhận đã che thông tin cá nhân (chữ ký, số giấy tờ tuỳ thân, số điện
     * thoại cá nhân) trên ảnh — Nghị định 13/2023. Chưa che thì không đăng.
     */
    redacted: z.literal(true, {
      message: 'Giấy tờ phải được che thông tin cá nhân trước khi đăng: đặt redacted: true SAU KHI đã che.',
    }),
    /** Ghi chú nội bộ, không hiển thị. */
    note: z.string().optional(),
  }).strict().superRefine((d, ctx) => {
    if (d.kind === 'notification' && !d.reference) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['reference'],
        message: 'Phiếu công bố phải có số tiếp nhận — đó là thứ người mua đem đi tra cứu.' });
    }
    if (d.kind === 'test-report' && !d.lot && !d.reference) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['lot'],
        message: 'Phiếu kiểm nghiệm cần số phiếu hoặc số lô: không có thì không ai đối chiếu được nó với hàng trên tay.' });
    }
    if (d.validUntil && d.validUntil < d.issuedAt) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['validUntil'], message: 'Hạn hiệu lực đứng trước ngày cấp.' });
    }
  }),
});

export const collections = { pages, products, lines, articles, policies, guides, brand, documents };
