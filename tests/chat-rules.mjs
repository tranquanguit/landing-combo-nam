/**
 * Phần hai của bộ thử chat (gọi từ tests/chat.mjs, dùng chung CSDL):
 * kịch bản tư vấn, cấu hình trên trang quản trị, dữ liệu phân tích, sự kiện,
 * đơn sau chat, xuất NDJSON.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createApp } from '../server/app.ts';
import { createUser } from '../server/lib/auth.ts';
import { seedRules, guardRule, pickRule, invalidateRules } from '../server/lib/chat-rules.ts';
import { saveChatSettings, getChatSettings, defaults, validate, invalidate } from '../server/lib/chat-settings.ts';
import { _resetPurge } from '../server/lib/chat.ts';

export async function run({ sql, ROOT, ok, catalog }) {
  const H = 'http://mocha.test';
  const uuid = () => crypto.randomUUID();

  // ---------------------------------------------------------------- 6. bộ kịch bản mẫu
  const seedFile = JSON.parse(readFileSync(join(ROOT, 'db/seed/chat-rules.json'), 'utf8'));
  const seeds = seedFile.rules.map((r, i) => ({ id: i + 1, enabled: true, locale: 'vi', keywords: [], payloads: [], path_prefix: null,
    requires_images: false, is_fallback: false, topic: 'khac', priority: 50, ...r }));
  const bad = seeds.flatMap((r) => guardRule(r).map((e) => `${r.name}: ${e}`));
  ok('kịch bản mẫu: qua hàng rào (từ cấm, số tiền viết tay, khối đúng chuẩn)', !bad.length, bad.slice(0, 2).join(' | ') || `${seeds.length} kịch bản`);
  const slugs = new Set(catalog.products.map((p) => p.slug));
  const badSlugs = seeds.flatMap((r) => (r.response.messages ?? []).flatMap((m) => (m.type === 'product' ? [m.slug] : m.type === 'products' ? m.slugs : [])))
    .filter((s) => s !== '{{page}}' && !slugs.has(s));
  ok('kịch bản mẫu: mọi slug sản phẩm có thật', !badSlugs.length, badSlugs.join(','));
  const handled = new Set(seeds.flatMap((r) => r.payloads.map((p) => `${r.locale}:${p}`)));
  const dead = seeds.flatMap((r) => (r.response.quickReplies ?? []).filter((q) => !handled.has(`${r.locale}:${q.payload}`)).map((q) => `${r.name}→${q.payload}`));
  ok('kịch bản mẫu: mọi nút gợi ý đều có kịch bản nhận', !dead.length, dead.join(', '));
  ok('kịch bản mẫu: có câu dự phòng cho vi và en', ['vi', 'en'].every((l) => seeds.some((r) => r.is_fallback && r.locale === l)));
  const M = (text, extra = {}) => pickRule(seeds, { text, payload: '', locale: 'vi', path: '/combo-nam/', images: 0, ...extra })?.rule.name ?? '';
  ok('khớp không dấu: "da toi bi nam sau sinh"', /phân loại/.test(M('da toi bi nam sau sinh')), M('da toi bi nam sau sinh'));
  ok('an toàn thắng bán hàng: "mang thai thì giá bao nhiêu"', /Mang thai/.test(M('đang mang thai thì combo giá bao nhiêu')), M('đang mang thai thì combo giá bao nhiêu'));
  ok('bức xúc -> chuyển người', /Bức xúc/.test(M('hàng giả à, lừa đảo')), M('hàng giả à, lừa đảo'));
  ok('"nam giới" không bị hiểu là "nám"', /Nam giới/.test(M('nam giới dùng được không')), M('nam giới dùng được không'));
  ok('câu lạ -> dự phòng', /Dự phòng/.test(M('hôm nay trời đẹp quá')));
  ok('gửi ảnh -> kịch bản ảnh', /Khách gửi ảnh/.test(M('', { images: 1 })));
  ok('hàng rào chặn "trị dứt điểm" + số tiền', guardRule({ name: 'x', keywords: ['ab'], response: { messages: [{ type: 'text', text: 'Trị nám dứt điểm, chỉ 590k' }] } }).length >= 2);

  const n = await seedRules(sql, ROOT);
  ok('máy chủ mới: nạp kịch bản mẫu vào CSDL', n === seeds.length && (await seedRules(sql, ROOT)) === 0, `${n}`);

  // ---------------------------------------------------------------- 7. cấu hình: trang quản trị > env
  const base = defaults({});
  ok('mặc định không có webhook = chế độ kịch bản', base.mode === 'rules' && defaults({ N8N_WEBHOOK_URL: 'https://x.test/w' }).mode === 'n8n');
  ok('kiểm cấu hình: http ra ngoài, khoá ngắn, n8n thiếu URL đều bị từ chối',
    !validate({ mode: 'n8n', webhookUrl: 'http://evil.example/w' }, base).ok && !validate({ sharedSecret: 'ngan' }, base).ok && !validate({ mode: 'n8n', webhookUrl: '' }, base).ok
      && validate({ mode: 'n8n', webhookUrl: 'http://n8n:5678/webhook/x' }, base).ok);

  let calls = 0; let mode = 'ok';
  const fetchN8n = async (url, init) => {
    calls++; if (mode === 'down') throw new Error('ECONNREFUSED');
    return new Response(JSON.stringify({ version: '1.0', matched: !JSON.parse(init.body).message.text?.includes('lạ'), messages: [{ type: 'text', text: 'n8n đây' }] }), { status: 200 });
  };
  const env = { IP_SALT: 'muoi', COOKIE_SECURE: '0', CHAT_RATE_MAX: '200', ADMIN_TOKEN: 'token-xuat-du-lieu-du-dai-24-ky-tu', N8N_WEBHOOK_URL: 'https://env.test/w' };
  const app = createApp({ sql, root: ROOT, env, fetch: fetchN8n });
  let jar = ''; const SESSION = uuid();
  const chat = async (body, path = '/combo-nam/') => {
    const r = await app(new Request(`${H}/api/chat`, { method: 'POST', headers: { 'content-type': 'application/json', ...(jar ? { cookie: jar } : {}) },
      body: JSON.stringify({ messageId: uuid(), sessionId: SESSION, locale: 'vi', page: { path, utm: { source: 'fb', campaign: 'thu-nam' } }, ...body }) }));
    const sc = r.headers.get('set-cookie'); if (sc) jar = sc.split(';')[0];
    return r.json();
  };

  await saveChatSettings(sql, { ...base, mode: 'rules' }, 'test');
  invalidateRules();
  calls = 0;
  let j = await chat({ text: 'Giá combo nám bao nhiêu?' });
  ok('cấu hình lưu trên admin thắng env (env có webhook vẫn trả bằng kịch bản)', calls === 0 && j.messages.some((m) => m.type === 'product'), j.messages.map((m) => m.type).join(','));
  ok('kịch bản: giá đi bằng thẻ sản phẩm lấy từ catalog', j.messages.find((m) => m.type === 'product')?.product.priceText === catalog.products.find((p) => p.slug === 'combo-nam' && p.locale === 'vi').priceText);
  ok('kịch bản: nút gợi ý theo sau', j.quickReplies.some((q) => q.payload === 'compare'));
  j = await chat({ text: 'Khác nhau thế nào?', payload: 'compare', event: 'quick_reply' });
  ok('nút gợi ý (payload) -> đúng kịch bản', j.messages.some((m) => m.type === 'products'));
  j = await chat({ text: 'ai gọi lại cho tôi được không' });
  ok('biến {{brand.phoneDisplay}} được thay + handoff thêm nút gọi', !JSON.stringify(j).includes('{{') && j.handoff && j.messages.some((m) => /^tel:/.test(m.url ?? '')));
  j = await chat({ text: 'cho tôi hỏi về chuyện lạ abc xyz' });
  ok('câu lạ -> câu dự phòng, không có "degraded"', !j.degraded && j.quickReplies.length > 0);
  j = await chat({ text: 'đặt hàng thế nào' }, '/chinh-sach/chinh-sach-doi-tra/');
  ok('{{page}} ở trang không phải sản phẩm -> bỏ thẻ, vẫn trả lời', j.messages.length > 0 && !j.messages.some((m) => m.type === 'product'));

  await saveChatSettings(sql, { ...base, mode: 'n8n', webhookUrl: 'https://n8n.test/w', rulesFallback: true }, 'test');
  calls = 0; j = await chat({ text: 'ship mấy ngày' });
  ok('chế độ n8n: gọi n8n theo URL trên trang quản trị', calls === 1 && j.messages[0].text === 'n8n đây');
  j = await chat({ text: 'câu lạ cho n8n' });
  ok('n8n báo "matched": false -> ghi là chưa hiểu', (await sql.query("SELECT matched FROM chat_messages WHERE role = 'bot' ORDER BY id DESC LIMIT 1")).rows[0].matched === false);
  mode = 'down'; j = await chat({ text: 'ship mấy ngày' });
  ok('n8n lỗi + bật dự phòng -> kịch bản trả lời thay, khách không thấy lỗi', !j.degraded && /2–5 ngày/.test(j.messages[0].text));
  const fb = (await sql.query("SELECT source, payload FROM chat_messages WHERE role = 'bot' ORDER BY id DESC LIMIT 1")).rows[0];
  ok('…nhưng vẫn ghi lại n8n lỗi', fb.source === 'fallback' && fb.payload.upstream === 'upstream');
  await saveChatSettings(sql, { ...base, mode: 'n8n', webhookUrl: 'https://n8n.test/w', rulesFallback: false }, 'test');
  j = await chat({ text: 'ship mấy ngày' });
  ok('n8n lỗi + tắt dự phòng -> xin lỗi + hotline', j.degraded === 'upstream' && j.messages.some((m) => /^tel:/.test(m.url ?? '')));
  mode = 'ok';
  await saveChatSettings(sql, { ...base, mode: 'off' }, 'test');
  j = await chat({ text: 'alo' });
  ok('chế độ tạm nghỉ', j.degraded === 'off');
  await saveChatSettings(sql, { ...base, mode: 'rules' }, 'test');

  // ---------------------------------------------------------------- 8. dữ liệu phân tích
  const bot = (await sql.query("SELECT * FROM chat_messages WHERE session_id = $1 AND role = 'bot' ORDER BY id", [SESSION])).rows;
  ok('mỗi lượt bot ghi nguồn, kịch bản, thời gian, thẻ đã hiện', bot[0].source === 'rules' && bot[0].rule_id && bot[0].latency_ms >= 0 && bot[0].products.includes('combo-nam'),
    `${bot[0].source} #${bot[0].rule_id} ${bot[0].latency_ms}ms [${bot[0].products}]`);
  ok('lượt khách + lượt bot nối nhau bằng message_id', (await sql.query('SELECT count(DISTINCT role)::int AS n FROM chat_messages WHERE message_id = $1', [bot[0].message_id])).rows[0].n === 2);
  let sess = (await sql.query('SELECT * FROM chat_sessions WHERE session_id = $1', [SESSION])).rows[0];
  ok('phiên: đếm tin, trả lời, chưa hiểu, sự cố, chuyển người, utm', sess.user_messages === bot.length && sess.answered_rules >= 4 && sess.answered_n8n === 1
    && sess.unmatched === 2 && sess.degraded >= 3 && sess.handoff && sess.utm_source === 'fb' && sess.entry_path === '/combo-nam/',
    `${sess.user_messages} tin · kb ${sess.answered_rules} · n8n ${sess.answered_n8n} · chưa hiểu ${sess.unmatched} · sự cố ${sess.degraded}`);
  ok('phiên không chứa chữ hội thoại', !JSON.stringify(sess).includes('ship'));

  const ev = (body, cookie = jar) => app(new Request(`${H}/api/chat/event`, { method: 'POST', headers: { 'content-type': 'text/plain', ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body) }));
  let r = await ev({ sessionId: SESSION, type: 'product_click', slug: 'combo-nam' });
  await ev({ sessionId: SESSION, type: 'order_click', slug: 'combo-nam' });
  await ev({ sessionId: SESSION, type: 'open' });
  ok('sự kiện: 204, đếm bấm thẻ / bấm đặt', r.status === 204 && (await sql.query('SELECT product_clicks, order_clicks FROM chat_sessions WHERE session_id = $1', [SESSION])).rows[0].order_clicks === 1);
  const before = (await sql.query('SELECT count(*)::int AS n FROM chat_events')).rows[0].n;
  await ev({ sessionId: SESSION, type: 'product_click', slug: 'combo-nam' }, '');
  await ev({ sessionId: SESSION, type: 'drop_table' });
  await ev({ sessionId: SESSION, type: 'product_click', slug: "x'; DROP TABLE orders;--" });
  const after = (await sql.query('SELECT count(*)::int AS n FROM chat_events')).rows[0].n;
  ok('sự kiện: không cookie / loại lạ bị bỏ, slug lạ thành null', after === before + 1 && (await sql.query('SELECT slug FROM chat_events ORDER BY id DESC LIMIT 1')).rows[0].slug === null);

  r = await app(new Request(`${H}/api/orders`, { method: 'POST', headers: { 'content-type': 'application/json', origin: H, cookie: jar, 'cf-connecting-ip': '192.0.2.50' },
    body: JSON.stringify({ productSlug: 'combo-nam', locale: 'vi', pack: 'combo-full', packPrice: 1050000, name: 'Khách Chat', phone: '0912000111',
      address: '1 Lê Lợi, Quận 1, TP.HCM', dataConsent: true, consentText: 'Tôi đồng ý để Mocha dùng thông tin này để liên hệ và giao đơn hàng.' }) }));
  const order = await r.json();
  sess = (await sql.query('SELECT order_code FROM chat_sessions WHERE session_id = $1', [SESSION])).rows[0];
  ok('đơn đặt sau khi chat -> gắn vào phiên (chuyển đổi)', r.status === 200 && sess.order_code === order.orderCode, order.orderCode ?? JSON.stringify(order));

  // ---------------------------------------------------------------- 9. trang quản trị
  await createUser(sql, 'quan-tri-chat', 'mat-khau-quan-tri-01', 'admin');
  await createUser(sql, 'bien-tap-chat', 'mat-khau-bien-tap-01', 'editor');
  const form = (o) => new URLSearchParams(o).toString();
  const loginAs = async (u, p) => (await app(new Request(`${H}/admin/login`, { method: 'POST', body: form({ username: u, password: p }),
    headers: { 'content-type': 'application/x-www-form-urlencoded', origin: H } }))).headers.get('set-cookie').split(';')[0];
  const ckA = await loginAs('quan-tri-chat', 'mat-khau-quan-tri-01');
  const ckE = await loginAs('bien-tap-chat', 'mat-khau-bien-tap-01');
  const adm = (ck, path, body) => app(new Request(`${H}${path}`, body
    ? { method: 'POST', body: form(body), headers: { cookie: ck, origin: H, 'content-type': 'application/x-www-form-urlencoded' } }
    : { headers: { cookie: ck } }));

  ok('cấu hình chat: biên tập viên bị chặn (403)', (await adm(ckE, '/admin/settings/chat')).status === 403);
  const SECRET = 'khoa-chung-rat-dai-0123456789abcdef';
  const S = { mode: 'n8n', webhookUrl: 'https://n8n.mocha.test/webhook/chat', sharedSecret: SECRET, timeoutSec: '10', rateMax: '40', retentionDays: '60', sessionRetentionDays: '365', rulesFallback: '1', action: 'save' };
  r = await adm(ckA, '/admin/settings/chat', S);
  invalidate();
  let s = await getChatSettings(sql, env);
  ok('lưu cấu hình từ trang quản trị', r.status === 303 && s.mode === 'n8n' && s.webhookUrl === S.webhookUrl && s.sharedSecret === SECRET && s.timeoutMs === 10000 && s.retentionDays === 60);
  let html = await (await adm(ckA, '/admin/settings/chat')).text();
  ok('khoá chung không bao giờ hiện lại đầy đủ', !html.includes(SECRET) && html.includes('khoa…cdef'));
  await adm(ckA, '/admin/settings/chat', { ...S, sharedSecret: '' });
  invalidate();
  ok('để trống ô khoá = giữ khoá cũ', (await getChatSettings(sql, env)).sharedSecret === SECRET);
  r = await adm(ckA, '/admin/settings/chat', { ...S, webhookUrl: 'http://evil.example/x' });
  html = await r.text();
  invalidate();
  ok('webhook http ra ngoài bị từ chối, cấu hình cũ giữ nguyên', html.includes('https://') && (await getChatSettings(sql, env)).webhookUrl === S.webhookUrl);
  calls = 0;
  html = await (await adm(ckA, '/admin/settings/chat', { ...S, action: 'test' })).text();
  ok('nút "Thử kết nối" gọi n8n và hiện kết quả', calls === 1 && html.includes('n8n trả lời sau') && html.includes('n8n đây'));
  r = await app(new Request(`${H}/admin/settings/chat`, { method: 'POST', body: form(S), headers: { cookie: ckA, origin: 'https://evil.example', 'content-type': 'application/x-www-form-urlencoded' } }));
  ok('đổi cấu hình từ trang khác (CSRF) bị chặn', r.status === 403);
  await saveChatSettings(sql, { ...base, mode: 'rules' }, 'test');

  html = await (await adm(ckE, '/admin/chat-rules')).text();
  ok('kịch bản: biên tập viên xem được danh sách', html.includes('Dự phòng — chưa hiểu câu hỏi') && html.includes('Mang thai'));
  html = await (await adm(ckE, '/admin/chat-rules?q=' + encodeURIComponent('đang cho con bú dùng được không'))).text();
  ok('ô thử: cho biết câu khớp kịch bản nào + xem trước', html.includes('Mang thai, cho con bú') && html.includes('bác sĩ'));
  const NEW = { name: 'Giờ làm việc', topic: 'mua-hang', priority: '60', locale: 'vi', enabled: '1', keywords: 'giờ làm việc\nmấy giờ mở cửa', payloads: 'hours',
    response: JSON.stringify({ messages: [{ type: 'text', text: 'Chuyên viên trả lời từ 8:00 đến 21:00 mỗi ngày.' }] }) };
  r = await adm(ckE, '/admin/chat-rules/edit', NEW);
  const created = (await sql.query("SELECT * FROM chat_rules WHERE name = 'Giờ làm việc'")).rows[0];
  ok('tạo kịch bản mới (biên tập viên)', r.status === 303 && created?.keywords.length === 2 && created.updated_by === 'bien-tap-chat');
  invalidateRules();
  j = await chat({ text: 'shop mấy giờ mở cửa vậy' });
  ok('kịch bản mới dùng được ngay', /8:00/.test(j.messages[0].text));
  html = await (await adm(ckE, '/admin/chat-rules/edit', { ...NEW, name: 'Cam kết', response: JSON.stringify({ messages: [{ type: 'text', text: 'Cam kết hết nám sau 2 tuần, chỉ 590.000đ' }] }) })).text();
  ok('không lưu được kịch bản có từ cấm / số tiền viết tay', html.includes('Chưa lưu') && html.includes('Nghị định 342') && html.includes('số tiền'));
  html = await (await adm(ckE, '/admin/chat-rules/edit', { ...NEW, name: 'Hỏng', response: '{ không phải json' })).text();
  ok('JSON hỏng -> báo lỗi, giữ nguyên chữ đã gõ', html.includes('không phải JSON hợp lệ') && html.includes('{ không phải json'));
  html = await (await adm(ckE, '/admin/chat-rules/edit', { ...NEW, name: 'Slug bịa', response: JSON.stringify({ messages: [{ type: 'product', slug: 'kem-than-ky' }] }) })).text();
  ok('slug sản phẩm không có thật bị chặn', html.includes('kem-than-ky'));
  await adm(ckE, '/admin/chat-rules/toggle', { id: String(created.id) });
  ok('tắt kịch bản', (await sql.query('SELECT enabled FROM chat_rules WHERE id = $1', [created.id])).rows[0].enabled === false);
  await adm(ckE, '/admin/chat-rules/delete', { id: String(created.id) });
  ok('xoá cần tích xác nhận', (await sql.query('SELECT 1 FROM chat_rules WHERE id = $1', [created.id])).rows.length === 1);
  await adm(ckE, '/admin/chat-rules/delete', { id: String(created.id), confirm: '1' });
  ok('xoá kịch bản', (await sql.query('SELECT 1 FROM chat_rules WHERE id = $1', [created.id])).rows.length === 0);

  html = await (await adm(ckE, '/admin/chats')).text();
  ok('trang Chat: số liệu + câu chưa trả lời được + nút tạo kịch bản', html.includes('Cuộc trò chuyện') && html.includes('Đơn sau khi chat')
    && html.includes('chuyện lạ abc xyz') && html.includes('/admin/chat-rules/edit?new=1&q='));
  html = await (await adm(ckE, `/admin/chats?s=${SESSION}`)).text();
  ok('xem lại cuộc: nguồn trả lời + tên kịch bản + sự kiện + đơn', html.includes('Kịch bản') && html.includes('/admin/chat-rules/edit?id=') && html.includes('order_click') && html.includes(order.orderCode));
  html = await (await adm(ckE, '/admin/chat-rules/edit?new=1&q=' + encodeURIComponent('Kem có dùng cho da dầu được không'))).text();
  ok('"Tạo kịch bản" điền sẵn câu khách hỏi', html.includes('kem co dung cho'));

  // ---------------------------------------------------------------- 10. xuất dữ liệu
  r = await app(new Request(`${H}/api/admin/chats`));
  ok('xuất dữ liệu không token -> 401', r.status === 401);
  r = await app(new Request(`${H}/api/admin/chats?type=messages`, { headers: { authorization: `Bearer ${env.ADMIN_TOKEN}` } }));
  const lines = (await r.text()).trim().split('\n').map((l) => JSON.parse(l));
  ok('xuất NDJSON tin nhắn', r.status === 200 && /ndjson/.test(r.headers.get('content-type')) && lines.length > 10 && lines.every((x) => x.session_id), `${lines.length} dòng`);
  r = await app(new Request(`${H}/api/admin/chats?type=sessions&from=2000-01-01&to=2999-12-31`, { headers: { authorization: `Bearer ${env.ADMIN_TOKEN}` } }));
  ok('xuất phiên theo khoảng ngày', r.status === 200 && (await r.text()).includes(SESSION));
  r = await app(new Request(`${H}/api/admin/chats?type=orders`, { headers: { authorization: `Bearer ${env.ADMIN_TOKEN}` } }));
  ok('xuất bảng khác (orders) qua API chat bị từ chối', r.status === 400);

  // ---------------------------------------------------------------- 11. thời hạn lưu
  await sql.query("UPDATE chat_messages SET created_at = now() - interval '200 days' WHERE session_id = $1", [SESSION]);
  await saveChatSettings(sql, { ...base, mode: 'rules', retentionDays: 90, sessionRetentionDays: 400 }, 'test');
  _resetPurge();
  await chat({ text: 'cảm ơn' });
  const left = (await sql.query('SELECT count(*)::int AS n FROM chat_messages WHERE session_id = $1', [SESSION])).rows[0].n;
  ok('quá hạn: xoá chữ hội thoại, GIỮ số liệu phiên', left === 2 && (await sql.query('SELECT 1 FROM chat_sessions WHERE session_id = $1', [SESSION])).rows.length === 1, `${left} tin còn lại`);
}
