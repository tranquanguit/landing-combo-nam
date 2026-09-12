/**
 * Bộ thử ĐI QUA SCHEMA, không gọi thẳng hàm trong src/lib.
 *
 * Kiểm định lần 12 chỉ ra lỗ kiến trúc lớn nhất của bộ thử: cả năm file test
 * đều gọi trực tiếp `src/lib/*`, nên MỌI lỗi ở tầng nối dây trong
 * `content.config.ts` là vô hình. Đó là lý do cửa hậu `reviewedClaims` sống
 * sót ba vòng kiểm định liền trong khi 203 ca vẫn xanh: không một ca nào chạy
 * qua chỗ nó ở.
 *
 * Mỗi ca ở đây là một tài liệu sản phẩm hoàn chỉnh, đi qua đúng schema mà
 * `npm run build` dùng.
 */
import { collections } from '../src/content.config.ts';

const schema = collections.products.schema;

/** Sản phẩm hợp lệ tối giản, dùng làm nền cho mọi ca. */
const base = () => ({
  slug: 'san-pham-thu',
  locale: 'vi',
  translationKey: 'san-pham-thu',
  status: 'published',
  name: 'Sản phẩm thử',
  sku: 'TEST-1',
  price: 390000,
  seo: { title: 'Sản phẩm thử Mocha', description: 'Mô tả ngắn, trung thực, không hứa kết quả.' },
  compliance: {
    declaringOrganization: 'Công ty Dược Mỹ Phẩm Mocha Việt Nam',
    declaringAddress: 'TP.HCM',
    functions: 'hỗ trợ làm mờ vùng da sạm màu',
    warnings: ['Mỹ phẩm dùng ngoài da, không phải thuốc và không có tác dụng thay thế thuốc chữa bệnh.'],
  },
  blocks: [
    {
      type: 'hero',
      heading: 'Hai bước chăm sóc da sạm màu',
      lead: 'Kem và serum dùng cùng nhau.',
      usp: [{ text: 'Công thức công khai tỉ lệ', evidence: 'ingredient' }],
      image: { src: '/images/packshot-combo.webp', alt: 'Ảnh sản phẩm' },
      primaryCta: 'Đặt mua',
    },
    { type: 'order', heading: 'Đặt hàng', body: 'Gọi hotline để đặt.', points: ['Miễn phí vận chuyển'] },
  ],
});

/** Sửa tài liệu nền rồi trả về. */
const withDoc = (fn) => { const d = base(); fn(d); return d; };

const CASES = [
  // --- phải ĐẠT ---
  { name: 'sản phẩm hợp lệ tối giản', doc: base(), expect: 'pass' },
  {
    name: 'bản nháp thiếu khối order',
    doc: withDoc((d) => { d.status = 'draft'; d.blocks = [d.blocks[0]]; }),
    expect: 'pass',
  },
  {
    name: 'hotline doanh nghiệp trong văn xuôi',
    doc: withDoc((d) => { d.blocks[1].body = 'Gọi 0367 848 918 để đặt hàng.'; }),
    expect: 'pass',
  },
  {
    name: 'giá viết bằng token',
    doc: withDoc((d) => { d.blocks[1].body = 'Combo giá {{price}}, tiết kiệm {{save}}.'; }),
    expect: 'pass',
  },

  // --- phải CHẶN ---
  {
    name: 'không còn cửa hậu reviewedClaims',
    doc: withDoc((d) => {
      d.compliance.reviewedClaims = [{
        text: 'Combo này xoá nám vĩnh viễn và được bác sĩ da liễu khuyên dùng mỗi tối.',
        reason: 'Đã duyệt nội bộ, có văn bản.',
      }];
      d.blocks[0].lead = 'Combo này xoá nám vĩnh viễn và được bác sĩ da liễu khuyên dùng mỗi tối.';
    }),
    expect: 'fail',
  },
  {
    name: 'tuyên bố bị cấm trong văn xuôi',
    doc: withDoc((d) => { d.blocks[1].body = 'Kem điều trị nám tận gốc sau 2 tuần.'; }),
    expect: 'fail',
  },
  {
    name: 'tuyên bố bị cấm viết không dấu',
    doc: withDoc((d) => { d.blocks[1].body = 'Kem tri nam tan goc sau 2 tuan.'; }),
    expect: 'fail',
  },
  {
    name: 'tuyên bố bị cấm viết sai dấu',
    doc: withDoc((d) => { d.blocks[1].body = 'Kem điều trị nạm tận gốc.'; }),
    expect: 'fail',
  },
  {
    name: 'số tiền viết tay trong văn xuôi',
    doc: withDoc((d) => { d.blocks[1].body = 'Combo chỉ 990 nghìn đồng thôi.'; }),
    expect: 'fail',
  },
  {
    name: 'dữ liệu cá nhân ngoài khối có consent',
    doc: withDoc((d) => {
      d.blocks.push({
        type: 'cards', heading: 'Khách nói gì',
        items: [{ heading: 'Chia sẻ', body: 'Chị Nguyễn Thu Hà, 38 tuổi, gọi 0912 345 678.' }],
      });
    }),
    expect: 'fail',
  },
  {
    name: 'thiếu khối order khi đã xuất bản',
    doc: withDoc((d) => { d.blocks = [d.blocks[0]]; }),
    expect: 'fail',
  },
  {
    name: 'hai khối trùng id',
    doc: withDoc((d) => {
      d.blocks.push({ type: 'faq', id: 'dat-hang', heading: 'Hỏi đáp', items: [{ q: 'Câu hỏi?', a: 'Trả lời.' }] });
    }),
    expect: 'fail',
  },
  {
    name: 'neo trỏ tới khối không tồn tại',
    doc: withDoc((d) => { d.blocks[0].secondaryCta = { label: 'Xem thành phần', href: '#thanh-phan' }; }),
    expect: 'fail',
  },
  {
    name: 'neo trỏ tới khối bị cổng consent ẩn',
    doc: withDoc((d) => {
      d.blocks[0].secondaryCta = { label: 'Xem kết quả', href: '#hieu-qua' };
      d.blocks.push({
        type: 'gallery', heading: 'Trước và sau',
        consent: { obtained: false, statement: 'Chưa thu thập được văn bản đồng ý.' },
        images: [{ src: '/images/packshot-combo.webp', alt: 'Ảnh' }],
      });
    }),
    expect: 'fail',
  },
  {
    name: 'scheme javascript: trong source',
    doc: withDoc((d) => { d.blocks[0].usp[0] = { text: 'A', evidence: 'verified', source: 'javascript:alert(1)' }; }),
    expect: 'fail',
  },
  {
    /* Ca này phải fail vì `.strict()`, KHÔNG vì thiếu trường bắt buộc.
       Kiểm định lần 13: bản trước dùng { question, a } — thiếu `q` nên nó fail
       bằng invalid_type dù có .strict() hay không, tức mutation sống sót. */
    name: 'khoá lạ trong faq.items (.strict)',
    doc: withDoc((d) => {
      d.blocks.push({
        type: 'faq', heading: 'Hỏi đáp',
        items: [{ q: 'Câu hỏi?', a: 'Trả lời.', cauTraLoi: 'khoá lạ' }],
      });
    }),
    expect: 'fail',
    expectCode: 'unrecognized_keys',
  },
  {
    name: 'khoá lạ trong ingredients.rows (.strict)',
    doc: withDoc((d) => {
      d.blocks.push({
        type: 'ingredients', heading: 'Thành phần',
        rows: [{ name: 'Niacinamide 1%', role: 'Hỗ trợ làm sáng', suitedFor: 'Mọi loại da',
          referenceNotee: 'khoá gõ sai' }],
      });
    }),
    expect: 'fail',
    expectCode: 'unrecognized_keys',
  },
  {
    name: 'khoá lạ trong cards.items (.strict)',
    doc: withDoc((d) => {
      d.blocks.push({
        type: 'cards', heading: 'Phân loại',
        items: [{ heading: 'Nám mảng', body: 'Mô tả.', metaa: 'khoá gõ sai' }],
      });
    }),
    expect: 'fail',
    expectCode: 'unrecognized_keys',
  },
  {
    name: 'khoá lạ ở cấp sản phẩm (.strict)',
    doc: withDoc((d) => { d.ghiChu = 'khoá lạ'; }),
    expect: 'fail',
    expectCode: 'unrecognized_keys',
  },
  {
    name: 'evidence survey thiếu qualifier',
    doc: withDoc((d) => { d.blocks[0].usp[0] = { text: '9/10 người thấy da sáng hơn', evidence: 'survey' }; }),
    expect: 'fail',
  },
  {
    name: 'hai khối order',
    doc: withDoc((d) => { d.blocks.push({ ...d.blocks[1] }); }),
    expect: 'fail',
  },
  {
    /* Hai cổng cùng phủ ca này: superRefine của `problem.quotes` (thông báo lỗi
       rõ hơn) và phép quét dữ liệu cá nhân ở cấp sản phẩm. Mutation testing cho
       thấy tắt cổng thứ nhất thì cổng thứ hai vẫn bắt — dư thừa có chủ đích,
       không phải ca đạt vì lý do sai. */
    name: 'danh tính trong khối problem bị chặn (hai cổng)',
    doc: withDoc((d) => {
      d.blocks.push({
        type: 'problem', heading: 'Vấn đề',
        quotes: ['Chị Hà bảo da tôi sạm hẳn sau sinh'],
        explainer: { heading: 'Vì sao', body: ['Nội tiết và nắng.'] },
      });
    }),
    expect: 'fail',
  },
  {
    name: 'seo.description quá 170 ký tự',
    doc: withDoc((d) => { d.seo.description = 'x'.repeat(171); }),
    expect: 'fail',
  },
  {
    name: 'compliance.warnings rỗng',
    doc: withDoc((d) => { d.compliance.warnings = []; }),
    expect: 'fail',
  },
  {
    name: 'neo secondaryCta sai định dạng',
    doc: withDoc((d) => { d.blocks[0].secondaryCta = { label: 'Xem', href: 'thanh-phan' }; }),
    expect: 'fail',
  },
  {
    name: 'gõ sai tên trường trong compliance',
    doc: withDoc((d) => { d.compliance.productNotificationNumbe = '123'; }),
    expect: 'fail',
  },
  {
    name: 'evidence khai verified mà không có source',
    doc: withDoc((d) => { d.blocks[0].usp[0] = { text: 'A', evidence: 'verified' }; }),
    expect: 'fail',
  },
  {
    name: 'hai gói cùng recommended',
    doc: withDoc((d) => {
      d.variants = [
        { label: 'Gói A', price: 390000, recommended: true },
        { label: 'Gói B', price: 290000, recommended: true },
      ];
    }),
    expect: 'fail',
  },
  {
    name: 'availability khác InStock khi chưa có giao diện hết hàng',
    doc: withDoc((d) => { d.availability = 'OutOfStock'; }),
    expect: 'fail',
  },
  {
    name: 'slug sai định dạng',
    doc: withDoc((d) => { d.slug = 'San Pham Thu'; }),
    expect: 'fail',
  },
];

let bad = 0;
for (const c of CASES) {
  const r = schema.safeParse(c.doc);
  const got = r.success ? 'pass' : 'fail';
  /* Fail ĐÚNG LÝ DO: một ca fail vì thiếu trường bắt buộc không chứng minh gì
     về cổng nó nhắm tới — kiểm định lần 13 tìm thấy đúng một ca như vậy. */
  if (got === 'fail' && c.expectCode &&
      !r.error.issues.some((i) => i.code === c.expectCode)) {
    bad++;
    console.error(`  LÝ DO SAI  ${c.name} — mong "${c.expectCode}", ` +
      `nhận ${JSON.stringify(r.error.issues.map((i) => i.code))}`);
    continue;
  }
  if (got !== c.expect) {
    bad++;
    const why = r.success ? '(qua schema, đáng ra phải chặn)' :
      `(bị chặn: ${r.error.issues[0]?.message?.slice(0, 90)})`;
    console.error(`  SAI   ${c.name} — mong ${c.expect}, nhận ${got} ${why}`);
  }
}
console.log(`  ${CASES.length - bad}/${CASES.length} ca đúng ` +
            `(${CASES.filter((c) => c.expect === 'fail').length} phải chặn, ` +
            `${CASES.filter((c) => c.expect === 'pass').length} phải cho qua)`);
process.exit(bad ? 1 : 0);
