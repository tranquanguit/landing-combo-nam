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
  /** Chỉ có với sản phẩm không nằm ở gốc tên miền. */
  breadcrumb?: { name: string; url: string }[];
}) {
  const { product: p, brand: b, site, url, locale, faq, breadcrumb } = opts;
  const orgId = `${site}/#organization`;
  const offerBlock = p.blocks.find((x) => x.type === 'offer');
  const offerValidUntil = offerBlock && offerBlock.type === 'offer' ? offerBlock.validUntil : undefined;

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
        areaServed: locale === 'vi' ? 'VN' : 'Worldwide',
        availableLanguage: locale === 'vi' ? ['Vietnamese'] : ['Vietnamese', 'English'],
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
        // Chỉ khai khi nội dung thật sự nêu hạn ưu đãi, không bịa ra một ngày.
        ...(offerValidUntil ? { priceValidUntil: offerValidUntil } : {}),
        availability: `https://schema.org/${p.availability ?? 'InStock'}`,
        itemCondition: 'https://schema.org/NewCondition',
        seller: { '@id': orgId },
        // Giao hàng miễn phí chỉ đúng trong nước; bản quốc tế báo phí trước khi thanh toán.
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
                returnMethod: 'https://schema.org/ReturnByMail',
                returnFees: 'https://schema.org/FreeReturn',
              },
            }
          : {}),
      },
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
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    });
  }

  return { '@context': 'https://schema.org', '@graph': graph };
}
