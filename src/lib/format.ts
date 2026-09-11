import { type Locale } from '../i18n/ui';

const intlLocale: Record<Locale, string> = {
  vi: 'vi-VN', en: 'en-GB', th: 'th-TH', id: 'id-ID',
};

/**
 * Tiền tệ theo cách đọc của từng thị trường.
 * Người Việt đọc 1.050.000đ; người đọc tiếng Anh thấy dấu chấm là số thập phân,
 * nên bản EN phải dùng dấu phẩy và ký hiệu ₫ đặt sau.
 */
export function money(amount: number, currency = 'VND', locale: Locale = 'vi'): string {
  if (currency === 'VND') {
    return locale === 'vi'
      ? `${amount.toLocaleString('vi-VN')}đ`
      : `${amount.toLocaleString('en-GB')}₫`;
  }
  return new Intl.NumberFormat(intlLocale[locale] ?? 'en-GB', {
    style: 'currency', currency,
  }).format(amount);
}

/** Ngày theo định dạng quen thuộc của từng thị trường, không bao giờ là MM/DD của Mỹ. */
export function shortDate(iso: string, locale: Locale = 'vi'): string {
  return new Date(iso).toLocaleDateString(intlLocale[locale] ?? 'en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}
