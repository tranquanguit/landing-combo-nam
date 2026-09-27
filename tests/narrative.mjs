/**
 * Cổng QA cấu trúc câu chuyện.
 *
 * Nó KHÔNG chấm thẩm mỹ. Mọi phép đo ở đây đếm được và lặp lại được; thứ gì
 * cần mắt người thì để cho mắt người, vì một luật thẩm mỹ chặn build là luật
 * sẽ bị tắt đi trong vòng một tuần.
 *
 * Phép đo quan trọng nhất là ĐA DẠNG CHUỖI: nếu mọi sản phẩm lại trôi về cùng
 * một trình tự vai, nền tảng đã quay về đúng chỗ xuất phát và không ai nhận ra
 * bằng cách đọc mã. Lúc kiểm định, 10 trên 12 sản phẩm dùng chung đúng một
 * chuỗi khối.
 *
 * Chạy: node --experimental-strip-types tests/narrative.mjs
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { roleOf, REQUIRED_ROLES, ARCHETYPE_BEATS } from '../src/lib/narrative.ts';

const DIR = 'src/content/products';
const LOCALES = ['vi', 'en'];

let pass = 0;
const fail = [];
const warn = [];
const ok = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ĐẠT  ${name.padEnd(56)} ${detail}`); }
  else { fail.push(`${name} — ${detail}`); console.log(`  LỖI  ${name.padEnd(56)} ${detail}`); }
};
const note = (name, detail) => {
  warn.push(`${name} — ${detail}`);
  console.log(`  LƯU Ý ${name.padEnd(55)} ${detail}`);
};

const pages = [];
for (const slug of readdirSync(DIR)) {
  for (const locale of LOCALES) {
    const f = `${DIR}/${slug}/${locale}.json`;
    if (!existsSync(f)) continue;
    const p = JSON.parse(readFileSync(f, 'utf8'));
    if (p.status !== 'published') continue;
    pages.push({ slug, locale, p, roles: p.blocks.map(roleOf) });
  }
}

console.log(`\nQA cấu trúc câu chuyện — ${pages.length} trang đã xuất bản\n`);

/* ---------- 1. Mỗi trang phải có các vai tối thiểu ---------- */
for (const { slug, locale, roles } of pages) {
  const missing = REQUIRED_ROLES.filter((r) => !roles.includes(r));
  ok(`${slug}/${locale}: có đủ vai bắt buộc`, missing.length === 0,
    missing.length ? `thiếu: ${missing.join(', ')}` : REQUIRED_ROLES.join(', '));
}

/* ---------- 2. Bằng chứng phải đứng TRƯỚC chỗ quyết định ---------- */
/* Đưa ra giá rồi mới đưa căn cứ là bắt người đọc quyết định trước khi họ có
   thứ để quyết định bằng. */
for (const { slug, locale, roles } of pages) {
  const firstProof = roles.findIndex((r) => r === 'proof');
  const decision = roles.findIndex((r) => r === 'decision');
  ok(`${slug}/${locale}: bằng chứng đứng trước khối đặt hàng`,
    firstProof >= 0 && decision >= 0 && firstProof < decision,
    `proof@${firstProof} < decision@${decision}`);
}

/* ---------- 3. Không có hai khối cùng vai "decision" ---------- */
for (const { slug, locale, roles } of pages) {
  const n = roles.filter((r) => r === 'decision').length;
  ok(`${slug}/${locale}: đúng một vùng quyết định`, n === 1, `${n} khối`);
}

/* ---------- 4. relatedProducts không tự trỏ về chính nó ---------- */
for (const { slug, locale, p } of pages) {
  const rel = p.blocks.find((b) => b.type === 'relatedProducts');
  if (!rel) continue;
  ok(`${slug}/${locale}: gợi ý không tự trỏ về mình`, !rel.items.includes(p.slug),
    rel.items.join(', '));
}

/* ---------- 5. ĐA DẠNG CHUỖI — phép đo chống trôi về khuôn cũ ---------- */
const byLocale = {};
for (const { locale, roles, slug } of pages) {
  (byLocale[locale] ??= []).push({ slug, sig: roles.join('>') });
}
for (const [locale, items] of Object.entries(byLocale)) {
  const counts = new Map();
  for (const it of items) counts.set(it.sig, (counts.get(it.sig) ?? 0) + 1);
  const [topSig, topN] = [...counts].sort((a, b) => b[1] - a[1])[0];
  const share = topN / items.length;
  /* Ngưỡng 0.75 chứ không phải 1.0: các sản phẩm cùng một dòng, cùng độ phức
     tạp thì ĐƯỢC PHÉP kể giống nhau — ép khác nhau chỉ để khác là tạo khác
     biệt giả. Cổng này bắt trường hợp gần như MỌI trang trùng khuôn. */
  ok(`[${locale}] không phải mọi trang dùng chung một chuỗi vai`,
    share < 0.75,
    `chuỗi phổ biến nhất chiếm ${topN}/${items.length} (${Math.round(share * 100)}%)`);
  if (share >= 0.5) {
    note(`[${locale}] chuỗi lặp nhiều`, `${topN}/${items.length} trang: ${topSig}`);
  }
}

/* ---------- 6. Nguyên mẫu đã khai thì phải khớp phần lớn nhịp của nó ---------- */
for (const { slug, locale, p, roles } of pages) {
  if (!p.storyArchetype) { note(`${slug}/${locale}`, 'chưa khai storyArchetype'); continue; }
  const beats = ARCHETYPE_BEATS[p.storyArchetype] ?? [];
  const present = beats.filter((b) => roles.includes(b)).length;
  const cover = beats.length ? present / beats.length : 0;
  /* BÁO chứ không chặn: nguyên mẫu là mô tả, không phải khuôn ép (§3). */
  if (cover < 0.6) {
    note(`${slug}/${locale}: nguyên mẫu "${p.storyArchetype}"`,
      `mới có ${present}/${beats.length} nhịp`);
  } else {
    pass++;
    console.log(`  ĐẠT  ${`${slug}/${locale}: khớp nguyên mẫu "${p.storyArchetype}"`.padEnd(56)} ${present}/${beats.length} nhịp`);
  }
}

/* ---------- 7. Khối bằng chứng không được khai dữ liệu chưa có ---------- */
for (const { slug, locale, p } of pages) {
  for (const b of p.blocks) {
    if (b.type === 'documents') {
      ok(`${slug}/${locale}: khối chứng từ có mục thật`, (b.items?.length ?? 0) > 0, `${b.items?.length ?? 0} mục`);
    }
    if ((b.type === 'gallery' || b.type === 'testimonials') && b.consent?.obtained !== true) {
      note(`${slug}/${locale}: khối "${b.type}" bị ẩn`, 'consent.obtained = false — không render');
    }
  }
}

/* ---------- 8. Nếu đã build: vai render ra HTML phải khớp vai tính từ dữ liệu ---------- */
/* Đây là chỗ bắt lệch giữa layout và dữ liệu. Không có dist thì bỏ qua, để
   cổng vẫn chạy được trước khi build. */
let checkedDist = 0;
for (const { slug, locale, p } of pages) {
  const f = locale === 'vi' ? `dist/${slug}/index.html` : `dist/en/${slug}/index.html`;
  if (!existsSync(f)) continue;
  const html = readFileSync(f, 'utf8');
  const rendered = [...html.matchAll(/data-narrative-role="([a-z-]+)"/g)].map((m) => m[1]);
  /* Chuỗi kỳ vọng phải là những khối THẬT SỰ render ra, nên bỏ hai nhóm:
       1. hero/offer/order — tự lo phần nền, không đi qua <Section>;
       2. khối có cổng consent chưa được đồng ý — schema cố tình không render
          chúng, và đó là hành vi đúng, không phải lệch.
     Bản đầu của cổng này quên nhóm 2 và báo đỏ combo-nam, nơi gallery và
     testimonials đang chờ văn bản đồng ý. */
  const expected = p.blocks
    .filter((b) => !('consent' in b) || b.consent?.obtained === true)
    .map(roleOf)
    .filter((r) => !['orient', 'value', 'decision'].includes(r));
  ok(`${slug}/${locale}: vai render khớp dữ liệu`, rendered.join('>') === expected.join('>'),
    `html=${rendered.join('>')}`);
  checkedDist++;
}
if (!checkedDist) console.log('  (bỏ qua đối chiếu với dist/ — chưa build)');

console.log(`\n${pass} phép thử đạt, ${fail.length} lỗi, ${warn.length} lưu ý.\n`);
if (warn.length) {
  console.log('Lưu ý (không chặn build):');
  for (const w of warn) console.log('  · ' + w);
  console.log('');
}
if (fail.length) {
  console.error('Lỗi:\n  ' + fail.join('\n  ') + '\n');
  process.exit(1);
}
