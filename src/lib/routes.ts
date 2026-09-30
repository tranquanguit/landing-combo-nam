import { getCollection } from 'astro:content';
import { ADVICE_SEGMENT, DOCS_SEGMENT, POLICY_SEGMENT, defaultLocale, localePath, type Locale } from '../i18n/ui.ts';

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
export function policyPath(slug: string, locale: Locale, topLevel = false): string {
  return withSlash(localePath(locale, topLevel ? `/${slug}/` : `/${POLICY_SEGMENT[locale]}/${slug}/`));
}

/** Trang tổng giấy tờ và chứng nhận. */
export function docsPath(locale: Locale): string {
  return withSlash(localePath(locale, `/${DOCS_SEGMENT[locale]}/`));
}

export type RouteKind = 'home' | 'product' | 'line' | 'article' | 'advice-index' | 'policy' | 'docs';

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
  const [pages, products, lines, articles, policies, documents] = await Promise.all([
    getCollection('pages'),
    getCollection('products'),
    getCollection('lines'),
    getCollection('articles'),
    getCollection('policies'),
    getCollection('documents'),
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
      kind: 'policy', path: policyPath(e.data.slug, e.data.locale, e.data.topLevel), locale: e.data.locale,
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

  /* Trang chứng nhận chỉ tồn tại khi có ít nhất một giấy đã xuất bản, và ở
     những ngôn ngữ có sản phẩm. Không giấy nào thì không sinh một trang rỗng. */
  if (published(documents as any[]).length > 0) {
    const productLocales = new Set(published(products as any[]).map((e: any) => e.data.locale as Locale));
    for (const locale of productLocales) {
      routes.push({ kind: 'docs', path: docsPath(locale), locale, translationKey: 'docs', slug: 'docs' });
    }
  }

  return routes;
}

export interface NavItem {
  label: string;
  href: string;
  /** Mục con. Có thì mục cha mở ra một bảng thay vì chỉ là một liên kết. */
  children?: { label: string; href: string; note?: string }[];
}

/**
 * Điều hướng chính, sinh từ nội dung đang có.
 *
 * Ba mục, không hơn: **Sản phẩm · Tư vấn · Liên hệ**. Đây là ba việc một người
 * ghé qua có thể muốn làm — xem hàng, đọc trước khi quyết, hoặc hỏi thẳng
 * người bán. Không có việc thứ tư.
 *
 * Bản trước có tám mục ngang hàng xếp theo bảng chữ cái của slug. Bản sau đó
 * còn ba, nhưng nhấc "Nám & thâm sạm" lên hàng đầu TRONG KHI nó vẫn nằm trong
 * bảng Sản phẩm — một mục xuất hiện hai lần cạnh nhau thì người đọc không hiểu
 * hai chỗ đó khác gì nhau, và tự hỏi mình có đang bỏ lỡ gì không. Dòng chủ lực
 * đứng đầu bảng là đủ để nó được thấy trước.
 */
export function siteNav(
  locale: Locale,
  lines: { slug: string; heading: string; navLabel?: string; order?: number; products?: string[] }[],
  hasArticles: boolean,
  labels: { advice: string; products: string; contact: string },
  productLabel: (slug: string) => string | undefined = () => undefined,
  contactSlug?: string,
): NavItem[] {
  const ordered = [...lines].sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
  const nameOf = (l: { heading: string; navLabel?: string }) => l.navLabel ?? l.heading;

  const catalogue: NavItem = {
    label: labels.products,
    /* Mục cha vẫn là một liên kết thật, không phải một nút mở bảng. Trên cảm
       ứng không có trạng thái di chuột, và một mục menu bấm vào không đi đâu
       là chỗ người dùng bỏ cuộc. Nó trỏ về dòng đầu tiên — trang có nhiều lối
       đi tiếp nhất. */
    href: linePath(ordered[0]?.slug ?? '', locale),
    children: ordered.flatMap((l) => [
      { label: nameOf(l), href: linePath(l.slug, locale), note: 'line' },
      ...(l.products ?? []).map((slug) => ({
        label: productLabel(slug) ?? slug,
        href: productPath(slug, locale),
      })),
    ]),
  };

  return [
    ...(ordered.length ? [catalogue] : []),
    ...(hasArticles ? [{ label: labels.advice, href: adviceIndexPath(locale) }] : []),
    ...(contactSlug ? [{ label: labels.contact, href: policyPath(contactSlug, locale, true) }] : []),
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
