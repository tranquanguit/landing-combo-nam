import { getCollection } from 'astro:content';
import { ADVICE_SEGMENT, POLICY_SEGMENT, defaultLocale, localePath, type Locale } from '../i18n/ui.ts';

/**
 * MỘT nơi duy nhất biết URL của mọi trang trên site.
 *
 * Bốn tầng nội dung dùng chung một hàm dựng đường dẫn, và `allRoutes()` liệt kê
 * tất cả. Nhờ vậy cổng build kiểm được hai thứ không thể kiểm bằng cách đọc
 * từng file: hai trang khác nhau có đang đòi cùng một URL không, và có trang
 * nào không ai trỏ tới không.
 */

/* Trang chủ nằm ở gốc. Trước đây gốc là landing của sản phẩm chủ lực; từ khi có
   tầng trang chủ + dòng sản phẩm, landing lùi về /combo-nam/ và gốc thành nơi
   đón truy vấn mang tên thương hiệu rồi phân luồng tiếp. */
export const HOME = 'home';

const withSlash = (p: string) => (p.endsWith('/') ? p : `${p}/`);

export function homePath(locale: Locale): string {
  return withSlash(localePath(locale, '/'));
}

/** Đường dẫn của một sản phẩm theo ngôn ngữ. */
export function productPath(slug: string, locale: Locale): string {
  return withSlash(localePath(locale, `/${slug}/`));
}

/** Đường dẫn của một dòng sản phẩm. Dòng nằm cùng cấp với sản phẩm. */
export function linePath(slug: string, locale: Locale): string {
  return withSlash(localePath(locale, `/${slug}/`));
}

/** Đường dẫn của một bài tư vấn, dưới đoạn chuyên mục đã dịch. */
export function articlePath(slug: string, locale: Locale): string {
  return withSlash(localePath(locale, `/${ADVICE_SEGMENT[locale]}/${slug}/`));
}

/** Trang danh sách của chuyên mục tư vấn. */
export function adviceIndexPath(locale: Locale): string {
  return withSlash(localePath(locale, `/${ADVICE_SEGMENT[locale]}/`));
}

/** Trang chính sách, dưới đoạn chuyên mục đã dịch. */
export function policyPath(slug: string, locale: Locale): string {
  return withSlash(localePath(locale, `/${POLICY_SEGMENT[locale]}/${slug}/`));
}

export type RouteKind = 'home' | 'product' | 'line' | 'article' | 'advice-index' | 'policy';

export interface Route {
  kind: RouteKind;
  path: string;
  locale: Locale;
  /** Khoá gộp các bản dịch của cùng một nội dung. */
  translationKey: string;
  slug: string;
  entry?: unknown;
}

const published = <T extends { data: { status?: string } }>(entries: T[]) =>
  entries.filter((e) => e.data.status === 'published');

/**
 * Mọi URL site sẽ xuất ra, gom từ cả bốn collection.
 *
 * Route catch-all dùng hàm này để sinh trang, và cổng build dùng chính nó để
 * kiểm trùng URL — nên không thể có chuyện cổng kiểm một tập còn trang sinh ra
 * từ một tập khác.
 */
export async function allRoutes(): Promise<Route[]> {
  const [pages, products, lines, articles, policies] = await Promise.all([
    getCollection('pages'),
    getCollection('products'),
    getCollection('lines'),
    getCollection('articles'),
    getCollection('policies'),
  ]);

  const routes: Route[] = [];

  for (const e of published(pages as any[])) {
    if (e.data.slug !== HOME) continue;
    routes.push({
      kind: 'home', path: homePath(e.data.locale), locale: e.data.locale,
      translationKey: HOME, slug: HOME, entry: e,
    });
  }

  for (const e of published(products as any[])) {
    routes.push({
      kind: 'product', path: productPath(e.data.slug, e.data.locale), locale: e.data.locale,
      translationKey: e.data.translationKey, slug: e.data.slug, entry: e,
    });
  }

  for (const e of published(lines as any[])) {
    routes.push({
      kind: 'line', path: linePath(e.data.slug, e.data.locale), locale: e.data.locale,
      translationKey: e.data.translationKey, slug: e.data.slug, entry: e,
    });
  }

  const articleLocales = new Set<Locale>();
  for (const e of published(articles as any[])) {
    articleLocales.add(e.data.locale);
    routes.push({
      kind: 'article', path: articlePath(e.data.slug, e.data.locale), locale: e.data.locale,
      translationKey: e.data.translationKey, slug: e.data.slug, entry: e,
    });
  }

  for (const e of published(policies as any[])) {
    routes.push({
      kind: 'policy', path: policyPath(e.data.slug, e.data.locale), locale: e.data.locale,
      translationKey: e.data.translationKey, slug: e.data.slug, entry: e,
    });
  }

  /* Trang danh sách tư vấn chỉ tồn tại ở ngôn ngữ CÓ bài. Sinh nó ở mọi ngôn
     ngữ sẽ tạo ra những trang rỗng — đúng loại nội dung mỏng mà cả cấu trúc
     này dựng ra để tránh. */
  for (const locale of articleLocales) {
    routes.push({
      kind: 'advice-index', path: adviceIndexPath(locale), locale,
      translationKey: 'advice-index', slug: 'advice-index',
    });
  }

  return routes;
}

export interface NavItem { label: string; href: string }

/**
 * Điều hướng chính, sinh từ nội dung đang có.
 *
 * Không viết cứng danh sách: thêm một dòng sản phẩm là nó tự xuất hiện, và một
 * tầng chưa có nội dung thì không sinh ra liên kết chết. Chính phép đo "trang mồ
 * côi" trong scripts/seo-report.mjs đã phát hiện tầng Góc tư vấn được dựng xong
 * mà không có chỗ nào trỏ tới.
 */
export function siteNav(locale: Locale, lines: { slug: string; heading: string }[],
  hasArticles: boolean, labels: { home: string; advice: string }): NavItem[] {
  return [
    { label: labels.home, href: homePath(locale) },
    ...lines.map((l) => ({ label: l.heading, href: linePath(l.slug, locale) })),
    ...(hasArticles ? [{ label: labels.advice, href: adviceIndexPath(locale) }] : []),
  ];
}

/**
 * Các bản dịch đã xuất bản của cùng một nội dung, ở bất kỳ tầng nào.
 * Chỉ liệt kê bản thật sự tồn tại — hreflang trỏ vào trang rỗng còn hại hơn không khai.
 */
export async function alternatesFor(translationKey: string, site: URL | undefined) {
  const routes = await allRoutes();
  const siblings = routes.filter((r) => r.translationKey === translationKey);
  if (siblings.length < 2) return [];
  return siblings
    .map((r) => ({ locale: r.locale, url: new URL(r.path, site).href }))
    .sort((a, b) => (a.locale === defaultLocale ? -1
      : b.locale === defaultLocale ? 1
        : a.locale.localeCompare(b.locale)));
}
