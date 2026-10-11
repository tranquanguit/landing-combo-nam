/**
 * Chọn lời chứng được phép hiện trên một trang.
 *
 * Production: chỉ lời `published` + `consent.status = "written"` + phạm vi có "website".
 * Demo (PUBLIC_DEMO_CONTENT=1 — bản xem thử chạy trên máy, tự gắn noindex): hiện thêm
 * lời đang chờ đồng ý (`pending`), mỗi thẻ dán nhãn "Mẫu demo — chưa có văn bản đồng ý",
 * để duyệt bố cục trước khi đi xin đồng ý. Lời bị từ chối (`refused`) không bao giờ hiện.
 */
export interface Voice {
  id: string;
  quote: string; display: string; detail?: string; channel: string;
  receivedAt?: string; productVersion?: string; sponsored: boolean;
  /** true = chỉ hiện vì đang ở chế độ demo, chưa có văn bản đồng ý. */
  demo: boolean;
}

export function isDemoBuild(env: Record<string, string | undefined>): boolean {
  return env.PUBLIC_DEMO_CONTENT === '1';
}

export function voicesFor(slug: string, locale: string, entries: { id: string; data: any }[], demo: boolean, limit = 6): Voice[] {
  return entries
    .filter(({ data: d }) => d.status === 'published' && d.locale === locale && d.products.includes(slug))
    .filter(({ data: d }) => (d.consent.status === 'written' && d.consent.scope.includes('website'))
      || (demo && d.consent.status === 'pending'))
    .sort((a, b) => (b.data.receivedAt ?? '').localeCompare(a.data.receivedAt ?? '') || a.id.localeCompare(b.id))
    .slice(0, limit)
    .map(({ id, data: d }) => ({
      id, quote: d.quote, display: d.person.display, detail: d.person.detail, channel: d.channel,
      receivedAt: d.receivedAt, productVersion: d.productVersion, sponsored: d.sponsored,
      demo: d.consent.status !== 'written',
    }));
}
