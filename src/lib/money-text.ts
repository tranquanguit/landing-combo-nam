import { money } from './format.ts';
export { findHandwrittenMoney, normaliseForScan } from './money-scan.ts';
import type { Locale } from '../i18n/ui.ts';

/**
 * Giá trong câu chữ được viết bằng token, không phải bằng số.
 *
 * Ba vòng liền, hàng rào "quét số tiền trong câu chữ" đều bị phá: viết
 * `990.000 VNĐ`, `777.000` không đơn vị, chữ số full-width, HTML entity, số bị
 * cắt bởi thẻ `<strong>`, zero-width space… Mỗi lần siết regex lại đẻ ra báo
 * nhầm ("gọi 1900 1000 **đồng** hành cùng bạn").
 *
 * Đổi hình dạng bài toán: người biên tập viết `{{price}}`, component thay bằng
 * số đã định dạng. Nhờ đó giá chỉ tồn tại ở đúng một nơi, và hàng rào không
 * còn phải đoán ý nghĩa của những con số trong văn xuôi.
 */
export interface PriceTokens {
  price: number;
  compareAtPrice?: number;
  currency: string;
}

export function expandMoneyTokens(text: string, p: PriceTokens, locale: Locale): string {
  const save = p.compareAtPrice ? p.compareAtPrice - p.price : 0;
  const table: Record<string, number | undefined> = {
    price: p.price,
    compareAtPrice: p.compareAtPrice,
    save: save || undefined,
  };
  return text.replace(/\{\{\s*(price|compareAtPrice|save)\s*\}\}/g, (whole, key: string) => {
    const value = table[key];
    if (value === undefined) return whole;
    return money(value, p.currency, locale);
  });
}

/** Các token hợp lệ, dùng cho thông điệp lỗi của schema. */
export const MONEY_TOKENS = ['{{price}}', '{{compareAtPrice}}', '{{save}}'] as const;

/**
 * Thay token tiền trong TOÀN BỘ dữ liệu sản phẩm, một lần, ở tầng layout.
 * Làm tập trung để không component nào có thể quên.
 */
export function expandProductTokens<T>(node: T, p: PriceTokens, locale: Locale): T {
  if (typeof node === 'string') return expandMoneyTokens(node, p, locale) as unknown as T;
  if (Array.isArray(node)) return node.map((v) => expandProductTokens(v, p, locale)) as unknown as T;
  if (node && typeof node === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node)) out[k] = expandProductTokens(v, p, locale);
    return out as T;
  }
  return node;
}
