import { defineCollection, z, reference } from 'astro:content';
import { glob } from 'astro/loaders';

/* ------------------------------------------------------------------
   Khối nội dung dùng chung cho mọi landing.
   Mỗi sản phẩm tự chọn khối nào, theo thứ tự nào, qua mảng `blocks`.
   Thêm sản phẩm mới = thêm 1 file JSON, không sửa code.
-------------------------------------------------------------------*/

const money = z.number().int().positive();

/** Tuyên bố về sản phẩm, luôn đi kèm mức độ bằng chứng để kiểm soát rủi ro pháp lý. */
const claim = z.object({
  text: z.string(),
  /** verified: có chứng từ | survey: khảo sát nội bộ | ingredient: suy ra từ hoạt chất | none: chưa có bằng chứng */
  evidence: z.enum(['verified', 'survey', 'ingredient', 'none']).default('none'),
  /** Nguồn kiểm chứng: số phiếu công bố, link nghiên cứu, tên đơn vị kiểm nghiệm. */
  source: z.string().optional(),
  /** Điều kiện đi kèm, ví dụ cỡ mẫu hoặc thời gian sử dụng. */
  qualifier: z.string().optional(),
});

const image = z.object({
  src: z.string(),
  alt: z.string(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  caption: z.string().optional(),
});

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
    eyebrow: z.string().optional(),
    heading: z.string(),
    intro: z.string().optional(),
    quotes: z.array(z.string()),
    explainer: z.object({ heading: z.string(), body: z.array(z.string()) }),
  }),
  z.object({
    type: z.literal('cards'),
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
    eyebrow: z.string().optional(),
    heading: z.string(),
    intro: z.string().optional(),
    caption: z.string().optional(),
    rows: z.array(z.object({
      name: z.string(),
      role: z.string(),
      suitedFor: z.string(),
      reference: z.string().url().optional(),
    })),
  }),
  z.object({
    type: z.literal('steps'),
    eyebrow: z.string().optional(),
    heading: z.string(),
    intro: z.string().optional(),
    totalTime: z.string().optional(),
    items: z.array(z.object({ heading: z.string(), body: z.string() })),
    footnote: z.string().optional(),
  }),
  z.object({
    type: z.literal('gallery'),
    eyebrow: z.string().optional(),
    heading: z.string(),
    intro: z.string().optional(),
    disclaimer: z.string().optional(),
    images: z.array(image),
  }),
  z.object({
    type: z.literal('testimonials'),
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
    eyebrow: z.string().optional(),
    heading: z.string(),
    items: z.array(z.object({ q: z.string(), a: z.string() })),
  }),
]);

const products = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/products' }),
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
