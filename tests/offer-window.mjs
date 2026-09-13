/**
 * Bộ thử cho `scripts/check-offer-window.mjs`.
 *
 * Kiểm định lần 14: script này có 0 ca canh. Sửa `if (endOfDay <= now)` thành
 * `if (false)` thì mọi bộ thử vẫn xanh và script in "ok mọi hạn ưu đãi còn hiệu
 * lực" rồi exit 0 — chuông báo hạn ưu đãi có thể vỡ trong im lặng.
 */
import { mkdtempSync, mkdirSync, writeFileSync, cpSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';

const root = process.cwd();

function run(product) {
  const dir = mkdtempSync(join(tmpdir(), 'offer-'));
  mkdirSync(join(dir, 'src/content/products/p'), { recursive: true });
  mkdirSync(join(dir, 'scripts'), { recursive: true });
  writeFileSync(join(dir, 'src/content/products/p/vi.json'), JSON.stringify(product));
  cpSync(join(root, 'scripts/check-offer-window.mjs'), join(dir, 'scripts/check-offer-window.mjs'));
  try {
    const out = execFileSync(process.execPath, ['scripts/check-offer-window.mjs'],
      { cwd: dir, encoding: 'utf8' });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status ?? 1, out: `${e.stdout ?? ''}${e.stderr ?? ''}` };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const day = (offset) => {
  const d = new Date(Date.now() + offset * 86400000);
  return d.toISOString().slice(0, 10);
};
const withOffer = (validUntil, status = 'published') =>
  ({ status, blocks: [{ type: 'offer', heading: 'Ưu đãi', body: 'x', validUntil }] });

const CASES = [
  ['hạn còn xa thì đạt', withOffer(day(60)), 0, /còn hiệu lực/],
  ['hạn ĐÃ QUA thì fail', withOffer(day(-1)), 1, /đã qua/],
  /* Hạn tính HẾT ngày theo giờ Việt Nam (UTC+7), nên "hôm nay" theo giờ UTC có
     thể đã qua — dùng ngày mai để ca này không phụ thuộc giờ chạy. */
  ['hạn ngày mai vẫn còn hiệu lực', withOffer(day(1)), 0, /còn hiệu lực|⏳/],
  ['hạn sắp hết được cảnh báo', withOffer(day(3)), 0, /còn 3 ngày|⏳/],
  ['bản nháp quá hạn không chặn', withOffer(day(-30), 'draft'), 0, /còn hiệu lực/],
  ['không có hạn thì đạt', { status: 'published', blocks: [{ type: 'offer', heading: 'x', body: 'y' }] }, 0, /còn hiệu lực/],
];

let bad = 0;
for (const [name, product, expectCode, expectOut] of CASES) {
  const r = run(product);
  const ok = r.code === expectCode && expectOut.test(r.out);
  if (!ok) { bad++; console.error(`  SAI   ${name} — mã thoát ${r.code} (mong ${expectCode}), output: ${r.out.trim().slice(0, 80)}`); }
}
console.log(`  ${CASES.length - bad}/${CASES.length} ca đúng`);
process.exit(bad ? 1 : 0);
