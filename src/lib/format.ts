/** Định dạng tiền theo thói quen đọc của người Việt: 1.050.000đ */
export function money(amount: number, currency = 'VND', locale = 'vi'): string {
  if (currency === 'VND') return `${amount.toLocaleString('vi-VN')}đ`;
  return new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : locale, {
    style: 'currency', currency,
  }).format(amount);
}

/** 30/09/2026 */
export function shortDate(iso: string, locale = 'vi'): string {
  const d = new Date(iso);
  return d.toLocaleDateString(locale === 'vi' ? 'vi-VN' : locale, {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}
