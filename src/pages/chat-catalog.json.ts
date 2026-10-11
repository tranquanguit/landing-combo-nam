import type { APIRoute } from 'astro';
import { getCollection, getEntry } from 'astro:content';
import { getImage } from 'astro:assets';
import { money } from '../lib/format';
import { productPath } from '../lib/routes';
import type { Locale } from '../i18n/ui';
import { packsFor, promoNow } from '../lib/promotions';
import { expandBrandTokens } from '../lib/brand';

/**
 * Danh mục sản phẩm cho chat: /chat-catalog.json
 *
 * Hai người đọc:
 *  - máy chủ (server/lib/chat.ts): n8n chỉ gửi `slug`, máy chủ dựng thẻ sản phẩm
 *    (tên, giá, ảnh, link) từ đây — giá trên thẻ chat không thể lệch giá trên
 *    trang, vì cả hai sinh từ cùng một file nội dung trong cùng một lần build;
 *  - n8n / trợ lý AI: biết site có những sản phẩm nào, slug gì, giá bao nhiêu.
 *
 * Sinh lúc build, không phải gõ tay. Chỉ sản phẩm đã xuất bản. Đường dẫn ảnh
 * và trang là tương đối (cùng tên miền) để chạy được ở mọi nơi triển khai.
 */
const assets = import.meta.glob<{ default: ImageMetadata }>('/src/assets/images/*.{webp,jpg,jpeg,png}', { eager: true });

export const GET: APIRoute = async () => {
  const brand = (await getEntry('brand', 'mocha'))!.data as any;
  const products = await getCollection('products', ({ data }) => data.status === 'published');
  /* Khuyến mãi đang chạy lúc build: n8n / trợ lý đọc được đợt nào đang có, gói nào, giá bao nhiêu. */
  const now = promoNow();
  const promoEntries = (await getCollection('promotions')).map((e: any) => ({ id: e.id, data: e.data }));
  const books = new Map<string, Map<string, { price: number; name: string }>>();
  for (const { data: d } of products) {
    if (!books.has(d.locale)) books.set(d.locale, new Map());
    books.get(d.locale)!.set(d.slug, { price: d.price, name: d.shortName ?? d.name });
  }
  const items = await Promise.all(products.map(async ({ data: p }) => {
    const hero = p.blocks.find((b: any) => b.type === 'hero') as any;
    const mod = hero?.image?.src ? assets[`/src/assets${hero.image.src}`]?.default : undefined;
    const img = mod ? await getImage({ src: mod, width: Math.min(480, mod.width), format: 'webp' }) : null;
    const locale = p.locale as Locale;
    return {
      slug: p.slug,
      locale,
      name: p.name,
      shortName: p.shortName ?? p.name,
      tagline: hero?.eyebrow ?? null,
      line: p.line ?? null,
      price: p.price,
      priceText: money(p.price, p.currency, locale),
      compareAtPrice: p.compareAtPrice ?? null,
      compareAtPriceText: p.compareAtPrice ? money(p.compareAtPrice, p.currency, locale) : null,
      currency: p.currency,
      availability: p.availability,
      url: productPath(p.slug, locale),
      orderUrl: `${productPath(p.slug, locale)}#dat-hang`,
      image: img?.src ?? null,
      imageAlt: hero?.image?.alt ?? p.name,
      notificationNumber: p.compliance.productNotificationNumber ?? null,
      promotions: packsFor(p.slug, locale, promoEntries, books.get(locale)!, now).map((x) => ({
        name: x.promoName, badge: x.badge ?? null, endsAt: x.endsAt, pack: x.label,
        priceText: money(x.price, p.currency, locale), regularText: money(x.regular, p.currency, locale),
        gifts: x.gifts.map((g) => `${g.qty} ${g.name}`),
      })),
    };
  }));
  items.sort((a, b) => a.locale.localeCompare(b.locale) || a.slug.localeCompare(b.slug));
  const body = {
    version: '1.0',
    brand: { name: brand.tradingName, phone: brand.phone, phoneDisplay: brand.phoneDisplay, zalo: brand.zalo ?? null },
    products: items,
  };
  return new Response(JSON.stringify(expandBrandTokens(body, brand), null, 1), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
