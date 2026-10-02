/**
 * Kiểm tra một bản triển khai ĐANG CHẠY, từ bên ngoài, như khách và nhân viên dùng.
 *
 *   BASE=http://app:8080 node server/verify.ts
 *
 * Chạy bởi `npm run verify:docker` (container `verify` trong
 * deploy/verify.compose.yml), hoặc trỏ BASE vào máy chủ thật sau khi deploy.
 * Thoát mã 1 nếu có bước nào trượt.
 */
const BASE = (process.env.BASE ?? 'http://127.0.0.1:8080').replace(/\/$/, '');
const ORIGIN = process.env.ALLOWED_ORIGIN ?? new URL(BASE).origin;
const TOKEN = process.env.ADMIN_TOKEN ?? '';
const USER = process.env.ADMIN_BOOTSTRAP_USER ?? 'admin';
const PASS = process.env.ADMIN_BOOTSTRAP_PASSWORD ?? '';
const PUBLISH_WAIT_MS = Number(process.env.VERIFY_PUBLISH_WAIT_MS ?? 240_000);

let failed = 0;
const ok = (name: string, cond: boolean, detail = '') => {
  if (!cond) failed++;
  console.log(`  ${cond ? 'ĐẠT ' : 'LỖI '} ${name.padEnd(52)} ${detail}`);
};
const get = (path: string, init: RequestInit = {}) => fetch(BASE + path, { redirect: 'manual', ...init });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

console.log(`\nKiểm tra triển khai: ${BASE}\n`);

// ---- sống + CSDL
let r = await get('/healthz');
ok('/healthz (máy chủ + Postgres)', r.status === 200 && (await r.text()) === 'ok', String(r.status));

// ---- đăng nhập quản trị (trước, để theo dõi lần xuất bản lúc khởi động)
let cookie = '';
if (PASS) {
  r = await get('/admin/login', {
    method: 'POST', body: new URLSearchParams({ username: USER, password: PASS }),
    headers: { 'content-type': 'application/x-www-form-urlencoded', origin: BASE },
  });
  cookie = (r.headers.get('set-cookie') ?? '').split(';')[0];
  ok('đăng nhập /admin', r.status === 303 && cookie.startsWith('mocha_admin='), String(r.status));
} else ok('đăng nhập /admin', false, 'thiếu ADMIN_BOOTSTRAP_PASSWORD');

// ---- chờ lần xuất bản lúc khởi động: build lại site từ Postgres, ngay trong container
if (cookie && process.env.PUBLISH_ON_BOOT !== '0') {
  const t0 = Date.now(); let state = 'chưa xong';
  while (Date.now() - t0 < PUBLISH_WAIT_MS) {
    const page = await (await get('/admin/publish', { headers: { cookie } })).text();
    /* Dòng đầu của bảng "Các lần gần đây" là lần xuất bản mới nhất. */
    const latest = page.split('<h2>Các lần gần đây</h2>')[1]?.split('</tr>')[1] ?? '';
    if (/thành công/.test(latest)) { state = 'thành công'; break; }
    if (/>lỗi</.test(latest)) { state = 'LỖI — xem /admin/publish'; break; }
    await sleep(3000);
  }
  ok('xuất bản lúc khởi động (astro build trong container)', state === 'thành công',
    `${state} sau ${Math.round((Date.now() - t0) / 1000)}s`);
  if (state !== 'thành công') {
    /* In nhật ký của lần xuất bản để biết lý do ngay tại đây, không phải vào máy chủ đọc. */
    const page = await (await get('/admin/publish', { headers: { cookie } })).text();
    const log = page.match(/<pre class="log">([\s\S]*?)<\/pre>/)?.[1] ?? '(không đọc được nhật ký)';
    console.log(log.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
      .split('\n').slice(-25).map((l) => '        | ' + l).join('\n'));
  }
}
if (cookie) {
  r = await get('/admin/content/products', { headers: { cookie } });
  const n = ((await r.text()).match(/Sửa<\/a>/g) ?? []).length;
  ok('nội dung đã nạp vào Postgres', r.status === 200 && n >= 20, `${n} sản phẩm (vi + en)`);
}

// ---- trang + tài nguyên
for (const path of ['/', '/combo-nam/', '/nam-tham/', '/chung-nhan/', '/en/combo-nam/', '/sitemap-index.xml', '/llms.txt']) {
  r = await get(path);
  ok(`GET ${path}`, r.status === 200, `${r.status} ${r.headers.get('content-type')?.split(';')[0]}`);
}
r = await get('/combo-nam/', { headers: { 'accept-encoding': 'br, gzip' } });
const html = await r.text();
ok('header bảo mật (CSP, HSTS, nosniff)', /default-src 'self'/.test(r.headers.get('content-security-policy') ?? '')
  && !!r.headers.get('strict-transport-security') && r.headers.get('x-content-type-options') === 'nosniff');
ok('biểu mẫu đặt hàng bật, gửi về /api/orders', /data-action="\/api\/orders"/.test(html) && !/id="form-no-endpoint"/.test(html));
const assets = [...new Set([...html.matchAll(/(?:href|src|srcset)="(\/_astro\/[^"\s,]+)/g)].map((m) => m[1]))];
const broken: string[] = [];
for (const a of assets) { const x = await get(a); if (x.status !== 200) broken.push(`${a} ${x.status}`); }
ok('mọi CSS/JS/ảnh của trang tải được', assets.length > 5 && broken.length === 0, broken.slice(0, 3).join(', ') || `${assets.length} tệp`);
r = await get('/khong-co-trang-nay/');
ok('trang không tồn tại -> 404', r.status === 404, String(r.status));

// ---- đặt một đơn thật, đọc lại từ CSDL
const phone = '09' + String(Date.now()).slice(-8);
r = await get('/api/orders', {
  method: 'POST', headers: { 'content-type': 'application/json', origin: ORIGIN },
  body: JSON.stringify({
    productSlug: 'combo-nam', locale: 'vi', pack: 'kiem-tra-trien-khai', packPrice: 1050000,
    name: 'Kiểm tra triển khai', phone, address: 'Đơn thử — xoá sau khi kiểm tra',
    dataConsent: true, consentText: 'Đơn thử của npm run verify:docker',
  }),
});
const order = await r.json().catch(() => ({}));
ok('đặt đơn qua /api/orders', r.status === 200 && /^MC-/.test(order.orderCode ?? ''), `${r.status} ${order.orderCode ?? JSON.stringify(order)}`);
if (TOKEN) {
  r = await get('/api/admin/orders?limit=5', { headers: { authorization: `Bearer ${TOKEN}` } });
  const list = await r.json().catch(() => ({}));
  const found = (list.orders ?? list.results ?? []).some((o: any) => o.order_code === order.orderCode);
  ok('đơn vừa đặt có trong Postgres', r.status === 200 && found, `${r.status}`);
}
// ---- chat (verify.env bật CHAT_MOCK=1; production có N8N_WEBHOOK_URL thì gọi n8n thật)
r = await get('/chat-catalog.json');
const cat = await r.json().catch(() => ({}));
ok('GET /chat-catalog.json', r.status === 200 && (cat.products?.length ?? 0) >= 20, `${cat.products?.length ?? 0} sản phẩm`);
r = await get('/api/chat', {
  method: 'POST', headers: { 'content-type': 'application/json', origin: ORIGIN },
  body: JSON.stringify({ messageId: crypto.randomUUID(), sessionId: crypto.randomUUID(), locale: 'vi', text: 'Giá combo nám bao nhiêu?', page: { path: '/combo-nam/' } }),
});
const reply = await r.json().catch(() => ({}));
ok('POST /api/chat trả lời theo chuẩn JSON', r.status === 200 && Array.isArray(reply.messages) && reply.messages.length > 0,
  `${r.status} ${reply.degraded ?? (reply.messages ?? []).map((m: any) => m.type).join(',')}`);
ok('chat cấp mã khách ẩn danh (cookie HttpOnly)', /mocha_vid=v_[^;]+;.*HttpOnly/.test(r.headers.get('set-cookie') ?? ''));
ok('bong bóng chat có trên trang', /class="mchat-fab"/.test(html));

r = await get('/api/admin/orders');
ok('API quản trị không có token -> 401', r.status === 401, String(r.status));

console.log(`\n${failed ? `${failed} bước TRƯỢT` : 'Sẵn sàng triển khai: mọi bước đạt.'}\n`);
process.exit(failed ? 1 : 0);

/* Module ES (await ở cấp trên cùng). */
export {};
