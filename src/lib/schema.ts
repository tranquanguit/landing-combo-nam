import type { CollectionEntry } from 'astro:content';
import { htmlLang, type Locale } from '../i18n/ui';

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
}) {
  const { product: p, brand: b, site, url, locale, faq } = opts;
  const orgId = `${site}/#organization`;

  const graph: Record<string, unknown>[] = [
    {
      '@type': 'Organization',
      '@id': orgId,
      name: b.legalName,
      alternateName: b.tradingName,
      url: site,
      logo: { '@type': 'ImageObject', url: `${site}${b.logo}` },
      email: b.email,
      address: { '@type': 'PostalAddress', streetAddress: b.address, addressCountry: 'VN' },
      contactPoint: [{
        '@type': 'ContactPoint',
        telephone: b.phone,
        contactType: 'customer service',
        areaServed: 'VN',
        availableLanguage: ['Vietnamese'],
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
      description: p.seo.description,
      brand: { '@type': 'Brand', name: b.tradingName },
      manufacturer: { '@id': orgId },
      ...(p.includes.length
        ? { isRelatedTo: p.includes.map((i) => ({ '@type': 'Product', name: i.name, description: i.note })) }
        : {}),
      offers: {
        '@type': 'Offer',
        url: `${url}#dat-hang`,
        priceCurrency: p.currency,
        price: String(p.price),
        availability: 'https://schema.org/InStock',
        itemCondition: 'https://schema.org/NewCondition',
        seller: { '@id': orgId },
        shippingDetails: {
          '@type': 'OfferShippingDetails',
          shippingRate: { '@type': 'MonetaryAmount', value: '0', currency: p.currency },
          shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'VN' },
          deliveryTime: {
            '@type': 'ShippingDeliveryTime',
            handlingTime: { '@type': 'QuantitativeValue', minValue: 0, maxValue: 1, unitCode: 'DAY' },
            transitTime: { '@type': 'QuantitativeValue', minValue: 2, maxValue: 5, unitCode: 'DAY' },
          },
        },
      },
    },
  ];

  if (faq?.length) {
    graph.push({
      '@type': 'FAQPage',
      '@id': `${url}#faq`,
      inLanguage: htmlLang[locale],
      mainEntity: faq.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    });
  }

  return { '@context': 'https://schema.org', '@graph': graph };
}
