/**
 * Khuyến mãi phía máy chủ: đọc các đợt từ CSDL, tự build lại website đúng lúc một đợt
 * bắt đầu hoặc kết thúc, và đánh dấu đơn đặt theo gói khuyến mãi không còn chạy.
 *
 * Website là trang tĩnh: giá trên trang là giá lúc build. Nên "khuyến mãi tự bật / tự
 * tắt" nghĩa là: máy chủ nhìn tập đợt ĐANG CHẠY mỗi phút; khác với tập đợt của lần xuất
 * bản thành công gần nhất (lưu ở app_settings, khoá 'promo-signature') thì xuất bản lại.
 * Chậm nhất ~1 phút + thời gian build (1–2 phút) sau mốc giờ.
 */
import type { Sql } from './db.ts';
import { liveSignature, isLive, nextBoundary, type PromoEntry, type PriceBook } from '../../src/lib/promotions.ts';

export async function loadPromos(sql: Sql): Promise<PromoEntry[]> {
  const rows = (await sql.query<{ entry_id: string; data: any }>(
    "SELECT entry_id, data FROM content_entries WHERE collection = 'promotions' ORDER BY entry_id")).rows;
  return rows.map((r) => ({ id: r.entry_id, data: { locales: ['vi'], terms: [], ...r.data,
    packs: (r.data.packs ?? []).map((p: any) => ({ recommended: false, ...p, gifts: (p.gifts ?? []).map((g: any) => ({ qty: 1, ...g })) })) } }));
}

export async function priceBook(sql: Sql, locale = 'vi'): Promise<PriceBook> {
  const rows = (await sql.query<{ entry_id: string; data: any }>(
    "SELECT entry_id, data FROM content_entries WHERE collection = 'products' AND entry_id LIKE $1", [`%/${locale}`])).rows;
  return new Map(rows.filter((r) => r.data?.status === 'published')
    .map((r) => [r.data.slug, { price: r.data.price, name: r.data.shortName ?? r.data.name }]));
}

const KEY = 'promo-signature';
export async function storedSignature(sql: Sql): Promise<string | null> {
  const r = (await sql.query<{ value: any }>('SELECT value FROM app_settings WHERE key = $1', [KEY])).rows[0];
  return r ? String(r.value?.sig ?? '') : null;
}
/** Gọi khi một lần xuất bản THÀNH CÔNG: ghi tập đợt mà bản build đó đã dùng. */
export async function saveSignature(sql: Sql, sig: string, by: string) {
  await sql.query(
    `INSERT INTO app_settings (key, value, updated_by) VALUES ($1, $2::text::jsonb, $3)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now(), updated_by = EXCLUDED.updated_by`,
    [KEY, JSON.stringify({ sig, at: new Date().toISOString() }), by]);
}

export interface SchedulerDeps {
  publish: (by: string) => Promise<{ ok: boolean }>;
  isPublishing: () => boolean;
  log: (s: string) => void;
  now?: () => Date;
}
/**
 * Một nhịp của lịch. Tách khỏi setInterval để bộ thử gọi thẳng được.
 * Trả về lý do để log/bộ thử đọc: 'same' | 'busy' | 'backoff' | 'published' | 'failed'.
 */
let lastAttempt: { sig: string; at: number } | null = null;
export async function schedulerTick(sql: Sql, deps: SchedulerDeps): Promise<string> {
  const now = (deps.now ?? (() => new Date()))();
  const sig = liveSignature(await loadPromos(sql), now);
  const stored = await storedSignature(sql);
  if (stored === sig || (stored === null && sig === '')) return 'same';
  if (deps.isPublishing()) return 'busy';
  /* Build lỗi thì không thử lại liên tục: 15 phút một lần cho cùng một tập đợt. */
  if (lastAttempt && lastAttempt.sig === sig && now.getTime() - lastAttempt.at < 15 * 60_000) return 'backoff';
  lastAttempt = { sig, at: now.getTime() };
  deps.log(`lịch khuyến mãi: đợt đang chạy đổi từ [${stored ?? '?'}] sang [${sig}] — xuất bản lại`);
  const r = await deps.publish('lich-khuyen-mai');
  return r.ok ? 'published' : 'failed';
}
export const _resetScheduler = () => { lastAttempt = null; };

export function startPromoScheduler(sql: Sql, deps: SchedulerDeps, everyMs = 60_000) {
  const t = setInterval(() => {
    schedulerTick(sql, deps).catch((e) => console.error('promo_scheduler_failed', (e as Error).message));
  }, everyMs);
  t.unref();
  return () => clearInterval(t);
}

export async function nextChange(sql: Sql, now = new Date()) {
  return nextBoundary(await loadPromos(sql), now);
}

/**
 * Sau khi nhận một đơn: gói khách chọn là gói khuyến mãi mà lúc này KHÔNG còn chạy
 * (trang mở từ hôm qua, hoặc bản cũ còn trong bộ nhớ đệm), hoặc giá gửi lên khác giá
 * gói → ghi cảnh báo vào ghi chú nội bộ của đơn để nhân viên báo đúng giá khi gọi.
 * Không từ chối đơn: khách đã điền xong, việc của mình là gọi lại cho đúng.
 */
export async function annotatePromoOrder(sql: Sql, orderCode: string, body: { pack?: string; packPrice?: unknown; productSlug?: string }, now = new Date()) {
  if (!body.pack || !body.productSlug) return null;
  const promos = await loadPromos(sql);
  for (const e of promos) {
    const pk = e.data.packs.find((p) => p.label === body.pack && p.showOn.includes(String(body.productSlug)));
    if (!pk) continue;
    let note: string | null = null;
    if (!isLive(e.data, now)) note = `⚠ Gói khuyến mãi "${pk.label}" (${e.data.name}) không còn chạy lúc đặt — báo khách giá hiện hành.`;
    else if (body.packPrice !== undefined && body.packPrice !== '' && Number(body.packPrice) !== pk.price) note = `⚠ Giá gửi lên khác giá gói "${pk.label}" — kiểm lại khi gọi xác nhận.`;
    if (note) {
      await sql.query("UPDATE orders SET staff_note = CASE WHEN staff_note IS NULL OR staff_note = '' THEN $1 ELSE staff_note || ' | ' || $1 END WHERE order_code = $2", [note, orderCode]);
    }
    return note;
  }
  return null;
}
