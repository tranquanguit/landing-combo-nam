import type { Locale } from '../i18n/ui';

/**
 * Combo: giá, thứ tự dùng và lưu ý — TÍNH từ các món, không khai tay.
 *
 * Trang combo chỉ khai thứ của riêng nó (gồm món nào, giá bộ). Mọi con số còn lại
 * suy từ giá đang bán của từng sản phẩm, nên đổi giá một món là mọi combo chứa nó
 * tự đúng theo, và không có chỗ nào để hai con số lệch nhau.
 */

export interface ComboItem { product: string; qty: number }
export interface ComboGift { product?: string; name?: string; qty: number }
export interface PriceInfo { price: number; name: string; shortName?: string }

/** Giá mua lẻ = tổng giá đang bán × số lượng. Món không tồn tại thì DỪNG BUILD. */
export function comboPricing(
  c: { slug: string; locale: string; price: number; items: ComboItem[] },
  prices: Map<string, PriceInfo>,
) {
  const missing = c.items.filter((it) => !prices.has(it.product)).map((it) => it.product);
  if (missing.length) {
    throw new Error(
      `Combo "${c.slug}" (${c.locale}) chứa sản phẩm chưa xuất bản ở ngôn ngữ này: ${missing.join(', ')}.\n` +
      `Combo bán món không có trang thì khách bấm vào món đó sẽ gặp 404.`,
    );
  }
  const regular = c.items.reduce((s, it) => s + prices.get(it.product)!.price * it.qty, 0);
  if (c.price >= regular) {
    throw new Error(
      `Combo "${c.slug}" (${c.locale}): giá bộ ${c.price} không thấp hơn giá mua lẻ ${regular}. ` +
      `Một combo đắt hơn mua lẻ là thông tin gây hiểu nhầm.`,
    );
  }
  const save = regular - c.price;
  /* Làm tròn XUỐNG: in "giảm 14%" khi thực tế 13,9% là nói quá. */
  const pct = Math.floor((save / regular) * 100);
  return { regular, save, pct };
}

type Hint = Record<'vi' | 'en', string>;
/**
 * Thứ tự thoa khi dùng chung — quy tắc lớp chung của chăm sóc da (làm sạch → tinh chất →
 * dưỡng → chống nắng), không phải hướng dẫn riêng của từng món: cách dùng chi tiết nằm
 * ở trang sản phẩm, và combo trỏ về đó thay vì chép lại (chép lại là hai bản sẽ lệch).
 */
const STEP: Record<string, { rank: number; hint: Hint }> = {
  'bio-deep-detox-rebalance':    { rank: 10, hint: { vi: 'Buổi tối, khi da có kem chống nắng hoặc trang điểm', en: 'Evenings, when there is sunscreen or make-up on the skin' } },
  'bio-active-cleanser':         { rank: 20, hint: { vi: 'Sáng và tối', en: 'Morning and evening' } },
  'retinol-mixpeel-kit':         { rank: 30, hint: { vi: 'Liệu trình riêng 3 ngày, xem lưu ý bên dưới', en: 'A separate 3-day course, see the note below' } },
  'ultra-egf-bio-gel-mask':      { rank: 35, hint: { vi: 'Đắp sau khi làm sạch, rửa lại rồi dưỡng tiếp', en: 'After cleansing; rinse, then carry on with your routine' } },
  'smart-first-care-serum':      { rank: 40, hint: { vi: 'Sau khi làm sạch, trước kem dưỡng', en: 'After cleansing, before moisturiser' } },
  'pro-vitamin-b5-serum':        { rank: 42, hint: { vi: 'Sau khi làm sạch, trước kem dưỡng', en: 'After cleansing, before moisturiser' } },
  'smart-target-acne-gel':       { rank: 45, hint: { vi: 'Chấm lên nốt mụn đang viêm', en: 'Dab onto inflamed spots' } },
  'smart-whitening-turmergel':   { rank: 46, hint: { vi: 'Thoa lên vùng thâm đã lành', en: 'On healed marks only' } },
  'smart-brightening-cream':     { rank: 60, hint: { vi: 'Bước dưỡng, sau serum', en: 'Moisturising step, after the serum' } },
  'biovector-brightening-cream': { rank: 62, hint: { vi: 'Bước dưỡng', en: 'Moisturising step' } },
  'collagen-peptide-cream':      { rank: 64, hint: { vi: 'Bước dưỡng', en: 'Moisturising step' } },
  'uv-block-sunscreen':          { rank: 90, hint: { vi: 'Buổi sáng, bước cuối cùng', en: 'Mornings, the very last step' } },
};

export function orderedSteps(items: ComboItem[], locale: Locale) {
  const lang = locale === 'vi' ? 'vi' : 'en';
  return [...items]
    .map((it, i) => ({ ...it, rank: STEP[it.product]?.rank ?? 50 + i, hint: STEP[it.product]?.hint[lang] }))
    .sort((a, b) => a.rank - b.rank);
}

const PEEL = 'retinol-mixpeel-kit';
/** Món có hoạt chất phải tạm dừng trong đợt peel (theo trang bộ peel: quay lại từ ngày 14). */
const WAIT_DURING_PEEL = new Set([
  'smart-first-care-serum', 'smart-brightening-cream', 'smart-target-acne-gel',
  'smart-whitening-turmergel', 'biovector-brightening-cream',
]);

/** Các món phải để dành tới sau đợt peel. Rỗng = bộ không có peel hoặc không có món nào phải chờ. */
export function waitAfterPeel(items: ComboItem[]): string[] {
  if (!items.some((it) => it.product === PEEL)) return [];
  return items.map((it) => it.product).filter((s) => WAIT_DURING_PEEL.has(s));
}

export const COMBO_GROUPS = ['nam', 'toan-dien', 'mun', 'peel', 'duong', 'lam-sach', 'toc'] as const;
export type ComboGroup = (typeof COMBO_GROUPS)[number];
