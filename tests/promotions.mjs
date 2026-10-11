/**
 * Bộ thử khuyến mãi theo lịch + lời chứng có cổng đồng ý.
 *
 *   node --import ./scripts/shim/register.mjs tests/promotions.mjs
 */
import { join } from 'node:path';
import { readdirSync, readFileSync } from 'node:fs';
import {
  phase, isLive, viewPack, packsFor, liveSignature, nextBoundary, vnDateTime, vnLastDay, packWarnings, promoNow,
} from '../src/lib/promotions.ts';
import { voicesFor } from '../src/lib/testimonials.ts';
import { connect, migrate } from '../server/lib/db.ts';
import { schedulerTick, saveSignature, storedSignature, annotatePromoOrder, _resetScheduler } from '../server/lib/promo-server.ts';
import { createUser } from '../server/lib/auth.ts';
import { createApp } from '../server/app.ts';
import { loadSchemas } from '../server/lib/content.ts';

const ROOT = process.cwd();
let pass = 0; const fail = [];
const ok = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ĐẠT  ${name.padEnd(66)} ${detail}`); }
  else { fail.push(name); console.log(`  LỖI  ${name.padEnd(66)} ${detail}`); }
};
const at = (s) => new Date(s);

// ---------------------------------------------------------------- 1. lịch: giờ Việt Nam, mốc kết thúc loại trừ
const P = (over = {}) => ({ status: 'published', name: 'Thử', startsAt: '2026-10-08T00:00:00+07:00', endsAt: '2026-10-12T00:00:00+07:00',
  locales: ['vi'], packs: [], terms: [], ...over });
ok('trước giờ bắt đầu (23:59 ngày 7 giờ VN) -> sắp chạy', phase(P(), at('2026-10-07T23:59:00+07:00')) === 'upcoming');
ok('đúng 00:00 ngày 8 giờ VN -> đang chạy (mốc bắt đầu tính vào)', phase(P(), at('2026-10-07T17:00:00Z')) === 'live');
ok('23:59:59 ngày 11 giờ VN -> vẫn chạy', phase(P(), at('2026-10-11T23:59:59+07:00')) === 'live');
ok('00:00 ngày 12 giờ VN -> đã kết thúc (mốc kết thúc loại trừ)', phase(P(), at('2026-10-12T00:00:00+07:00')) === 'ended');
ok('bản nháp không bao giờ chạy', phase(P({ status: 'draft' }), at('2026-10-09T10:00:00+07:00')) === 'draft');
ok('đợt chỉ khai tiếng Việt không chạy ở trang tiếng Anh', !isLive(P(), at('2026-10-09T10:00:00+07:00'), 'en'));
ok('giờ kết thúc in "23:59, 11/10/2026" (không phải 00:00 ngày 12)', vnDateTime('2026-10-12T00:00:00+07:00', 'vi', true) === '23:59, 11/10/2026',
  vnDateTime('2026-10-12T00:00:00+07:00', 'vi', true));
ok('giờ bắt đầu in đúng "00:00, 08/10/2026"', vnDateTime('2026-10-08T00:00:00+07:00') === '00:00, 08/10/2026');
ok('priceValidUntil = ngày cuối theo giờ VN', vnLastDay('2026-10-12T00:00:00+07:00') === '2026-10-11');
ok('PROMO_NOW xem trước được một đợt sắp chạy', promoNow({ PROMO_NOW: '2026-10-15T09:00:00+07:00' }).toISOString() === '2026-10-15T02:00:00.000Z');

// ---------------------------------------------------------------- 2. giá: mua lẻ tự tính, % làm tròn xuống, cảnh báo
const prices = new Map([['kcn', { price: 335000, name: 'KCN' }], ['srm', { price: 285000, name: 'SRM' }]]);
const entry = (packs, over = {}) => ({ id: 'dot-thu', data: P({ packs, ...over }) });
const pk = (over) => ({ id: 'g', showOn: ['kcn'], label: 'Gói thử nghiệm', items: [{ product: 'kcn', qty: 2 }], price: 525000, gifts: [], recommended: false, ...over });
let v = viewPack(entry([]), pk({ gifts: [{ name: 'SRM mini', qty: 2, value: 140000 }] }), prices);
ok('mua lẻ = giá đang bán × số lượng', v.regular === 670000, String(v.regular));
ok('tiết kiệm + % làm tròn XUỐNG (21,6% -> 21%)', v.save === 145000 && v.savePct === 21, `${v.save} ${v.savePct}%`);
ok('giá trị quà = giá trị × số lượng, không cộng vào "tiết kiệm"', v.giftValue === 280000 && v.save === 145000);
ok('gói hợp lệ: không cảnh báo', v.warnings.length === 0, v.warnings.join(' | '));
v = viewPack(entry([]), pk({ price: 300000 }), prices);
ok('giảm 55% -> cảnh báo mức 50% (NĐ 81/2018, sửa đổi bởi NĐ 128/2024)', v.warnings.some((w) => /50%/.test(w) && /81\/2018/.test(w)), `${v.savePct}%`);
v = viewPack(entry([]), pk({ price: 670000, gifts: [] }), prices);
ok('giá gói không rẻ hơn mua lẻ, không quà -> cảnh báo', v.warnings.some((w) => /không thấp hơn mua lẻ/.test(w)));
ok('quà trị giá > 50% hàng mua -> cảnh báo', packWarnings({ label: 'x', savePct: 0, giftValue: 400000, regular: 670000, price: 670000 }).some((w) => /quà trị giá/.test(w)));
let threw = ''; try { viewPack(entry([]), pk({ items: [{ product: 'khong-co', qty: 1 }] }), prices); } catch (e) { threw = e.message; }
ok('gói chứa sản phẩm không có thật -> dừng build, nói rõ chỗ sai', /khong-co/.test(threw), threw.slice(0, 80));
v = viewPack(entry([]), pk({ items: [{ product: 'kcn', qty: 1 }], price: 299000 }), prices);
ok('1 món × 1, không quà -> là giá bán ưu đãi của chính sản phẩm (JSON-LD)', v.unitSaleOf === 'kcn');

const e1 = { id: 'a', data: P({ packs: [pk({ id: 'a1', showOn: ['kcn'] })] }) };
const e2 = { id: 'b', data: P({ startsAt: '2026-10-14T00:00:00+07:00', endsAt: '2026-10-17T00:00:00+07:00', packs: [pk({ id: 'b1', showOn: ['kcn', 'srm'] })] }) };
ok('chỉ gói của đợt đang chạy hiện trên trang', packsFor('kcn', 'vi', [e1, e2], prices, at('2026-10-09T10:00:00+07:00')).map((x) => x.id).join() === 'a1');
ok('hết đợt 10.10, chưa tới 15.10 -> không gói nào', packsFor('kcn', 'vi', [e1, e2], prices, at('2026-10-13T10:00:00+07:00')).length === 0);
ok('gói có thể hiện ở nhiều trang (showOn)', packsFor('srm', 'vi', [e1, e2], prices, at('2026-10-15T10:00:00+07:00')).length === 1);
ok('chữ ký đợt đang chạy đổi đúng lúc', liveSignature([e1, e2], at('2026-10-09T10:00:00+07:00')) === 'a' && liveSignature([e1, e2], at('2026-10-13T10:00:00+07:00')) === '');
ok('mốc đổi tiếp theo = giờ kết thúc 10.10', nextBoundary([e1, e2], at('2026-10-09T10:00:00+07:00'))?.toISOString() === '2026-10-11T17:00:00.000Z');

// ---------------------------------------------------------------- 3. schema: file khuyến mãi thật + chặn chữ sai
const schemas = await loadSchemas(ROOT);
for (const f of readdirSync('src/content/promotions')) {
  const r = schemas.promotions.safeParse(JSON.parse(readFileSync(`src/content/promotions/${f}`, 'utf8')));
  ok(`schema: ${f}`, r.success, r.success ? '' : r.error.issues[0].message);
}
const base = JSON.parse(readFileSync('src/content/promotions/2026-10-ngay-doi-1010.json', 'utf8'));
const bad = (mut) => { const d = structuredClone(base); mut(d); const r = schemas.promotions.safeParse(d); return r.success ? '' : r.error.issues.map((i) => i.message).join(' | '); };
ok('thiếu múi giờ -> bị chặn', /múi giờ/.test(bad((d) => { d.startsAt = '2026-10-08T00:00:00'; })));
ok('kết thúc trước bắt đầu -> bị chặn', /sau thời điểm bắt đầu/.test(bad((d) => { d.endsAt = '2026-10-01T00:00:00+07:00'; })));
ok('gõ số tiền vào chữ -> bị chặn', /số tiền/.test(bad((d) => { d.banner.text = 'Combo chỉ còn 525k hôm nay'; })));
ok('tên gói quá 40 ký tự (cột pack của đơn) -> bị chặn', bad((d) => { d.packs[0].label = 'x'.repeat(41); }) !== '');
ok('từ cấm trong điều kiện chương trình -> bị chặn', bad((d) => { d.terms.push('Cam kết trị nám dứt điểm sau 1 liệu trình'); }) !== '');

// ---------------------------------------------------------------- 4. lời chứng: cổng đồng ý
const T = (over) => ({ id: over.id ?? 't', data: { status: 'published', locale: 'vi', products: ['kcn'], quote: 'Thấm nhanh, không bết dính', person: { display: 'Chị N.' },
  channel: 'zalo', sponsored: false, consent: { status: 'pending', scope: [] }, ...over } });
const ts = [
  T({ id: 'ok', consent: { status: 'written', date: '2026-10-01', method: 'tin nhắn Zalo', scope: ['website'], evidence: 'Drive/consent/ok.png' } }),
  T({ id: 'cho', consent: { status: 'pending', scope: [] } }),
  T({ id: 'tu-choi', consent: { status: 'refused', scope: [] } }),
  T({ id: 'chi-ads', consent: { status: 'written', date: '2026-10-01', method: 'x', scope: ['ads'], evidence: 'y' } }),
];
ok('bản thật: chỉ lời có văn bản đồng ý cho website', voicesFor('kcn', 'vi', ts, false).map((x) => x.id).join() === 'ok');
ok('bản demo: thêm lời đang chờ (gắn nhãn demo), KHÔNG có lời bị từ chối', voicesFor('kcn', 'vi', ts, true).map((x) => `${x.id}:${x.demo}`).sort().join() === 'cho:true,ok:false');
for (const f of readdirSync('src/content/testimonials')) {
  const r = schemas.testimonials.safeParse(JSON.parse(readFileSync(`src/content/testimonials/${f}`, 'utf8')));
  ok(`schema lời chứng: ${f}`, r.success, r.success ? '' : r.error.issues[0].message);
}
const tb = JSON.parse(readFileSync(readdirSync('src/content/testimonials').map((f) => `src/content/testimonials/${f}`)[0], 'utf8'));
const tbad = (mut) => { const d = structuredClone(tb); mut(d); return schemas.testimonials.safeParse(d).success; };
ok('tên đầy đủ của khách -> bị chặn (chỉ xưng hô + chữ cái đầu)', !tbad((d) => { d.person.display = 'Đặng Thư'; }));
ok('"written" mà thiếu bằng chứng / ngày -> bị chặn', !tbad((d) => { d.consent = { status: 'written', scope: ['website'] }; }));
ok('lời khách hứa kết quả điều trị -> bị chặn', !tbad((d) => { d.quote = 'Dùng 2 tuần là trị dứt điểm nám luôn'; }));
ok('lời khách có số tiền -> bị chặn', !tbad((d) => { d.quote = 'Mua có 525k mà dùng thích lắm'; }));

// ---------------------------------------------------------------- 5. máy chủ: lịch tự xuất bản + đánh dấu đơn
const sql = await connect('pglite:memory');
await migrate(sql, join(ROOT, 'db/pg'));
const put = (c, id, data) => sql.query(
  `INSERT INTO content_entries (collection, entry_id, data, source, updated_by) VALUES ($1, $2, $3::text::jsonb, $3, 'test')
   ON CONFLICT (collection, entry_id) DO UPDATE SET data = EXCLUDED.data, source = EXCLUDED.source`, [c, id, JSON.stringify(data)]);
await put('products', 'uv-block-sunscreen/vi', { slug: 'uv-block-sunscreen', status: 'published', price: 335000, shortName: 'KCN' });
await put('promotions', '2026-10-ngay-doi-1010', base);
let published = 0, result = { ok: true };
const deps = (now) => ({ publish: async () => { published++; return result; }, isPublishing: () => false, log: () => {}, now: () => at(now) });
_resetScheduler();
ok('máy chủ mới, đợt đang chạy, chưa ghi mốc -> tự xuất bản', await schedulerTick(sql, deps('2026-10-09T10:00:00+07:00')) === 'published' && published === 1);
await saveSignature(sql, '2026-10-ngay-doi-1010', 'test');
ok('đợt không đổi -> không xuất bản lại', await schedulerTick(sql, deps('2026-10-10T10:00:00+07:00')) === 'same' && published === 1);
ok('qua giờ kết thúc -> tự xuất bản để gỡ ưu đãi', await schedulerTick(sql, deps('2026-10-12T00:01:00+07:00')) === 'published' && published === 2);
result = { ok: false };
_resetScheduler();
await schedulerTick(sql, deps('2026-10-12T00:02:00+07:00'));
ok('build lỗi -> 15 phút sau mới thử lại (không thử liên tục)', await schedulerTick(sql, deps('2026-10-12T00:05:00+07:00')) === 'backoff');
ok('đang có lần xuất bản chạy -> đợi', await schedulerTick(sql, { ...deps('2026-10-12T00:30:00+07:00'), isPublishing: () => true }) === 'busy');
ok('mốc lưu ở app_settings', (await storedSignature(sql)) === '2026-10-ngay-doi-1010');

await sql.query(`INSERT INTO orders (order_code, created_at, product_slug, locale, pack, pack_price, currency, name, phone, data_consent, consent_text)
  VALUES ('MC-T1', now()::text, 'uv-block-sunscreen', 'vi', 'Combo 2 kem chống nắng + 2 SRM mini', 525000, 'VND', 'Khách thử', '0912000000', 1, 'đồng ý')`);
let note = await annotatePromoOrder(sql, 'MC-T1', { pack: 'Combo 2 kem chống nắng + 2 SRM mini', packPrice: 525000, productSlug: 'uv-block-sunscreen' }, at('2026-10-13T09:00:00+07:00'));
const staff = (await sql.query("SELECT staff_note FROM orders WHERE order_code = 'MC-T1'")).rows[0].staff_note;
ok('đặt theo gói đã hết hạn (trang mở từ hôm trước) -> ghi cảnh báo cho nhân viên', /không còn chạy/.test(staff ?? ''), staff ?? '');
note = await annotatePromoOrder(sql, 'MC-T1', { pack: 'Combo 2 kem chống nắng + 2 SRM mini', packPrice: 525000, productSlug: 'uv-block-sunscreen' }, at('2026-10-09T09:00:00+07:00'));
ok('đặt đúng gói, đúng giá, đang chạy -> không ghi gì', note === null);
note = await annotatePromoOrder(sql, 'MC-T1', { pack: 'Combo 2 kem chống nắng + 2 SRM mini', packPrice: 1, productSlug: 'uv-block-sunscreen' }, at('2026-10-09T09:00:00+07:00'));
ok('giá gửi lên khác giá gói -> cảnh báo', /khác giá gói/.test(note ?? ''));

// ---------------------------------------------------------------- 6. phát hành bản mới: nạp nội dung không mất phần admin đã sửa
{
  const { importFromFiles } = await import('../server/lib/content.ts');
  await sql.query("UPDATE content_entries SET data = jsonb_set(data, '{price}', '111000') WHERE entry_id = 'uv-block-sunscreen/vi'");
  await sql.query("DELETE FROM content_entries WHERE collection = 'testimonials'");
  const r = await importFromFiles(sql, ROOT, 'test', true);
  const price = (await sql.query("SELECT data->>'price' AS p FROM content_entries WHERE entry_id = 'uv-block-sunscreen/vi'")).rows[0].p;
  const nT = (await sql.query("SELECT count(*)::int AS n FROM content_entries WHERE collection = 'testimonials'")).rows[0].n;
  ok('import --only-new: thêm mục mới, KHÔNG ghi đè giá admin đã sửa', price === '111000' && nT === readdirSync('src/content/testimonials').length, `giá ${price}, ${nT} lời chứng, ${r.entries} mục mới`);
  await importFromFiles(sql, ROOT, 'test', false, new Set(['products/smart-target-acne-gel/vi']));
  const price2 = (await sql.query("SELECT data->>'price' AS p FROM content_entries WHERE entry_id = 'uv-block-sunscreen/vi'")).rows[0].p;
  const acne = (await sql.query("SELECT data FROM content_entries WHERE entry_id = 'smart-target-acne-gel/vi'")).rows[0]?.data;
  ok('import --entries: chỉ ghi đè đúng mục chỉ định', price2 === '111000' && acne?.blocks?.some((b) => b.type === 'conditions'));
  await sql.query("UPDATE content_entries SET data = jsonb_set(data, '{price}', '335000') WHERE entry_id = 'uv-block-sunscreen/vi'");
}

await createUser(sql, 'quan-tri', 'mat-khau-quan-tri-01', 'admin');
const app = createApp({ sql, root: ROOT, env: { IP_SALT: 'muoi', COOKIE_SECURE: '0' } });
const lr = await app(new Request('http://m.test/admin/login', { method: 'POST', body: 'username=quan-tri&password=mat-khau-quan-tri-01',
  headers: { 'content-type': 'application/x-www-form-urlencoded', origin: 'http://m.test' } }));
const ck = lr.headers.get('set-cookie').split(';')[0];
const html = await (await app(new Request('http://m.test/admin/promotions', { headers: { cookie: ck } }))).text();
ok('trang quản trị Khuyến mãi: hiện đợt, giá gói, mua lẻ, % giảm', /Ưu đãi ngày đôi 10.10/.test(html) && /525\.000đ/.test(html) && /670\.000đ/.test(html) && /−21%/.test(html));
ok('trang quản trị cảnh báo chưa ghi thông báo Sở Công Thương', /Sở Công Thương/.test(html));
await sql.close();

console.log(`\n${pass}/${pass + fail.length} phép thử đạt.`);
process.exit(fail.length ? 1 : 0);
