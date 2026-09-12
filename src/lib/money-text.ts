import { money } from './format';
import type { Locale } from '../i18n/ui';

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
 * Chuẩn hoá chuỗi trước khi dò số tiền viết tay.
 *
 * Gom mọi cách né đã quan sát được về một dạng: chữ số full-width và Ả Rập,
 * HTML entity dạng số, ký tự zero-width, và thẻ HTML cắt giữa con số.
 */
export function normaliseForScan(input: string): string {
  let s = input;

  // &#57; &#x39; -> ký tự thật
  s = s.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)));
  s = s.replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)));

  // Thẻ HTML cắt giữa con số: <strong>1.950</strong><strong>.000</strong>đ
  s = s.replace(/<[^>]*>/g, '');

  // Zero-width và các khoảng trắng lạ
  s = s.replace(/[​-‍﻿⁠]/g, '');
  s = s.replace(/[   ]/g, ' ');

  // Full-width -> ASCII
  s = s.normalize('NFKC');

  // Chữ số Ả Rập, Ba Tư, Devanagari -> ASCII
  s = s.replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x0660));
  s = s.replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 0x06F0));
  s = s.replace(/[०-९]/g, (c) => String(c.charCodeAt(0) - 0x0966));

  return s;
}

/**
 * Tìm số tiền viết tay trong một chuỗi nội dung.
 *
 * Chỉ bắt những dạng KHÔNG THỂ hiểu nhầm. "gọi 1900 1000 đồng hành cùng bạn"
 * và "hơn 5 triệu phụ nữ" không phải là giá, nên đơn vị phải đứng độc lập
 * chứ không phải là âm tiết đầu của một từ khác.
 */
export function findHandwrittenMoney(raw: string): string[] {
  const s = normaliseForScan(raw);
  const hits: string[] = [];

  // 1.050.000đ | 1,050,000 ₫ | 1050000 VND | 1.140.000 VNĐ | $39.90 | 39.90 USD
  const explicit = /(\d[\d.,\s]{0,15}\d|\d)\s*(đ|₫|VNĐ|VND|USD|EUR|\$|€)(?![\p{L}])/giu;
  for (const m of s.matchAll(explicit)) hits.push(m[0].trim());

  // 990k — chỉ khi 'k' đứng riêng
  for (const m of s.matchAll(/\d+(?:[.,]\d+)?\s*k(?![\p{L}])/giu)) hits.push(m[0].trim());

  // 630 nghìn đồng | 1,2 triệu. — đơn vị lớn phải kết câu hoặc kèm "đồng",
  // để "5 triệu phụ nữ" không bị coi là giá.
  const scaled = /\d+(?:[.,]\d+)?\s*(nghìn|ngàn|triệu|tỷ)(?:\s*(?:đồng|đ|₫|VND))?(?=$|[\s]*[.,;!?)"”]|\s*$)/giu;
  for (const m of s.matchAll(scaled)) hits.push(m[0].trim());

  // $ đứng trước số
  for (const m of s.matchAll(/[$€]\s*\d[\d.,]*/g)) hits.push(m[0].trim());

  return [...new Set(hits)];
}

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
