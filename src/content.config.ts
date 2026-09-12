import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { MONEY_TOKENS } from './lib/money-text.ts';
import { findHandwrittenMoney } from './lib/money-scan.ts';
import { findForbiddenClaims, findPersonalData } from './lib/claims-lexicon.ts';
import { DEFAULT_ANCHOR } from './lib/block-anchors.ts';
import { readFileSync } from 'node:fs';

/* Số liên hệ của chính doanh nghiệp không phải dữ liệu cá nhân của khách. */
const BRAND_NUMBERS: string[] = (() => {
  try {
    const b = JSON.parse(readFileSync('src/data/mocha.json', 'utf8'));
    return [b.phone, b.phoneDisplay].filter(Boolean);
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
});
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
}).strict();

/** Id neo dùng cho liên kết trong trang. Để trống thì component dùng id mặc định. */
const anchorId = z.string().regex(/^[a-z0-9-]+$/).optional();

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
      const identity = /\b(chị|anh|cô|bác|chú|em)\s+[A-ZĐÀ-Ỹ][\p{L}]+|\b\d{2}\s*tuổi|\b(Mrs?|Ms)\.\s+[A-Z]/u;
      if (identity.test(q)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            `Câu trích trong khối "problem" nêu danh tính người thật: "${q.slice(0, 60)}…". ` +
            `Lời chứng của khách phải nằm ở khối "testimonials", nơi có cổng consent. ` +
            `Khối này chỉ dành cho nỗi lo chung, viết ẩn danh.`,
        });
      }
    })),
    explainer: z.object({ heading: z.string(), body: z.array(z.string()) }).strict(),
  }).strict(),
  z.object({
    type: z.literal('cards'),
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
    id: anchorId,
    eyebrow: z.string().optional(),
    heading: z.string(),
    intro: z.string().optional(),
    caption: z.string().optional(),
    rows: z.array(z.object({
      name: z.string(),
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
  z.object({
    type: z.literal('faq'),
    id: anchorId,
    eyebrow: z.string().optional(),
    heading: z.string(),
    items: z.array(z.object({ q: z.string(), a: z.string() }).strict()),
  }).strict(),
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

    name: z.string(),
    shortName: z.string().optional(),
    sku: z.string(),
    /** Tên từng sản phẩm con trong combo, dùng cho schema và phần quà tặng. */
    includes: z.array(z.object({ name: z.string(), note: z.string().optional() }).strict()).default([]),
    gifts: z.array(z.object({ name: z.string(), note: z.string().optional() }).strict()).default([]),

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

    /* availability chỉ có trong JSON-LD: đặt OutOfStock thì máy đọc thấy hết
       hàng còn trang vẫn mời đặt mua — đúng loại "ba nguồn nói ba điều".
       Chưa dựng giao diện hết hàng, nên chặn ở cổng thay vì phát hành mâu thuẫn. */
    if (p.availability && p.availability !== 'InStock' && p.status === 'published') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `availability="${p.availability}" nhưng giao diện chưa có trạng thái hết hàng: ` +
          `trang vẫn hiện nút đặt mua và biểu mẫu. Hoặc đặt status="draft", hoặc dựng giao diện ` +
          `hết hàng trước khi khai trạng thái này.`,
      });
    }

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

const brand = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/data' }),
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
    marketplaces: z.array(z.object({ name: z.string(), url: safeUrl.optional() }).strict()).default([]),
  }),
});

export const collections = { products, brand };
