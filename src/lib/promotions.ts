/**
 * Chương trình khuyến mãi: tính gói nào đang chạy, giá mua lẻ, mức giảm, giá trị quà.
 *
 * Một nguồn duy nhất cho ba nơi: lúc build trang (src/layouts/ProductLanding.astro),
 * máy chủ (lịch tự xuất bản khi một đợt bắt đầu / kết thúc, kiểm đơn đặt theo gói đã
 * hết hạn — server/lib/promo-server.ts) và trang quản trị (/admin/promotions). Không
 * import gì của Astro để cả ba dùng được.
 *
 * Quy tắc:
 *  - Thời điểm là một khoảnh khắc đủ múi giờ (+07:00). `endsAt` là lúc KẾT THÚC: từ
 *    thời điểm đó trở đi gói không còn hiện.
 *  - Giá mua lẻ không khai tay: cộng giá ĐANG BÁN của từng sản phẩm trong gói. Mức
 *    giảm tính trên giá đó — không tính trên "giá niêm yết" — vì đó mới là giá ngay
 *    trước khuyến mại mà khách thật sự trả.
 *  - Quà có giá trị thì in giá trị, không cộng vào "mức giảm".
 */

export type Phase = 'draft' | 'upcoming' | 'live' | 'ended';

export interface PromoGift { name: string; qty: number; value?: number }
export interface PromoPack {
  id: string; showOn: string[]; label: string; note?: string;
  items: { product: string; qty: number }[];
  price: number; gifts: PromoGift[]; recommended: boolean;
}
export interface Promotion {
  status: 'draft' | 'published'; name: string; startsAt: string; endsAt: string;
  locales: string[]; badge?: string; banner?: { text: string; href: string };
  packs: PromoPack[]; terms: string[];
  registration?: { authority: string; reference: string; date: string };
}
export interface PromoEntry { id: string; data: Promotion }
/** Giá đang bán + tên của từng sản phẩm, theo slug (đúng ngôn ngữ của trang). */
export type PriceBook = Map<string, { price: number; name: string }>;

export interface PackView {
  promoId: string; promoName: string; badge?: string; endsAt: string;
  /** Đợt còn ở trạng thái nháp — chỉ hiện trong bản demo, kèm nhãn "Bản xem thử". */
  draft: boolean;
  id: string; label: string; note?: string; recommended: boolean;
  price: number;
  /** Tổng giá mua lẻ các món trong gói, theo giá đang bán. */
  regular: number;
  save: number;
  /** Làm tròn xuống: "giảm 21%" chứ không làm tròn lên thành con số đẹp hơn sự thật. */
  savePct: number;
  /** Tổng giá trị quà (chỉ các món có khai `value`). */
  giftValue: number;
  gifts: PromoGift[];
  items: { product: string; qty: number; name: string; unitPrice: number }[];
  /** Gói chỉ là chính sản phẩm này × 1, không quà: tức là một giá bán ưu đãi. */
  unitSaleOf?: string;
  warnings: string[];
}

/** "Bây giờ" của lần build. PROMO_NOW cho phép xem trước một đợt sắp chạy (và cho bộ thử). */
export function promoNow(env: Record<string, string | undefined> = typeof process !== 'undefined' ? process.env : {}): Date {
  const v = env.PROMO_NOW;
  if (v) {
    const t = Date.parse(v);
    if (Number.isNaN(t)) throw new Error(`PROMO_NOW="${v}" không phải thời điểm hợp lệ (vd 2026-10-15T09:00:00+07:00).`);
    return new Date(t);
  }
  return new Date();
}

/**
 * `preview` = bản build demo (PUBLIC_DEMO_CONTENT=1): đợt NHÁP cũng chạy theo lịch, để
 * duyệt bố cục mọi chương trình trước khi bật thật. Bản chạy thật không bao giờ truyền
 * cờ này, nên một đợt nháp không thể lọt lên website thật.
 */
export function phase(p: Promotion, now: Date, preview = false): Phase {
  if (p.status !== 'published' && !preview) return 'draft';
  const t = now.getTime();
  if (t < Date.parse(p.startsAt)) return 'upcoming';
  if (t >= Date.parse(p.endsAt)) return 'ended';
  return 'live';
}

export const isLive = (p: Promotion, now: Date, locale?: string, preview = false) =>
  phase(p, now, preview) === 'live' && (!locale || p.locales.includes(locale));

/** Cảnh báo cho một gói. Không chặn build: đây là chỗ con người phải quyết. */
export function packWarnings(v: Pick<PackView, 'savePct' | 'giftValue' | 'regular' | 'price' | 'label'>): string[] {
  const w: string[] = [];
  if (v.savePct > 50) {
    w.push(`"${v.label}": giảm ${v.savePct}% so với giá đang bán — vượt mức 50% áp dụng cho khuyến mại giảm giá theo `
      + 'Nghị định 81/2018/NĐ-CP (đã sửa đổi, bổ sung bởi Nghị định 128/2024/NĐ-CP), trừ chương trình khuyến mại tập trung. Kiểm lại trước khi chạy.');
  }
  if (v.regular > 0 && v.giftValue > v.regular * 0.5) {
    w.push(`"${v.label}": quà trị giá ${Math.floor((v.giftValue / v.regular) * 100)}% giá trị hàng mua — vượt mức 50% thường áp dụng `
      + 'cho hình thức tặng hàng. Kiểm lại trước khi chạy.');
  }
  if (v.price >= v.regular && v.giftValue === 0) {
    w.push(`"${v.label}": giá gói không thấp hơn mua lẻ và không có quà khai giá trị — khách không được lợi gì so với mua thường.`);
  }
  return w;
}

export function promoWarnings(p: Promotion): string[] {
  return p.registration ? [] : [
    'Chưa ghi số thông báo thực hiện khuyến mại gửi Sở Công Thương (trường "registration"). Phần lớn hình thức khuyến mại phải thông báo trước khi chạy.',
  ];
}

export function viewPack(entry: PromoEntry, pack: PromoPack, prices: PriceBook): PackView {
  const items = pack.items.map((it) => {
    const p = prices.get(it.product);
    if (!p) throw new Error(`Khuyến mãi "${entry.id}", gói "${pack.id}": không có sản phẩm "${it.product}" đang bán ở ngôn ngữ này.`);
    return { ...it, name: p.name, unitPrice: p.price };
  });
  const regular = items.reduce((s, it) => s + it.unitPrice * it.qty, 0);
  const save = Math.max(0, regular - pack.price);
  const savePct = regular > 0 ? Math.floor((save / regular) * 100) : 0;
  const giftValue = pack.gifts.reduce((s, g) => s + (g.value ?? 0) * g.qty, 0);
  const unitSaleOf = items.length === 1 && items[0].qty === 1 && pack.gifts.length === 0 ? items[0].product : undefined;
  const view: PackView = {
    promoId: entry.id, promoName: entry.data.name, badge: entry.data.badge, endsAt: entry.data.endsAt,
    draft: entry.data.status !== 'published',
    id: pack.id, label: pack.label, note: pack.note, recommended: pack.recommended,
    price: pack.price, regular, save, savePct, giftValue, gifts: pack.gifts, items, unitSaleOf, warnings: [],
  };
  view.warnings = packWarnings(view);
  return view;
}

/** Các gói đang chạy hiện trên trang sản phẩm `slug`. Đợt kết thúc muộn nhất xếp trước. */
export function packsFor(slug: string, locale: string, promos: PromoEntry[], prices: PriceBook, now: Date, preview = false): PackView[] {
  return promos
    .filter((e) => isLive(e.data, now, locale, preview))
    .flatMap((e) => e.data.packs.filter((pk) => pk.showOn.includes(slug)).map((pk) => viewPack(e, pk, prices)));
}

/** Tập đợt đang chạy — đổi thì website phải build lại. */
export function liveSignature(promos: PromoEntry[], now: Date): string {
  return promos.filter((e) => isLive(e.data, now)).map((e) => e.id).sort().join(',');
}

/** Lần tới tập đợt đang chạy sẽ đổi (bắt đầu hoặc kết thúc), để lịch biết lúc nào cần build. */
export function nextBoundary(promos: PromoEntry[], now: Date): Date | null {
  const t = now.getTime();
  const pts = promos.filter((e) => e.data.status === 'published')
    .flatMap((e) => [Date.parse(e.data.startsAt), Date.parse(e.data.endsAt)]).filter((x) => x > t).sort((a, b) => a - b);
  return pts.length ? new Date(pts[0]) : null;
}

/**
 * "23:59, 11/10/2026" theo giờ Việt Nam — giờ in trên trang là giờ của người bán.
 * `end`: thời điểm kết thúc là mốc loại trừ, nên lùi 1 giây — endsAt 00:00 ngày 12
 * in thành 23:59 ngày 11, đúng cách người đọc hiểu "đến hết ngày 11".
 */
export function vnDateTime(iso: string, locale = 'vi', end = false): string {
  const d = new Date(Date.parse(iso) - (end ? 1000 : 0));
  const f = new Intl.DateTimeFormat(locale === 'vi' ? 'vi-VN' : 'en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric', hour12: false,
  }).formatToParts(d);
  const g = (k: string) => f.find((x) => x.type === k)?.value ?? '';
  return `${g('hour')}:${g('minute')}, ${g('day')}/${g('month')}/${g('year')}`;
}

/** Ngày kết thúc (giờ VN) dạng YYYY-MM-DD — cho priceValidUntil của JSON-LD. */
export function vnLastDay(iso: string): string {
  const d = new Date(Date.parse(iso) - 1000 + 7 * 3600_000);
  return d.toISOString().slice(0, 10);
}
