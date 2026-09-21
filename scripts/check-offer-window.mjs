/**
 * Chuông báo hạn ưu đãi.
 *
 * Trang tĩnh tính hạn ưu đãi lúc build. Nếu không ai deploy, bản đã phát hành
 * tiếp tục in "ưu đãi đến hết <ngày cũ>" và phát priceValidUntil quá hạn cho
 * Google. Bước này chạy hằng đêm trong CI để có người nhìn thấy điều đó.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = 'src/content/products';
const files = (function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : e.name.endsWith('.json') ? [join(dir, e.name)] : []);
})(root);

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const expired = [];
const soon = [];
const now = Date.now();

for (const f of files) {
  let doc;
  try { doc = JSON.parse(readFileSync(f, 'utf8')); } catch { continue; }
  if (doc.status !== 'published') continue;
  for (const blk of doc.blocks ?? []) {
    if (blk.type !== 'offer' || !blk.validUntil) continue;
    const day = Date.parse(`${blk.validUntil}T00:00:00Z`);
    if (Number.isNaN(day)) continue;
    const endOfDay = day + 24 * 60 * 60 * 1000 - VN_OFFSET_MS;
    const daysLeft = Math.floor((endOfDay - now) / 86400000);
    if (endOfDay <= now) expired.push(`${f}: hạn ${blk.validUntil} đã qua`);
    else if (daysLeft <= 7) soon.push(`${f}: hạn ${blk.validUntil}, còn ${daysLeft} ngày`);
  }
}

for (const l of soon) console.log('  ⏳  ' + l);
if (expired.length) {
  console.error('\nHạn ưu đãi đã qua — cập nhật validUntil rồi deploy lại:\n' +
    expired.map((l) => '  ✗  ' + l).join('\n'));
  process.exit(1);
}
console.log('  ok  mọi hạn ưu đãi còn hiệu lực');
