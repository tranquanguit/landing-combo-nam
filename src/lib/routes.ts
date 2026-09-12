import { getCollection } from 'astro:content';
import { defaultLocale, localePath, type Locale } from '../i18n/ui.ts';

/** Sản phẩm được đặt ở gốc tên miền. Mọi sản phẩm khác nằm dưới /<slug>. */
export const FLAGSHIP = 'combo-nam';

/** Đường dẫn của một sản phẩm theo ngôn ngữ. */
export function productPath(slug: string, locale: Locale): string {
  const base = slug === FLAGSHIP ? '/' : `/${slug}/`;
  const path = localePath(locale, base);
  return path.endsWith('/') ? path : `${path}/`;
}

/**
 * Các bản dịch đã xuất bản của cùng một sản phẩm.
 * Chỉ liệt kê bản thật sự tồn tại — hreflang trỏ vào trang rỗng còn hại hơn không khai.
 */
export async function alternatesFor(translationKey: string, site: URL | undefined) {
  const all = await getCollection('products', ({ data }) => data.status === 'published');
  const siblings = all.filter((p) => p.data.translationKey === translationKey);
  if (siblings.length < 2) return [];
  return siblings
    .map((p) => ({
      locale: p.data.locale as Locale,
      url: new URL(productPath(p.data.slug, p.data.locale as Locale), site).href,
    }))
    .sort((a, b) => (a.locale === defaultLocale ? -1 : b.locale === defaultLocale ? 1 : a.locale.localeCompare(b.locale)));
}
