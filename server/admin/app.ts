/**
 * Trang quản trị nhập liệu: /admin/*
 *
 * Chuẩn hoá nhập liệu nghĩa là: MỘT schema (src/content.config.ts) quyết định
 * cái gì hợp lệ, cho cả build lẫn người nhập. Người biên tập không sửa file trên
 * máy ai cả — họ sửa ở đây, bấm Lưu thì được kiểm ngay bằng đúng schema đó (lỗi
 * tiếng Việt, chỉ đúng trường sai), mọi lần lưu để lại một bản trong lịch sử, và
 * chỉ khi bấm "Xuất bản" thì nội dung mới được build ra trang thật.
 */
import type { Sql } from '../lib/db.ts';
import {
  COLLECTIONS, validate, canonicalSource, putMedia, type Issue,
} from '../lib/content.ts';
import {
  login, logout, userFromRequest, sessionCookie, clearCookie, sameOrigin, cookie, COOKIE, createUser,
} from '../lib/auth.ts';
import { publish, isPublishing } from '../lib/publish.ts';
import {
  page, redirect, esc, notice, pageHead, statusPill, STATUS_LABEL, AVAILABILITY_LABEL, COLLECTION_LABEL, type Viewer,
} from './html.ts';
import { chatRoutes } from './chat.ts';
import { limited } from '../lib/rate-limit.ts';
import { hashIp } from '../lib/chat.ts';

export interface AdminCtx { sql: Sql; root: string; env?: Record<string, string | undefined>; fetch?: typeof fetch }

/** Trường hay sửa nhất, đưa lên đầu biểu mẫu. Phần còn lại sửa trong ô JSON. */
type Quick = { path: string; label: string; type: 'text' | 'number' | 'select' | 'date'; options?: Record<string, string> };
const STATUS_Q: Quick = { path: 'status', label: 'Trạng thái', type: 'select', options: STATUS_LABEL };
const QUICK: Record<string, Quick[]> = {
  products: [
    STATUS_Q,
    { path: 'price', label: 'Giá bán (VND)', type: 'number' },
    { path: 'compareAtPrice', label: 'Giá niêm yết gạch ngang (VND)', type: 'number' },
    { path: 'availability', label: 'Tình trạng hàng', type: 'select', options: AVAILABILITY_LABEL },
    { path: 'compliance.productNotificationNumber', label: 'Số tiếp nhận phiếu công bố', type: 'text' },
  ],
  documents: [
    STATUS_Q,
    { path: 'reference', label: 'Số hiệu', type: 'text' },
    { path: 'issuedAt', label: 'Ngày cấp', type: 'date' },
    { path: 'validUntil', label: 'Hiệu lực đến', type: 'date' },
  ],
  articles: [STATUS_Q], lines: [STATUS_Q], guides: [STATUS_Q], policies: [STATUS_Q],
};

const get = (o: any, path: string) => path.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
function set(o: any, path: string, v: unknown) {
  const ks = path.split('.'); let cur = o;
  for (const k of ks.slice(0, -1)) cur = cur[k] ??= {};
  if (v === undefined) delete cur[ks.at(-1)!]; else cur[ks.at(-1)!] = v;
}
const titleOf = (d: any) => d?.shortName ?? d?.name ?? d?.title ?? d?.heading ?? d?.tradingName ?? d?.hero?.heading ?? '';
const ID = /^[a-z0-9][a-z0-9-]*(?:\/[a-z]{2})?$/;
const fmt = (d: any) => (d ? new Date(d).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '—');
const label = (c: string) => COLLECTION_LABEL[c] ?? c;

/** Số việc đang chờ cho menu. Lỗi ở đây không được làm hỏng trang. */
async function badges(sql: Sql): Promise<NonNullable<Viewer['badges']>> {
  try {
    const r = (await sql.query<any>(`SELECT
      (SELECT count(*)::int FROM orders WHERE status = 'new') AS orders,
      (SELECT count(*)::int FROM content_revisions WHERE saved_at > coalesce((SELECT max(started_at) FROM publish_runs WHERE ok), 'epoch')) AS pending,
      (SELECT count(*)::int FROM chat_messages WHERE role = 'bot' AND matched = false AND created_at > now() - interval '7 days') AS unanswered`)).rows[0];
    return r;
  } catch { return {}; }
}
function sectionOf(path: string, url: URL) {
  if (path === '/admin') return 'home';
  if (path === '/admin/edit' || path === '/admin/history') return `content/${url.searchParams.get('c') ?? ''}`;
  if (path.startsWith('/admin/chat-rules')) return 'chat-rules';
  return path.replace(/^\/admin\//, '').replace(/\/(raw|delete)$/, '');
}

export async function adminHandler(request: Request, ctx: AdminCtx): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '') || '/admin';
  const { sql } = ctx;

  if (request.method === 'POST' && !sameOrigin(request)) {
    return page('Từ chối', notice('err', 'Yêu cầu không đến từ chính trang quản trị (kiểm tra Origin thất bại).'), null, 403);
  }
  /* Trang quản trị không có JavaScript: mọi yêu cầu hợp lệ là một lần điều hướng của trình
     duyệt (hoặc ảnh xem trước). fetch()/XHR từ script — ví dụ một thẻ GTM/Facebook chạy
     trên website cùng tên miền — bị từ chối, nên không đọc được đơn hàng hay tạo tài khoản.
     Sec-Fetch-* do trình duyệt đặt, script không giả được. Chỉ xét khi có Sec-Fetch-Site (trình
     duyệt luôn gửi kèm): fetch của Node, curl, bộ thử không phải nơi script quảng cáo chạy. */
  const mode = request.headers.get('sec-fetch-mode');
  if (request.headers.has('sec-fetch-site') && mode !== 'navigate' && !(path === '/admin/media/raw' && mode === 'no-cors')) {
    return new Response('Forbidden', { status: 403, headers: { 'content-type': 'text/plain', 'cache-control': 'no-store' } });
  }

  // ---------------------------------------------------------------- đăng nhập
  if (path === '/admin/login') {
    if (request.method === 'POST') {
      const f = await request.formData();
      const name = String(f.get('username') ?? '').trim().toLowerCase().slice(0, 64);
      /* Chống dò mật khẩu: 10 lần / 15 phút mỗi IP, 20 lần / 15 phút mỗi tên đăng nhập.
         Mỗi lần thử chạy scrypt (16MB, thread pool) — không giới hạn thì dò mật khẩu cũng là làm nghẽn máy chủ. */
      const ip = request.headers.get('cf-connecting-ip');
      const ipKey = ip ? hashIp(ip, ctx.env?.IP_SALT ?? process.env.IP_SALT ?? 'login') : null;
      /* Đếm CẢ HAI mỗi lần (không dùng ||): IP bị khoá vẫn phải cộng vào khoá theo tên. */
      const [byIp, byName] = await Promise.all([ipKey ? limited(sql, `login:ip:${ipKey}`, 10, 15 * 60_000) : false, limited(sql, `login:u:${name}`, 20, 15 * 60_000)]);
      if (byIp || byName) {
        return loginPage('Thử sai quá nhiều lần. Đợi 15 phút rồi thử lại.', 429);
      }
      const token = await login(sql, name, String(f.get('password') ?? ''));
      if (!token) return loginPage('Sai tên đăng nhập hoặc mật khẩu.', 401);
      return redirect('/admin/', { 'set-cookie': sessionCookie(token) });
    }
    return loginPage();
  }
  const found = await userFromRequest(sql, request);
  if (!found) return redirect('/admin/login');

  if (path === '/admin/logout' && request.method === 'POST') {
    const t = cookie(request, COOKIE); if (t) await logout(sql, t);
    return redirect('/admin/login', { 'set-cookie': clearCookie() });
  }
  const user: Viewer = { ...found, section: sectionOf(path, url), badges: request.method === 'GET' ? await badges(sql) : {} };

  if (path === '/admin') return dashboard(ctx, user, url);
  if (path.startsWith('/admin/content/')) return listPage(ctx, user, url, path.slice('/admin/content/'.length));
  if (path === '/admin/edit') return request.method === 'POST' ? saveEntry(ctx, user, request) : editPage(ctx, user, url);
  if (path === '/admin/history') return historyPage(ctx, user, url);
  if (path === '/admin/restore' && request.method === 'POST') return restore(ctx, user, request);
  if (path === '/admin/media') return request.method === 'POST' ? uploadMedia(ctx, user, request) : mediaPage(ctx, user, url);
  if (path === '/admin/media/raw') return mediaRaw(ctx, url);
  if (path === '/admin/media/delete' && request.method === 'POST') return deleteMedia(ctx, user, request);
  if (path === '/admin/publish') return request.method === 'POST' ? startPublish(ctx, user) : publishPage(ctx, user, url);
  const chat = await chatRoutes(path, request, ctx, user, url);
  if (chat) return chat;
  if (path === '/admin/orders') return request.method === 'POST' ? updateOrder(ctx, request) : ordersPage(ctx, user, url);
  if (path.startsWith('/admin/users')) {
    if (user.role !== 'admin') return page('Không có quyền', notice('err', 'Chỉ tài khoản quyền <b>quản trị</b> quản lý được tài khoản.'), user, 403);
    if (path === '/admin/users') return request.method === 'POST' ? saveUser(ctx, request) : usersPage(ctx, user, url);
    if (path === '/admin/users/delete' && request.method === 'POST') return deleteUser(ctx, user, request);
  }
  return page('Không có trang này', pageHead('Không có trang này') + notice('err', 'Đường dẫn không đúng hoặc trang đã được chuyển. <a href="/admin/">Về Tổng quan</a>.'), user, 404);
}

function loginPage(err = '', status = 200) {
  return page('Đăng nhập', `
    <div class="card" style="padding:28px">
      <div class="muted" style="letter-spacing:.12em;font-weight:700;color:var(--navy)">MOCHA</div>
      <h1 style="margin-bottom:18px">Đăng nhập quản trị</h1>
      ${err ? notice('err', esc(err)) : ''}
      <form method="post" action="/admin/login" class="grid" style="grid-template-columns:1fr">
        <label>Tên đăng nhập <input name="username" autocomplete="username" required autofocus></label>
        <label>Mật khẩu <input name="password" type="password" autocomplete="current-password" required></label>
        <div><button>Đăng nhập</button></div>
      </form>
    </div>`, null, status);
}

// ---------------------------------------------------------------- tổng quan
async function dashboard({ sql }: AdminCtx, user: Viewer, url: URL) {
  const s = (await sql.query<any>(`SELECT
      (SELECT count(*)::int FROM orders WHERE created_at::timestamptz > now() - interval '7 days') AS orders7,
      (SELECT count(*)::int FROM chat_sessions WHERE last_at > now() - interval '7 days') AS chats7,
      (SELECT count(*)::int FROM chat_sessions WHERE last_at > now() - interval '7 days' AND order_code IS NOT NULL) AS chat_orders7`)).rows[0];
  const counts = new Map((await sql.query<{ collection: string; n: number; drafts: number }>(
    `SELECT collection, count(*)::int AS n, count(*) FILTER (WHERE data->>'status' = 'draft')::int AS drafts
       FROM content_entries GROUP BY collection`)).rows.map((r) => [r.collection, r]));
  const recent = (await sql.query<any>(
    `SELECT collection, entry_id, saved_at, saved_by, note, source IS NULL AS deleted FROM content_revisions ORDER BY id DESC LIMIT 10`)).rows;
  const last = (await sql.query<any>('SELECT id, started_at, ok, started_by FROM publish_runs ORDER BY id DESC LIMIT 1')).rows[0];
  const b = user.badges ?? {};
  const stat = (href: string, n: number, title: string, sub: string, alert = false) =>
    `<a class="stat${alert ? ' alert' : ''}" href="${href}"><span class="muted">${title}</span><b>${n}</b><span class="muted">${sub}</span></a>`;
  return page('Tổng quan', `
    ${pageHead(`Chào ${esc(user.username)}`, { sub: 'Việc cần làm hôm nay ở trên cùng; nội dung website ở dưới.' })}
    ${url.searchParams.get('msg') ? notice('ok', esc(url.searchParams.get('msg'))) : ''}
    <div class="stats">
      ${stat('/admin/orders?status=new', b.orders ?? 0, 'Đơn mới chưa gọi', `${s.orders7} đơn trong 7 ngày`, !!b.orders)}
      ${stat('/admin/publish', b.pending ?? 0, 'Thay đổi chưa xuất bản', b.pending ? 'bấm Xuất bản để lên trang thật' : 'trang thật đã cập nhật', !!b.pending)}
      ${stat('/admin/chats?f=unmatched', b.unanswered ?? 0, 'Câu chat chưa trả lời được', '7 ngày — nên viết thêm kịch bản', !!b.unanswered)}
      ${stat('/admin/chats', s.chats7, 'Cuộc chat 7 ngày', `${s.chat_orders7} cuộc ra đơn`)}
    </div>
    <div class="split">
      <div><h2 style="margin-top:0">Nội dung website</h2>
        <table>${Object.keys(COLLECTIONS).map((c) => {
          const r = counts.get(c);
          return `<tr><td><a href="/admin/content/${c}">${esc(label(c))}</a></td><td class="num">${r?.n ?? 0}</td>
            <td>${r?.drafts ? `<span class="pill draft">${r.drafts} bản nháp</span>` : ''}</td></tr>`;
        }).join('')}</table>
        <p class="muted">Lần xuất bản gần nhất: ${last ? `<a href="/admin/publish?run=${last.id}">#${last.id}</a> · ${esc(fmt(last.started_at))} · ${esc(last.started_by)} · ${
          last.ok === null ? 'đang chạy' : last.ok ? '<span class="pill published">thành công</span>' : '<span class="pill bad">lỗi</span>'}` : 'chưa lần nào.'}</p>
      </div>
      <div><h2 style="margin-top:0">Sửa gần đây</h2>
        <table><tr><th>Nội dung</th><th>Ai · lúc</th></tr>
        ${recent.map((r) => `<tr><td>${r.deleted ? `<s>${esc(label(r.collection))} · ${esc(r.entry_id)}</s> <span class="muted">đã xoá</span>`
          : `<a href="/admin/edit?c=${esc(r.collection)}&id=${encodeURIComponent(r.entry_id)}">${esc(label(r.collection))} · ${esc(r.entry_id)}</a>`}
          ${r.note ? `<br><span class="muted">${esc(r.note)}</span>` : ''}</td><td class="muted">${esc(r.saved_by)}<br>${esc(fmt(r.saved_at))}</td></tr>`).join('')
          || '<tr><td colspan="2" class="muted">Chưa có.</td></tr>'}
        </table></div>
    </div>`, user);
}

// ---------------------------------------------------------------- danh sách
async function listPage({ sql }: AdminCtx, user: Viewer, url: URL, collection: string) {
  if (!COLLECTIONS[collection]) return page('Không có', pageHead('Không có mục này') + notice('err', 'Không có loại nội dung này.'), user, 404);
  const st = url.searchParams.get('status');
  const rows = (await sql.query<any>(
    `SELECT entry_id, data, updated_at, updated_by FROM content_entries WHERE collection = $1 ORDER BY entry_id`, [collection])).rows;
  const shown = st ? rows.filter((r) => (r.data?.status ?? '') === st) : rows;
  const hasStatus = rows.some((r) => r.data?.status);
  const n = (s: string) => rows.filter((r) => r.data?.status === s).length;
  return page(label(collection), `
    ${pageHead(`${esc(label(collection))} <span class="muted">(${rows.length})</span>`, {
      actions: `<a class="btn" href="/admin/edit?c=${esc(collection)}&new=1">+ Thêm mới</a>`,
      sub: collection === 'products' ? 'Mỗi sản phẩm có một bản cho mỗi ngôn ngữ: mã dạng <code>slug/vi</code>, <code>slug/en</code>.' : '' })}
    ${hasStatus ? `<div class="chips">${[['', 'Tất cả', rows.length], ['published', STATUS_LABEL.published, n('published')], ['draft', STATUS_LABEL.draft, n('draft')]]
      .map(([v, l, k]) => `<a href="/admin/content/${esc(collection)}${v ? `?status=${v}` : ''}"${(st ?? '') === v ? ' aria-current="page"' : ''}>${l}<span class="n">${k}</span></a>`).join('')}</div>` : ''}
    <table><tr><th>Tên</th><th>Trạng thái</th><th class="hide-sm">Sửa lần cuối</th><th class="hide-sm"></th></tr>
    ${shown.map((r) => `<tr>
      <td><a href="/admin/edit?c=${esc(collection)}&id=${encodeURIComponent(r.entry_id)}"><b>${esc(titleOf(r.data) || r.entry_id)}</b></a><br><code class="muted">${esc(r.entry_id)}</code></td>
      <td>${statusPill(r.data?.status)}</td>
      <td class="muted hide-sm">${esc(fmt(r.updated_at))}<br>${esc(r.updated_by)}</td>
      <td class="nowrap hide-sm"><a href="/admin/edit?c=${esc(collection)}&id=${encodeURIComponent(r.entry_id)}">Sửa</a> ·
          <a href="/admin/edit?c=${esc(collection)}&new=1&from=${encodeURIComponent(r.entry_id)}">Nhân bản</a></td></tr>`).join('')
      || '<tr><td colspan="4" class="muted">Không có mục nào.</td></tr>'}
    </table>`, user);
}

// ---------------------------------------------------------------- sửa
async function editPage({ sql }: AdminCtx, user: Viewer, url: URL, state?: { source: string; id: string; issues?: Issue[]; msg?: string; isNew?: boolean }) {
  const c = url.searchParams.get('c') ?? '';
  if (!COLLECTIONS[c]) return page('Không có', pageHead('Không có mục này') + notice('err', 'Không có loại nội dung này.'), user, 404);
  let id = state?.id ?? url.searchParams.get('id') ?? '';
  const isNew = state?.isNew ?? url.searchParams.get('new') === '1';
  let source = state?.source ?? '';
  if (!state) {
    const from = isNew ? url.searchParams.get('from') : id;
    if (from) {
      const row = (await sql.query<{ source: string }>('SELECT source FROM content_entries WHERE collection = $1 AND entry_id = $2', [c, from])).rows[0];
      if (!row && !isNew) return page('Không có', pageHead('Không có nội dung này', { back: [`/admin/content/${c}`, label(c)] }) + notice('err', 'Có thể đã bị xoá.'), user, 404);
      source = row?.source ?? '';
      if (isNew) { id = ''; try { const d = JSON.parse(source); d.status = 'draft'; source = canonicalSource(d); } catch { /* giữ nguyên */ } }
    }
    if (!source) source = '{\n  "status": "draft"\n}\n';
  }
  let data: any = {}; try { data = JSON.parse(source); } catch { /* báo ở dưới */ }
  const quick = QUICK[c] ?? [];
  const issues = state?.issues;
  const name = titleOf(data);
  return page(`${isNew ? 'Thêm' : 'Sửa'} ${label(c)}`, `
    ${pageHead(isNew ? `Thêm ${esc(label(c).toLowerCase())}` : esc(name || id), {
      back: [`/admin/content/${c}`, label(c)],
      sub: isNew ? '' : `<code>${esc(id)}</code> ${statusPill(data.status)}`,
      actions: isNew ? '' : `<a class="btn ghost sm" href="/admin/history?c=${esc(c)}&id=${encodeURIComponent(id)}">Lịch sử sửa</a>` })}
    ${state?.msg ? notice('ok', esc(state.msg)) : ''}
    ${issues?.length ? notice('err', `<b>Chưa lưu — ${issues.length} lỗi.</b> Sửa rồi lưu lại; nội dung bạn gõ vẫn còn nguyên bên dưới.<ul>${
      issues.slice(0, 40).map((i) => `<li><code>${esc(i.path || '(gốc)')}</code> — ${esc(i.message)}</li>`).join('')}</ul>`) : ''}
    <form method="post" action="/admin/edit">
      <input type="hidden" name="c" value="${esc(c)}">
      <input type="hidden" name="isNew" value="${isNew ? '1' : ''}">
      <div class="card grid">
        <label>Mã (id) <input name="id" value="${esc(id)}" ${isNew ? '' : 'readonly'} required pattern="[a-z0-9][a-z0-9\\-]*(/[a-z]{2})?"></label>
        ${quick.map((q) => {
          const v = get(data, q.path);
          if (q.type === 'select') {
            const opts = Object.entries(q.options ?? {});
            const known = opts.some(([k]) => k === v);
            return `<label>${esc(q.label)} <select name="q:${esc(q.path)}">${known || v == null ? '' : `<option value="${esc(v)}" selected>${esc(v)}</option>`}${
              opts.map(([k, l]) => `<option value="${esc(k)}" ${k === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>`;
          }
          return `<label>${esc(q.label)} <input name="q:${esc(q.path)}" type="${q.type === 'number' ? 'number' : q.type === 'date' ? 'date' : 'text'}" value="${esc(v ?? '')}"></label>`;
        }).join('')}
      </div>
      <label>Nội dung (JSON) <textarea class="json" name="source" spellcheck="false">${esc(source)}</textarea></label>
      <p class="muted">Các ô phía trên ghi đè lên JSON khi lưu. Bảng giải nghĩa từng trường: <code>docs/truong-du-lieu.md</code>. Giá trong câu chữ viết <code>{{price}}</code>, <code>{{compareAtPrice}}</code> để không bao giờ lệch giá thật.</p>
      <label>Ghi chú lần sửa <input name="note" placeholder="vd: đổi giá theo bảng giá 10/2026" maxlength="200"></label>
      <div class="row">
        <button name="action" value="save">Kiểm tra &amp; lưu</button>
        <button name="action" value="check" class="ghost">Chỉ kiểm tra</button>
        <span class="muted">Lưu chưa đổi trang thật — cần <a href="/admin/publish">Xuất bản</a>.</span>
      </div>
    </form>
    ${isNew ? '' : `<form method="post" action="/admin/edit" class="card danger-zone">
      <h2>Xoá nội dung này</h2>
      <input type="hidden" name="c" value="${esc(c)}"><input type="hidden" name="id" value="${esc(id)}"><input type="hidden" name="action" value="delete">
      <p class="muted">Muốn tạm ẩn thì đổi Trạng thái sang "${STATUS_LABEL.draft}". Xoá vẫn khôi phục được từ Lịch sử sửa.</p>
      <div class="row"><label style="display:flex;gap:8px;font-weight:400"><input type="checkbox" name="confirm" value="1" required style="width:auto"> <span>Tôi muốn xoá <b>${esc(name || id)}</b></span></label>
        <button class="danger">Xoá</button></div>
    </form>`}`, user, issues?.length ? 422 : 200);
}

async function saveEntry(ctx: AdminCtx, user: Viewer, request: Request) {
  const { sql, root } = ctx;
  const f = await request.formData();
  const c = String(f.get('c') ?? ''), isNew = f.get('isNew') === '1';
  const id = String(f.get('id') ?? '').trim();
  const action = String(f.get('action') ?? 'save');
  const note = String(f.get('note') ?? '').slice(0, 200) || null;
  const url = new URL(`http://x/admin/edit?c=${encodeURIComponent(c)}`);
  if (!COLLECTIONS[c]) return page('Không có', notice('err', 'Không có loại nội dung này.'), user, 404);
  if (!ID.test(id)) return editPage(ctx, user, url, { source: String(f.get('source') ?? ''), id, isNew, issues: [{ path: 'id', message: 'Mã chỉ gồm chữ thường, số, gạch nối; sản phẩm có thêm "/vi" hoặc "/en".' }] });

  if (action === 'delete') {
    if (f.get('confirm') !== '1') return redirect(`/admin/edit?c=${encodeURIComponent(c)}&id=${encodeURIComponent(id)}`);
    await sql.query('DELETE FROM content_entries WHERE collection = $1 AND entry_id = $2', [c, id]);
    await sql.query('INSERT INTO content_revisions (collection, entry_id, source, saved_by, note) VALUES ($1, $2, NULL, $3, $4)', [c, id, user.username, note ?? 'xoá']);
    return redirect(`/admin/content/${encodeURIComponent(c)}`);
  }

  let data: any;
  try { data = JSON.parse(String(f.get('source') ?? '')); }
  catch (e) {
    return editPage(ctx, user, url, { source: String(f.get('source') ?? ''), id, isNew, issues: [{ path: '', message: `JSON không hợp lệ: ${(e as Error).message}` }] });
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return editPage(ctx, user, url, { source: String(f.get('source') ?? ''), id, isNew, issues: [{ path: '', message: 'Nội dung phải là một đối tượng JSON { ... }.' }] });
  }
  for (const q of QUICK[c] ?? []) {
    const raw = f.get(`q:${q.path}`);
    if (raw === null) continue;
    const s = String(raw).trim();
    const v = s === '' ? undefined : q.type === 'number' ? Number(s) : s;
    if (JSON.stringify(get(data, q.path)) !== JSON.stringify(v)) set(data, q.path, v);
  }
  /* Mã trong dữ liệu phải khớp mã của entry: slug + locale cho sản phẩm, slug cho giấy tờ. */
  const [slug, loc] = id.split('/');
  if ('slug' in data && data.slug !== slug) data.slug = slug;
  if (loc && 'locale' in data && data.locale !== loc) data.locale = loc;

  const source = canonicalSource(data);
  const issues = await validate(root, c, data);
  if (isNew && !issues.length) {
    const dup = (await sql.query('SELECT 1 FROM content_entries WHERE collection = $1 AND entry_id = $2', [c, id])).rows.length;
    if (dup) issues.push({ path: 'id', message: 'Mã này đã có. Chọn mã khác hoặc sửa nội dung cũ.' });
  }
  if (issues.length || action === 'check') {
    return editPage(ctx, user, url, { source, id, isNew, issues, msg: issues.length ? undefined : 'Hợp lệ theo schema. Chưa lưu — bấm "Kiểm tra & lưu".' });
  }
  await sql.query(
    `INSERT INTO content_entries (collection, entry_id, data, source, updated_by) VALUES ($1, $2, $3::text::jsonb, $4, $5)
     ON CONFLICT (collection, entry_id) DO UPDATE SET data = EXCLUDED.data, source = EXCLUDED.source, updated_at = now(), updated_by = EXCLUDED.updated_by`,
    [c, id, source, source, user.username]);
  await sql.query('INSERT INTO content_revisions (collection, entry_id, source, saved_by, note) VALUES ($1, $2, $3, $4, $5)', [c, id, source, user.username, note]);
  return editPage(ctx, user, new URL(`http://x/admin/edit?c=${encodeURIComponent(c)}&id=${encodeURIComponent(id)}`),
    { source, id, isNew: false, msg: 'Đã lưu. Trang thật chỉ đổi sau khi Xuất bản.' });
}

async function historyPage({ sql }: AdminCtx, user: Viewer, url: URL) {
  const c = url.searchParams.get('c') ?? '', id = url.searchParams.get('id') ?? '';
  if (!COLLECTIONS[c]) return page('Không có', pageHead('Không có mục này') + notice('err', 'Không có loại nội dung này.'), user, 404);
  const rows = (await sql.query<any>(
    'SELECT id, saved_at, saved_by, note, length(source) AS len FROM content_revisions WHERE collection = $1 AND entry_id = $2 ORDER BY id DESC LIMIT 100', [c, id])).rows;
  return page('Lịch sử sửa', `
    ${pageHead('Lịch sử sửa', { back: [`/admin/edit?c=${encodeURIComponent(c)}&id=${encodeURIComponent(id)}`, `${label(c)} · ${id}`],
      sub: 'Khôi phục = mở bản cũ trong trình sửa; vẫn phải qua kiểm tra rồi mới lưu.' })}
    <table><tr><th>#</th><th>Lúc</th><th>Ai</th><th>Ghi chú</th><th></th></tr>
    ${rows.map((r) => `<tr><td>${r.id}</td><td class="nowrap">${esc(fmt(r.saved_at))}</td><td>${esc(r.saved_by)}</td><td>${esc(r.note ?? '')}</td>
      <td>${r.len === null ? '<span class="pill bad">đã xoá</span>' : `<form method="post" action="/admin/restore"><input type="hidden" name="rev" value="${r.id}"><button class="ghost sm">Mở bản này</button></form>`}</td></tr>`).join('')
      || '<tr><td colspan="5" class="muted">Chưa có lần sửa nào.</td></tr>'}
    </table>`, user);
}

async function restore(ctx: AdminCtx, user: Viewer, request: Request) {
  const f = await request.formData();
  const rev = (await ctx.sql.query<any>('SELECT collection, entry_id, source FROM content_revisions WHERE id = $1', [Number(f.get('rev')) || 0])).rows[0];
  if (!rev?.source) return page('Không có', notice('err', 'Không có bản này.'), user, 404);
  return editPage(ctx, user, new URL(`http://x/admin/edit?c=${encodeURIComponent(rev.collection)}`), { source: rev.source, id: rev.entry_id, isNew: false, msg: `Đang mở bản #${Number(f.get('rev'))}. Bấm "Kiểm tra & lưu" để khôi phục.` });
}

// ---------------------------------------------------------------- ảnh
async function mediaPage({ sql }: AdminCtx, user: Viewer, url: URL) {
  const rows = (await sql.query<any>('SELECT path, width, height, length(bytes) AS size, uploaded_by, uploaded_at FROM media ORDER BY path')).rows;
  const used = new Set((await sql.query<{ source: string }>('SELECT source FROM content_entries')).rows.flatMap((r) => r.source.match(/\/(?:images|documents)\/[\w.-]+/g) ?? []));
  const filter = url.searchParams.get('f') ?? '';
  const pick = rows.filter((r) => (filter === 'documents' ? r.path.startsWith('/documents/') : filter === 'images' ? r.path.startsWith('/images/') : filter === 'unused' ? !used.has(r.path) : true));
  const unused = rows.filter((r) => !used.has(r.path)).length;
  return page('Ảnh', `
    ${pageHead(`Ảnh <span class="muted">(${rows.length})</span>`)}
    ${url.searchParams.get('msg') ? notice('ok', esc(url.searchParams.get('msg'))) : ''}
    ${url.searchParams.get('err') ? notice('err', esc(url.searchParams.get('err'))) : ''}
    <form class="card grid" method="post" action="/admin/media" enctype="multipart/form-data">
      <label>Tệp ảnh (jpg, png, webp) <input type="file" name="file" accept="image/jpeg,image/png,image/webp" required></label>
      <label>Thư mục <select name="dir"><option value="images">Ảnh sản phẩm, ảnh bài</option><option value="documents">Giấy tờ (ĐÃ che thông tin cá nhân)</option></select></label>
      <label>Tên tệp (không dấu) <input name="name" placeholder="packshot-ten-san-pham" pattern="[a-z0-9][a-z0-9\\-]*"></label>
      <div style="align-self:end"><button>Tải lên</button></div>
      <p class="muted" style="grid-column:1/-1;margin:0">Ảnh tự chuyển WebP, cạnh dài ≤ 1600px, dưới 120KB. Dùng đường dẫn dưới mỗi ảnh trong ô JSON, ví dụ <code>"src": "/images/packshot-ten-san-pham.webp"</code>. Ảnh người thật cần văn bản đồng ý; ảnh bác sĩ, nhân viên y tế không được dùng (Nghị định 342/2025).</p>
    </form>
    <div class="chips">${[['', 'Tất cả', rows.length], ['images', 'Ảnh', rows.filter((r) => r.path.startsWith('/images/')).length],
      ['documents', 'Giấy tờ', rows.filter((r) => r.path.startsWith('/documents/')).length], ['unused', 'Chưa dùng', unused]]
      .map(([v, l, n]) => `<a href="/admin/media${v ? `?f=${v}` : ''}"${filter === v ? ' aria-current="page"' : ''}>${l}<span class="n">${n}</span></a>`).join('')}</div>
    <div class="thumbs">${pick.map((r) => `
      <figure><a href="/admin/media/raw?path=${encodeURIComponent(r.path)}" target="_blank" rel="noopener"><img src="/admin/media/raw?path=${encodeURIComponent(r.path)}" alt="" loading="lazy"></a>
        <figcaption><code>${esc(r.path)}</code><span class="muted">${r.width ?? '?'}×${r.height ?? '?'} · ${Math.round(r.size / 1024)}KB${used.has(r.path) ? '' : ' · <b>chưa dùng</b>'}</span>
        ${used.has(r.path) ? '' : `<form method="post" action="/admin/media/delete"><input type="hidden" name="path" value="${esc(r.path)}"><button class="danger sm">Xoá</button></form>`}
        </figcaption></figure>`).join('') || '<p class="muted">Không có ảnh nào.</p>'}
    </div>`, user);
}

const slugify = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd')
  .toLowerCase().replace(/\.[a-z0-9]+$/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

async function uploadMedia({ sql }: AdminCtx, user: Viewer, request: Request) {
  const f = await request.formData();
  const file = f.get('file');
  const dir = f.get('dir') === 'documents' ? 'documents' : 'images';
  if (!(file instanceof Blob) || file.size === 0) return redirect('/admin/media?err=' + encodeURIComponent('Chưa chọn tệp.'));
  if (file.size > 25 * 1024 * 1024) return redirect('/admin/media?err=' + encodeURIComponent('Tệp quá 25MB.'));
  const name = slugify(String(f.get('name') || (file as File).name || 'anh'));
  if (!name) return redirect('/admin/media?err=' + encodeURIComponent('Tên tệp không hợp lệ.'));
  const { default: sharp } = await import('sharp');
  let out: Buffer;
  try {
    const img = sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 120_000_000 }).rotate()
      .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true });
    let q = 82;
    do { out = await img.clone().webp({ quality: q, effort: 5 }).toBuffer(); q -= 8; } while (out.length > 118 * 1024 && q >= 42);
  } catch { return redirect('/admin/media?err=' + encodeURIComponent('Không đọc được ảnh.')); }
  const path = `/${dir}/${name}.webp`;
  await putMedia(sql, path, out, user.username);
  return redirect('/admin/media?msg=' + encodeURIComponent(`Đã tải lên ${path} (${Math.round(out.length / 1024)}KB).`));
}

async function mediaRaw({ sql }: AdminCtx, url: URL) {
  const row = (await sql.query<any>('SELECT bytes, mime FROM media WHERE path = $1', [url.searchParams.get('path') ?? ''])).rows[0];
  if (!row) return new Response('Not found', { status: 404 });
  return new Response(Buffer.from(row.bytes) as unknown as BodyInit, { headers: { 'content-type': row.mime, 'cache-control': 'private, max-age=300', 'x-content-type-options': 'nosniff', 'content-security-policy': "default-src 'none'; sandbox" } });
}

async function deleteMedia({ sql }: AdminCtx, _user: Viewer, request: Request) {
  const path = String((await request.formData()).get('path') ?? '');
  const inUse = (await sql.query<{ source: string }>('SELECT source FROM content_entries')).rows.some((r) => r.source.includes(path));
  if (!path || inUse) return redirect('/admin/media?err=' + encodeURIComponent(`${path} đang được dùng — gỡ khỏi nội dung trước.`));
  await sql.query('DELETE FROM media WHERE path = $1', [path]);
  return redirect('/admin/media?msg=' + encodeURIComponent(`Đã xoá ${path}.`));
}

// ---------------------------------------------------------------- xuất bản
async function publishPage({ sql }: AdminCtx, user: Viewer, url: URL) {
  const runs = (await sql.query<any>('SELECT id, started_at, finished_at, started_by, ok, log FROM publish_runs ORDER BY id DESC LIMIT 10')).rows;
  const openId = Number(url.searchParams.get('run') ?? runs[0]?.id);
  const open = runs.find((r) => r.id === openId);
  const busy = isPublishing();
  /* Nhật ký dài vài trăm dòng ảnh; lỗi luôn ở cuối — hiện phần cuối. */
  const lines = String(open?.log ?? '').split('\n');
  const tail = lines.length > 150 ? [`… (bỏ ${lines.length - 150} dòng đầu)`, ...lines.slice(-150)].join('\n') : lines.join('\n');
  const b = user.badges ?? {};
  return page('Xuất bản', `
    ${pageHead('Xuất bản', { sub: 'Ghi toàn bộ nội dung đang lưu ra file rồi build lại website. Build lỗi (sai schema, giá trong câu chữ lệch giá, thiếu nguồn cho tuyên bố…) thì <b>bản đang chạy giữ nguyên</b> và nhật ký nói rõ lỗi ở đâu.' })}
    ${busy ? notice('warn', 'Đang xuất bản… trang tự tải lại mỗi 5 giây.')
      : `<form method="post" action="/admin/publish" class="card row" style="margin-top:0">
          <button>Xuất bản ngay</button><span class="muted">${b.pending ? `<b>${b.pending}</b> thay đổi đang chờ lên trang thật.` : 'Không có thay đổi mới — xuất bản lại vẫn được.'}</span></form>`}
    <div class="split">
      <div><h2 style="margin-top:0">Các lần gần đây</h2>
        <table><tr><th>#</th><th>Bắt đầu</th><th>Ai</th><th>Kết quả</th></tr>
        ${runs.map((r) => `<tr data-run="${r.id}" data-status="${r.ok === null ? 'running' : r.ok ? 'ok' : 'error'}"${r.id === openId ? ' style="background:var(--paper)"' : ''}><td><a href="/admin/publish?run=${r.id}">#${r.id}</a></td><td class="nowrap">${esc(fmt(r.started_at))}</td><td>${esc(r.started_by)}</td>
          <td>${r.ok === null ? 'đang chạy' : r.ok ? '<span class="pill published">thành công</span>' : '<span class="pill bad">lỗi</span>'}</td></tr>`).join('')
          || '<tr><td colspan="4" class="muted">Chưa xuất bản lần nào.</td></tr>'}
        </table></div>
      ${open ? `<div><h2 style="margin-top:0">Nhật ký #${open.id}</h2><pre class="log">${esc(tail)}</pre></div>` : ''}
    </div>`, user, 200, {}, busy ? '<meta http-equiv="refresh" content="5">' : '');
}

async function startPublish(ctx: AdminCtx, user: Viewer) {
  if (!isPublishing()) publish(ctx.sql, ctx.root, user.username).catch(() => {});
  await new Promise((r) => setTimeout(r, 300));
  return redirect('/admin/publish');
}

// ---------------------------------------------------------------- đơn hàng
const STATUSES = ['new', 'contacted', 'confirmed', 'shipped', 'done', 'cancelled'];
const STATUS_VI: Record<string, string> = { new: 'Mới', contacted: 'Đã gọi', confirmed: 'Đã xác nhận', shipped: 'Đang giao', done: 'Hoàn tất', cancelled: 'Huỷ' };

async function ordersPage({ sql }: AdminCtx, user: Viewer, url: URL) {
  const st = STATUSES.includes(url.searchParams.get('status') ?? '') ? url.searchParams.get('status')! : '';
  const q = (url.searchParams.get('q') ?? '').trim().slice(0, 60);
  const where: string[] = []; const params: string[] = [];
  if (st) { params.push(st); where.push(`status = $${params.length}`); }
  if (q) { params.push(`%${q.replace(/[%_\\]/g, '\\$&')}%`); where.push(`(order_code ILIKE $${params.length} OR phone ILIKE $${params.length} OR name ILIKE $${params.length})`); }
  const rows = (await sql.query<any>(
    `SELECT order_code, created_at, status, product_slug, pack, pack_price, name, phone, address, note, staff_note, utm_source, utm_campaign
       FROM orders ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY id DESC LIMIT 200`, params)).rows;
  const counts = new Map((await sql.query<{ status: string; n: number }>('SELECT status, count(*)::int AS n FROM orders GROUP BY status')).rows.map((r) => [r.status, r.n]));
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  const back = `/admin/orders?${new URLSearchParams({ ...(st ? { status: st } : {}), ...(q ? { q } : {}) })}`;
  return page('Đơn hàng', `
    ${pageHead('Đơn hàng', { sub: 'Dữ liệu cá nhân của khách: chỉ dùng để xác nhận và giao đơn (Nghị định 13/2023). Xuất CSV: <code>/api/admin/orders?format=csv</code> với ADMIN_TOKEN.' })}
    <div class="chips">${[['', 'Tất cả', total], ...STATUSES.map((s) => [s, STATUS_VI[s], counts.get(s) ?? 0])]
      .map(([v, l, n]) => `<a href="/admin/orders${v ? `?status=${v}` : ''}"${st === v ? ' aria-current="page"' : ''}>${l}<span class="n">${n}</span></a>`).join('')}</div>
    <form method="get" action="/admin/orders" class="row" style="margin-top:0">${st ? `<input type="hidden" name="status" value="${esc(st)}">` : ''}
      <input name="q" value="${esc(q)}" placeholder="Tìm mã đơn, số điện thoại, tên" style="max-width:340px"><button class="ghost">Tìm</button>
      ${q ? `<a href="/admin/orders${st ? `?status=${st}` : ''}">Bỏ tìm</a>` : ''}</form>
    <table><tr><th>Đơn</th><th>Khách</th><th>Sản phẩm</th><th>Xử lý</th></tr>
    ${rows.map((o) => `<tr>
      <td class="nowrap"><b>${esc(o.order_code)}</b><br><span class="muted">${esc(fmt(o.created_at))}</span>${o.utm_source ? `<br><span class="muted">${esc(o.utm_source)}${o.utm_campaign ? ' / ' + esc(o.utm_campaign) : ''}</span>` : ''}</td>
      <td>${esc(o.name)}<br><a href="tel:${esc(o.phone)}">${esc(o.phone)}</a><br><span class="muted">${esc(o.address ?? '')}</span>${o.note ? `<br><i>${esc(o.note)}</i>` : ''}</td>
      <td>${esc(o.product_slug)}<br><span class="muted">${esc(o.pack)}${o.pack_price ? ` · ${Number(o.pack_price).toLocaleString('vi-VN')}đ` : ''}</span></td>
      <td style="min-width:230px"><form method="post" action="/admin/orders" class="grid" style="grid-template-columns:1fr;gap:6px">
        <input type="hidden" name="order_code" value="${esc(o.order_code)}"><input type="hidden" name="back" value="${esc(back)}">
        <select name="status" aria-label="Trạng thái">${STATUSES.map((s) => `<option value="${s}" ${s === o.status ? 'selected' : ''}>${STATUS_VI[s]}</option>`).join('')}</select>
        <input name="staff_note" value="${esc(o.staff_note ?? '')}" placeholder="ghi chú nội bộ" maxlength="500" aria-label="Ghi chú nội bộ">
        <div><button class="ghost sm">Lưu</button></div></form></td></tr>`).join('')
      || `<tr><td colspan="4" class="muted">${q || st ? 'Không có đơn nào khớp.' : 'Chưa có đơn nào.'}</td></tr>`}
    </table>`, user);
}

async function updateOrder({ sql }: AdminCtx, request: Request) {
  const f = await request.formData();
  const status = String(f.get('status') ?? '');
  const back = String(f.get('back') ?? '');
  const to = /^\/admin\/orders(\?[\w=&%.+-]*)?$/.test(back) ? back : '/admin/orders';
  if (!STATUSES.includes(status)) return redirect(to);
  await sql.query('UPDATE orders SET status = $1, staff_note = $2, updated_at = $3 WHERE order_code = $4',
    [status, String(f.get('staff_note') ?? '').slice(0, 500) || null, new Date().toISOString(), String(f.get('order_code') ?? '')]);
  return redirect(to);
}

// ---------------------------------------------------------------- tài khoản
async function usersPage({ sql }: AdminCtx, user: Viewer, url: URL) {
  const rows = (await sql.query<any>('SELECT username, role, created_at FROM admin_users ORDER BY username')).rows;
  return page('Tài khoản', `
    ${pageHead('Tài khoản', { sub: '<b>Biên tập</b>: nhập liệu, xuất bản, đơn hàng, kịch bản chat. <b>Quản trị</b>: thêm cấu hình chat và quản lý tài khoản.' })}
    ${url.searchParams.get('msg') ? notice('ok', esc(url.searchParams.get('msg'))) : ''}
    ${url.searchParams.get('err') ? notice('err', esc(url.searchParams.get('err'))) : ''}
    <table><tr><th>Tên</th><th>Quyền</th><th>Tạo lúc</th><th></th></tr>
    ${rows.map((r) => `<tr><td><b>${esc(r.username)}</b>${r.username === user.username ? ' <span class="muted">(bạn)</span>' : ''}</td>
      <td>${r.role === 'admin' ? 'Quản trị' : 'Biên tập'}</td><td class="muted">${esc(fmt(r.created_at))}</td>
      <td>${r.username === user.username ? '' : `<form method="post" action="/admin/users/delete" class="row" style="margin:0">
        <input type="hidden" name="username" value="${esc(r.username)}">
        <label style="display:flex;gap:6px;font-weight:400"><input type="checkbox" name="confirm" value="1" required style="width:auto"> <span>xác nhận</span></label>
        <button class="danger sm">Xoá</button></form>`}</td></tr>`).join('')}</table>
    <h2>Thêm tài khoản hoặc đặt lại mật khẩu</h2>
    <form class="card grid" method="post" action="/admin/users">
      <label>Tên đăng nhập <input name="username" pattern="[a-z0-9._\\-]{3,32}" required autocomplete="off"></label>
      <label>Mật khẩu (≥ 10 ký tự) <input name="password" type="password" minlength="10" required autocomplete="new-password"></label>
      <label>Quyền <select name="role"><option value="editor">Biên tập</option><option value="admin">Quản trị</option></select></label>
      <div style="align-self:end"><button>Lưu</button></div>
      <p class="muted" style="grid-column:1/-1;margin:0">Nhập tên đã có để đặt lại mật khẩu hoặc đổi quyền.</p>
    </form>`, user);
}

async function saveUser({ sql }: AdminCtx, request: Request) {
  const f = await request.formData();
  try {
    await createUser(sql, String(f.get('username') ?? '').toLowerCase(), String(f.get('password') ?? ''), f.get('role') === 'admin' ? 'admin' : 'editor');
    return redirect('/admin/users?msg=' + encodeURIComponent('Đã lưu tài khoản.'));
  } catch (e) {
    return redirect('/admin/users?err=' + encodeURIComponent((e as Error).message));
  }
}

async function deleteUser({ sql }: AdminCtx, user: Viewer, request: Request) {
  const f = await request.formData();
  const name = String(f.get('username') ?? '');
  if (f.get('confirm') !== '1' || !name) return redirect('/admin/users');
  if (name === user.username) return redirect('/admin/users?err=' + encodeURIComponent('Không tự xoá tài khoản đang đăng nhập.'));
  await sql.query('DELETE FROM admin_sessions WHERE username = $1', [name]);
  await sql.query('DELETE FROM admin_users WHERE username = $1', [name]);
  return redirect('/admin/users?msg=' + encodeURIComponent(`Đã xoá tài khoản ${name}.`));
}
