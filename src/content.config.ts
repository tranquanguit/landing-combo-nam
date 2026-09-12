import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

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
  source: z.string().optional(),
  /** Điều kiện đi kèm: cỡ mẫu, thời gian dùng, cách thu thập. */
  qualifier: z.string().optional(),
}).superRefine((c, ctx) => {
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
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  caption: z.string().optional(),
});

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
    secondaryCta: z.string().optional(),
    trustBadges: z.array(z.string()).max(5).default([]),
  }),
  z.object({
    type: z.literal('offer'),
    eyebrow: z.string().optional(),
    heading: z.string(),
    body: z.string(),
    /** Hạn khuyến mãi là ngày thật, không phải đồng hồ đếm ngược reset mỗi lần tải trang. */
    validUntil: z.string().date().optional(),
    notes: z.array(z.string()).default([]),
  }),
  z.object({
    type: z.literal('problem'),
    id: anchorId,
    eyebrow: z.string().optional(),
    heading: z.string(),
    intro: z.string().optional(),
    quotes: z.array(z.string()),
    explainer: z.object({ heading: z.string(), body: z.array(z.string()) }),
  }),
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
    })),
  }),
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
      reference: z.string().url().optional(),
      /**
       * Nồng độ và bối cảnh mà nghiên cứu được dẫn thật sự đã thử nghiệm.
       * Bắt buộc phải ghi khi nó khác với nồng độ trong sản phẩm — dẫn một nghiên
       * cứu dùng 5% để chống lưng cho công thức 1% là dẫn nguồn gây hiểu nhầm.
       */
      referenceNote: z.string().optional(),
    })),
  }),
  z.object({
    type: z.literal('steps'),
    id: anchorId,
    eyebrow: z.string().optional(),
    heading: z.string(),
    intro: z.string().optional(),
    totalTime: z.string().optional(),
    items: z.array(z.object({ heading: z.string(), body: z.string() })),
    footnote: z.string().optional(),
  }),
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
    }),
    images: z.array(image),
  }),
  z.object({
    type: z.literal('testimonials'),
    id: anchorId,
    eyebrow: z.string().optional(),
    heading: z.string(),
    intro: z.string().optional(),
    items: z.array(z.object({
      quote: z.string(),
      name: z.string(),
      meta: z.string().optional(),
      avatar: image.optional(),
      /** Bắt buộc với nội dung có tài trợ (FTC, và để minh bạch tại VN). */
      sponsored: z.boolean().default(false),
      video: z.object({ src: z.string(), poster: z.string() }).optional(),
    })),
  }),
  z.object({
    type: z.literal('order'),
    eyebrow: z.string().optional(),
    heading: z.string(),
    body: z.string(),
    points: z.array(z.string()),
  }),
  z.object({
    type: z.literal('faq'),
    id: anchorId,
    eyebrow: z.string().optional(),
    heading: z.string(),
    items: z.array(z.object({ q: z.string(), a: z.string() })),
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
    slug: z.string(),
    locale: z.enum(['vi', 'en', 'th', 'id']),
    /** Nhóm các bản dịch của cùng một sản phẩm lại, dùng để sinh hreflang. */
    translationKey: z.string(),
    status: z.enum(['draft', 'published']).default('draft'),

    name: z.string(),
    shortName: z.string().optional(),
    sku: z.string(),
    /** Tên từng sản phẩm con trong combo, dùng cho schema và phần quà tặng. */
    includes: z.array(z.object({ name: z.string(), note: z.string().optional() })).default([]),
    gifts: z.array(z.object({ name: z.string(), note: z.string().optional() })).default([]),

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
    }).optional(),
    returnPolicy: z.object({
      country: z.string().length(2),
      days: z.number().int().positive(),
    }).optional(),
    /** Các lựa chọn mua hiển thị trong form đặt hàng. */
    variants: z.array(z.object({
      label: z.string(),
      note: z.string().optional(),
      price: money.nullable(),
      recommended: z.boolean().default(false),
    })).default([]),

    seo: z.object({
      title: z.string().max(70),
      description: z.string().max(170),
      ogImage: z.string().optional(),
    }),

    /** Thông tin bắt buộc theo Nghị định 342/2025/NĐ-CP. Thiếu thì build cảnh báo. */
    compliance: z.object({
      productNotificationNumber: z.string().optional(),
      declaringOrganization: z.string(),
      declaringAddress: z.string(),
      functions: z.string(),
      warnings: z.array(z.string()).min(1),
    }),

    blocks: z.array(blocks).min(1),
  }).superRefine((p, ctx) => {
    /**
     * Giá bị nhắc lại ở nhiều chỗ trong nội dung (khối ưu đãi, FAQ, ghi chú biến thể).
     * Ở vòng trước, "tiết kiệm 630.000đ" sống sót qua hai lần dọn dẹp vì không ai
     * đối chiếu con số trong câu chữ với con số trong dữ liệu. Hàng rào này quét
     * mọi chuỗi tiền trong nội dung và chặn build nếu xuất hiện số không thuộc
     * tập hợp giá hợp lệ.
     */
    const legit = new Set<number>([p.price, ...(p.compareAtPrice ? [p.compareAtPrice] : [])]);
    for (const v of p.variants) if (v.price !== null) legit.add(v.price);
    if (p.compareAtPrice) legit.add(p.compareAtPrice - p.price);

    const seen = new Set<string>();
    const scan = (node: unknown, path: string): void => {
      if (typeof node === 'string') {
        // Bắt 1.050.000đ, 1,050,000₫, 1.140.000 VND
        const re = /(\d{1,3}(?:[.,]\d{3}){1,3})\s*(?:đ|₫|VND)/gi;
        for (const m of node.matchAll(re)) {
          const n = Number(m[1].replace(/[.,]/g, ''));
          if (!legit.has(n)) seen.add(`${n.toLocaleString('vi-VN')} (tại ${path})`);
        }
      } else if (Array.isArray(node)) {
        node.forEach((v, i) => scan(v, `${path}[${i}]`));
      } else if (node && typeof node === 'object') {
        for (const [k, v] of Object.entries(node)) scan(v, `${path}.${k}`);
      }
    };
    scan(p.blocks, 'blocks');

    if (seen.size) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          `Câu chữ nhắc tới số tiền không khớp dữ liệu giá: ${[...seen].join('; ')}. ` +
          `Các số hợp lệ: ${[...legit].map((n) => n.toLocaleString('vi-VN')).join(', ')}. ` +
          `Sửa câu chữ hoặc sửa giá — đừng để hai nơi nói hai con số.`,
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
    zalo: z.string().optional(),
    email: z.string().email(),
    hours: z.string(),
    logo: z.string(),
    marketplaces: z.array(z.object({ name: z.string(), url: z.string().url().optional() })).default([]),
  }),
});

export const collections = { products, brand };
