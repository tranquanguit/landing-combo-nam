import type { CollectionEntry } from 'astro:content';
import { htmlLang, type Locale } from '../i18n/ui.ts';
import { plainText } from './richtext.ts';

const languageName: Record<Locale, string> = {
  vi: 'Vietnamese', en: 'English', th: 'Thai', id: 'Indonesian',
};

type Product = CollectionEntry<'products'>['data'];
type Brand = CollectionEntry<'brand'>['data'];

/**
 * JSON-LD cho một landing sản phẩm.
 *
 * Chủ ý không khai `aggregateRating` và `review`: Google cấm khai điểm đánh giá
 * mà trang không hiển thị đúng dữ liệu đó, vi phạm dẫn tới manual action.
 * Khi có hệ thống review thật thì thêm vào đây, không sớm hơn.
 *
 * FAQPage và HowTo KHÔNG khai để lấy rich result: Google đã bỏ cả hai (FAQ từ
 * 05/2026). Vẫn khai vì lý do khác — chúng là cách duy nhất nói với máy rằng
 * "đây là một câu hỏi và đây là câu trả lời của nó", "đây là bước 2 trong quy
 * trình bốn bước". Trợ lý AI trích dẫn được đoạn nào là nhờ ranh giới đó, chứ
 * không nhờ SERP. Mất rich result không làm dữ liệu sai đi.
 */
import { isOfferExpired } from './offer.ts';
import { DEFAULT_ANCHOR } from './block-anchors.ts';

const REFUND: Record<string, string> = {
  exchange: 'https://schema.org/ExchangeRefund',
  full: 'https://schema.org/FullRefund',
  'store-credit': 'https://schema.org/StoreCreditRefund',
};

/**
 * Dựng MerchantReturnPolicy đúng phạm vi đã hứa trên trang.
 *
 * scope 'defect': không có cửa sổ đổi ý, chỉ có cửa sổ hàng lỗi. Khai bằng
 * `MerchantReturnNotPermitted` + `itemDefectReturnDays` là cách schema.org mô tả
 * đúng điều đó; khai `MerchantReturnFiniteReturnWindow` + `merchantReturnDays`
 * như bản trước là hứa với máy nhiều hơn hứa với người.
 */
function returnPolicyNode(rp: {
  country: string | string[]; days: number;
  scope?: 'defect' | 'any'; fees?: 'free' | 'customer'; refund?: string;
}) {
  /* Google đòi returnShippingFeesAmount khi phí do khách chịu. Không biết con
     số thật cho từng nước, nên khai đúng bản chất: khách tự chịu phí gửi về. */
  const customerPays = rp.fees === 'customer';
  const fees = customerPays
    ? 'https://schema.org/ReturnFeesCustomerResponsibility'
    : 'https://schema.org/FreeReturn';
  const base = {
    '@type': 'MerchantReturnPolicy',
    applicableCountry: rp.country,
    returnMethod: 'https://schema.org/ReturnByMail',
    refundType: REFUND[rp.refund ?? 'exchange'],
  };
  if ((rp.scope ?? 'defect') === 'any') {
    return {
      ...base,
      returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
      merchantReturnDays: rp.days,
      returnFees: fees,
      returnMethod: 'https://schema.org/ReturnByMail',
    };
  }
  return {
    ...base,
    returnPolicyCategory: 'https://schema.org/MerchantReturnNotPermitted',
    itemDefectReturnLabelSource: 'https://schema.org/ReturnLabelInBox',
    itemDefectReturnFees: fees,
    // Chỉ khai số tiền 0 khi người bán THẬT SỰ trả phí; bản trước luôn khai 0
    // kể cả khi fees là 'customer', tức tự mâu thuẫn ngay trong một node.
    ...(customerPays ? {} : {
      itemDefectReturnShippingFeesAmount: { '@type': 'MonetaryAmount', value: 0, currency: 'VND' },
    }),
    itemDefectReturnDays: rp.days,
  };
}

/**
 * Node Organization, dùng chung cho MỌI loại trang.
 *
 * Trước đây node này nằm gọn trong `productGraph`. Từ khi site có bốn tầng
 * trang, chép nó ra bốn chỗ là cách chắc chắn để bốn trang khai bốn pháp nhân
 * hơi khác nhau sau vài tháng sửa lặt vặt.
 */
export function organizationNode(b: Brand, site: string, locale: Locale, logoUrl?: string) {
  return {
    '@type': 'Organization',
    '@id': `${site}/#organization`,
    name: b.legalName,
    alternateName: b.tradingName,
    url: site,
    ...(logoUrl ? { logo: { '@type': 'ImageObject', url: logoUrl } } : {}),
    email: b.email,
    address: { '@type': 'PostalAddress', streetAddress: b.address, addressCountry: 'VN' },
    contactPoint: [{
      '@type': 'ContactPoint',
      telephone: b.phone,
      contactType: 'customer service',
      areaServed: locale === 'vi' ? 'VN' : 'Worldwide',
      availableLanguage: [languageName[locale]],
    }],
    /* sameAs nối website với hồ sơ chính thức trên nền tảng khác. Thiếu nó thì
       mỗi nơi là một thực thể rời, và không nơi nào mượn được uy tín của nơi
       nào — kể cả khi cùng một doanh nghiệp vận hành tất cả. */
    ...(b.profiles?.length ? { sameAs: b.profiles.map((p) => p.url) } : {}),
    ...(b.taxId ? { taxID: b.taxId } : {}),
  };
}

export function breadcrumbNode(url: string, items: { name: string; url: string }[]) {
  return {
    '@type': 'BreadcrumbList',
    '@id': `${url}#breadcrumb`,
    itemListElement: items.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      // Mục cuối là trang hiện tại nên không cần item, theo hướng dẫn của Google.
      ...(i < items.length - 1 ? { item: c.url } : {}),
    })),
  };
}

export function faqNode(url: string, locale: Locale, faq: { q: string; a: string }[]) {
  return {
    '@type': 'FAQPage',
    '@id': `${url}#faq`,
    inLanguage: htmlLang[locale],
    mainEntity: faq.map((f) => ({
      '@type': 'Question',
      name: plainText(f.q),
      // Bóc thẻ: schema là dữ liệu cho máy, không phải nơi đặt đánh dấu trình bày.
      acceptedAnswer: { '@type': 'Answer', text: plainText(f.a) },
    })),
  };
}

/**
 * HowTo từ khối `steps`.
 *
 * Neo `url` của từng bước trỏ về đúng khối hướng dẫn trên trang, để máy nối
 * được bước trong dữ liệu với bước người đọc nhìn thấy. Không bịa `supply` hay
 * `tool`: khối `steps` không khai hai thứ đó, và đoán ra chúng là thêm dữ kiện
 * không có trên trang.
 */
export function howToNode(url: string, locale: Locale, steps: {
  heading: string;
  intro?: string;
  totalTime?: string;
  anchor: string;
  items: { heading: string; body: string }[];
}) {
  return {
    '@type': 'HowTo',
    '@id': `${url}#howto`,
    name: plainText(steps.heading),
    ...(steps.intro ? { description: plainText(steps.intro) } : {}),
    ...(steps.totalTime ? { totalTime: steps.totalTime } : {}),
    inLanguage: htmlLang[locale],
    step: steps.items.map((s, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      name: plainText(s.heading),
      text: plainText(s.body),
      url: `${url}#${steps.anchor}`,
    })),
  };
}

interface PageBase {
  brand: Brand;
  site: string;
  url: string;
  locale: Locale;
  logoUrl?: string;
  breadcrumb?: { name: string; url: string }[];
  faq?: { q: string; a: string }[];
}

/**
 * JSON-LD cho trang chủ: Organization + WebSite.
 *
 * WebSite chỉ khai ở gốc. Khai nó trên mọi trang là cách nhanh nhất để máy đọc
 * hiểu mỗi trang con là một website riêng.
 */
export function homeGraph(opts: PageBase & { title: string; description: string }) {
  const { brand: b, site, url, locale, logoUrl, title, description } = opts;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      organizationNode(b, site, locale, logoUrl),
      {
        '@type': 'WebSite',
        '@id': `${site}/#website`,
        url: site,
        name: b.tradingName,
        inLanguage: htmlLang[locale],
        publisher: { '@id': `${site}/#organization` },
      },
      {
        '@type': 'WebPage',
        '@id': `${url}#webpage`,
        url,
        name: title,
        description,
        inLanguage: htmlLang[locale],
        isPartOf: { '@id': `${site}/#website` },
        publisher: { '@id': `${site}/#organization` },
      },
    ],
  };
}

/**
 * JSON-LD cho trang dòng sản phẩm: CollectionPage + ItemList.
 *
 * ItemList cho máy đọc biết trang này liệt kê những sản phẩm nào và theo thứ tự
 * nào — đây là thứ phân biệt một trang danh mục thật với một trang giới thiệu
 * có gắn vài liên kết.
 */
export function collectionGraph(opts: PageBase & {
  title: string;
  description: string;
  items: { name: string; url: string }[];
}) {
  const { brand: b, site, url, locale, logoUrl, title, description, items, breadcrumb, faq } = opts;
  const graph: Record<string, unknown>[] = [
    organizationNode(b, site, locale, logoUrl),
    {
      '@type': 'CollectionPage',
      '@id': `${url}#webpage`,
      url,
      name: title,
      description,
      inLanguage: htmlLang[locale],
      publisher: { '@id': `${site}/#organization` },
      mainEntity: { '@id': `${url}#list` },
    },
    {
      '@type': 'ItemList',
      '@id': `${url}#list`,
      numberOfItems: items.length,
      itemListElement: items.map((it, i) => ({
        '@type': 'ListItem', position: i + 1, name: it.name, url: it.url,
      })),
    },
  ];
  if (breadcrumb?.length) graph.push(breadcrumbNode(url, breadcrumb));
  if (faq?.length) graph.push(faqNode(url, locale, faq));
  return { '@context': 'https://schema.org', '@graph': graph };
}

/** JSON-LD cho bài tư vấn. */
export function articleGraph(opts: PageBase & {
  title: string;
  description: string;
  headline: string;
  publishedAt: string;
  updatedAt?: string;
  imageUrls?: string[];
}) {
  const {
    brand: b, site, url, locale, logoUrl, title, description, headline,
    publishedAt, updatedAt, imageUrls = [], breadcrumb, faq,
  } = opts;
  const graph: Record<string, unknown>[] = [
    organizationNode(b, site, locale, logoUrl),
    {
      '@type': 'Article',
      '@id': `${url}#article`,
      headline,
      description,
      inLanguage: htmlLang[locale],
      datePublished: publishedAt,
      dateModified: updatedAt ?? publishedAt,
      /* Tác giả là pháp nhân, không phải một cái tên bịa ra cho có vẻ chuyên gia.
         Một tên người không kiểm chứng được thì tệ hơn là không khai tên. */
      author: { '@id': `${site}/#organization` },
      publisher: { '@id': `${site}/#organization` },
      mainEntityOfPage: { '@id': `${url}#webpage` },
      ...(imageUrls.length ? { image: imageUrls } : {}),
    },
    {
      '@type': 'WebPage',
      '@id': `${url}#webpage`,
      url,
      name: title,
      description,
      inLanguage: htmlLang[locale],
      publisher: { '@id': `${site}/#organization` },
    },
  ];
  if (breadcrumb?.length) graph.push(breadcrumbNode(url, breadcrumb));
  if (faq?.length) graph.push(faqNode(url, locale, faq));
  return { '@context': 'https://schema.org', '@graph': graph };
}

export function productGraph(opts: {
  product: Product;
  brand: Brand;
  site: string;
  url: string;
  locale: Locale;
  faq?: { q: string; a: string }[];
  /** Chỉ có với sản phẩm không nằm ở gốc tên miền. */
  breadcrumb?: { name: string; url: string }[];
  /** URL tuyệt đối đã giải qua pipeline ảnh. */
  imageUrls?: string[];
  logoUrl?: string;
}) {
  const { product: p, brand: b, site, url, locale, faq, breadcrumb, imageUrls = [], logoUrl } = opts;
  const orgId = `${site}/#organization`;
  const offerBlock = p.blocks.find((x) => x.type === 'offer');
  const declaredValidUntil = offerBlock && offerBlock.type === 'offer' ? offerBlock.validUntil : undefined;
  // Hạn đã qua thì KHÔNG phát cho máy đọc — giống hệt cách giao diện ẩn dòng hạn.
  const offerValidUntil = isOfferExpired(declaredValidUntil) ? undefined : declaredValidUntil;

  /**
   * Mỗi gói bán là một Offer riêng.
   *
   * Trước đây chỉ khai một Offer cho cả bốn lựa chọn, nên máy đọc được giá combo
   * mà không đọc được giá mua lẻ — trong khi trang hiển thị đủ cả bốn.
   */
  const offerBase = {
    priceCurrency: p.currency,
    availability: `https://schema.org/${p.availability ?? 'InStock'}`,
    itemCondition: 'https://schema.org/NewCondition',
    seller: { '@id': orgId },
    ...(offerValidUntil ? { priceValidUntil: offerValidUntil } : {}),
    // Phí vận chuyển là dữ kiện của người bán, không phụ thuộc ngôn ngữ trang.
    // Kiểm định lần 6: Offer bản EN không có shippingDetails nên người đọc bản
    // tiếng Anh không biết mình sẽ trả bao nhiêu.
    ...(p.shipping
      ? {
          shippingDetails: {
            '@type': 'OfferShippingDetails',
            shippingRate: { '@type': 'MonetaryAmount', value: String(p.shipping.rate), currency: p.currency },
            shippingDestination: { '@type': 'DefinedRegion', addressCountry: p.shipping.country },
            deliveryTime: {
              '@type': 'ShippingDeliveryTime',
              handlingTime: { '@type': 'QuantitativeValue', minValue: 0, maxValue: 1, unitCode: 'DAY' },
              transitTime: {
                '@type': 'QuantitativeValue',
                minValue: p.shipping.transitDaysMin,
                maxValue: p.shipping.transitDaysMax,
                unitCode: 'DAY',
              },
            },
          },
        }
      : {}),
    ...(p.returnPolicy
      ? {
          hasMerchantReturnPolicy: Array.isArray(p.returnPolicy)
            ? p.returnPolicy.map(returnPolicyNode)
            : returnPolicyNode(p.returnPolicy),
        }
      : {}),
  };

  /**
   * Sản phẩm này có đúng MỘT giá.
   *
   * Bản trước gộp cả bốn lựa chọn vào một `AggregateOffer`, nên `lowPrice` là
   * 550.000 — giá của serum bán lẻ — gắn trên `Product` vốn là combo giá
   * 1.050.000. Máy đọc sẽ hiểu sai, và giá hiển thị lệch giá markup là đúng
   * loại rủi ro rich result.
   *
   * Cách đúng: combo có một Offer của chính nó; các món bán lẻ là sản phẩm
   * khác, khai riêng và liên kết bằng `isRelatedTo`.
   */
  function buildOffers() {
    return { '@type': 'Offer', url: `${url}#dat-hang`, price: String(p.price), ...offerBase };
  }

  /** Các món bán lẻ: sản phẩm riêng, giá riêng, không trộn vào giá combo. */
  function standaloneProducts() {
    return p.variants
      .filter((v) => v.price !== null && v.price !== p.price)
      .map((v, i) => ({
        '@type': 'Product',
        '@id': `${url}#variant-${i}`,
        name: v.label,
        ...(v.note ? { description: plainText(v.note) } : {}),
        brand: { '@type': 'Brand', name: b.tradingName },
        offers: {
          '@type': 'Offer',
          url: `${url}#dat-hang`,
          price: String(v.price),
          ...offerBase,
        },
      }));
  }

  const graph: Record<string, unknown>[] = [
    organizationNode(b, site, locale, logoUrl),
    {
      '@type': 'WebPage',
      '@id': `${url}#webpage`,
      url,
      name: p.seo.title,
      description: p.seo.description,
      inLanguage: htmlLang[locale],
      publisher: { '@id': orgId },
    },
    {
      '@type': 'Product',
      '@id': `${url}#product`,
      name: p.name,
      sku: p.sku,
      description: plainText(p.seo.description),
      ...(imageUrls.length ? { image: imageUrls } : {}),
      brand: { '@type': 'Brand', name: b.tradingName },
      manufacturer: { '@id': orgId },
      ...(p.includes.length
        ? { hasPart: p.includes.map((i) => ({ '@type': 'Product', name: i.name, description: i.note })) }
        : {}),
      ...(standaloneProducts().length
        ? { isRelatedTo: standaloneProducts().map((v) => ({ '@id': v['@id'] })) }
        : {}),
      offers: buildOffers(),
    },
  ];

  graph.push(...standaloneProducts());

  const stepsBlock = p.blocks.find((x) => x.type === 'steps');
  if (stepsBlock && stepsBlock.type === 'steps' && stepsBlock.items.length) {
    graph.push(howToNode(url, locale, {
      heading: stepsBlock.heading,
      intro: stepsBlock.intro,
      totalTime: stepsBlock.totalTime,
      anchor: stepsBlock.id ?? DEFAULT_ANCHOR.steps,
      items: stepsBlock.items,
    }));
  }

  if (breadcrumb?.length) graph.push(breadcrumbNode(url, breadcrumb));
  if (faq?.length) graph.push(faqNode(url, locale, faq));

  return { '@context': 'https://schema.org', '@graph': graph };
}
