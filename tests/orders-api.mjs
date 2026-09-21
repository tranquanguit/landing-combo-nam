/**
 * Kiểm thử API đặt hàng trên SQLite THẬT với lược đồ THẬT.
 *
 * Không mô phỏng cơ sở dữ liệu bằng mảng trong bộ nhớ: phần lớn lỗi của một
 * API ghi dữ liệu nằm ở chỗ giáp ranh với cơ sở dữ liệu — ràng buộc UNIQUE,
 * CHECK, cột NOT NULL, thứ tự tham số bind. Một bản giả bằng mảng sẽ cho qua
 * hết những lỗi đó. Ở đây migrations/0001_orders.sql được chạy nguyên văn, và
 * handler chạy là chính file sẽ deploy lên Cloudflare.
 *
 *   node --experimental-strip-types --experimental-sqlite tests/orders-api.mjs
 */
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { onRequest as ordersApi } from '../functions/api/orders.ts';
import { onRequest as adminApi } from '../functions/api/admin/orders.ts';

/* ---------- D1 giả lập trên node:sqlite ----------
   Chỉ năm hàm, đúng bằng những gì functions/_lib/cloudflare.d.ts khai báo. */
function makeD1(db) {
  return {
    prepare(sql) {
      const stmt = db.prepare(sql);
      let params = [];
      const api = {
        bind(...values) { params = values.map((v) => (v === undefined ? null : v)); return api; },
        async first() { return stmt.get(...params) ?? null; },
        async all() { return { results: stmt.all(...params), success: true }; },
        async run() {
          const r = stmt.run(...params);
          return { success: true, meta: { changes: Number(r.changes) } };
        },
      };
      return api;
    },
  };
}

const db = new DatabaseSync(':memory:');
db.exec(readFileSync(new URL('../migrations/0001_orders.sql', import.meta.url), 'utf8'));
const env = {
  DB: makeD1(db),
  IP_SALT: 'muoi-kiem-thu-khong-dung-cho-production',
  ADMIN_TOKEN: 'token-kiem-thu-du-dai-de-vuot-nguong-24',
  ALLOWED_ORIGIN: 'https://mochatrinam.com',
};

const GOOD = {
  productSlug: 'combo-nam',
  locale: 'vi',
  pack: 'combo-full',
  packPrice: 1050000,
  name: 'Nguyễn Thu Hà',
  phone: '0912345678',
  address: '12 Lê Lợi, Phường Bến Nghé, Quận 1, TP.HCM',
  note: 'Giao giờ hành chính',
  dataConsent: true,
  consentText: 'Tôi đồng ý để Mocha dùng thông tin này để liên hệ và giao đơn hàng.',
};

let ipCounter = 0;
const post = (body, headers = {}) =>
  ordersApi({
    env,
    request: new Request('https://mochatrinam.com/api/orders', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'https://mochatrinam.com',
        // IP khác nhau mỗi lần gọi, nếu không phép thử thứ 9 sẽ dính rate limit
        // của phép thử thứ 1 và ta sẽ đi sửa nhầm chỗ.
        'cf-connecting-ip': `10.0.0.${++ipCounter}`,
        ...headers,
      },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
  });

const admin = (path, init = {}) => {
  // Gộp headers TRƯỚC khi trải init, nếu không init.headers sẽ đè mất token và
  // mọi phép thử quản trị đều trả 401 vì lỗi của chính bộ thử.
  const { headers, ...rest } = init;
  return adminApi({
    env,
    request: new Request(`https://mochatrinam.com/api/admin/orders${path}`, {
      ...rest,
      headers: { authorization: `Bearer ${env.ADMIN_TOKEN}`, ...(headers || {}) },
    }),
  });
};

const results = [];
const check = (name, ok, detail) => results.push([name, ok, detail]);
const countRows = () => db.prepare('SELECT COUNT(*) AS n FROM orders').get().n;

/* ================= 1. Đơn hợp lệ được ghi đúng ================= */
{
  const res = await post(GOOD);
  const body = await res.json();
  const row = db.prepare('SELECT * FROM orders WHERE order_code = ?').get(body.orderCode);
  check('đơn hợp lệ được ghi',
    res.status === 200 && body.ok === true
    && /^MC-\d{6}-[A-Z0-9]{4}$/.test(body.orderCode)
    && row?.name === GOOD.name && row.phone === '0912345678'
    && row.pack_price === 1050000 && row.data_consent === 1
    && row.status === 'new' && row.consent_text === GOOD.consentText,
    `${body.orderCode}, status=${row?.status}`);
}

/* ================= 2. Số điện thoại các dạng đều gộp về một ================= */
{
  const before = countRows();
  for (const phone of ['+84 912 345 679', '84912345679', '0912.345.679']) {
    await post({ ...GOOD, phone, pack: `p-${phone.length}` });
  }
  const rows = db.prepare("SELECT DISTINCT phone FROM orders WHERE phone = '0912345679'").all();
  check('chuẩn hoá +84 / 84 / có dấu chấm',
    rows.length === 1 && countRows() === before + 3,
    `${rows.length} dạng lưu trong CSDL`);
}

/* ================= 3. Không đồng ý dữ liệu thì không ghi ================= */
{
  const before = countRows();
  const res = await post({ ...GOOD, dataConsent: false, phone: '0900000001' });
  const body = await res.json();
  check('không tick đồng ý thì không ghi',
    res.status === 422 && countRows() === before
    && body.fields?.some((f) => f.field === 'dataConsent'),
    `HTTP ${res.status}, số dòng không đổi: ${countRows() === before}`);
}

/* ================= 4. Phản hồi lỗi không mang dữ liệu cá nhân ================= */
{
  const res = await post({ ...GOOD, phone: 'khong-phai-so', name: 'Trần Bí Mật' });
  const text = await res.text();
  check('phản hồi lỗi không lộ dữ liệu khách',
    res.status === 422 && !text.includes('Trần Bí Mật') && !text.includes('khong-phai-so')
    && text.includes('phone'),
    text.slice(0, 90));
}

/* ================= 5. Bấm hai lần vẫn là một đơn ================= */
{
  const payload = { ...GOOD, phone: '0987654321', pack: 'combo-doi' };
  const a = await (await post(payload)).json();
  const b = await (await post(payload)).json();
  const n = db.prepare('SELECT COUNT(*) AS n FROM orders WHERE phone = ?').get('0987654321').n;
  check('bấm hai lần chỉ thành một đơn',
    a.orderCode === b.orderCode && b.deduped === true && n === 1,
    `${n} dòng, mã ${a.orderCode}`);
}

/* ================= 6. Gói chỉ tư vấn không cần địa chỉ ================= */
{
  const res = await post({ ...GOOD, packPrice: '', address: '', phone: '0911111111', pack: 'tu-van' });
  const body = await res.json();
  const row = db.prepare('SELECT * FROM orders WHERE order_code = ?').get(body.orderCode);
  check('gói tư vấn không bắt địa chỉ',
    res.status === 200 && row?.address === null && row.pack_price === null,
    `HTTP ${res.status}, address=${row?.address}`);
}

/* ...nhưng gói có giá thì vẫn bắt. */
{
  const res = await post({ ...GOOD, address: '', phone: '0911111112' });
  check('gói có giá vẫn bắt địa chỉ', res.status === 422, `HTTP ${res.status}`);
}

/* ================= 7. Bẫy bot ================= */
{
  const before = countRows();
  const res = await post({ ...GOOD, website: 'http://spam.example', phone: '0922222222' });
  check('ô bẫy có nội dung thì chặn',
    res.status === 422 && countRows() === before, `HTTP ${res.status}`);
}

/* ================= 8. Thân yêu cầu quá lớn và JSON hỏng ================= */
{
  const big = await post({ ...GOOD, note: 'x'.repeat(9000) });
  const broken = await post('{khong phai json');
  const array = await post('[1,2,3]');
  check('thân quá lớn / JSON hỏng bị chặn',
    big.status === 413 && broken.status === 400 && array.status === 400,
    `${big.status} / ${broken.status} / ${array.status}`);
}

/* ================= 9. Chỉ nhận từ gốc của chính mình ================= */
{
  const res = await post({ ...GOOD, phone: '0933333333' },
    { origin: 'https://trang-gia-mao.example' });
  check('gốc lạ bị từ chối', res.status === 403, `HTTP ${res.status}`);
}

/* ================= 10. Chèn SQL không thoát ra khỏi tham số ================= */
{
  const evil = "Nguyễn'); DROP TABLE orders; --";
  const res = await post({ ...GOOD, name: evil, phone: '0944444444' });
  const body = await res.json();
  const row = db.prepare('SELECT name FROM orders WHERE order_code = ?').get(body.orderCode);
  const tableAlive = db.prepare(
    "SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name='orders'").get().n;
  check('chèn SQL chỉ là một chuỗi',
    res.status === 200 && row?.name === evil && tableAlive === 1,
    `bảng còn sống: ${tableAlive === 1}`);
}

/* ================= 11. Giới hạn nhịp gửi ================= */
{
  const ip = 'cf-connecting-ip';
  let limited = 0;
  for (let i = 0; i < 12; i++) {
    const res = await ordersApi({
      env,
      request: new Request('https://mochatrinam.com/api/orders', {
        method: 'POST',
        headers: { 'content-type': 'application/json', [ip]: '203.0.113.9' },
        body: JSON.stringify({ ...GOOD, phone: `09555555${String(i).padStart(2, '0')}`, pack: `k${i}` }),
      }),
    });
    if (res.status === 429) limited++;
  }
  check('gửi dồn dập bị chặn', limited > 0, `${limited}/12 lần bị chặn`);
}

/* ================= 12. IP không bao giờ nằm trong CSDL ================= */
{
  const dump = JSON.stringify(db.prepare('SELECT * FROM orders').all())
    + JSON.stringify(db.prepare('SELECT * FROM rate_limit').all());
  check('không lưu IP thô ở bất cứ đâu',
    !dump.includes('203.0.113.9') && !dump.includes('10.0.0.'),
    'đã quét cả bảng orders lẫn rate_limit');
}

/* ================= 13. Quản trị: không token thì không đọc được ================= */
{
  const noToken = await adminApi({
    env, request: new Request('https://mochatrinam.com/api/admin/orders'),
  });
  const wrongToken = await adminApi({
    env,
    request: new Request('https://mochatrinam.com/api/admin/orders', {
      headers: { authorization: 'Bearer token-sai-nhung-dung-do-dai-24k' },
    }),
  });
  const noConfig = await adminApi({
    env: { ...env, ADMIN_TOKEN: undefined },
    request: new Request('https://mochatrinam.com/api/admin/orders'),
  });
  check('quản trị đòi token',
    noToken.status === 401 && wrongToken.status === 401 && noConfig.status === 503,
    `${noToken.status} / ${wrongToken.status} / chưa cấu hình: ${noConfig.status}`);
}

/* ================= 14. Quản trị: đọc, lọc, phân trang ================= */
{
  const res = await admin('?limit=3');
  const body = await res.json();
  const filtered = await (await admin('?status=new&limit=2')).json();
  const badStatus = await admin('?status=khong-ton-tai');
  check('quản trị đọc được đơn',
    res.status === 200 && body.orders.length === 3 && body.nextCursor !== null
    && filtered.orders.every((o) => o.status === 'new') && badStatus.status === 400,
    `${body.count} đơn, cursor kế: ${body.nextCursor}`);
}

/* ================= 15. Không cho công cụ tìm kiếm lập chỉ mục ================= */
{
  const res = await admin('?limit=1');
  check('phản hồi quản trị có noindex + no-store',
    /noindex/.test(res.headers.get('x-robots-tag') || '')
    && res.headers.get('cache-control') === 'no-store',
    `${res.headers.get('x-robots-tag')} | ${res.headers.get('cache-control')}`);
}

/* ================= 16. CSV không thành công thức Excel ================= */
{
  await post({ ...GOOD, name: '=cmd|calc', phone: '0966666666', pack: 'csv' });
  const res = await admin('?format=csv&limit=100');
  // Đọc byte thô: Response.text() tự bỏ BOM khi giải mã, nên kiểm bằng chuỗi
  // sẽ luôn báo "không có BOM" dù trên đường truyền vẫn có.
  const bytes = new Uint8Array(await res.clone().arrayBuffer());
  const hasBom = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
  const csv = await res.text();
  const line = csv.split('\r\n').find((l) => l.includes('cmd|calc'));
  check('ô CSV nguy hiểm bị vô hiệu hoá',
    res.headers.get('content-type').startsWith('text/csv')
    && line?.includes('"\'=cmd|calc"') && hasBom,
    `BOM cho Excel: ${hasBom}, ô: ${line?.match(/"'=[^"]*"/)?.[0]}`);
}

/* ================= 17. Quản trị: cập nhật trạng thái ================= */
{
  const code = db.prepare('SELECT order_code FROM orders ORDER BY id LIMIT 1').get().order_code;
  const ok = await admin('', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ orderCode: code, status: 'contacted', staffNote: 'Đã gọi, hẹn mai' }),
  });
  const row = db.prepare('SELECT status, staff_note, updated_at FROM orders WHERE order_code = ?').get(code);
  const badStatus = await admin('', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ orderCode: code, status: 'da-xoa-het' }),
  });
  const missing = await admin('', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ orderCode: 'MC-999999-ZZZZ', status: 'done' }),
  });
  check('cập nhật trạng thái',
    ok.status === 200 && row.status === 'contacted' && row.staff_note === 'Đã gọi, hẹn mai'
    && row.updated_at && badStatus.status === 400 && missing.status === 404,
    `${row.status}, trạng thái sai: ${badStatus.status}, không tồn tại: ${missing.status}`);
}

/* ================= 18. Lược đồ tự bảo vệ ================= */
{
  // data_consent = 0 phải bị chính CSDL chặn, không chỉ bị handler chặn: nếu mai
  // có ai ghi thẳng vào bảng thì ràng buộc vẫn còn đứng đó.
  let blocked = false;
  try {
    db.prepare(`INSERT INTO orders (order_code, created_at, product_slug, locale, pack,
      currency, name, phone, data_consent, consent_text)
      VALUES ('MC-260101-AAAA','2026-01-01T00:00:00Z','x','vi','p','VND','A','0900000000',0,'t')`).run();
  } catch { blocked = true; }
  check('CSDL tự chặn đơn không có đồng ý', blocked, 'ràng buộc CHECK còn hiệu lực');
}

/* ================= 19. Phương thức sai ================= */
{
  const get = await ordersApi({
    env, request: new Request('https://mochatrinam.com/api/orders'),
  });
  check('GET vào endpoint đặt hàng trả 405',
    get.status === 405 && get.headers.get('allow') === 'POST, OPTIONS',
    `HTTP ${get.status}`);
}

/* ---------------- kết quả ---------------- */
let failed = 0;
for (const [name, ok, detail] of results) {
  if (!ok) failed++;
  console.log(`  ${ok ? 'ĐẠT ' : 'LỖI '} ${name.padEnd(38)} ${detail}`);
}
console.log(`\n${results.length - failed}/${results.length} kịch bản đúng.`);
process.exit(failed ? 1 : 0);
