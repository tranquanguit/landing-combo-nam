import type { CollectionEntry } from 'astro:content';
import { htmlLang, type Locale } from '../i18n/ui';
import { plainText } from './richtext';

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
 * Cũng không khai FAQPage/HowTo như một chiến lược: Google đã bỏ hai rich result
 * này (FAQ từ 05/2026). Giữ FAQPage vì vẫn giúp máy đọc hiểu, không vì SERP.
 */
import { isOfferExpired } from './offer.ts';

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
  const fees = rp.fees === 'customer'
    ? 'https://schema.org/ReturnShippingFees'
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
    };
  }
  return {
    ...base,
    returnPolicyCategory: 'https://schema.org/MerchantReturnNotPermitted',
    itemDefectReturnLabelSource: 'https://schema.org/ReturnLabelInBox',
    itemDefectReturnShippingFeesAmount: { '@type': 'MonetaryAmount', value: 0, currency: 'VND' },
    itemDefectReturnFees: fees,
    itemDefectReturnDays: rp.days,
  };
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
    ...(p.returnPolicy ? { hasMerchantReturnPolicy: returnPolicyNode(p.returnPolicy) } : {}),
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
    {
      '@type': 'Organization',
      '@id': orgId,
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
        // Ngôn ngữ hỗ trợ lấy từ chính trang đang render, không đoán.
        availableLanguage: [languageName[locale]],
      }],
      ...(b.taxId ? { taxID: b.taxId } : {}),
    },
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

  if (breadcrumb?.length) {
    graph.push({
      '@type': 'BreadcrumbList',
      '@id': `${url}#breadcrumb`,
      itemListElement: breadcrumb.map((c, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: c.name,
        // Mục cuối là trang hiện tại nên không cần item, theo hướng dẫn của Google.
        ...(i < breadcrumb.length - 1 ? { item: c.url } : {}),
      })),
    });
  }

  if (faq?.length) {
    graph.push({
      '@type': 'FAQPage',
      '@id': `${url}#faq`,
      inLanguage: htmlLang[locale],
      mainEntity: faq.map((f) => ({
        '@type': 'Question',
        name: plainText(f.q),
        // Bóc thẻ: schema là dữ liệu cho máy, không phải nơi đặt đánh dấu trình bày.
        acceptedAnswer: { '@type': 'Answer', text: plainText(f.a) },
      })),
    });
  }

  return { '@context': 'https://schema.org', '@graph': graph };
}
