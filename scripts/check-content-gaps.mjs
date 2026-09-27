/**
 * Những gì còn THIẾU để trang nói thật được nhiều hơn.
 *
 *   node --experimental-strip-types scripts/check-content-gaps.mjs
 *   node --experimental-strip-types scripts/check-content-gaps.mjs --md docs/content-gaps.md
 *
 * Tệp này SINH RA từ dữ liệu thật, không phải gõ tay. Một danh sách thiếu sót
 * gõ tay thì đúng đúng một ngày: hôm sau có người bổ sung ảnh mà quên xoá dòng,
 * và từ đó không ai tin danh sách nữa.
 *
 * Nguyên tắc xuyên suốt: KHÔNG bịa. Thiếu chứng từ thì khối chứng từ không
 * render, thiếu đồng ý thì lời chứng không lên trang, và chỗ trống được ghi vào
 * đây kèm đúng thứ cần để lấp — chứ không lấp bằng ảnh mẫu hay chữ tạm.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';

const args = process.argv.slice(2);
const mdIndex = args.indexOf('--md');
const mdPath = mdIndex >= 0 ? args[mdIndex + 1] : null;

const DIR = 'src/content/products';
const LOCALES = ['vi', 'en'];
const gaps = [];
let seq = 0;
const add = (g) => gaps.push({ id: `CG-${String(++seq).padStart(3, '0')}`, ...g });

const load = (slug, loc) => {
  const f = `${DIR}/${slug}/${loc}.json`;
  return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null;
};
const slugs = readdirSync(DIR);

/* ---------- 1. Số tiếp nhận phiếu công bố ---------- */
const noNumber = [];
const numbers = new Map();
for (const slug of slugs) {
  const p = load(slug, 'vi');
  if (!p || p.status !== 'published') continue;
  const n = p.compliance?.productNotificationNumber;
  if (!n) noNumber.push(slug);
  else numbers.set(slug, n);
}
if (noNumber.length) {
  add({
    kind: 'chứng từ pháp lý',
    product: noNumber.join(', '),
    field: 'compliance.productNotificationNumber',
    need: 'Số tiếp nhận Phiếu công bố sản phẩm mỹ phẩm của từng sản phẩm',
    why: 'Đây là dữ kiện pháp lý người mua Việt Nam tra cứu được, và là bằng chứng mạnh nhất một trang mỹ phẩm đưa ra được mà không cần hứa gì. Thiếu nó, trang chỉ còn lời của người bán.',
    format: 'Chuỗi đúng như in trên phiếu, ví dụ 1234/25/CBMP-XX',
    placement: 'compliance ở chân trang, llms.txt, và khối chứng từ khi có ảnh',
    requiredFor: 'trust · ad-readiness',
    status: `thiếu ở ${noNumber.length}/${slugs.length} sản phẩm`,
  });
}

/* Hai sản phẩm dùng CHUNG một số là chuyện cần người xác nhận, không phải lỗi. */
const byNumber = new Map();
for (const [slug, n] of numbers) {
  if (!byNumber.has(n)) byNumber.set(n, []);
  byNumber.get(n).push(slug);
}
for (const [n, list] of byNumber) {
  if (list.length > 1) {
    add({
      kind: 'xác nhận pháp lý',
      product: list.join(', '),
      field: 'compliance.productNotificationNumber',
      need: `Xác nhận số ${n} dùng chung cho ${list.length} trang là đúng`,
      why: 'Một bộ gồm nhiều sản phẩm mà chỉ dẫn số công bố của MỘT thành phần là công bố thiếu. Có thể đúng (nếu bộ được công bố dưới số đó) — nhưng phải do doanh nghiệp xác nhận, không phải do trang suy đoán.',
      format: 'Xác nhận bằng văn bản, hoặc số công bố riêng cho từng thành phần',
      placement: 'compliance của từng sản phẩm trong bộ',
      requiredFor: 'trust · compliance',
      status: 'cần chủ doanh nghiệp xác nhận',
    });
  }
}

/* ---------- 2. Ảnh chứng từ ---------- */
const docDir = 'src/assets/documents';
const docCount = existsSync(docDir) ? readdirSync(docDir).length : 0;
const usesDocs = slugs.some((s) => {
  const p = load(s, 'vi');
  return p?.blocks?.some((b) => b.type === 'documents');
});
if (docCount === 0) {
  add({
    kind: 'ảnh chứng từ',
    product: 'toàn site',
    field: 'khối blocks[].type = "documents"',
    need: 'Ảnh chụp hoặc bản quét phiếu công bố / phiếu kiểm nghiệm / chứng nhận cơ sở sản xuất',
    why: `Khối "documents" đã có sẵn trong schema và đã có component, nhưng ${usesDocs ? 'chưa có ảnh nào' : 'KHÔNG sản phẩm đã xuất bản nào dùng'} — nên tầng bằng chứng mạnh nhất của trang hiện không tồn tại trên màn hình.`,
    format: 'PDF hoặc ảnh gốc, đọc được số hiệu; cạnh dài ≥ 1600px; giữ đúng tỉ lệ giấy',
    placement: 'src/assets/documents/, khai trong khối documents ở vai trò proof',
    requiredFor: 'trust · conversion',
    status: `${docCount} tệp trong ${docDir}`,
  });
}

/* ---------- 3. Đồng ý cho ảnh và lời chứng ---------- */
for (const slug of slugs) {
  for (const loc of LOCALES) {
    const p = load(slug, loc);
    if (!p || p.status !== 'published') continue;
    for (const b of p.blocks ?? []) {
      if ((b.type === 'gallery' || b.type === 'testimonials') && b.consent?.obtained !== true) {
        add({
          kind: 'văn bản đồng ý',
          product: `${slug} (${loc})`,
          field: `blocks[].type = "${b.type}" → consent.obtained`,
          need: b.type === 'gallery'
            ? 'Văn bản đồng ý của khách cho việc đăng ảnh, kèm điều kiện chụp'
            : 'Văn bản đồng ý của khách cho việc đăng tên, tuổi, nơi ở kèm lời chứng',
          why: 'Khối đang bị ẩn hoàn toàn khỏi trang vì chưa có đồng ý — đúng hành vi, nhưng nghĩa là trang không có bằng chứng xã hội nào. Không được thay bằng nội dung bịa.',
          format: b.type === 'gallery'
            ? 'Bản ký (ảnh/PDF) + ghi rõ cùng đèn, cùng góc, cùng mức trang điểm'
            : 'Bản ký (ảnh/PDF) cho từng người, nêu rõ phạm vi sử dụng',
          placement: `${slug}/${loc}.json, khối ${b.type}`,
          requiredFor: 'trust · conversion',
          status: 'consent.obtained = false → khối không render',
        });
      }
    }
  }
}

/* ---------- 4. Lệch cấu trúc giữa hai ngôn ngữ ---------- */
for (const slug of slugs) {
  const vi = load(slug, 'vi');
  const en = load(slug, 'en');
  if (!vi || !en) continue;
  const key = (b) => b.type + (b.id ? '#' + b.id : '');
  const viKeys = new Set((vi.blocks ?? []).map(key));
  const enKeys = new Set((en.blocks ?? []).map(key));
  const onlyVi = [...viKeys].filter((k) => !enKeys.has(k));
  const onlyEn = [...enKeys].filter((k) => !viKeys.has(k));
  if (onlyVi.length || onlyEn.length) {
    add({
      kind: 'lệch bản dịch',
      product: slug,
      field: 'blocks[]',
      need: `Quyết định xem ${[...onlyVi, ...onlyEn].join(', ')} có nên tồn tại ở cả hai ngôn ngữ không`,
      why: 'Cùng một sản phẩm đang kể hai cấu trúc khác nhau ở hai ngôn ngữ. Hiện các khối lệch đều là khối chưa có đồng ý nên không render — nhưng ngày có đồng ý, một bản sẽ có bằng chứng còn bản kia thì không.',
      format: 'Bản dịch của khối, hoặc xác nhận khối chỉ dành cho một thị trường',
      placement: `${slug}/en.json`,
      requiredFor: 'trust',
      status: `chỉ có ở vi: ${onlyVi.join(', ') || 'không'} | chỉ có ở en: ${onlyEn.join(', ') || 'không'}`,
    });
  }
}

/* ---------- 5. Bối cảnh quảng cáo ---------- */
const noAd = slugs.filter((s) => { const p = load(s, 'vi'); return p?.status === 'published' && !p.adContext; });
if (noAd.length) {
  add({
    kind: 'dữ liệu vận hành',
    product: noAd.join(', '),
    field: 'adContext',
    need: 'Khai bối cảnh quảng cáo cho các sản phẩm còn lại',
    why: 'Không có adContext thì không đối chiếu được lời quảng cáo với nội dung trang, và người tiếp theo phải đoán trang này được dựng để đón ý định nào.',
    format: 'Theo schema adContext trong src/content.config.ts',
    placement: `${DIR}/<slug>/<locale>.json`,
    requiredFor: 'ad-readiness',
    status: `thiếu ở ${noAd.length} sản phẩm`,
  });
}

/* ---------- in ra ---------- */
console.log(`\nThiếu sót nội dung — ${gaps.length} mục\n`);
for (const g of gaps) {
  console.log(`  ${g.id}  [${g.kind}] ${g.product}`);
  console.log(`         cần: ${g.need}`);
  console.log(`         cho: ${g.requiredFor}   trạng thái: ${g.status}`);
}
console.log('');

if (mdPath) {
  const L = [];
  L.push('# Thiếu sót nội dung — những gì cần chủ doanh nghiệp cung cấp');
  L.push('');
  L.push('> Sinh tự động bằng `npm run docs:gaps`. Đừng sửa tay — bổ sung dữ liệu thật');
  L.push('> rồi chạy lại, mục tương ứng sẽ tự biến mất.');
  L.push(`> Quét ngày ${new Date().toISOString().slice(0, 10)}.`);
  L.push('');
  L.push('## Nguyên tắc');
  L.push('');
  L.push('Không mục nào dưới đây được lấp bằng nội dung tạm. Cụ thể, nền tảng này');
  L.push('**không** tạo chứng nhận giả, không dựng thẻ chứng từ rỗng, không gắn huy');
  L.push('hiệu "đã xác minh" khi chưa xác minh, và không viết lời chứng thay khách.');
  L.push('Thiếu dữ liệu thì khối tương ứng **không render** — trang im lặng về điều nó');
  L.push('không chứng minh được, thay vì nói to về điều nó không có.');
  L.push('');
  L.push('| Mã | Loại | Sản phẩm | Cần cho | Trạng thái |');
  L.push('| --- | --- | --- | --- | --- |');
  for (const g of gaps) {
    L.push(`| ${g.id} | ${g.kind} | ${g.product} | ${g.requiredFor} | ${g.status} |`);
  }
  L.push('');
  for (const g of gaps) {
    L.push(`## ${g.id} — ${g.need}`);
    L.push('');
    L.push(`- **Loại:** ${g.kind}`);
    L.push(`- **Sản phẩm:** ${g.product}`);
    L.push(`- **Trường:** \`${g.field}\``);
    L.push(`- **Vì sao cần:** ${g.why}`);
    L.push(`- **Định dạng:** ${g.format}`);
    L.push(`- **Đặt ở đâu:** ${g.placement}`);
    L.push(`- **Bắt buộc cho:** ${g.requiredFor}`);
    L.push(`- **Trạng thái hiện tại:** ${g.status}`);
    L.push('');
  }
  const CR = String.fromCharCode(13), LF = String.fromCharCode(10);
  let body = L.join(LF) + LF;
  if (existsSync(mdPath) && readFileSync(mdPath, 'utf8').includes(CR + LF)) body = body.split(LF).join(CR + LF);
  const { writeFileSync } = await import('node:fs');
  writeFileSync(mdPath, body);
  console.log(`  Đã ghi ${mdPath}\n`);
}
