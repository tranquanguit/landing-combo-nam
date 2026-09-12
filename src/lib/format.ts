import { type Locale } from '../i18n/ui.ts';

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

/**
 * Ngày theo định dạng quen thuộc của từng thị trường, không bao giờ là MM/DD của Mỹ.
 *
 * Múi giờ CỐ ĐỊNH là giờ Việt Nam. Kiểm định lần 9: chuỗi "2026-09-30" được đọc
 * là nửa đêm UTC, nên máy build ở múi giờ âm in ra "29 thg 9" — hạn ưu đãi lệch
 * một ngày tuỳ vào chỗ đặt máy chạy build. `isOfferExpired` đã cẩn thận với
 * UTC+7 từ vòng trước; hàm này thì chưa.
 */
export function shortDate(iso: string, locale: Locale = 'vi'): string {
  return new Date(iso).toLocaleDateString(intlLocale[locale] ?? 'en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh',
  });
}
