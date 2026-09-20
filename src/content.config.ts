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
    }).strict()).min(1),
    footnote: z.string().optional(),
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

    /** Dòng sản phẩm chứa sản phẩm này. Trang dòng sẽ tự gom, không khai hai chiều. */
    line: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
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

/* ------------------------------------------------------------------
   Ba tầng nội dung còn lại: trang chủ, dòng sản phẩm, bài tư vấn.

   Bài học đắt nhất của dự án (kiểm định lần 13, bằng mutation testing): một
   collection mới KHÔNG có hàng rào là một vùng tự do, và không ai phát hiện ra
   bằng cách đọc mã. Nên ba collection dưới đây đi qua đúng ba phép quét mà
   `products` phải qua — tuyên bố bị cấm, dữ liệu cá nhân, giá viết tay — ngay
   từ dòng đầu tiên, chứ không phải "bổ sung sau".
-------------------------------------------------------------------*/

const slugField = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug chỉ gồm chữ thường, số và gạch nối');

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
    lead: z.string(),
    /** Sản phẩm hiển thị, theo thứ tự này. Bỏ trống thì tự gom theo product.line. */
    products: z.array(slugField).default([]),
    sections: z.array(proseSection).default([]),
    faq: faqField,
    articles: z.array(slugField).default([]),
  }).strict().superRefine((line, ctx) => {
    scanEditorial(line, ctx);
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

export const collections = { pages, products, lines, articles, policies, guides, brand };
