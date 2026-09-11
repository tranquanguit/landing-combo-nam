import { getCollection } from 'astro:content';
import { defaultLocale, localePath, type Locale } from '../i18n/ui';

/** Đường dẫn của một sản phẩm theo ngôn ngữ. Sản phẩm chủ lực nằm ở gốc. */
export function productPath(slug: string, locale: Locale, flagship = 'combo-nam'): string {
  const base = slug === flagship ? '/' : `/${slug}`;
  return localePath(locale, base);
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
