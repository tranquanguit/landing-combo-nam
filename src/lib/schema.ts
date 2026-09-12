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
  const offerValidUntil = offerBlock && offerBlock.type === 'offer' ? offerBlock.validUntil : undefined;

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
    ...(locale === 'vi' && p.shipping
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
          hasMerchantReturnPolicy: {
            '@type': 'MerchantReturnPolicy',
            applicableCountry: p.returnPolicy.country,
            returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
            merchantReturnDays: p.returnPolicy.days,
            // Cùng một SKU phải khai cùng số ngày ở mọi ngôn ngữ. Quyền rút lui
            // 14 ngày của EU/UK là quyền theo luật của người mua, nêu trong phần
            // cảnh báo của bản EN, không phải chính sách của người bán.
            returnMethod: 'https://schema.org/ReturnByMail',
            returnFees: 'https://schema.org/FreeReturn',
            refundType: 'https://schema.org/ExchangeRefund',
          },
        }
      : {}),
  };

  function buildOffers() {
    const paid = p.variants.filter((v) => v.price !== null);
    if (paid.length < 2) {
      return { '@type': 'Offer', url: `${url}#dat-hang`, price: String(p.price), ...offerBase };
    }
    return {
      '@type': 'AggregateOffer',
      url: `${url}#dat-hang`,
      priceCurrency: p.currency,
      lowPrice: String(Math.min(...paid.map((v) => v.price as number))),
      highPrice: String(Math.max(...paid.map((v) => v.price as number))),
      offerCount: paid.length,
      offers: paid.map((v) => ({
        '@type': 'Offer',
        name: v.label,
        price: String(v.price),
        url: `${url}#dat-hang`,
        ...offerBase,
      })),
    };
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
        ? { isRelatedTo: p.includes.map((i) => ({ '@type': 'Product', name: i.name, description: i.note })) }
        : {}),
      offers: buildOffers(),
    },
  ];

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
