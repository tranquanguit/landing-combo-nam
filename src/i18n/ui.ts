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
    'nav.home': 'Trang chủ',
    'nav.lines': 'Dòng sản phẩm',
    'nav.advice': 'Góc tư vấn',
    'advice.title': 'Góc tư vấn chăm sóc da | Mocha Việt Nam',
    'advice.description': 'Giải thích cơ chế của các vấn đề về da trước khi nói tới sản phẩm: nám, thâm, da dầu mụn và cách chăm sóc hằng ngày.',
    'advice.heading': 'Góc tư vấn',
    'advice.lead': 'Những bài giải thích cơ chế, viết để đọc trước khi mua chứ không phải để bán hàng.',
    'line.products': 'Sản phẩm trong dòng này',
    'line.readMore': 'Xem chi tiết',
    'line.from': 'Từ',
    'line.relatedArticles': 'Bài viết liên quan',
    'article.updated': 'Cập nhật',
    'article.readingTime': 'phút đọc',
    'article.toc': 'Nội dung bài viết',
    'faq.heading': 'Câu hỏi thường gặp',
    'article.relatedProducts': 'Sản phẩm được nhắc tới',
    'product.relatedArticles': 'Đọc thêm trước khi quyết định',
    'article.backToLine': 'Xem cả dòng sản phẩm',
    'home.linesHeading': 'Chọn theo vấn đề của da',
    'home.adviceHeading': 'Hiểu trước, chọn sau',
    'home.allProducts': 'Tất cả sản phẩm',
    'breadcrumb.label': 'Đường dẫn trang',
    'policy.heading': 'Chính sách',
    'policy.updated': 'Cập nhật ngày',
    'policy.pending': 'Phần còn phải bổ sung',
    'footer.policies': 'Chính sách',
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
    'form.optional': 'không bắt buộc khi chỉ cần tư vấn',
    'form.note': 'Ghi chú thêm (không bắt buộc)',
    'form.submit': 'Đặt mua – Giao hàng miễn phí',
    'form.total': 'Tổng tiền trả khi nhận hàng:',
    'form.success': 'Cảm ơn bạn! Đơn hàng đã được ghi nhận. Chuyên viên Mocha sẽ gọi xác nhận trong vòng 2 giờ làm việc.',
    'form.errName': 'Vui lòng nhập họ tên của bạn.',
    'form.errPhone': 'Số điện thoại chưa đúng định dạng (10 số, bắt đầu bằng 0).',
    'form.errAddress': 'Vui lòng nhập địa chỉ nhận hàng.',
    'form.errCountry': 'Vui lòng nhập quốc gia nhận hàng.',
    'form.totalNote': '(đã gồm phí giao hàng)',
    'form.noPrice': 'Miễn phí',
    'form.failed': 'Gửi đơn không thành công. Bạn vui lòng gọi',
    'form.sending': 'Đang gửi đơn…',
    'form.needsJs': 'Biểu mẫu đặt hàng cần JavaScript. Bạn vui lòng đặt qua hotline',
    'form.dataConsent': 'Tôi đồng ý để Mocha lưu và dùng họ tên, số điện thoại, địa chỉ của tôi <strong>chỉ để xác nhận và giao đơn hàng này</strong>. Tôi có thể yêu cầu xoá bất cứ lúc nào.',
    'form.selectPack': 'Chọn gói sản phẩm',
    'form.phName': 'Nguyễn Thu Hà',
    'form.phPhone': '0912 345 678',
    'form.phAddress': 'Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành',
    'form.country': 'Quốc gia nhận hàng',
    'form.noEndpoint': 'Chưa cấu hình nơi nhận đơn. Biểu mẫu này hiện không gửi đơn đi đâu — xin đặt hàng qua hotline',
    'gift.tag': 'Quà tặng',
    'testimonial.sponsored': 'Nội dung có tài trợ',
    'form.privacy': 'Thông tin chỉ dùng để xác nhận đơn và tư vấn cách dùng, không chia sẻ cho bên thứ ba.',
    'evidence.verified': 'có chứng từ trên trang',
    'evidence.study': 'theo nghiên cứu công bố',
    'evidence.survey': 'theo khảo sát nội bộ',
    'evidence.ingredient': 'suy ra từ công thức, không phải cam kết kết quả',
    'table.ingredient': 'Hoạt chất',
    'table.inProduct': 'Có trong',
    'table.role': 'Vai trò',
    'table.suitedFor': 'Phù hợp với',
    'table.source': 'nguồn',
    'legal.decree': 'Nghị định 342/2025/NĐ-CP',
    'legal.notifNumber': 'Số tiếp nhận phiếu công bố sản phẩm mỹ phẩm',
    'legal.taxId': 'Mã số thuế doanh nghiệp',
    'legal.policies': 'Chính sách đổi trả và Chính sách bảo vệ dữ liệu cá nhân',
    'footer.product': 'Thông tin sản phẩm',
    'footer.contact': 'Liên hệ',
    'footer.warning': 'Cảnh báo',
    'footer.declaredBy': 'Tổ chức công bố sản phẩm',
    'footer.functions': 'Tính năng, công dụng',
    'footer.hours': 'Giờ làm việc',
    'footer.official': 'Kênh bán chính hãng',
    'footer.profiles': 'Kênh chính thức của thương hiệu',
    'legal.storeLinks': 'đường dẫn tới từng gian hàng chính hãng — trang đang khẳng định có gian hàng nhưng chưa dẫn được về đâu',
    'consent.title': 'Đo lường truy cập',
    'consent.body': 'Chúng tôi muốn dùng cookie đo lường để biết quảng cáo nào đưa bạn tới đây. Bạn có thể từ chối mà không ảnh hưởng gì tới việc đặt hàng.',
    'consent.accept': 'Đồng ý',
    'consent.decline': 'Từ chối',
    'consent.withdraw': 'Rút lại đồng ý đo lường',
    'consent.reconsider': 'Xem lại lựa chọn đo lường',
    'todo': 'Cần bổ sung dữ liệu thật',
  },
  en: {
    'nav.order': 'Buy now',
    'nav.home': 'Home',
    'nav.lines': 'Product lines',
    'nav.advice': 'Skin guide',
    'advice.title': 'Skin guide | Mocha Vietnam',
    'advice.description': 'How common skin concerns actually work, explained before any product is mentioned: pigmentation, dark spots, oily and acne-prone skin, and daily care.',
    'advice.heading': 'Skin guide',
    'advice.lead': 'Explainers written to be read before buying, not to sell.',
    'line.products': 'Products in this line',
    'line.readMore': 'View details',
    'line.from': 'From',
    'line.relatedArticles': 'Related reading',
    'article.updated': 'Updated',
    'article.readingTime': 'min read',
    'article.toc': 'In this article',
    'faq.heading': 'Frequently asked questions',
    'article.relatedProducts': 'Products mentioned',
    'product.relatedArticles': 'Worth reading before you decide',
    'article.backToLine': 'See the full product line',
    'home.linesHeading': 'Start with your skin concern',
    'home.adviceHeading': 'Understand first, choose second',
    'home.allProducts': 'All products',
    'breadcrumb.label': 'Breadcrumb',
    'policy.heading': 'Policies',
    'policy.updated': 'Last updated',
    'policy.pending': 'Still to be completed',
    'footer.policies': 'Policies',
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
    'form.optional': 'optional if you only want advice',
    'form.note': 'Anything else (optional)',
    'form.submit': 'Request this order',
    'form.success': 'Thank you. We have your order and will call to confirm within 2 business hours.',
    'form.errName': 'Please enter your name.',
    'form.errPhone': 'Please enter a valid phone number.',
    'form.errAddress': 'Please enter a delivery address.',
    'form.errCountry': 'Please tell us which country to ship to.',
    'form.total': 'Product total:',
    'form.totalNote': '(international shipping quoted separately before payment)',
    'form.noPrice': 'No charge',
    'form.failed': 'We could not submit your order. Please call',
    'form.sending': 'Sending…',
    'form.needsJs': 'The order form needs JavaScript. Please order by phone:',
    'form.dataConsent': 'I agree that Mocha may store and use my name, phone number and address <strong>only to confirm and deliver this order</strong>. I can ask for deletion at any time.',
    'form.selectPack': 'Choose an option',
    'form.phName': 'Jane Nguyen',
    'form.phPhone': '+1 415 555 2671',
    'form.phAddress': 'Street, city, postcode',
    'form.country': 'Delivery country',
    'form.noEndpoint': 'No order endpoint is configured yet, so this form does not submit anywhere. Please order by phone:',
    'gift.tag': 'Included',
    'testimonial.sponsored': 'Sponsored content',
    'form.privacy': 'Used only to confirm your order and advise on use. Never shared with third parties.',
    'evidence.verified': 'evidence on this page',
    'evidence.study': 'from published research',
    'evidence.survey': 'from an internal survey',
    'evidence.ingredient': 'derived from the formula, not a promised outcome',
    'table.ingredient': 'Active',
    'table.inProduct': 'Found in',
    'table.role': 'What it does',
    'table.suitedFor': 'Suited to',
    'table.source': 'source',
    'legal.decree': 'Vietnamese Decree 342/2025/ND-CP',
    'legal.notifNumber': 'Cosmetic product notification number',
    'legal.taxId': 'Company tax identification number',
    'legal.policies': 'Returns policy and personal data protection policy',
    'footer.product': 'Product information',
    'footer.contact': 'Contact',
    'footer.warning': 'Warning',
    'footer.declaredBy': 'Declared by',
    'footer.functions': 'Functions',
    'footer.hours': 'Opening hours',
    'footer.official': 'Official channels',
    'footer.profiles': 'Official brand channels',
    'legal.storeLinks': 'links to each official storefront — the page claims they exist but points nowhere',
    'consent.title': 'Analytics',
    'consent.body': 'We would like to use analytics cookies to see which advert brought you here. Declining changes nothing about ordering.',
    'consent.accept': 'Accept',
    'consent.decline': 'Decline',
    'consent.withdraw': 'Withdraw analytics consent',
    'consent.reconsider': 'Review analytics choice',
    'todo': 'Real data still required',
  },
} as const;

/** Những ngôn ngữ đã có bảng chuỗi giao diện đầy đủ. */
export const translatedLocales = Object.keys(ui) as Locale[];

/**
 * Kiểm bảng dịch ĐỦ KHOÁ, không chỉ kiểm bảng có tồn tại.
 *
 * Bản trước chỉ hỏi `Object.keys(ui)` nên một bảng `th` chứa đúng một khoá cũng
 * qua được, và trang xuất ra mang lang="th-TH" với 100% nhãn giao diện tiếng Việt —
 * vì `t()` âm thầm rơi về `ui.vi`. Hàng rào và cơ chế fallback triệt tiêu nhau.
 */
export function assertTranslated(locale: Locale): void {
  const table = (ui as Record<string, Record<string, string>>)[locale];
  if (!table) {
    throw new Error(
      `Ngôn ngữ "${locale}" chưa có bảng chuỗi trong src/i18n/ui.ts.\n` +
      `Nếu xuất bản, trang sẽ mang lang="${htmlLang[locale]}" nhưng toàn bộ nhãn giao diện ` +
      `(nút, biểu mẫu, cảnh báo pháp lý) vẫn là tiếng Việt. Hãy thêm bảng chuỗi trước, ` +
      `hoặc đặt status: "draft" cho nội dung ngôn ngữ này.`
    );
  }
  const keys = Object.keys(ui.vi);
  const missing = keys.filter((k) => !(k in table));
  /* Khoá có mặt nhưng rỗng thì nhãn biến mất (nút không chữ); khoá có mặt
     nhưng vẫn y hệt tiếng Việt thì chưa dịch. Cả hai đều qua được cổng cũ. */
  const empty = keys.filter((k) => k in table && !String(table[k]).trim());
  const untranslated = locale === defaultLocale ? [] : keys.filter(
    (k) => k in table && String(table[k]).trim() && table[k] === ui.vi[k as keyof typeof ui.vi]
      // Vài chuỗi trùng nhau là bình thường (mã ngôn ngữ, ký hiệu), bỏ qua chuỗi rất ngắn.
      && String(table[k]).trim().length > 3
  );

  const problems = [
    missing.length && `thiếu ${missing.length} khoá: ${missing.join(', ')}`,
    empty.length && `${empty.length} khoá để rỗng: ${empty.join(', ')}`,
    untranslated.length && `${untranslated.length} khoá còn nguyên tiếng Việt: ${untranslated.join(', ')}`,
  ].filter(Boolean);

  if (problems.length) {
    throw new Error(
      `Bảng chuỗi "${locale}" chưa dùng được (${keys.length} khoá cần có):\n` +
      problems.map((x) => `  - ${x}`).join('\n') + '\n' +
      `Trang sẽ mang lang="${htmlLang[locale]}" nhưng những phần này hiện sai. ` +
      `Dịch nốt, hoặc đặt status: "draft" cho nội dung ngôn ngữ này.`
    );
  }
}

export function t(locale: Locale, key: keyof typeof ui.vi): string {
  const table = (ui as Record<string, Record<string, string>>)[locale] ?? ui.vi;
  return table[key] ?? ui.vi[key];
}

/**
 * Đoạn đường dẫn của chuyên mục tư vấn, dịch theo ngôn ngữ.
 *
 * Không dùng chung một đoạn tiếng Việt cho mọi ngôn ngữ: URL là nội dung, và
 * một người đọc tiếng Anh gặp /en/goc-tu-van/ thì không đọc được nó nói gì —
 * cả người lẫn máy tìm kiếm.
 */
export const ADVICE_SEGMENT: Record<Locale, string> = {
  vi: 'goc-tu-van', en: 'advice', th: 'goc-tu-van', id: 'goc-tu-van',
};

/** Đoạn đường dẫn của trang chính sách, cũng dịch theo ngôn ngữ. */
export const POLICY_SEGMENT: Record<Locale, string> = {
  vi: 'chinh-sach', en: 'policies', th: 'chinh-sach', id: 'chinh-sach',
};

/** Đường dẫn có tiền tố ngôn ngữ; tiếng Việt không prefix. */
export function localePath(locale: Locale, path = '/'): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  return locale === defaultLocale ? clean : `/${locale}${clean}`;
}
