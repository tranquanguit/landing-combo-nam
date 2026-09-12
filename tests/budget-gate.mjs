/**
 * Bộ thử cho `scripts/check-budget.mjs`.
 *
 * Kiểm định lần 13 (mutation testing): 0/12 cổng trong script này có ca thử nào
 * canh. Làm yếu bất kỳ cổng nào — kể cả cổng "ảnh chờ văn bản đồng ý lọt vào
 * bản build" và cổng CSP — đều không làm một bộ thử nào đỏ. Script chỉ được
 * "thử" bởi việc repo hiện tại tình cờ đạt.
 *
 * Bộ thử này dựng thư mục `dist` giả rồi chạy script thật trên đó.
 */
import { mkdtempSync, mkdirSync, writeFileSync, cpSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const results = [];

/** Chạy check-budget.mjs trong một thư mục tạm có dist + public do ta dựng. */
function run({ html, files = {}, headers, env = {}, products }) {
  const dir = mkdtempSync(join(tmpdir(), 'budget-'));
  mkdirSync(join(dir, 'dist/_astro'), { recursive: true });
  mkdirSync(join(dir, 'public'), { recursive: true });
  mkdirSync(join(dir, 'scripts'), { recursive: true });
  writeFileSync(join(dir, 'dist/index.html'), html);
  for (const [name, bytes] of Object.entries(files)) {
    writeFileSync(join(dir, 'dist/_astro', name), bytes);
  }
  writeFileSync(join(dir, 'public/_headers'),
    headers ?? readFileSync(join(root, 'public/_headers'), 'utf8'));
  cpSync(join(root, 'scripts/check-budget.mjs'), join(dir, 'scripts/check-budget.mjs'));
  // Nội dung sản phẩm quyết định ảnh nào đang chờ văn bản đồng ý.
  mkdirSync(join(dir, 'src/content/products/p'), { recursive: true });
  writeFileSync(join(dir, 'src/content/products/p/vi.json'), JSON.stringify(products ?? { blocks: [] }));
  try {
    execFileSync(process.execPath, ['scripts/check-budget.mjs'],
      { cwd: dir, env: { ...process.env, ...env }, stdio: 'pipe' });
    return { code: 0, out: '' };
  } catch (e) {
    return { code: e.status ?? 1, out: `${e.stdout ?? ''}${e.stderr ?? ''}` };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const MINIMAL = '<!doctype html><html><head><title>x</title></head><body>ok</body></html>';

/* 1. Bản build sạch phải đạt. */
{
  const r = run({ html: MINIMAL });
  results.push(['bản build sạch đạt', r.code === 0, `mã thoát ${r.code}`]);
}

/* 2. Ảnh của khối CHƯA có văn bản đồng ý lọt vào dist phải fail. */
{
  const r = run({
    html: MINIMAL,
    files: { 'tuong-phan-1.AbCdEfGh.webp': Buffer.alloc(1024) },
    products: {
      blocks: [{
        type: 'gallery',
        consent: { obtained: false, statement: 'Chưa có văn bản đồng ý.' },
        images: [{ src: '/images/tuong-phan-1.webp', alt: 'x' }],
      }],
    },
  });
  results.push(['ảnh chờ đồng ý lọt vào build bị chặn',
    r.code === 1 && /chưa có văn bản đồng ý|CHƯA có văn bản/i.test(r.out), `mã thoát ${r.code}`]);
}

/* 3. Ảnh của khối ĐÃ có văn bản đồng ý thì được phép. */
{
  const r = run({
    html: MINIMAL,
    files: { 'tuong-phan-1.AbCdEfGh.webp': Buffer.alloc(1024) },
    products: {
      blocks: [{
        type: 'gallery',
        consent: { obtained: true, statement: 'Đã có văn bản đồng ý.' },
        images: [{ src: '/images/tuong-phan-1.webp', alt: 'x' }],
      }],
    },
  });
  results.push(['ảnh đã có đồng ý được phép', r.code === 0, `mã thoát ${r.code}`]);
}

/* 4. Endpoint đặt hàng ngoài connect-src phải fail, và fail đúng lý do. */
{
  const r = run({
    html: MINIMAL.replace('<body>', '<body><form data-action="https://api.ben-thu-ba.example/orders">'),
  });
  results.push(['endpoint ngoài connect-src bị chặn',
    r.code === 1 && /connect-src không cho phép endpoint/.test(r.out), `mã thoát ${r.code}`]);
}

/* 5. Endpoint cùng miền với site thì đạt. */
{
  const r = run({
    html: MINIMAL.replace('<body>', '<body><form data-action="https://mochatrinam.com/api/orders">'),
  });
  results.push(['endpoint cùng miền được phép', r.code === 0, `mã thoát ${r.code}`]);
}

/* 6. Thiếu hẳn CSP phải fail. */
{
  const r = run({ html: MINIMAL, headers: '/*\n  X-Content-Type-Options: nosniff\n' });
  results.push(['thiếu Content-Security-Policy bị chặn',
    r.code === 1 && /không có Content-Security-Policy/.test(r.out), `mã thoát ${r.code}`]);
}

/* 7. Script bên thứ ba nhúng sẵn trong HTML phải fail. */
{
  const r = run({
    html: MINIMAL.replace('</head>', '<script src="https://cdn.ben-thu-ba.example/a.js"></script></head>'),
  });
  results.push(['script bên thứ ba bị chặn', r.code === 1, `mã thoát ${r.code}`]);
}

/* 8. Trang tạm dùng để thử hàng rào không được lọt lên production. */
{
  const dir = 'zz-probe';
  const r = (() => {
    const tmp = mkdtempSync(join(tmpdir(), 'budget-'));
    mkdirSync(join(tmp, `dist/${dir}`), { recursive: true });
    mkdirSync(join(tmp, 'dist/_astro'), { recursive: true });
    mkdirSync(join(tmp, 'public'), { recursive: true });
    mkdirSync(join(tmp, 'scripts'), { recursive: true });
    mkdirSync(join(tmp, 'src/content/products/p'), { recursive: true });
    writeFileSync(join(tmp, 'dist/index.html'), MINIMAL);
    writeFileSync(join(tmp, `dist/${dir}/index.html`), MINIMAL);
    writeFileSync(join(tmp, 'public/_headers'), readFileSync(join(root, 'public/_headers'), 'utf8'));
    writeFileSync(join(tmp, 'src/content/products/p/vi.json'), '{"blocks":[]}');
    cpSync(join(root, 'scripts/check-budget.mjs'), join(tmp, 'scripts/check-budget.mjs'));
    try {
      execFileSync(process.execPath, ['scripts/check-budget.mjs'], { cwd: tmp, stdio: 'pipe' });
      return { code: 0, out: '' };
    } catch (e) {
      return { code: e.status ?? 1, out: `${e.stdout ?? ''}${e.stderr ?? ''}` };
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  })();
  results.push(['trang tạm lọt vào build bị chặn',
    r.code === 1 && /trang tạm/.test(r.out), `mã thoát ${r.code}`]);
}

let failed = 0;
for (const [name, ok, detail] of results) {
  if (!ok) failed++;
  console.log(`  ${ok ? 'ĐẠT ' : 'HỎNG'}  ${name.padEnd(42)} ${detail}`);
}
console.log(failed ? `\n${failed}/${results.length} cổng ngân sách hỏng.` : `\n  ${results.length}/${results.length} cổng ngân sách đúng.`);
process.exit(failed ? 1 : 0);
