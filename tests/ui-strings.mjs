/**
 * Bảng chuỗi giao diện cũng phải qua hàng rào.
 *
 * Kiểm định lần 13 (bằng mutation testing): `src/i18n/ui.ts` render trực tiếp
 * lên mọi trang nhưng không đi qua schema nào. Đặt
 * `'evidence.ingredient': 'Kem trị nám tốt nhất, cam kết hoàn tiền, bác sĩ da
 * liễu khuyên dùng'` thì build xanh, 257 ca thử xanh, và chuỗi đó có trong
 * dist/index.html. Ba luật bị vượt cùng lúc.
 *
 * Đây là nguồn nội dung thứ hai không có hàng rào; nguồn thứ nhất là
 * src/data/mocha.json (đã đóng bằng superRefine trong content.config.ts).
 */
import { ui } from '../src/i18n/ui.ts';
import { findForbiddenClaims, findPersonalData } from '../src/lib/claims-lexicon.ts';
import { findHandwrittenMoney } from '../src/lib/money-scan.ts';
import { readFileSync } from 'node:fs';

const brand = JSON.parse(readFileSync('src/data/mocha.json', 'utf8'));
const ownNumbers = [brand.phone, brand.phoneDisplay].filter(Boolean);

/* Vài khoá CỐ Ý chứa số điện thoại hoặc lời cảnh báo của doanh nghiệp. */
const EXEMPT_PII = new Set(['form.phPhone', 'form.needsJs', 'form.noEndpoint', 'form.failed']);

let bad = 0;
let checked = 0;
for (const [locale, table] of Object.entries(ui)) {
  for (const [key, value] of Object.entries(table)) {
    if (typeof value !== 'string') continue;
    checked++;
    for (const hit of findForbiddenClaims(value)) {
      console.error(`  TUYÊN BỐ BỊ CẤM  ui.${locale}["${key}"]: "${hit.match}" — ${hit.why}`);
      bad++;
    }
    if (!EXEMPT_PII.has(key)) {
      for (const hit of findPersonalData(value, ownNumbers)) {
        console.error(`  DỮ LIỆU CÁ NHÂN  ui.${locale}["${key}"]: "${hit.match}" (${hit.kind})`);
        bad++;
      }
    }
    for (const hit of findHandwrittenMoney(value)) {
      console.error(`  SỐ TIỀN VIẾT TAY  ui.${locale}["${key}"]: "${hit}"`);
      bad++;
    }
  }
}

console.log(`  ${checked - bad}/${checked} chuỗi giao diện sạch (${Object.keys(ui).length} ngôn ngữ)`);
process.exit(bad ? 1 : 0);
