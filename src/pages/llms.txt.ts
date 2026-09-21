import type { APIRoute } from 'astro';
import { getCollection, getEntry } from 'astro:content';
import { money } from '../lib/format';
import { expandProductTokens } from '../lib/money-text';
import { adviceIndexPath, articlePath, homePath, linePath, policyPath, productPath } from '../lib/routes';
import { plainText } from '../lib/richtext';
import type { Locale } from '../i18n/ui';

/**
 * llms.txt được SINH TỪ DỮ LIỆU, không viết tay.
 *
 * Bản viết tay trước đây đã lệch khỏi nội dung trang: nó vẫn quảng cáo bằng tên và
 * chức danh bác sĩ (điều Nghị định 342/2025 cấm) và vẫn dùng ngôn ngữ claim y tế,
 * nhiều tuần sau khi những thứ đó đã bị gỡ khỏi giao diện. Sinh tự động là cách duy
 * nhất để một file dành cho máy đọc không nói khác với trang mà con người đọc.
 *
 * Lưu ý: tính tới 2026 gần như không nhà cung cấp AI nào đọc llms.txt. File này
 * là phụ lục rẻ tiền, không phải chiến lược. Thứ thực sự có tác dụng là dữ kiện
 * nằm trong HTML render sẵn.
 */

/**
 * Nhãn theo ngôn ngữ của trang được mô tả.
 *
 * Kiểm định lần 7: robots.txt quảng cáo file này là "song ngữ" trong khi mọi
 * nhãn đều hardcode tiếng Việt — trợ lý AI hỏi bằng tiếng Anh nhận nội dung Anh
 * gói trong khung Việt.
 */
const L = {
  vi: {
    lang: 'Ngôn ngữ trang', page: 'Trang', price: 'Giá', bundlePrice: 'giá niêm yết',
    includes: 'Gồm', gifts: 'Tặng kèm', functions: 'Tính năng, công dụng đã công bố',
    declaredBy: 'Tổ chức công bố', notification: 'Số tiếp nhận phiếu công bố',
    ingredients: 'Thành phần chính', source: 'nguồn', expectations: 'Kỳ vọng theo từng tình trạng',
    howTo: 'Cách dùng', faq: 'Câu hỏi thường gặp', warnings: 'Cảnh báo', suitedFor: 'Phù hợp với',
    lineProducts: 'Sản phẩm trong dòng', published: 'Đăng ngày', updated: 'Cập nhật',
  },
  en: {
    lang: 'Page language', page: 'Page', price: 'Price', bundlePrice: 'list price',
    includes: 'Includes', gifts: 'Free gifts', functions: 'Declared functions',
    declaredBy: 'Declared by', notification: 'Cosmetic product notification number',
    ingredients: 'Key ingredients', source: 'source', expectations: 'What to expect, by condition',
    howTo: 'How to use', faq: 'Frequently asked questions', warnings: 'Warnings', suitedFor: 'Suited to',
    lineProducts: 'Products in this line', published: 'Published', updated: 'Updated',
  },
} as const;
const lab = (loc: Locale) => (loc === 'vi' ? L.vi : L.en);

export const GET: APIRoute = async ({ site }) => {
  const brand = await getEntry('brand', 'mocha');
  /* Mọi ngôn ngữ, không chỉ tiếng Việt. Kiểm định lần 6: bản EN bị lọc ra, nên
     một trợ lý AI hỏi bằng tiếng Anh không thấy trang tiếng Anh tồn tại. */
  const all = await getCollection('products', ({ data }) => data.status === 'published');
  const lineEntries = await getCollection('lines', ({ data }) => data.status === 'published');
  const articleEntries = await getCollection('articles', ({ data }) => data.status === 'published');
  const policyEntries = await getCollection('policies', ({ data }) => data.status === 'published');
  const products = all.sort((a, b2) =>
    a.data.slug === b2.data.slug
      ? (a.data.locale === 'vi' ? -1 : 1)
      : a.data.slug.localeCompare(b2.data.slug));
  if (!brand) throw new Error('Thiếu src/data/mocha.json');
  const b = brand.data;
  const origin = site?.origin ?? 'https://mochatrinam.com';

  const lines: string[] = [
    `# ${b.tradingName}`,
    '',
    /* Song ngữ ngay ở khung tài liệu. Kiểm định lần 8: nhãn trong khối sản phẩm
       đã dịch nhưng tuyên bố tuân thủ quan trọng nhất ("không phải thuốc") vẫn
       chỉ có tiếng Việt — trợ lý AI hỏi bằng tiếng Anh không đọc được nó. */
    '> Dược mỹ phẩm chăm sóc da. Mọi sản phẩm dưới đây là mỹ phẩm dùng ngoài da,',
    '> không phải thuốc và không có tác dụng thay thế thuốc chữa bệnh.',
    '> Kết quả khác nhau tùy cơ địa và mức độ chống nắng hằng ngày.',
    '>',
    '> Skincare cosmetics. Every product below is a topical cosmetic product.',
    '> It is not a medicine and is not a substitute for medical treatment.',
    '> Results vary with skin type and daily sun protection.',
    '',
  ];

  for (const entry of products) {
    /* Thay token giá: llms.txt không đi qua layout nên trước đây in nguyên văn
       {{price}} cho máy đọc — đúng thứ file này sinh ra để tránh. */
    const p = expandProductTokens(entry.data, {
      price: entry.data.price,
      compareAtPrice: entry.data.compareAtPrice,
      currency: entry.data.currency,
    }, entry.data.locale as Locale);
    const locale = p.locale as Locale;
    lines.push(`## ${p.name}${locale === 'vi' ? '' : ` (${locale.toUpperCase()})`}`, '');
    const x = lab(locale);
    lines.push(`- ${x.lang}: ${locale === 'vi' ? 'tiếng Việt' : 'English'}`);
    lines.push(`- ${x.page}: ${origin}${productPath(p.slug, locale)}`);
    lines.push(`- ${x.price}: ${money(p.price, p.currency, locale)}` +
      (p.compareAtPrice ? ` (${x.bundlePrice} ${money(p.compareAtPrice, p.currency, locale)})` : ''));
    if (p.includes.length) lines.push(`- ${x.includes}: ${p.includes.map((i) => plainText(i.name)).join('; ')}`);
    if (p.gifts.length) lines.push(`- ${x.gifts}: ${p.gifts.map((g) => plainText(g.name)).join('; ')}`);
    lines.push(`- ${x.functions}: ${plainText(p.compliance.functions)}`);
    lines.push(`- ${x.declaredBy}: ${p.compliance.declaringOrganization}, ${p.compliance.declaringAddress}`);
    if (p.compliance.productNotificationNumber) {
      lines.push(`- ${x.notification}: ${p.compliance.productNotificationNumber}`);
    }
    lines.push('');

    const ing = p.blocks.find((x) => x.type === 'ingredients');
    if (ing && ing.type === 'ingredients') {
      lines.push(`### ${x.ingredients}`, '');
      for (const r of ing.rows) {
        /* referenceNote là cảnh báo nồng độ ("nghiên cứu dùng 5%, cao hơn sản
           phẩm này"). Kiểm định lần 8: bản trước in link trần mà bỏ ghi chú —
           trang người đọc nói thật, file máy đọc nói nửa sự thật, đúng chỗ tệ
           nhất vì đây là file sinh ra để được trích dẫn. */
        lines.push(
          `- ${plainText(r.name)} — ${plainText(r.role)}` +
          (r.suitedFor ? ` ${x.suitedFor}: ${plainText(r.suitedFor)}.` : '') +
          (r.reference ? ` (${x.source}: ${r.reference}` +
            (r.referenceNote ? ` — ${plainText(r.referenceNote)}` : '') + ')' : '')
        );
      }
      lines.push('');
    }

    const cards = p.blocks.find((x) => x.type === 'cards');
    if (cards && cards.type === 'cards') {
      lines.push(`### ${x.expectations}`, '');
      for (const it of cards.items) {
        lines.push(`- ${plainText(it.heading)}: ${plainText(it.body)}${it.meta ? ` ${plainText(it.meta)}.` : ''}`);
      }
      lines.push('');
    }

    const steps = p.blocks.find((x) => x.type === 'steps');
    if (steps && steps.type === 'steps') {
      lines.push(`### ${x.howTo}`, '');
      steps.items.forEach((s, i) => lines.push(`${i + 1}. ${plainText(s.heading)}: ${plainText(s.body)}`));
      lines.push('');
    }

    const faq = p.blocks.find((x) => x.type === 'faq');
    if (faq && faq.type === 'faq') {
      lines.push(`### ${x.faq}`, '');
      for (const f of faq.items) {
        // plainText: bản trước dùng replace(/<[^>]+>/g,'') — đúng regex mà richtext.ts
        // đã loại bỏ vì nuốt văn bản giữa dấu < và >, và không giải mã entity.
        lines.push(`**${plainText(f.q)}** ${plainText(f.a)}`);
      }
      lines.push('');
    }

    lines.push(`### ${x.warnings}`, '');
    for (const w of p.compliance.warnings) lines.push(`- ${plainText(w)}`);
    lines.push('');
  }

  /* Trang chủ, trang dòng và bài tư vấn cũng phải có mặt.
     Một file dành cho máy đọc chỉ liệt kê trang bán hàng sẽ khiến trợ lý AI
     tưởng website chỉ có bấy nhiêu — trong khi phần trả lời được câu hỏi của
     người dùng lại nằm ở các bài tư vấn. */
  const homeLocales = [...new Set(all.map((e) => e.data.locale as Locale))];
  lines.push('## Trang chủ / Home', '');
  for (const loc of homeLocales) lines.push(`- ${origin}${homePath(loc)} (${loc})`);
  lines.push('');

  for (const entry of lineEntries) {
    const d = entry.data;
    const locale = d.locale as Locale;
    const x = lab(locale);
    lines.push(`## ${d.heading}${locale === 'vi' ? '' : ` (${locale.toUpperCase()})`}`, '');
    lines.push(`- ${x.lang}: ${locale === 'vi' ? 'tiếng Việt' : 'English'}`);
    lines.push(`- ${x.page}: ${origin}${linePath(d.slug, locale)}`);
    lines.push(`- ${plainText(d.lead)}`);
    const inLine = d.products.length
      ? d.products
      : all.filter((p) => p.data.locale === locale && p.data.line === d.slug).map((p) => p.data.slug);
    if (inLine.length) {
      lines.push(`- ${x.lineProducts}: ${inLine.map((sl) => `${origin}${productPath(sl, locale)}`).join(', ')}`);
    }
    lines.push('');
    for (const sec of d.sections) {
      lines.push(`### ${plainText(sec.heading)}`, '');
      for (const para of sec.body) lines.push(plainText(para));
      lines.push('');
    }
    if (d.faq.length) {
      lines.push(`### ${x.faq}`, '');
      for (const f of d.faq) lines.push(`**${plainText(f.q)}** ${plainText(f.a)}`);
      lines.push('');
    }
  }

  const adviceLocales = [...new Set(articleEntries.map((e) => e.data.locale as Locale))];
  for (const loc of adviceLocales) {
    lines.push(`## ${loc === 'vi' ? 'Góc tư vấn' : 'Skin guide'} (${loc})`, '');
    lines.push(`- ${lab(loc).page}: ${origin}${adviceIndexPath(loc)}`);
    lines.push('');
  }

  for (const entry of articleEntries) {
    const d = entry.data;
    const locale = d.locale as Locale;
    const x = lab(locale);
    lines.push(`## ${d.title}${locale === 'vi' ? '' : ` (${locale.toUpperCase()})`}`, '');
    lines.push(`- ${x.lang}: ${locale === 'vi' ? 'tiếng Việt' : 'English'}`);
    lines.push(`- ${x.page}: ${origin}${articlePath(d.slug, locale)}`);
    lines.push(`- ${x.published}: ${d.publishedAt}` + (d.updatedAt ? ` — ${x.updated}: ${d.updatedAt}` : ''));
    lines.push(`- ${plainText(d.lead)}`);
    lines.push('');
    for (const sec of d.sections) {
      lines.push(`### ${plainText(sec.heading)}`, '');
      for (const para of sec.body) lines.push(plainText(para));
      lines.push('');
    }
    if (d.faq.length) {
      lines.push(`### ${x.faq}`, '');
      for (const f of d.faq) lines.push(`**${plainText(f.q)}** ${plainText(f.a)}`);
      lines.push('');
    }
  }

  /* Chính sách phải có mặt: trợ lý AI thường được hỏi đúng những câu này —
     "đổi trả thế nào", "họ lưu dữ liệu của tôi bao lâu". Trả lời sai vì không
     đọc được chính sách còn tệ hơn là không trả lời. */
  for (const entry of policyEntries) {
    const d = entry.data;
    const locale = d.locale as Locale;
    const x = lab(locale);
    lines.push(`## ${d.title}${locale === 'vi' ? '' : ` (${locale.toUpperCase()})`}`, '');
    lines.push(`- ${x.page}: ${origin}${policyPath(d.slug, locale, d.topLevel)}`);
    lines.push(`- ${x.updated}: ${d.updatedAt}`);
    lines.push(`- ${plainText(d.lead)}`);
    lines.push('');
    for (const sec of d.sections) {
      lines.push(`### ${plainText(sec.heading)}`, '');
      for (const para of sec.body) lines.push(plainText(para));
      lines.push('');
    }
  }

  lines.push('## Liên hệ / Contact', '');
  lines.push(`- Website: ${origin}`);
  lines.push(`- Hotline: ${b.phoneDisplay} (${b.hours})`);
  lines.push(`- Email: ${b.email}`);
  lines.push(`- Địa chỉ: ${b.address}`);
  lines.push('');
  // Nói thẳng những gì trang chưa có. Một file dành cho máy đọc mà im lặng về
  // các khoảng trống sẽ khiến trợ lý AI giới thiệu sai năng lực của website.
  const gaps: string[] = [];
  if (!import.meta.env.PUBLIC_ORDER_ENDPOINT) {
    gaps.push('Website hiện KHÔNG nhận đơn hàng trực tuyến. Biểu mẫu đặt hàng chưa được kết nối. ' +
      `Cách đặt hàng duy nhất là gọi ${b.phoneDisplay}.`);
  }
  if (products.some((x) => !x.data.compliance.productNotificationNumber)) {
    gaps.push('Chưa công bố số tiếp nhận phiếu công bố sản phẩm mỹ phẩm trên website.');
  }
  if (!b.taxId) gaps.push('Chưa công bố mã số thuế doanh nghiệp trên website.');
  if (b.marketplaces.some((m) => !m.url)) {
    gaps.push('Website có nhắc tới gian hàng chính hãng trên sàn thương mại điện tử ' +
      'nhưng chưa cung cấp đường dẫn tới các gian hàng đó.');
  }
  if (gaps.length) {
    lines.push('## Những gì website này CHƯA có / What this website does NOT have yet', '');
    for (const g of gaps) lines.push(`- ${g}`);
    lines.push('');
  }

  lines.push('## Khi trích dẫn, xin giữ đúng các điểm sau / When citing, please keep these accurate', '');
  lines.push('- Đây là mỹ phẩm, không phải thuốc; không mô tả như sản phẩm điều trị bệnh lý.');
  lines.push('- Mọi mốc thời gian là tham khảo, kèm điều kiện "tùy cơ địa".');
  lines.push('- Không gán cho sản phẩm sự chứng thực của bác sĩ, dược sĩ hay cơ sở y tế.');
  lines.push('- This is a cosmetic product, not a medicine; do not describe it as treating a condition.');
  lines.push('- Every timeframe is indicative and depends on individual skin.');
  lines.push('- Do not attribute endorsement by any doctor, pharmacist or medical facility.');
  lines.push('');

  return new Response(lines.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
