/**
 * Cổng sẵn sàng quảng cáo — quét bề mặt quảng cáo của mọi sản phẩm.
 *
 *   node --experimental-strip-types scripts/check-ad-readiness.mjs
 *   node --experimental-strip-types scripts/check-ad-readiness.mjs --md docs/ad-readiness.md
 *   node --experimental-strip-types scripts/check-ad-readiness.mjs --strict
 *
 * Mặc định: in báo cáo, mã thoát 0. Đây là CHỦ Ý — phần lớn phát hiện cần
 * người quyết định, và một cổng đỏ vì chuyện cần người ký sẽ bị tắt đi sau
 * đúng một tuần.
 *
 * `--strict` chỉ đỏ khi có vi phạm mức `blocked`: những thứ không ai định ký,
 * ví dụ mạo nhận ChatGPT giới thiệu sản phẩm, hoặc đặt mỹ phẩm vào vai thuốc.
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { adPolicyProfile, AD_POLICY_VERSION, AD_STATUS_LABEL } from '../src/lib/ad-safety.ts';

const args = process.argv.slice(2);
const mdIndex = args.indexOf('--md');
const mdPath = mdIndex >= 0 ? args[mdIndex + 1] : null;
const strict = args.includes('--strict');

const DIR = 'src/content/products';
const LOCALES = ['vi', 'en'];

const rows = [];
for (const slug of readdirSync(DIR)) {
  for (const locale of LOCALES) {
    const f = `${DIR}/${slug}/${locale}.json`;
    if (!existsSync(f)) continue;
    const p = JSON.parse(readFileSync(f, 'utf8'));
    if (p.status !== 'published') continue;
    rows.push({ slug, locale, product: p, profile: adPolicyProfile(p) });
  }
}

/* ---------------- báo cáo ra màn hình ---------------- */
const MARK = { 'ready-for-review': 'SOÁT', 'needs-revision': 'SỬA ', 'not-suitable': 'CHẶN' };
console.log(`\nSẵn sàng quảng cáo — bộ luật ${AD_POLICY_VERSION}\n`);
for (const r of rows) {
  const { profile: pr } = r;
  console.log(`  ${MARK[pr.status]}  ${(r.slug + '/' + r.locale).padEnd(34)} ${AD_STATUS_LABEL[pr.status]}`);
  for (const h of pr.hits) {
    console.log(`         ${h.severity === 'blocked' ? '✗' : '!'} ${h.path}: "${h.match}" — ${h.why}`);
  }
  for (const a of pr.unsupportedAngles) {
    console.log(`         ! lời hứa không thấy trong nội dung trang: "${a}"`);
  }
  for (const m of pr.missing) console.log(`         · ${m}`);
}

const counts = rows.reduce((acc, r) => {
  acc[r.profile.status] = (acc[r.profile.status] ?? 0) + 1;
  return acc;
}, {});
const blocked = counts['not-suitable'] ?? 0;
console.log(`\n  ${rows.length} trang: ` +
  `${counts['ready-for-review'] ?? 0} sẵn sàng soát, ` +
  `${counts['needs-revision'] ?? 0} cần sửa, ` +
  `${blocked} chưa dùng được.\n`);
console.log('  Không mức nào ở đây nghĩa là "đã được duyệt". Chính sách quảng cáo do');
console.log('  nền tảng quyết định vào thời điểm bạn chạy, không phải do tệp này.\n');

/* ---------------- xuất Markdown ---------------- */
if (mdPath) {
  const L = [];
  L.push('# Sẵn sàng cho ChatGPT Ads');
  L.push('');
  L.push(`> Sinh tự động bằng \`npm run check:ads -- --md ${mdPath}\`. Đừng sửa tay.`);
  L.push(`> Bộ luật: **${AD_POLICY_VERSION}**. Quét ngày: ${new Date().toISOString().slice(0, 10)}.`);
  L.push('');
  L.push('**Không dòng nào trong bảng này nghĩa là "đã được OpenAI duyệt".** Tệp này');
  L.push('đo nội dung của chính website so với một bộ luật nội bộ. Quyết định cuối');
  L.push('cùng thuộc về nền tảng quảng cáo và người phụ trách của doanh nghiệp.');
  L.push('');
  L.push('| Trang | Nguyên mẫu | Trạng thái | Chặn | Cần soát | Thiếu dữ liệu |');
  L.push('| --- | --- | --- | ---: | ---: | ---: |');
  for (const r of rows) {
    const pr = r.profile;
    const b = pr.hits.filter((h) => h.severity === 'blocked').length;
    const w = pr.hits.filter((h) => h.severity === 'review').length + pr.unsupportedAngles.length;
    L.push(`| \`${r.slug}\` (${r.locale}) | ${r.product.storyArchetype ?? '—'} | ${AD_STATUS_LABEL[pr.status]} | ${b} | ${w} | ${pr.missing.length} |`);
  }
  L.push('');

  for (const r of rows) {
    const pr = r.profile;
    const ad = r.product.adContext;
    L.push(`## \`${r.slug}\` — ${r.locale}`);
    L.push('');
    L.push(`- **Trang đích:** \`/${r.slug}/\`${r.locale === 'en' ? ' (bản EN dưới `/en/`)' : ''}`);
    L.push(`- **Nguyên mẫu câu chuyện:** ${r.product.storyArchetype ?? '_chưa khai_'}`);
    L.push(`- **Trạng thái:** ${AD_STATUS_LABEL[pr.status]}`);
    if (ad) {
      L.push(`- **Nhu cầu chính:** ${ad.primaryNeed}`);
      L.push('- **Bối cảnh hội thoại trang này đón:**');
      for (const c of ad.contextHints ?? []) L.push(`  - ${c}`);
      L.push('- **Lời hứa được phép dùng:**');
      for (const a of ad.approvedAngles ?? []) L.push(`  - ${a}`);
      if (ad.riskyAngles?.length) {
        L.push('- **Hướng KHÔNG được dùng:**');
        for (const a of ad.riskyAngles) L.push(`  - ${a}`);
      }
      if (ad.preferredDestination) L.push(`- **Neo nên trỏ tới:** \`${ad.preferredDestination}\``);
    } else {
      L.push('- **`adContext` chưa khai.** Chưa ghi lại được trang này phục vụ ý định nào.');
    }
    if (pr.hits.length) {
      L.push('');
      L.push('**Phát hiện trên bề mặt quảng cáo**');
      L.push('');
      L.push('| Mức | Trường | Cụm | Vì sao | Hướng sửa |');
      L.push('| --- | --- | --- | --- | --- |');
      for (const h of pr.hits) {
        L.push(`| ${h.severity === 'blocked' ? '**chặn**' : 'soát'} | \`${h.path}\` | ${h.match} | ${h.why} | ${h.instead} |`);
      }
    }
    if (pr.unsupportedAngles.length) {
      L.push('');
      L.push('**Lời hứa quảng cáo không thấy nội dung trang chống lưng**');
      L.push('');
      for (const a of pr.unsupportedAngles) L.push(`- ${a}`);
      L.push('');
      L.push('_Phép đo là mức phủ từ nội dung, cố tình thô: nó bắt lời hứa nói về thứ');
      L.push('trang không hề nhắc tới. Nó không thay được người đọc._');
    }
    if (pr.missing.length) {
      L.push('');
      L.push('**Cần chủ doanh nghiệp cung cấp**');
      L.push('');
      for (const m of pr.missing) L.push(`- ${m}`);
    }
    L.push('');
  }

  const CR = String.fromCharCode(13), LF = String.fromCharCode(10);
  let body = L.join(LF) + LF;
  if (existsSync(mdPath) && readFileSync(mdPath, 'utf8').includes(CR + LF)) {
    body = body.split(LF).join(CR + LF);
  }
  writeFileSync(mdPath, body);
  console.log(`  Đã ghi ${mdPath}\n`);
}

if (strict && blocked > 0) {
  console.error(`  ${blocked} trang có vi phạm mức "chặn" — không ai định ký những mục này.\n`);
  process.exit(1);
}
