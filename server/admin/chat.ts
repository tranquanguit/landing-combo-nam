/**
 * Trang quản trị cho chat:
 *   /admin/chats              số liệu (30 ngày) + câu chưa trả lời được + danh sách cuộc trò chuyện
 *   /admin/chats?s=<id>       xem lại một cuộc
 *   /admin/chat-rules         kịch bản tư vấn: danh sách, bật/tắt, ô thử "câu này khớp kịch bản nào"
 *   /admin/chat-rules/edit    tạo / sửa / xoá một kịch bản
 *   /admin/settings/chat      chế độ trả lời + webhook n8n + khoá chung + thời hạn lưu (chỉ quyền admin)
 *
 * Mọi chữ đến từ khách hoặc từ n8n đều escape — trang quản trị không tin dữ liệu chat.
 */
import type { User } from '../lib/auth.ts';
import type { AdminCtx } from './app.ts';
import { page, redirect, esc, notice } from './html.ts';
import { getChatSettings, saveChatSettings, defaults, validate, maskSecret, type ChatSettings } from '../lib/chat-settings.ts';
import { guardRule, invalidateRules, unaccent, type Rule } from '../lib/chat-rules.ts';
import { answerByRules, loadCatalog, normalizeResponse, testN8n, type Normalized } from '../lib/chat.ts';
import { chatAnalytics } from '../lib/chat-analytics.ts';

const fmt = (d: any) => (d ? new Date(d).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '—');
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '—');
const envOf = (ctx: AdminCtx) => (ctx.env ?? process.env) as Record<string, string | undefined>;
const SOURCE_VI: Record<string, string> = {
  rules: 'Kịch bản', n8n: 'n8n', fallback: 'Kịch bản (thay n8n lỗi)', off: 'Chat tắt', rate_limited: 'Gửi quá nhanh', error: 'Không trả lời được', 'khác': 'Trước khi có phân tích',
};
const MODE_VI: Record<string, string> = { off: 'Tạm nghỉ', rules: 'Kịch bản tư vấn', n8n: 'n8n' };

export async function chatRoutes(path: string, request: Request, ctx: AdminCtx, user: User, url: URL): Promise<Response | null> {
  if (path === '/admin/chats') return chatsPage(ctx, user, url);
  if (path === '/admin/chat-rules') return rulesPage(ctx, user, url);
  if (path === '/admin/chat-rules/edit') return request.method === 'POST' ? saveRule(ctx, user, request) : editRulePage(ctx, user, url);
  if (path === '/admin/chat-rules/toggle' && request.method === 'POST') return toggleRule(ctx, user, request);
  if (path === '/admin/chat-rules/delete' && request.method === 'POST') return deleteRule(ctx, request);
  if (path === '/admin/settings/chat') {
    if (user.role !== 'admin') return page('Không có quyền', notice('err', 'Chỉ tài khoản quyền <b>admin</b> sửa được cấu hình chat (có khoá bí mật).'), user, 403);
    return request.method === 'POST' ? saveSettings(ctx, user, request) : settingsPage(ctx, user, url);
  }
  return null;
}

// ================================================================= cấu hình
async function settingsPage(ctx: AdminCtx, user: User, url: URL, opts: { errors?: string[]; draft?: ChatSettings; test?: Awaited<ReturnType<typeof testN8n>> } = {}) {
  const env = envOf(ctx);
  const saved = (await ctx.sql.query<any>("SELECT updated_at, updated_by FROM app_settings WHERE key = 'chat'")).rows[0];
  const s = opts.draft ?? await getChatSettings(ctx.sql, env);
  const t = opts.test;
  const radio = (v: string, title: string, help: string) => `
    <label style="display:flex;gap:10px;align-items:flex-start;font-weight:400"><input type="radio" name="mode" value="${v}" ${s.mode === v ? 'checked' : ''} style="width:auto;margin-top:4px">
      <span><b>${title}</b><br><span class="muted">${help}</span></span></label>`;
  return page('Cấu hình chat', `
    <h1>Cấu hình chat</h1>
    ${url.searchParams.get('ok') ? notice('ok', 'Đã lưu. Áp dụng ngay cho tin nhắn kế tiếp (không cần khởi động lại).') : ''}
    ${opts.errors?.length ? notice('err', `Chưa lưu:<ul>${opts.errors.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>`) : ''}
    ${t ? notice(t.ok ? 'ok' : 'err', t.ok
      ? `n8n trả lời sau <b>${t.ms} ms</b>: ${t.blocks} khối hợp lệ${t.dropped ? `, <b>${t.dropped} khối bị bỏ</b> (sai chuẩn — xem docs/chat/response.schema.json)` : ''}.${preview(t.normalized!)}`
      : `Thử kết nối thất bại sau ${t.ms} ms: <code>${esc(t.error)}</code>`) : ''}
    <p class="muted">${saved ? `Đang dùng cấu hình lưu trên trang này — sửa lần cuối ${esc(fmt(saved.updated_at))} bởi ${esc(saved.updated_by)}.`
      : 'Chưa lưu lần nào: đang dùng giá trị khởi đầu từ biến môi trường (.env). Lưu ở đây thì trang này được ưu tiên.'}</p>
    <form method="post" action="/admin/settings/chat">
      <div class="card"><h2 style="margin-top:0">Ai trả lời khách?</h2>
        <div class="grid" style="grid-template-columns:1fr">
          ${radio('rules', 'Kịch bản tư vấn', 'Trả lời theo bộ kịch bản ở <a href="/admin/chat-rules">Kịch bản chat</a>. Không cần n8n.')}
          ${radio('n8n', 'n8n (trợ lý AI / quy trình riêng)', 'Mỗi tin nhắn gửi tới webhook bên dưới, câu trả lời của n8n hiện cho khách.')}
          ${radio('off', 'Tạm nghỉ', 'Khung chat vẫn hiện nhưng mời khách gọi / nhắn Zalo.')}
          <label style="display:flex;gap:10px;font-weight:400"><input type="checkbox" name="rulesFallback" value="1" ${s.rulesFallback ? 'checked' : ''} style="width:auto">
            <span>Khi n8n lỗi, chậm hoặc trả rỗng: <b>trả lời bằng kịch bản</b> thay vì xin lỗi khách.</span></label>
        </div></div>
      <div class="card"><h2 style="margin-top:0">Kết nối n8n</h2>
        <div class="grid" style="grid-template-columns:1fr">
          <label>Webhook URL <input name="webhookUrl" value="${esc(s.webhookUrl)}" placeholder="https://n8n.ten-mien.vn/webhook/mocha-chat" autocomplete="off" spellcheck="false"></label>
          <label>Khoá chung (N8N_SHARED_SECRET) — tối thiểu 16 ký tự
            <input name="sharedSecret" type="password" value="" autocomplete="new-password" placeholder="${s.sharedSecret ? `đã đặt: ${esc(maskSecret(s.sharedSecret))} — để trống để giữ nguyên` : 'chưa đặt — sinh: openssl rand -hex 32'}"></label>
          ${s.sharedSecret ? '<label style="display:flex;gap:10px;font-weight:400"><input type="checkbox" name="clearSecret" value="1" style="width:auto"> Xoá khoá chung (n8n sẽ không kiểm được chữ ký)</label>' : ''}
        </div>
        <p class="muted">Máy chủ gửi kèm <code>X-Mocha-Token</code>, <code>X-Mocha-Timestamp</code>, <code>X-Mocha-Signature: sha256=HMAC(khoá, timestamp + "." + body)</code>.
          Chuẩn JSON hai chiều: <code>docs/chat/request.schema.json</code>, <code>docs/chat/response.schema.json</code>; hướng dẫn: <code>docs/chat-n8n.md</code>.
          Khoá không bao giờ hiện lại đầy đủ trên trang này.</p>
        <div class="grid">
          <label>Chờ n8n tối đa (giây) <input name="timeoutSec" type="number" min="2" max="60" value="${Math.round(s.timeoutMs / 1000)}"></label>
        </div></div>
      <div class="card"><h2 style="margin-top:0">Giới hạn + lưu trữ</h2>
        <div class="grid">
          <label>Tin tối đa / 10 phút / khách <input name="rateMax" type="number" min="3" max="500" value="${s.rateMax}"></label>
          <label>Giữ chữ hội thoại (ngày) <input name="retentionDays" type="number" min="1" max="3650" value="${s.retentionDays}"></label>
          <label>Giữ số liệu phiên, không chữ (ngày) <input name="sessionRetentionDays" type="number" min="30" max="3650" value="${s.sessionRetentionDays}"></label>
        </div>
        <p class="muted">Chữ hội thoại là dữ liệu cá nhân (Nghị định 13/2023): giữ đủ để chăm sóc và cải thiện kịch bản, rồi xoá. Số liệu phiên chỉ có số đếm, giữ lâu hơn để so sánh theo mùa.</p></div>
      <div class="row"><button name="action" value="save">Lưu cấu hình</button>
        <button class="ghost" name="action" value="test">Thử kết nối n8n (không lưu)</button></div>
    </form>`, user);
}

async function saveSettings(ctx: AdminCtx, user: User, request: Request) {
  const f = await request.formData();
  const env = envOf(ctx);
  const current = await getChatSettings(ctx.sql, env);
  const secretIn = String(f.get('sharedSecret') ?? '').trim();
  const input: Partial<ChatSettings> = {
    mode: String(f.get('mode') ?? current.mode) as ChatSettings['mode'],
    rulesFallback: f.get('rulesFallback') === '1',
    webhookUrl: String(f.get('webhookUrl') ?? ''),
    sharedSecret: f.get('clearSecret') === '1' ? '' : secretIn || current.sharedSecret,
    timeoutMs: Number(f.get('timeoutSec')) * 1000,
    rateMax: Number(f.get('rateMax')), retentionDays: Number(f.get('retentionDays')), sessionRetentionDays: Number(f.get('sessionRetentionDays')),
  };
  const v = validate(input, { ...defaults(env), ...current });
  const draft = { ...current, ...input, sharedSecret: input.sharedSecret ?? '' } as ChatSettings;
  if (f.get('action') === 'test') {
    if (!draft.webhookUrl) return settingsPage(ctx, user, new URL(request.url), { draft, errors: ['Nhập Webhook URL để thử.'] });
    if (!v.ok && v.errors.some((e) => /Webhook|Khoá/.test(e))) return settingsPage(ctx, user, new URL(request.url), { draft, errors: v.errors });
    return settingsPage(ctx, user, new URL(request.url), { draft, test: await testN8n(v.ok ? v.value : draft, ctx.root, ctx.fetch) });
  }
  if (!v.ok) return settingsPage(ctx, user, new URL(request.url), { draft, errors: v.errors });
  await saveChatSettings(ctx.sql, v.value, user.username);
  return redirect('/admin/settings/chat?ok=1');
}

// ================================================================= xem trước một phản hồi
/** **đậm** như khung chat hiện — chạy SAU esc(), nên chỉ thêm đúng thẻ <b>. */
const bold = (html: string) => html.replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>');
function preview(n: Normalized) {
  const b = n.messages.map((m) => {
    if (m.type === 'text') return `<div class="card" style="margin:6px 0;white-space:pre-wrap">${bold(esc(m.text))}</div>`;
    if (m.type === 'product') return `<div class="card" style="margin:6px 0">🛍 <b>${esc(m.product.name)}</b> · ${esc(m.product.priceText)}${m.note ? ` — <i>${esc(m.note)}</i>` : ''} <span class="muted">${esc(m.product.url)}</span></div>`;
    if (m.type === 'products') return `<div class="card" style="margin:6px 0">🛍 ${m.products.map((p: any) => `<b>${esc(p.name)}</b> (${esc(p.priceText)})`).join(' · ')}</div>`;
    if (m.type === 'link') return `<div style="margin:6px 0"><span class="pill">↗ ${esc(m.label)}</span> <span class="muted">${esc(m.url)}</span></div>`;
    if (m.type === 'image') return `<div class="muted">[ảnh ${esc(m.url)}]</div>`;
    return '';
  }).join('');
  const q = n.quickReplies.length ? `<div class="row">${n.quickReplies.map((q) => `<span class="pill" title="${esc(q.payload)}">${esc(q.label)}</span>`).join('')}</div>` : '';
  return `<div style="margin-top:8px">${b}${q}${n.handoff ? '<div class="muted">↪ chuyển chuyên viên (kèm nút gọi / Zalo)</div>' : ''}</div>`;
}

// ================================================================= kịch bản
async function rulesPage(ctx: AdminCtx, user: User, url: URL) {
  const { sql } = ctx;
  const rules = (await sql.query<Rule & { updated_at: string }>('SELECT * FROM chat_rules ORDER BY is_fallback, topic, priority DESC, id')).rows;
  const s = await getChatSettings(sql, envOf(ctx));
  const q = url.searchParams.get('q') ?? '';
  const locale = url.searchParams.get('locale') === 'en' ? 'en' : 'vi';
  const path = url.searchParams.get('path') || '/combo-nam/';
  let tested = '';
  if (q) {
    invalidateRules();
    const catalog = loadCatalog(ctx.root);
    const ans = await answerByRules(sql, { text: q, payload: q, locale, page: { path, title: null, utm: {} }, images: [] }, catalog);
    tested = ans
      ? notice(ans.fallback ? 'warn' : 'ok', `${ans.fallback ? 'Không kịch bản nào khớp → câu <b>dự phòng</b>' : 'Khớp'}: <a href="/admin/chat-rules/edit?id=${ans.rule.id}"><b>${esc(ans.rule.name)}</b></a>
          ${ans.hits.length ? ` <span class="muted">(${ans.hits.map((h) => esc(h)).join(', ')})</span>` : ''}
          ${ans.fallback ? ` · <a href="/admin/chat-rules/edit?new=1&q=${encodeURIComponent(q)}">Tạo kịch bản cho câu này</a>` : ''}
          ${preview(normalizeResponse(ans.raw, catalog, locale, []))}`)
      : notice('err', 'Không có kịch bản nào, kể cả câu dự phòng — khách sẽ nhận lời xin lỗi.');
  }
  const handled = new Set(rules.filter((r) => r.enabled).flatMap((r) => r.payloads.map((p) => `${r.locale}:${p}`)));
  const dead = (r: Rule) => (r.response?.quickReplies ?? []).filter((x: any) => x.payload && !handled.has(`${r.locale}:${x.payload}`) && !handled.has(`*:${x.payload}`)).map((x: any) => x.payload);
  return page('Kịch bản chat', `
    <h1>Kịch bản tư vấn <span class="muted">(${rules.length})</span></h1>
    <p class="muted">Chế độ đang chạy: <b>${esc(MODE_VI[s.mode])}</b>${s.mode === 'n8n' ? (s.rulesFallback ? ' — kịch bản trả lời thay khi n8n lỗi' : ' — kịch bản không được dùng') : ''}.
      ${user.role === 'admin' ? '<a href="/admin/settings/chat">Đổi</a>' : ''}
      Kịch bản so khớp <b>không dấu</b> ("da toi bi nam" = "da tôi bị nám"), nên dùng cụm 2–3 từ thay vì một từ trần ("nam" cũng là "nam giới").</p>
    <form class="card row" method="get" action="/admin/chat-rules">
      <label style="flex:1 1 320px">Thử một câu khách hỏi <input name="q" value="${esc(q)}" placeholder="vd: da tôi bị nám sau sinh, dùng gì?"></label>
      <label>Ngôn ngữ <select name="locale"><option value="vi">vi</option><option value="en" ${locale === 'en' ? 'selected' : ''}>en</option></select></label>
      <label>Trang đang xem <input name="path" value="${esc(path)}" style="width:180px"></label>
      <button>Thử</button>
    </form>
    ${tested}
    <div class="row"><a class="btn" href="/admin/chat-rules/edit?new=1">+ Kịch bản mới</a></div>
    <table><tr><th>Kịch bản</th><th>Khi nào</th><th>Ưu tiên</th><th>Đã dùng</th><th></th></tr>
    ${rules.map((r) => {
      const d = dead(r);
      return `<tr style="${r.enabled ? '' : 'opacity:.55'}">
      <td><a href="/admin/chat-rules/edit?id=${r.id}"><b>${esc(r.name)}</b></a><br><span class="pill">${esc(r.topic)}</span> <span class="pill">${esc(r.locale)}</span>
        ${r.is_fallback ? '<span class="pill draft">dự phòng</span>' : ''}${r.response?.handoff ? ' <span class="pill">chuyển người</span>' : ''}
        ${d.length ? `<br><span class="muted" style="color:var(--warn)">⚠ nút chưa có kịch bản nhận: ${d.map((x: string) => esc(x)).join(', ')}</span>` : ''}</td>
      <td class="muted">${r.is_fallback ? 'không kịch bản nào khớp' : [
        r.keywords.length ? `${r.keywords.slice(0, 6).map((k) => esc(k)).join(', ')}${r.keywords.length > 6 ? ` … (+${r.keywords.length - 6})` : ''}` : '',
        r.payloads.length ? `nút: ${r.payloads.map((p) => esc(p)).join(', ')}` : '',
        r.requires_images ? 'khách gửi ảnh' : '', r.path_prefix ? `trang ${esc(r.path_prefix)}*` : ''].filter(Boolean).join('<br>')}</td>
      <td>${r.priority}</td>
      <td>${r.hits ?? 0}<br><span class="muted">${r.last_hit_at ? esc(fmt(r.last_hit_at)) : ''}</span></td>
      <td><form method="post" action="/admin/chat-rules/toggle"><input type="hidden" name="id" value="${r.id}">
        <button class="ghost">${r.enabled ? 'Tắt' : 'Bật'}</button></form></td></tr>`;
    }).join('')}
    </table>`, user);
}

const TEMPLATE = {
  messages: [
    { type: 'text', text: 'Câu trả lời. **In đậm** bằng hai dấu sao. Số điện thoại: {{brand.phoneDisplay}}.' },
    { type: 'product', slug: '{{page}}', note: 'ghi chú nhỏ dưới thẻ (không bắt buộc)' },
  ],
  quickReplies: [{ label: 'Gặp chuyên viên', payload: 'handoff' }],
  handoff: false,
};
interface RuleForm { id?: number; name: string; topic: string; enabled: boolean; priority: number; locale: Rule['locale']; keywords: string[]; payloads: string[];
  path_prefix: string | null; requires_images: boolean; is_fallback: boolean; responseText: string }

async function editRulePage(ctx: AdminCtx, user: User, url: URL, opts: { form?: RuleForm; errors?: string[] } = {}) {
  const id = Number(url.searchParams.get('id'));
  let f = opts.form;
  if (!f && id) {
    const r = (await ctx.sql.query<any>('SELECT * FROM chat_rules WHERE id = $1', [id])).rows[0];
    if (!r) return page('Kịch bản', notice('err', 'Không có kịch bản này (có thể đã bị xoá).'), user, 404);
    f = { ...r, responseText: JSON.stringify(r.response, null, 2) };
  }
  if (!f) {
    const q = url.searchParams.get('q') ?? '';
    f = { name: q ? `Câu hỏi: ${q.slice(0, 60)}` : '', topic: 'khac', enabled: true, priority: 50, locale: 'vi', keywords: q ? [unaccent(q).split(' ').slice(0, 4).join(' ')] : [],
      payloads: [], path_prefix: null, requires_images: false, is_fallback: false, responseText: JSON.stringify(TEMPLATE, null, 2) };
  }
  const catalog = loadCatalog(ctx.root);
  const slugs = [...new Set(catalog.products.map((p) => p.slug))];
  const topics = (await ctx.sql.query<{ topic: string }>('SELECT DISTINCT topic FROM chat_rules ORDER BY topic')).rows.map((r) => r.topic);
  const payloads = (await ctx.sql.query<{ p: string }>('SELECT DISTINCT unnest(payloads) AS p FROM chat_rules ORDER BY 1')).rows.map((r) => r.p);
  const check = (name: string, on: boolean, label: string) => `<label style="display:flex;gap:8px;font-weight:400"><input type="checkbox" name="${name}" value="1" ${on ? 'checked' : ''} style="width:auto"> <span>${label}</span></label>`;
  return page(f.id ? 'Sửa kịch bản' : 'Kịch bản mới', `
    <h1>${f.id ? 'Sửa kịch bản' : 'Kịch bản mới'}</h1>
    <p><a href="/admin/chat-rules">← tất cả kịch bản</a></p>
    ${url.searchParams.get('ok') ? notice('ok', 'Đã lưu — áp dụng cho tin nhắn kế tiếp.') : ''}
    ${opts.errors?.length ? notice('err', `Chưa lưu:<ul>${opts.errors.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>`) : ''}
    <form method="post" action="/admin/chat-rules/edit">
      ${f.id ? `<input type="hidden" name="id" value="${f.id}">` : ''}
      <div class="card grid">
        <label style="grid-column:1/-1">Tên (chỉ người quản trị thấy) <input name="name" value="${esc(f.name)}" required maxlength="120"></label>
        <label>Chủ đề <input name="topic" value="${esc(f.topic)}" list="topics" maxlength="40"><datalist id="topics">${topics.map((t) => `<option value="${esc(t)}">`).join('')}</datalist></label>
        <label>Ưu tiên (0–1000, cao thắng) <input name="priority" type="number" min="0" max="1000" value="${f.priority}"></label>
        <label>Ngôn ngữ <select name="locale">${['vi', 'en', '*'].map((l) => `<option ${f!.locale === l ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label>Chỉ ở trang bắt đầu bằng <input name="path_prefix" value="${esc(f.path_prefix ?? '')}" placeholder="vd: /combo-nam/ — trống = mọi trang"></label>
        ${check('enabled', f.enabled, 'Đang bật')}
        ${check('requires_images', f.requires_images, 'Chỉ khi khách gửi ảnh')}
        ${check('is_fallback', f.is_fallback, 'Câu <b>dự phòng</b> (dùng khi không kịch bản nào khớp)')}
      </div>
      <div class="card grid" style="grid-template-columns:repeat(auto-fit,minmax(min(300px,100%),1fr))">
        <label>Cụm từ khách hay gõ — mỗi dòng một cụm (có dấu hay không đều được)
          <textarea name="keywords" rows="9">${esc(f.keywords.join('\n'))}</textarea></label>
        <label>Giá trị nút gợi ý nhận vào — mỗi dòng một giá trị
          <textarea name="payloads" rows="9">${esc(f.payloads.join('\n'))}</textarea>
          <span class="muted">Đang dùng: ${payloads.map((p) => `<code>${esc(p)}</code>`).join(' ') || '—'}</span></label>
      </div>
      <div class="card">
        <label>Câu trả lời — JSON đúng chuẩn <code>docs/chat/response.schema.json</code>
          <textarea class="json" name="response" spellcheck="false" style="min-height:360px">${esc(f.responseText)}</textarea></label>
        <p class="muted">Khối: <code>text</code> (chữ, <code>**đậm**</code>) · <code>product</code> (<code>slug</code>) · <code>products</code> (<code>slugs</code>, tối đa 6) · <code>link</code> (<code>label</code>, <code>url</code>) · <code>image</code> (ảnh cùng tên miền).
          <code>quickReplies</code>: nút gợi ý (<code>label</code>, <code>payload</code>). <code>handoff: true</code> = mời gọi / nhắn Zalo.<br>
          Biến: <code>{{brand.phoneDisplay}}</code> <code>{{brand.zalo}}</code> <code>{{product.name}}</code> <code>{{product.priceText}}</code> <code>{{product.url}}</code> — sản phẩm của trang khách đang xem; slug <code>{{page}}</code> = thẻ của sản phẩm đó.<br>
          Slug: ${slugs.map((s) => `<code>${esc(s)}</code>`).join(' ')}<br>
          <b>Không viết số tiền</b> (giá lấy từ thẻ sản phẩm, luôn khớp website) và <b>không dùng từ cấm</b> theo Nghị định 342/2025 ("trị dứt điểm", "cam kết khỏi"…) — trang sẽ không cho lưu.</p>
      </div>
      <div class="row"><button>Lưu kịch bản</button>${f.id ? `<a class="btn ghost" href="/admin/chat-rules?q=${encodeURIComponent(f.keywords[0] ?? f.payloads[0] ?? '')}">Thử kịch bản</a>` : ''}</div>
    </form>
    ${f.id ? `<form method="post" action="/admin/chat-rules/delete" class="card row">
      <input type="hidden" name="id" value="${f.id}">
      <label style="display:flex;gap:8px;font-weight:400"><input type="checkbox" name="confirm" value="1" required style="width:auto"> Tôi muốn xoá hẳn kịch bản này (muốn tạm ngưng thì bỏ chọn "Đang bật")</label>
      <button class="danger">Xoá</button></form>` : ''}`, user);
}

const lines = (v: FormDataEntryValue | null) => [...new Set(String(v ?? '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean))].slice(0, 200);

async function saveRule(ctx: AdminCtx, user: User, request: Request) {
  const fd = await request.formData();
  const id = Number(fd.get('id')) || undefined;
  const locale = (['vi', 'en', '*'] as const).find((l) => l === fd.get('locale')) ?? 'vi';
  const form: RuleForm = {
    id, name: String(fd.get('name') ?? '').trim().slice(0, 120), topic: (String(fd.get('topic') ?? '').trim() || 'khac').slice(0, 40),
    enabled: fd.get('enabled') === '1', priority: Math.max(0, Math.min(1000, Math.round(Number(fd.get('priority')) || 0))), locale,
    keywords: lines(fd.get('keywords')).map((k) => k.slice(0, 80)), payloads: lines(fd.get('payloads')).map((p) => p.slice(0, 200)),
    path_prefix: String(fd.get('path_prefix') ?? '').trim() || null, requires_images: fd.get('requires_images') === '1', is_fallback: fd.get('is_fallback') === '1',
    responseText: String(fd.get('response') ?? ''),
  };
  const errors: string[] = [];
  let response: any = null;
  try { response = JSON.parse(form.responseText); } catch (e) { errors.push(`Câu trả lời không phải JSON hợp lệ: ${(e as Error).message}`); }
  if (form.path_prefix && !form.path_prefix.startsWith('/')) errors.push('"Chỉ ở trang" phải bắt đầu bằng "/".');
  if (response) {
    errors.push(...guardRule({ ...form, response }));
    const slugs = new Set(loadCatalog(ctx.root).products.map((p) => p.slug));
    if (slugs.size) {
      for (const m of response.messages ?? []) {
        for (const s of m.type === 'product' ? [m.slug] : m.type === 'products' ? m.slugs ?? [] : []) {
          if (s !== '{{page}}' && !slugs.has(s)) errors.push(`Không có sản phẩm slug "${s}" trên website (đã xuất bản).`);
        }
      }
    }
  }
  if (errors.length) return editRulePage(ctx, user, new URL(request.url), { form, errors: [...new Set(errors)] });
  const params = [form.name, form.topic, form.enabled, form.priority, form.locale, form.keywords, form.payloads, form.path_prefix,
    form.requires_images, form.is_fallback, JSON.stringify(response), user.username];
  let rid = id;
  if (id) {
    await ctx.sql.query(`UPDATE chat_rules SET name = $1, topic = $2, enabled = $3, priority = $4, locale = $5, keywords = $6, payloads = $7, path_prefix = $8,
      requires_images = $9, is_fallback = $10, response = $11::text::jsonb, updated_by = $12, updated_at = now() WHERE id = $13`, [...params, id]);
  } else {
    rid = (await ctx.sql.query<{ id: number }>(`INSERT INTO chat_rules (name, topic, enabled, priority, locale, keywords, payloads, path_prefix, requires_images, is_fallback, response, updated_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::text::jsonb, $12) RETURNING id`, params)).rows[0].id;
  }
  invalidateRules();
  return redirect(`/admin/chat-rules/edit?id=${rid}&ok=1`);
}

async function toggleRule(ctx: AdminCtx, user: User, request: Request) {
  const id = Number((await request.formData()).get('id'));
  await ctx.sql.query('UPDATE chat_rules SET enabled = NOT enabled, updated_by = $2, updated_at = now() WHERE id = $1', [id, user.username]);
  invalidateRules();
  return redirect('/admin/chat-rules');
}

async function deleteRule(ctx: AdminCtx, request: Request) {
  const f = await request.formData();
  if (f.get('confirm') !== '1') return redirect(`/admin/chat-rules/edit?id=${Number(f.get('id'))}`);
  await ctx.sql.query('DELETE FROM chat_rules WHERE id = $1', [Number(f.get('id'))]);
  invalidateRules();
  return redirect('/admin/chat-rules');
}

// ================================================================= số liệu + lịch sử
async function chatsPage(ctx: AdminCtx, user: User, url: URL) {
  const { sql } = ctx;
  const sid = url.searchParams.get('s');
  if (sid) return transcript(ctx, user, sid);
  const days = [7, 30, 90].includes(Number(url.searchParams.get('days'))) ? Number(url.searchParams.get('days')) : 30;
  const a = await chatAnalytics(sql, days);
  const s = await getChatSettings(sql, envOf(ctx));
  const k = a.kpis;
  const replies = a.sources.reduce((x, y) => x + y.n, 0);
  const kpi = (label: string, value: string | number, sub = '') => `<div class="card" style="margin:0"><div class="muted">${label}</div><div style="font-size:26px;font-weight:700;color:var(--navy)">${value}</div>${sub ? `<div class="muted">${sub}</div>` : ''}</div>`;
  const maxDay = Math.max(1, ...a.daily.map((d) => d.sessions));
  const filter = url.searchParams.get('f') ?? '';
  const FILTERS: Record<string, string> = { unmatched: 's.unmatched > 0', handoff: 's.handoff', order: 's.order_code IS NOT NULL', degraded: 's.degraded > 0' };
  const sessions = (await sql.query<any>(
    `SELECT s.*, (SELECT text FROM chat_messages m WHERE m.session_id = s.session_id AND m.role = 'user' AND m.text IS NOT NULL ORDER BY id LIMIT 1) AS first_text
       FROM chat_sessions s ${FILTERS[filter] ? `WHERE ${FILTERS[filter]}` : ''} ORDER BY s.last_at DESC LIMIT 150`)).rows;
  return page('Chat', `
    <h1>Chat <span class="muted">— ${days} ngày qua</span></h1>
    <div class="row">${[7, 30, 90].map((d) => `<a class="btn ${d === days ? '' : 'ghost'}" href="/admin/chats?days=${d}">${d} ngày</a>`).join('')}
      <span class="muted">Chế độ: <b>${esc(MODE_VI[s.mode])}</b> · lưu chữ ${s.retentionDays} ngày, số liệu phiên ${s.sessionRetentionDays} ngày, không lưu ảnh ·
      xuất dữ liệu: <code>/api/admin/chats?type=messages&amp;from=YYYY-MM-DD</code> (Bearer ADMIN_TOKEN, NDJSON)</span></div>
    <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(min(150px,45%),1fr))">
      ${kpi('Cuộc trò chuyện', k.sessions, `${k.visitors} khách`)}
      ${kpi('Tin khách gửi', k.userMessages, k.images ? `${k.images} ảnh` : '')}
      ${kpi('Trả lời được', pct(k.answeredRules + k.answeredN8n, k.userMessages), `kịch bản ${k.answeredRules} · n8n ${k.answeredN8n}`)}
      ${kpi('Chưa hiểu câu hỏi', k.unmatched, pct(k.unmatched, k.userMessages) + ' số tin')}
      ${kpi('Chuyển chuyên viên', k.handoffs, pct(k.handoffs, k.sessions) + ' số cuộc')}
      ${kpi('Bấm thẻ sản phẩm', k.productClicks, `bấm đặt hàng ${k.orderClicks}`)}
      ${kpi('Đơn sau khi chat', k.orders, pct(k.orders, k.sessions) + ' số cuộc · ≤7 ngày')}
      ${kpi('Sự cố', k.degraded, 'n8n lỗi / chat tắt / gửi nhanh')}
    </div>
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(min(340px,100%),1fr));margin-top:12px">
      <div class="card"><h2 style="margin-top:0">Câu chưa trả lời được</h2>
        <p class="muted">Không kịch bản nào khớp (hoặc n8n báo <code>"matched": false</code>). Đây là danh sách kịch bản nên viết thêm.</p>
        ${a.unanswered.length ? `<table>${a.unanswered.map((u) => `<tr><td>${esc(u.text.slice(0, 160))}<br><span class="muted">${u.n} lần · ${esc(fmt(u.last_at))} · ${esc(u.locale)}</span></td>
          <td style="white-space:nowrap"><a href="/admin/chat-rules/edit?new=1&q=${encodeURIComponent(u.text.slice(0, 200))}">Tạo kịch bản</a><br><a class="muted" href="/admin/chats?s=${encodeURIComponent(u.session_id)}">xem cuộc</a></td></tr>`).join('')}</table>`
          : '<p class="muted">Chưa có — mọi câu đều được trả lời.</p>'}</div>
      <div class="card"><h2 style="margin-top:0">Kịch bản được dùng nhiều</h2>
        ${a.topRules.length ? `<table>${a.topRules.map((r) => `<tr><td><a href="/admin/chat-rules/edit?id=${r.id}">${esc(r.name)}</a> <span class="pill">${esc(r.topic)}</span></td><td>${r.n}</td></tr>`).join('')}</table>` : '<p class="muted">Chưa có.</p>'}
        <h2>Ai trả lời</h2>
        <table>${a.sources.map((x) => `<tr><td>${esc(SOURCE_VI[x.source] ?? x.source)}</td><td>${x.n}</td><td class="muted">${pct(x.n, replies)}</td></tr>`).join('') || '<tr><td class="muted">Chưa có.</td></tr>'}</table></div>
      <div class="card"><h2 style="margin-top:0">Sản phẩm trong chat</h2>
        ${a.products.length ? `<table><tr><th>Sản phẩm</th><th>Hiện</th><th>Bấm xem</th><th>Bấm đặt</th></tr>${a.products.map((p) => `<tr><td>${esc(p.slug)}</td><td>${p.shown}</td><td>${p.views}</td><td>${p.orders}</td></tr>`).join('')}</table>` : '<p class="muted">Chưa có.</p>'}
        <h2>Theo ngày</h2>
        ${a.daily.map((d) => `<div style="display:flex;gap:8px;align-items:center;font-size:12px"><span class="muted" style="width:78px">${esc(d.day.slice(5))}</span>
          <span style="display:inline-block;height:10px;border-radius:5px;background:var(--cobalt);width:${Math.max(2, Math.round((d.sessions / maxDay) * 220))}px"></span>${d.sessions}${d.orders ? ` · <b>${d.orders} đơn</b>` : ''}</div>`).join('') || '<p class="muted">Chưa có.</p>'}</div>
    </div>
    <h2>Cuộc trò chuyện</h2>
    <div class="row">${[['', 'Tất cả'], ['unmatched', 'Có câu chưa hiểu'], ['handoff', 'Chuyển chuyên viên'], ['order', 'Có đơn'], ['degraded', 'Có sự cố']]
      .map(([v, l]) => `<a class="btn ${v === filter ? '' : 'ghost'}" href="/admin/chats?days=${days}${v ? `&f=${v}` : ''}">${l}</a>`).join('')}</div>
    <p class="muted">"Khách" là mã ẩn danh của trình duyệt (cookie), không phải danh tính.</p>
    <table><tr><th>Lần cuối</th><th>Khách</th><th>Câu đầu tiên</th><th>Lượt</th><th>Kết quả</th><th></th></tr>
    ${sessions.map((r) => `<tr><td>${esc(fmt(r.last_at))}</td><td><code>${esc(String(r.visitor_id).slice(0, 10))}</code><br><span class="muted">${esc(r.entry_path ?? '')}${r.utm_source ? ` · ${esc(r.utm_source)}` : ''}</span></td>
      <td>${esc((r.first_text ?? '').slice(0, 120))}</td><td>${r.user_messages}</td>
      <td>${[r.order_code ? `<span class="pill published">đơn ${esc(r.order_code)}</span>` : '', r.handoff ? '<span class="pill">chuyển người</span>' : '',
        r.unmatched ? `<span class="pill draft">${r.unmatched} chưa hiểu</span>` : '', r.degraded ? '<span class="pill draft">sự cố</span>' : '',
        r.product_clicks ? `<span class="muted">${r.product_clicks} bấm thẻ</span>` : ''].filter(Boolean).join(' ')}</td>
      <td><a href="/admin/chats?s=${encodeURIComponent(r.session_id)}">Xem</a></td></tr>`).join('') || '<tr><td colspan="6" class="muted">Chưa có cuộc trò chuyện nào.</td></tr>'}
    </table>`, user);
}

async function transcript({ sql }: AdminCtx, user: User, sid: string) {
  const rows = (await sql.query<any>(
    `SELECT m.role, m.text, m.payload, m.created_at, m.page_path, m.visitor_id, m.source, m.latency_ms, m.matched, r.id AS rule_id, r.name AS rule_name
       FROM chat_messages m LEFT JOIN chat_rules r ON r.id = m.rule_id WHERE m.session_id = $1 ORDER BY m.id`, [sid])).rows;
  const sess = (await sql.query<any>('SELECT * FROM chat_sessions WHERE session_id = $1', [sid])).rows[0];
  const events = (await sql.query<any>('SELECT type, slug, value, created_at FROM chat_events WHERE session_id = $1 ORDER BY id', [sid])).rows;
  return page('Chat', `
    <h1>Cuộc trò chuyện <code>${esc(sid.slice(0, 8))}</code></h1>
    <p class="muted">Khách ${esc(rows[0]?.visitor_id ?? sess?.visitor_id ?? '')} · <a href="/admin/chats">← tất cả</a>
      ${sess ? ` · vào từ ${esc(sess.entry_path ?? '')}${sess.utm_source ? ` (${esc(sess.utm_source)}/${esc(sess.utm_campaign ?? '')})` : ''}${sess.order_code ? ` · <b>đặt đơn ${esc(sess.order_code)}</b>` : ''}` : ''}</p>
    ${rows.map((r) => {
      const extra = r.role === 'user'
        ? esc([r.payload?.images ? `${r.payload.images} ảnh (không lưu)` : '', r.payload?.event === 'quick_reply' ? `nút gợi ý: ${r.payload?.payload ?? ''}` : ''].filter(Boolean).join(' · '))
        /* Mọi mẩu chữ đến từ n8n (nhãn nút, tên…) đều escape — trang quản trị không tin phản hồi của bot. */
        : [esc(SOURCE_VI[r.source] ?? r.source ?? ''), r.rule_id ? `<a href="/admin/chat-rules/edit?id=${Number(r.rule_id)}">${esc(r.rule_name)}</a>` : '',
            r.matched === false ? '<b>chưa hiểu câu hỏi</b>' : '', r.latency_ms != null ? `${Number(r.latency_ms)} ms` : '',
            esc((r.payload?.messages ?? []).filter((m: any) => m.type !== 'text').map((m: any) =>
              m.type === 'product' ? `thẻ: ${m.product?.name}` : m.type === 'products' ? `dải thẻ: ${(m.products ?? []).map((p: any) => p.name).join(', ')}` : m.type === 'link' ? `nút: ${m.label}` : m.type).join(' · ')),
            r.payload?.degraded ? `<b>${esc(r.payload.degraded)}</b>` : '', r.payload?.upstream ? `n8n: ${esc(r.payload.upstream)}` : '']
          .filter(Boolean).join(' · ');
      return `<div class="card" style="margin-left:${r.role === 'user' ? '15%' : '0'};margin-right:${r.role === 'user' ? '0' : '15%'};background:${r.role === 'user' ? '#eef0fb' : '#fff'}">
        <div class="muted">${r.role === 'user' ? 'Khách' : 'Bot'} · ${esc(fmt(r.created_at))} · ${esc(r.page_path ?? '')}</div>
        <div style="white-space:pre-wrap">${esc(r.text ?? '')}</div>${extra ? `<div class="muted">${extra}</div>` : ''}</div>`;
    }).join('') || notice('warn', 'Không có tin nào (có thể đã quá hạn lưu và bị xoá — số liệu phiên vẫn còn).')}
    ${events.length ? `<h2>Sự kiện</h2><table>${events.map((e) => `<tr><td class="muted">${esc(fmt(e.created_at))}</td><td>${esc(e.type)}</td><td>${esc(e.slug ?? '')} ${esc(e.value ?? '')}</td></tr>`).join('')}</table>` : ''}`, user);
}
