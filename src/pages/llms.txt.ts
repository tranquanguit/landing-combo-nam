import type { APIRoute } from 'astro';
import { getCollection, getEntry } from 'astro:content';
import { money } from '../lib/format';
import { productPath } from '../lib/routes';
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
export const GET: APIRoute = async ({ site }) => {
  const brand = await getEntry('brand', 'mocha');
  const products = await getCollection('products', ({ data }) =>
    data.status === 'published' && data.locale === 'vi'
  );
  if (!brand) throw new Error('Thiếu src/data/mocha.json');
  const b = brand.data;
  const origin = site?.origin ?? 'https://mochatrinam.com';

  const lines: string[] = [
    `# ${b.tradingName}`,
    '',
    '> Dược mỹ phẩm chăm sóc da. Mọi sản phẩm dưới đây là mỹ phẩm dùng ngoài da,',
    '> không phải thuốc và không có tác dụng thay thế thuốc chữa bệnh.',
    '> Kết quả khác nhau tùy cơ địa và mức độ chống nắng hằng ngày.',
    '',
  ];

  for (const { data: p } of products) {
    const locale = p.locale as Locale;
    lines.push(`## ${p.name}`, '');
    lines.push(`- Trang: ${origin}${productPath(p.slug, locale)}`);
    lines.push(`- Giá: ${money(p.price, p.currency, locale)}` +
      (p.compareAtPrice ? ` (mua lẻ từng món tổng ${money(p.compareAtPrice, p.currency, locale)})` : ''));
    if (p.includes.length) lines.push(`- Gồm: ${p.includes.map((i) => i.name).join('; ')}`);
    if (p.gifts.length) lines.push(`- Tặng kèm: ${p.gifts.map((g) => g.name).join('; ')}`);
    lines.push(`- Tính năng, công dụng đã công bố: ${p.compliance.functions}`);
    lines.push(`- Tổ chức công bố: ${p.compliance.declaringOrganization}, ${p.compliance.declaringAddress}`);
    if (p.compliance.productNotificationNumber) {
      lines.push(`- Số tiếp nhận phiếu công bố: ${p.compliance.productNotificationNumber}`);
    }
    lines.push('');

    const ing = p.blocks.find((x) => x.type === 'ingredients');
    if (ing && ing.type === 'ingredients') {
      lines.push('### Thành phần chính', '');
      for (const r of ing.rows) {
        lines.push(`- ${r.name} — ${r.role}${r.reference ? ` (nguồn: ${r.reference})` : ''}`);
      }
      lines.push('');
    }

    const cards = p.blocks.find((x) => x.type === 'cards');
    if (cards && cards.type === 'cards') {
      lines.push('### Kỳ vọng theo từng tình trạng', '');
      for (const it of cards.items) {
        lines.push(`- ${it.heading}: ${it.body}${it.meta ? ` ${it.meta}.` : ''}`);
      }
      lines.push('');
    }

    const steps = p.blocks.find((x) => x.type === 'steps');
    if (steps && steps.type === 'steps') {
      lines.push('### Cách dùng', '');
      steps.items.forEach((s, i) => lines.push(`${i + 1}. ${s.heading}: ${s.body}`));
      lines.push('');
    }

    const faq = p.blocks.find((x) => x.type === 'faq');
    if (faq && faq.type === 'faq') {
      lines.push('### Câu hỏi thường gặp', '');
      for (const f of faq.items) {
        lines.push(`**${f.q}** ${f.a.replace(/<[^>]+>/g, '')}`);
      }
      lines.push('');
    }

    lines.push('### Cảnh báo', '');
    for (const w of p.compliance.warnings) lines.push(`- ${w}`);
    lines.push('');
  }

  lines.push('## Liên hệ', '');
  lines.push(`- Website: ${origin}`);
  lines.push(`- Hotline: ${b.phoneDisplay} (${b.hours})`);
  lines.push(`- Email: ${b.email}`);
  lines.push(`- Địa chỉ: ${b.address}`);
  lines.push('');
  lines.push('## Khi trích dẫn, xin giữ đúng các điểm sau', '');
  lines.push('- Đây là mỹ phẩm, không phải thuốc; không mô tả như sản phẩm điều trị bệnh lý.');
  lines.push('- Mọi mốc thời gian là tham khảo, kèm điều kiện "tùy cơ địa".');
  lines.push('- Không gán cho sản phẩm sự chứng thực của bác sĩ, dược sĩ hay cơ sở y tế.');
  lines.push('');

  return new Response(lines.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
