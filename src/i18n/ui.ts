export const locales = ['vi', 'en', 'th', 'id'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'vi';

/** Ngôn ngữ khai trong thẻ html và hreflang. */
export const htmlLang: Record<Locale, string> = {
  vi: 'vi-VN', en: 'en', th: 'th-TH', id: 'id-ID',
};

export const ui = {
  vi: {
    'nav.order': 'Đặt mua',
    'nav.skip': 'Bỏ qua điều hướng, đến nội dung chính',
    'cta.call': 'Gọi tư vấn',
    'cta.order': 'Đặt hàng',
    'price.from': 'Giá niêm yết',
    'price.now': 'Giá ưu đãi',
    'price.save': 'Tiết kiệm',
    'offer.validUntil': 'Ưu đãi áp dụng đến hết',
    'form.name': 'Họ và tên',
    'form.phone': 'Số điện thoại',
    'form.address': 'Địa chỉ nhận hàng',
    'form.note': 'Ghi chú thêm (không bắt buộc)',
    'form.submit': 'Đặt mua – Giao hàng miễn phí',
    'form.success': 'Cảm ơn bạn! Đơn hàng đã được ghi nhận. Chuyên viên Mocha sẽ gọi xác nhận trong vòng 2 giờ làm việc.',
    'form.errName': 'Vui lòng nhập họ tên của bạn.',
    'form.errPhone': 'Số điện thoại chưa đúng định dạng (10 số, bắt đầu bằng 0).',
    'form.errAddress': 'Vui lòng nhập địa chỉ nhận hàng.',
    'form.privacy': 'Thông tin chỉ dùng để xác nhận đơn và tư vấn cách dùng, không chia sẻ cho bên thứ ba.',
    'footer.product': 'Thông tin sản phẩm',
    'footer.contact': 'Liên hệ',
    'footer.warning': 'Cảnh báo',
    'footer.declaredBy': 'Tổ chức công bố sản phẩm',
    'footer.functions': 'Tính năng, công dụng',
    'footer.hours': 'Giờ làm việc',
    'todo': 'Cần bổ sung dữ liệu thật',
  },
  en: {
    'nav.order': 'Buy now',
    'nav.skip': 'Skip to main content',
    'cta.call': 'Talk to us',
    'cta.order': 'Order',
    'price.from': 'List price',
    'price.now': 'Offer price',
    'price.save': 'You save',
    'offer.validUntil': 'Offer valid through',
    'form.name': 'Full name',
    'form.phone': 'Phone number',
    'form.address': 'Delivery address',
    'form.note': 'Anything else (optional)',
    'form.submit': 'Place order – Free delivery',
    'form.success': 'Thank you. We have your order and will call to confirm within 2 business hours.',
    'form.errName': 'Please enter your name.',
    'form.errPhone': 'Please enter a valid phone number.',
    'form.errAddress': 'Please enter a delivery address.',
    'form.privacy': 'Used only to confirm your order and advise on use. Never shared with third parties.',
    'footer.product': 'Product information',
    'footer.contact': 'Contact',
    'footer.warning': 'Warning',
    'footer.declaredBy': 'Declared by',
    'footer.functions': 'Functions',
    'footer.hours': 'Opening hours',
    'todo': 'Real data still required',
  },
} as const;

export function t(locale: Locale, key: keyof typeof ui.vi): string {
  const table = (ui as Record<string, Record<string, string>>)[locale] ?? ui.vi;
  return table[key] ?? ui.vi[key];
}

/** Đường dẫn có tiền tố ngôn ngữ; tiếng Việt không prefix. */
export function localePath(locale: Locale, path = '/'): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  return locale === defaultLocale ? clean : `/${locale}${clean}`;
}
