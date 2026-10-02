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
    'nav.products': 'Sản phẩm',
    'nav.contact': 'Liên hệ',
    'nav.menu': 'Danh mục',
    'nav.advice': 'Góc tư vấn',
    'advice.title': 'Góc tư vấn chăm sóc da | Mocha Việt Nam',
    'advice.description': 'Giải thích cơ chế của các vấn đề về da trước khi nói tới sản phẩm: nám, thâm, da dầu mụn và cách chăm sóc hằng ngày.',
    'advice.heading': 'Góc tư vấn',
    'advice.lead': 'Những bài giải thích cơ chế, viết để đọc trước khi mua chứ không phải để bán hàng.',
    'nav.choose': 'Chọn mua',
    'line.choose': 'Chọn theo tình trạng của bạn',
    'line.chooseLead': 'Ba lựa chọn này không hơn kém nhau. Chúng khác nhau ở chỗ hợp với ai.',
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
    'compare.scrollHint': 'Vuốt ngang để xem hết bảng',
    'article.backToLine': 'Xem cả dòng sản phẩm',
    'home.linesHeading': 'Chọn theo vấn đề của da',
    'home.adviceHeading': 'Hiểu trước, chọn sau',
    'home.allProducts': 'Tất cả sản phẩm',
    'breadcrumb.label': 'Đường dẫn trang',
    'policy.heading': 'Chính sách',
    'policy.updated': 'Cập nhật ngày',
    'policy.pending': 'Phần còn phải bổ sung',
    'footer.about': 'Về chúng tôi',
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
    'form.success': 'Đã ghi nhận đơn của bạn. Chuyên viên Mocha gọi xác nhận trong vòng 2 giờ làm việc; sau khi bạn xác nhận, hàng đi trong 2–5 ngày tuỳ khu vực và bạn mở kiểm tra rồi mới trả tiền. Chưa trừ tiền ở bước này.',
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
    'form.soldOut': 'Sản phẩm này đang tạm hết hàng nên biểu mẫu tạm khoá. Gọi hotline để được báo khi có hàng lại',
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
    'table.activeCount': 'hoạt chất',
    'chat.open': 'Hỏi Mocha',
    'chat.teaser': 'Cần tư vấn da? Hỏi ngay',
    'chat.title': 'Mocha tư vấn',
    'chat.status': 'Chuyên viên và trợ lý trả lời trong giờ làm việc',
    'chat.greeting': 'Chào bạn! Mình có thể giúp bạn chọn sản phẩm theo tình trạng da, giải thích thành phần, hoặc hướng dẫn đặt hàng. Bạn có thể gửi kèm ảnh vùng da cần tư vấn.',
    'chat.suggest1': 'Da tôi bị nám, nên bắt đầu từ đâu?',
    'chat.suggest2': 'Giá combo nám bao nhiêu?',
    'chat.suggest3': 'Gửi ảnh da để được tư vấn',
    'chat.placeholder': 'Nhập câu hỏi…',
    'chat.send': 'Gửi',
    'chat.attach': 'Đính kèm ảnh',
    'chat.removeImage': 'Bỏ ảnh',
    'chat.close': 'Đóng',
    'chat.new': 'Cuộc trò chuyện mới',
    'chat.typing': 'Đang trả lời',
    'chat.retry': 'Gửi lại',
    'chat.error': 'Chưa gửi được tin nhắn. Kiểm tra kết nối rồi bấm Gửi lại.',
    'chat.viewProduct': 'Xem chi tiết',
    'chat.orderProduct': 'Đặt hàng',
    'chat.outOfStock': 'Tạm hết hàng',
    'chat.imagesSent': 'ảnh',
    'chat.imageTooBig': 'Ảnh quá lớn hoặc không đọc được. Chọn ảnh khác nhé.',
    'chat.maxImages': 'Tối đa 3 ảnh mỗi lần gửi.',
    'chat.notice': 'Đừng gửi số CCCD, mật khẩu hay số thẻ. Ảnh chỉ dùng để tư vấn, không lưu trên website. Cuộc trò chuyện được lưu 90 ngày để chuyên viên hỗ trợ.',
    'chat.privacy': 'Chính sách dữ liệu',
    'chat.you': 'Bạn',
    'fx.printed': 'In trên bao bì',
    'fx.motto': 'Cái nào có số thì ghi số',
    'fx.inBox': 'Trong hộp có gì',
    'fx.step': 'Bước',
    'fx.essential': 'Không được bỏ',
    'fx.skin.surface': 'Mặt da',
    'fx.skin.epidermis': 'Biểu bì',
    'fx.skin.dermis': 'Trung bì',
    'fx.skin.pigment': 'Tế bào sinh sắc tố',
    'fx.allActives': 'Xem đủ vai trò từng hoạt chất',
    'fx.keyActive': 'Hoạt chất chính',
    'fx.thisProduct': 'Sản phẩm trên trang này',
    'fx.statDoses': 'nồng độ hoạt chất in trên bao bì',
    'fx.statProducts': 'sản phẩm, cùng một cách ghi nhãn',
    'docs.eyebrow': 'Giấy tờ',
    'docs.heading': 'Giấy tờ đi kèm sản phẩm',
    'docs.intro': 'Bản chụp giấy tờ gốc, đủ rõ để đọc số hiệu. Bấm vào từng giấy để xem bản đầy đủ.',
    'docs.view': 'Xem bản đầy đủ',
    'docs.close': 'Đóng',
    'docs.watermark': 'Hiển thị tại mochatrinam.com',
    'docs.lot': 'Lô',
    'docs.kind.notification': 'Phiếu công bố',
    'docs.kind.test-report': 'Phiếu kiểm nghiệm',
    'docs.kind.gmp': 'Chứng nhận nhà máy',
    'docs.kind.business': 'Giấy tờ pháp nhân',
    'docs.kind.trademark': 'Nhãn hiệu',
    'docs.kind.patent': 'Bằng sáng chế hoạt chất',
    'docs.kind.other': 'Giấy tờ khác',
    'docs.pageTitle': 'Giấy tờ và chứng nhận',
    'docs.pageLead': 'Toàn bộ giấy tờ Mocha đang công khai: phiếu công bố từng sản phẩm và phiếu kết quả thử nghiệm. Mỗi giấy ghi rõ cơ quan cấp và ngày cấp.',
    'docs.forProduct': 'Áp dụng cho',
    'docs.allProducts': 'Mọi sản phẩm',
    'nav.docs': 'Chứng nhận',
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
    'nav.products': 'Products',
    'nav.contact': 'Contact',
    'nav.menu': 'Menu',
    'nav.advice': 'Skin guide',
    'advice.title': 'Skin guide | Mocha Vietnam',
    'advice.description': 'How common skin concerns actually work, explained before any product is mentioned: pigmentation, dark spots, oily and acne-prone skin, and daily care.',
    'advice.heading': 'Skin guide',
    'advice.lead': 'Explainers written to be read before buying, not to sell.',
    'nav.choose': 'Choose',
    'line.choose': 'Choose by your situation',
    'line.chooseLead': 'The three options below differ in who they suit, not in which one is better.',
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
    'compare.scrollHint': 'Swipe sideways to see the whole table',
    'article.backToLine': 'See the full product line',
    'home.linesHeading': 'Start with your skin concern',
    'home.adviceHeading': 'Understand first, choose second',
    'home.allProducts': 'All products',
    'breadcrumb.label': 'Breadcrumb',
    'policy.heading': 'Policies',
    'policy.updated': 'Last updated',
    'policy.pending': 'Still to be completed',
    'footer.about': 'About us',
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
    'form.success': 'We have your order. An adviser calls to confirm within 2 business hours; once you confirm, delivery takes 2–5 days depending on the area and you inspect the parcel before paying. Nothing is charged at this step.',
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
    'form.soldOut': 'This product is temporarily out of stock, so the form is disabled. Call us to be told when it is back',
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
    'table.activeCount': 'actives',
    'chat.open': 'Ask Mocha',
    'chat.teaser': 'Skin question? Ask us',
    'chat.title': 'Mocha advice',
    'chat.status': 'Our team and assistant reply during business hours',
    'chat.greeting': 'Hi! I can help you pick a product for your skin, explain ingredients, or walk you through ordering. You can attach a photo of the area you want advice on.',
    'chat.suggest1': 'I have melasma — where do I start?',
    'chat.suggest2': 'How much is the melasma set?',
    'chat.suggest3': 'Send a skin photo for advice',
    'chat.placeholder': 'Type your question…',
    'chat.send': 'Send',
    'chat.attach': 'Attach photo',
    'chat.removeImage': 'Remove photo',
    'chat.close': 'Close',
    'chat.new': 'New conversation',
    'chat.typing': 'Typing',
    'chat.retry': 'Resend',
    'chat.error': 'Message not sent. Check your connection and tap Resend.',
    'chat.viewProduct': 'View details',
    'chat.orderProduct': 'Order',
    'chat.outOfStock': 'Out of stock',
    'chat.imagesSent': 'photo(s)',
    'chat.imageTooBig': 'That photo is too large or unreadable. Please pick another.',
    'chat.maxImages': 'Up to 3 photos per message.',
    'chat.notice': 'Do not send ID numbers, passwords or card numbers. Photos are used only for advice and are not stored on this website. Conversations are kept for 90 days so our team can help.',
    'chat.privacy': 'Data policy',
    'chat.you': 'You',
    'fx.printed': 'Printed on the pack',
    'fx.motto': 'If it has a number, we print it',
    'fx.inBox': "What's in the box",
    'fx.step': 'Step',
    'fx.essential': 'Never skip',
    'fx.skin.surface': 'Skin surface',
    'fx.skin.epidermis': 'Epidermis',
    'fx.skin.dermis': 'Dermis',
    'fx.skin.pigment': 'Pigment-making cells',
    'fx.allActives': 'See what each active does',
    'fx.keyActive': 'Key active',
    'fx.thisProduct': 'On this page',
    'fx.statDoses': 'active concentrations printed on packs',
    'fx.statProducts': 'products, labelled the same way',
    'docs.eyebrow': 'Documents',
    'docs.heading': 'The paperwork behind this product',
    'docs.intro': 'Scans of the original documents, sharp enough to read the reference numbers. Tap any document to see it in full.',
    'docs.view': 'View full document',
    'docs.close': 'Close',
    'docs.watermark': 'Shown on mochatrinam.com',
    'docs.lot': 'Batch',
    'docs.kind.notification': 'Product notification',
    'docs.kind.test-report': 'Test report',
    'docs.kind.gmp': 'Factory certificate',
    'docs.kind.business': 'Company registration',
    'docs.kind.trademark': 'Trademark',
    'docs.kind.patent': 'Ingredient patent',
    'docs.kind.other': 'Other document',
    'docs.pageTitle': 'Documents and certificates',
    'docs.pageLead': 'Every document Mocha publishes: product notifications and test reports, each showing who issued it and when.',
    'docs.forProduct': 'Applies to',
    'docs.allProducts': 'All products',
    'nav.docs': 'Certificates',
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
/** Trang tổng giấy tờ và chứng nhận. */
export const DOCS_SEGMENT: Record<Locale, string> = {
  vi: 'chung-nhan', en: 'certificates', th: 'chung-nhan', id: 'chung-nhan',
};

export const POLICY_SEGMENT: Record<Locale, string> = {
  vi: 'chinh-sach', en: 'policies', th: 'chinh-sach', id: 'chinh-sach',
};

/** Đường dẫn có tiền tố ngôn ngữ; tiếng Việt không prefix. */
/**
 * Tiền tố đường dẫn con khi site không chạy ở gốc tên miền (bản xem thử trên
 * GitHub Pages). Astro tự thêm tiền tố cho tài nguyên nó sinh ra, nhưng KHÔNG
 * đụng vào chuỗi href do chính mình viết — nên phải thêm ở đây, nơi duy nhất
 * mọi đường dẫn nội bộ đi qua.
 *
 * `?.` để hàm này vẫn chạy được khi bị import từ script node trần (các bộ thử),
 * nơi `import.meta.env` không tồn tại.
 */
const BASE = ((import.meta as any).env?.BASE_URL ?? '/').replace(/\/$/, '');

export function localePath(locale: Locale, path = '/'): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  const withLocale = locale === defaultLocale ? clean : `/${locale}${clean}`;
  return `${BASE}${withLocale}`;
}
