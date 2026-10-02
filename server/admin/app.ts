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
  login, logout, userFromRequest, sessionCookie, clearCookie, sameOrigin, cookie, COOKIE, createUser, type User,
} from '../lib/auth.ts';
import { publish, isPublishing } from '../lib/publish.ts';
import { page, redirect, esc, notice } from './html.ts';

export interface AdminCtx { sql: Sql; root: string }

const LABEL: Record<string, string> = {
  products: 'Sản phẩm', documents: 'Giấy tờ', lines: 'Dòng sản phẩm', pages: 'Trang chủ',
  articles: 'Bài tư vấn', policies: 'Chính sách', guides: 'Góc tư vấn', brand: 'Thương hiệu',
};

/** Trường hay sửa nhất, đưa lên đầu biểu mẫu. Phần còn lại sửa trong ô JSON. */
const QUICK: Record<string, { path: string; label: string; type: 'text' | 'number' | 'select' | 'date'; options?: string[] }[]> = {
  products: [
    { path: 'status', label: 'Trạng thái', type: 'select', options: ['published', 'draft'] },
    { path: 'price', label: 'Giá bán (VND)', type: 'number' },
    { path: 'compareAtPrice', label: 'Giá niêm yết gạch ngang (VND)', type: 'number' },
    { path: 'availability', label: 'Tình trạng hàng', type: 'select', options: ['InStock', 'OutOfStock', 'PreOrder', 'BackOrder'] },
    { path: 'compliance.productNotificationNumber', label: 'Số tiếp nhận phiếu công bố', type: 'text' },
  ],
  documents: [
    { path: 'status', label: 'Trạng thái', type: 'select', options: ['published', 'draft'] },
    { path: 'reference', label: 'Số hiệu', type: 'text' },
    { path: 'issuedAt', label: 'Ngày cấp', type: 'date' },
    { path: 'validUntil', label: 'Hiệu lực đến', type: 'date' },
  ],
  articles: [{ path: 'status', label: 'Trạng thái', type: 'select', options: ['published', 'draft'] }],
  lines: [{ path: 'status', label: 'Trạng thái', type: 'select', options: ['published', 'draft'] }],
};

const get = (o: any, path: string) => path.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
function set(o: any, path: string, v: unknown) {
  const ks = path.split('.'); let cur = o;
  for (const k of ks.slice(0, -1)) cur = cur[k] ??= {};
  if (v === undefined) delete cur[ks.at(-1)!]; else cur[ks.at(-1)!] = v;
}
const titleOf = (d: any) => d?.shortName ?? d?.name ?? d?.title ?? d?.heading ?? d?.tradingName ?? d?.hero?.heading ?? '';
const ID = /^[a-z0-9][a-z0-9-]*(?:\/[a-z]{2})?$/;

export async function adminHandler(request: Request, ctx: AdminCtx): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '') || '/admin';
  const { sql } = ctx;

  if (request.method === 'POST' && !sameOrigin(request)) {
    return page('Từ chối', notice('err', 'Yêu cầu không đến từ chính trang quản trị (kiểm tra Origin thất bại).'), null, 403);
  }

  // ---------------------------------------------------------------- đăng nhập
  if (path === '/admin/login') {
    if (request.method === 'POST') {
      const f = await request.formData();
      const token = await login(sql, String(f.get('username') ?? '').trim().toLowerCase(), String(f.get('password') ?? ''));
      if (!token) return loginPage('Sai tên đăng nhập hoặc mật khẩu.', 401);
      return redirect('/admin/', { 'set-cookie': sessionCookie(token) });
    }
    return loginPage();
  }
  const user = await userFromRequest(sql, request);
  if (!user) return redirect('/admin/login');

  if (path === '/admin/logout' && request.method === 'POST') {
    const t = cookie(request, COOKIE); if (t) await logout(sql, t);
    return redirect('/admin/login', { 'set-cookie': clearCookie() });
  }

  if (path === '/admin') return dashboard(ctx, user, url);
  if (path.startsWith('/admin/content/')) return listPage(ctx, user, path.slice('/admin/content/'.length));
  if (path === '/admin/edit') return request.method === 'POST' ? saveEntry(ctx, user, request) : editPage(ctx, user, url);
  if (path === '/admin/history') return historyPage(ctx, user, url);
  if (path === '/admin/restore' && request.method === 'POST') return restore(ctx, user, request);
  if (path === '/admin/media') return request.method === 'POST' ? uploadMedia(ctx, user, request) : mediaPage(ctx, user, url);
  if (path === '/admin/media/raw') return mediaRaw(ctx, url);
  if (path === '/admin/media/delete' && request.method === 'POST') return deleteMedia(ctx, user, request);
  if (path === '/admin/publish') return request.method === 'POST' ? startPublish(ctx, user) : publishPage(ctx, user, url);
  if (path === '/admin/chats') return chatsPage(ctx, user, url);
  if (path === '/admin/orders') return request.method === 'POST' ? updateOrder(ctx, request) : ordersPage(ctx, user, url);
  if (path === '/admin/users' && user.role === 'admin') return request.method === 'POST' ? saveUser(ctx, request) : usersPage(ctx, user, url);
  return page('Không có trang này', notice('err', 'Không có trang này.'), user, 404);
}

function loginPage(err = '', status = 200) {
  return page('Đăng nhập', `
    <div class="card" style="max-width:380px;margin:60px auto">
      <h1>Đăng nhập nhập liệu</h1>
      ${err ? notice('err', esc(err)) : ''}
      <form method="post" action="/admin/login" class="grid" style="grid-template-columns:1fr">
        <label>Tên đăng nhập <input name="username" autocomplete="username" required></label>
        <label>Mật khẩu <input name="password" type="password" autocomplete="current-password" required></label>
        <button>Đăng nhập</button>
      </form>
    </div>`, null, status);
}

// ---------------------------------------------------------------- tổng quan
async function dashboard({ sql }: AdminCtx, user: User, url: URL) {
  const counts = (await sql.query<{ collection: string; n: number; drafts: number }>(
    `SELECT collection, count(*)::int AS n,
            count(*) FILTER (WHERE data->>'status' = 'draft')::int AS drafts
       FROM content_entries GROUP BY collection ORDER BY collection`)).rows;
  const recent = (await sql.query<any>(
    `SELECT collection, entry_id, saved_at, saved_by, note FROM content_revisions ORDER BY id DESC LIMIT 12`)).rows;
  const last = (await sql.query<any>('SELECT id, started_at, ok, started_by FROM publish_runs ORDER BY id DESC LIMIT 1')).rows[0];
  const pendingSince = last
    ? (await sql.query<{ n: number }>('SELECT count(*)::int AS n FROM content_revisions WHERE saved_at > $1', [last.started_at])).rows[0].n
    : recent.length;
  return page('Tổng quan', `
    <h1>Tổng quan</h1>
    ${url.searchParams.get('msg') ? notice('ok', esc(url.searchParams.get('msg'))) : ''}
    ${pendingSince ? notice('warn', `Có <b>${pendingSince}</b> thay đổi chưa xuất bản. <a href="/admin/publish">Xuất bản</a> để đưa lên trang thật.`) : ''}
    <div class="grid">${counts.map((c) => `
      <a class="card" href="/admin/content/${esc(c.collection)}" style="text-decoration:none">
        <div class="muted">${esc(LABEL[c.collection] ?? c.collection)}</div>
        <div style="font-size:28px;font-weight:700;color:var(--navy)">${c.n}</div>
        ${c.drafts ? `<span class="pill draft">${c.drafts} bản nháp</span>` : ''}
      </a>`).join('')}
    </div>
    <h2>Lần xuất bản gần nhất</h2>
    <p>${last ? `#${last.id} · ${esc(fmt(last.started_at))} · ${esc(last.started_by)} · ${last.ok === null ? 'đang chạy' : last.ok ? '<span class="pill published">thành công</span>' : '<span class="pill draft">lỗi</span>'}` : 'Chưa xuất bản lần nào.'}</p>
    <h2>Sửa gần đây</h2>
    <table><tr><th>Lúc</th><th>Ai</th><th>Nội dung</th><th>Ghi chú</th></tr>
    ${recent.map((r) => `<tr><td>${esc(fmt(r.saved_at))}</td><td>${esc(r.saved_by)}</td>
      <td><a href="/admin/edit?c=${esc(r.collection)}&id=${encodeURIComponent(r.entry_id)}">${esc(r.collection)}/${esc(r.entry_id)}</a></td><td>${esc(r.note ?? '')}</td></tr>`).join('')}
    </table>`, user);
}

const fmt = (d: any) => new Date(d).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

// ---------------------------------------------------------------- danh sách
async function listPage({ sql }: AdminCtx, user: User, collection: string) {
  if (!COLLECTIONS[collection]) return page('Không có', notice('err', 'Không có collection này.'), user, 404);
  const rows = (await sql.query<any>(
    `SELECT entry_id, data, updated_at, updated_by FROM content_entries WHERE collection = $1 ORDER BY entry_id`, [collection])).rows;
  return page(LABEL[collection] ?? collection, `
    <h1>${esc(LABEL[collection] ?? collection)} <span class="muted">(${rows.length})</span></h1>
    <div class="row"><a class="btn" href="/admin/edit?c=${esc(collection)}&new=1">+ Thêm mới</a>
      <span class="muted">Mã (id) của sản phẩm có dạng <code>slug/ngôn-ngữ</code>, ví dụ <code>combo-nam/vi</code>.</span></div>
    <table><tr><th>Mã</th><th>Tên</th><th>Trạng thái</th><th>Sửa lần cuối</th><th></th></tr>
    ${rows.map((r) => `<tr>
      <td><code>${esc(r.entry_id)}</code></td><td>${esc(titleOf(r.data))}</td>
      <td>${r.data?.status ? `<span class="pill ${esc(r.data.status)}">${esc(r.data.status)}</span>` : ''}</td>
      <td class="muted">${esc(fmt(r.updated_at))} · ${esc(r.updated_by)}</td>
      <td><a href="/admin/edit?c=${esc(collection)}&id=${encodeURIComponent(r.entry_id)}">Sửa</a> ·
          <a href="/admin/edit?c=${esc(collection)}&new=1&from=${encodeURIComponent(r.entry_id)}">Nhân bản</a></td></tr>`).join('')}
    </table>`, user);
}

// ---------------------------------------------------------------- sửa
async function editPage({ sql }: AdminCtx, user: User, url: URL, state?: { source: string; id: string; issues?: Issue[]; msg?: string; isNew?: boolean }) {
  const c = url.searchParams.get('c') ?? '';
  if (!COLLECTIONS[c]) return page('Không có', notice('err', 'Không có collection này.'), user, 404);
  let id = state?.id ?? url.searchParams.get('id') ?? '';
  const isNew = state?.isNew ?? url.searchParams.get('new') === '1';
  let source = state?.source ?? '';
  if (!state) {
    const from = isNew ? url.searchParams.get('from') : id;
    if (from) {
      const row = (await sql.query<{ source: string }>('SELECT source FROM content_entries WHERE collection = $1 AND entry_id = $2', [c, from])).rows[0];
      if (!row && !isNew) return page('Không có', notice('err', 'Không có nội dung này.'), user, 404);
      source = row?.source ?? '';
      if (isNew) { id = ''; try { const d = JSON.parse(source); d.status = 'draft'; source = canonicalSource(d); } catch { /* giữ nguyên */ } }
    }
    if (!source) source = '{\n  "status": "draft"\n}\n';
  }
  let data: any = {}; try { data = JSON.parse(source); } catch { /* báo ở dưới */ }
  const quick = QUICK[c] ?? [];
  const issues = state?.issues;
  return page(`Sửa ${c}/${id}`, `
    <h1>${isNew ? 'Thêm mới' : 'Sửa'} · ${esc(LABEL[c] ?? c)} ${id ? `<code>${esc(id)}</code>` : ''}</h1>
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
          if (q.type === 'select') return `<label>${esc(q.label)} <select name="q:${esc(q.path)}">${(q.options ?? []).map((o) => `<option ${o === v ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></label>`;
          return `<label>${esc(q.label)} <input name="q:${esc(q.path)}" type="${q.type === 'number' ? 'number' : q.type === 'date' ? 'date' : 'text'}" value="${esc(v ?? '')}"></label>`;
        }).join('')}
      </div>
      <p class="muted">Các ô phía trên ghi đè lên nội dung JSON khi lưu. Mọi trường khác sửa trong ô JSON — bảng giải nghĩa từng trường ở <code>docs/truong-du-lieu.md</code>. Giá trong câu chữ dùng <code>{{price}}</code>, <code>{{compareAtPrice}}</code> để không bao giờ lệch.</p>
      <label>Nội dung (JSON) <textarea class="json" name="source" spellcheck="false">${esc(source)}</textarea></label>
      <div class="row">
        <label style="flex:1">Ghi chú lần sửa <input name="note" placeholder="vd: đổi giá theo bảng giá 10/2026"></label>
      </div>
      <div class="row">
        <button name="action" value="save">Kiểm tra &amp; lưu</button>
        <button name="action" value="check" class="ghost">Chỉ kiểm tra</button>
        ${!isNew ? `<a class="btn ghost" href="/admin/history?c=${esc(c)}&id=${encodeURIComponent(id)}">Lịch sử</a>
        <button name="action" value="delete" class="danger" formnovalidate>Xoá</button>` : ''}
      </div>
    </form>`, user, issues?.length ? 422 : 200);
}

async function saveEntry(ctx: AdminCtx, user: User, request: Request) {
  const { sql, root } = ctx;
  const f = await request.formData();
  const c = String(f.get('c') ?? ''), isNew = f.get('isNew') === '1';
  const id = String(f.get('id') ?? '').trim();
  const action = String(f.get('action') ?? 'save');
  const note = String(f.get('note') ?? '').slice(0, 200) || null;
  const url = new URL(`http://x/admin/edit?c=${encodeURIComponent(c)}`);
  if (!COLLECTIONS[c]) return page('Không có', notice('err', 'Không có collection này.'), user, 404);
  if (!ID.test(id)) return editPage(ctx, user, url, { source: String(f.get('source') ?? ''), id, isNew, issues: [{ path: 'id', message: 'Mã chỉ gồm chữ thường, số, gạch nối; sản phẩm có thêm "/vi" hoặc "/en".' }] });

  if (action === 'delete') {
    await sql.query('DELETE FROM content_entries WHERE collection = $1 AND entry_id = $2', [c, id]);
    await sql.query('INSERT INTO content_revisions (collection, entry_id, source, saved_by, note) VALUES ($1, $2, NULL, $3, $4)', [c, id, user.username, note ?? 'xoá']);
    return redirect(`/admin/content/${c}`);
  }

  let data: any;
  try { data = JSON.parse(String(f.get('source') ?? '')); }
  catch (e) {
    return editPage(ctx, user, url, { source: String(f.get('source') ?? ''), id, isNew, issues: [{ path: '', message: `JSON không hợp lệ: ${(e as Error).message}` }] });
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
    `INSERT INTO content_entries (collection, entry_id, data, source, updated_by) VALUES ($1, $2, $3::jsonb, $4, $5)
     ON CONFLICT (collection, entry_id) DO UPDATE SET data = EXCLUDED.data, source = EXCLUDED.source, updated_at = now(), updated_by = EXCLUDED.updated_by`,
    [c, id, source, source, user.username]);
  await sql.query('INSERT INTO content_revisions (collection, entry_id, source, saved_by, note) VALUES ($1, $2, $3, $4, $5)', [c, id, source, user.username, note]);
  return editPage(ctx, user, new URL(`http://x/admin/edit?c=${c}&id=${encodeURIComponent(id)}`),
    { source, id, isNew: false, msg: 'Đã lưu. Trang thật chỉ đổi sau khi Xuất bản.' });
}

async function historyPage({ sql }: AdminCtx, user: User, url: URL) {
  const c = url.searchParams.get('c') ?? '', id = url.searchParams.get('id') ?? '';
  const rows = (await sql.query<any>(
    'SELECT id, saved_at, saved_by, note, length(source) AS len FROM content_revisions WHERE collection = $1 AND entry_id = $2 ORDER BY id DESC LIMIT 100', [c, id])).rows;
  return page('Lịch sử', `
    <h1>Lịch sử · <code>${esc(c)}/${esc(id)}</code></h1>
    <table><tr><th>#</th><th>Lúc</th><th>Ai</th><th>Ghi chú</th><th></th></tr>
    ${rows.map((r) => `<tr><td>${r.id}</td><td>${esc(fmt(r.saved_at))}</td><td>${esc(r.saved_by)}</td><td>${esc(r.note ?? '')}</td>
      <td>${r.len === null ? '<span class="muted">(xoá)</span>' : `<form method="post" action="/admin/restore"><input type="hidden" name="rev" value="${r.id}"><button class="ghost">Khôi phục bản này</button></form>`}</td></tr>`).join('')}
    </table>`, user);
}

async function restore(ctx: AdminCtx, user: User, request: Request) {
  const f = await request.formData();
  const rev = (await ctx.sql.query<any>('SELECT collection, entry_id, source FROM content_revisions WHERE id = $1', [Number(f.get('rev'))])).rows[0];
  if (!rev?.source) return page('Không có', notice('err', 'Không có bản này.'), user, 404);
  /* Khôi phục = mở bản cũ trong trình sửa; vẫn phải qua kiểm tra rồi mới lưu. */
  return editPage(ctx, user, new URL(`http://x/admin/edit?c=${rev.collection}`), { source: rev.source, id: rev.entry_id, isNew: false, msg: `Đang mở bản #${f.get('rev')}. Bấm "Kiểm tra & lưu" để khôi phục.` });
}

// ---------------------------------------------------------------- ảnh
async function mediaPage({ sql }: AdminCtx, user: User, url: URL) {
  const rows = (await sql.query<any>('SELECT path, width, height, length(bytes) AS size, uploaded_by, uploaded_at FROM media ORDER BY path')).rows;
  const used = new Set((await sql.query<{ source: string }>('SELECT source FROM content_entries')).rows.flatMap((r) => r.source.match(/\/(?:images|documents)\/[\w.-]+/g) ?? []));
  return page('Ảnh', `
    <h1>Ảnh <span class="muted">(${rows.length})</span></h1>
    ${url.searchParams.get('msg') ? notice('ok', esc(url.searchParams.get('msg'))) : ''}
    ${url.searchParams.get('err') ? notice('err', esc(url.searchParams.get('err'))) : ''}
    <form class="card grid" method="post" action="/admin/media" enctype="multipart/form-data">
      <label>Tệp ảnh (jpg, png, webp) <input type="file" name="file" accept="image/jpeg,image/png,image/webp" required></label>
      <label>Thư mục <select name="dir"><option value="images">images — ảnh sản phẩm, ảnh bài</option><option value="documents">documents — giấy tờ ĐÃ CHE thông tin cá nhân</option></select></label>
      <label>Tên tệp (không dấu) <input name="name" placeholder="packshot-ten-san-pham" pattern="[a-z0-9][a-z0-9-]*"></label>
      <div><button>Tải lên</button></div>
      <p class="muted" style="grid-column:1/-1">Ảnh được chuyển sang WebP, cạnh dài tối đa 1600px, dưới 120KB (ngân sách trọng lượng của site). Dùng đường dẫn hiện dưới mỗi ảnh trong ô JSON, ví dụ <code>"src": "/images/packshot-ten-san-pham.webp"</code>. Ảnh người thật cần văn bản đồng ý; ảnh bác sĩ, nhân viên y tế không được dùng (Nghị định 342/2025).</p>
    </form>
    <div class="thumbs">${rows.map((r) => `
      <figure><img src="/admin/media/raw?path=${encodeURIComponent(r.path)}" alt="" loading="lazy">
        <figcaption><code>${esc(r.path)}</code><br><span class="muted">${r.width}×${r.height} · ${Math.round(r.size / 1024)}KB${used.has(r.path) ? '' : ' · chưa dùng'}</span>
        ${used.has(r.path) ? '' : `<form method="post" action="/admin/media/delete"><input type="hidden" name="path" value="${esc(r.path)}"><button class="danger" style="padding:3px 10px;font-size:12px">Xoá</button></form>`}
        </figcaption></figure>`).join('')}
    </div>`, user);
}

const slugify = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd')
  .toLowerCase().replace(/\.[a-z0-9]+$/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

async function uploadMedia({ sql }: AdminCtx, user: User, request: Request) {
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
  const row = (await sql.query<any>('SELECT bytes, mime FROM media WHERE path = $1', [url.searchParams.get('path')])).rows[0];
  if (!row) return new Response('Not found', { status: 404 });
  return new Response(Buffer.from(row.bytes) as unknown as BodyInit, { headers: { 'content-type': row.mime, 'cache-control': 'private, max-age=300', 'x-content-type-options': 'nosniff' } });
}

async function deleteMedia({ sql }: AdminCtx, _user: User, request: Request) {
  const path = String((await request.formData()).get('path') ?? '');
  const inUse = (await sql.query('SELECT 1 FROM content_entries WHERE source LIKE $1 LIMIT 1', [`%${path}%`])).rows.length;
  if (inUse) return redirect('/admin/media?err=' + encodeURIComponent(`${path} đang được dùng — gỡ khỏi nội dung trước.`));
  await sql.query('DELETE FROM media WHERE path = $1', [path]);
  return redirect('/admin/media?msg=' + encodeURIComponent(`Đã xoá ${path}.`));
}

// ---------------------------------------------------------------- xuất bản
async function publishPage({ sql }: AdminCtx, user: User, url: URL) {
  const runs = (await sql.query<any>('SELECT id, started_at, finished_at, started_by, ok, log FROM publish_runs ORDER BY id DESC LIMIT 10')).rows;
  const openId = Number(url.searchParams.get('run') ?? runs[0]?.id);
  const open = runs.find((r) => r.id === openId);
  return page('Xuất bản', `
    <h1>Xuất bản</h1>
    <p>Xuất bản ghi toàn bộ nội dung đang lưu ra file rồi build lại website. Build có lỗi (sai schema, giá trong câu chữ lệch giá, thiếu nguồn cho tuyên bố…) thì <b>bản đang chạy giữ nguyên</b> và nhật ký nói rõ lỗi ở đâu.</p>
    ${isPublishing() ? notice('warn', 'Đang xuất bản… tải lại trang sau ít giây để xem kết quả.') : `<form method="post" action="/admin/publish"><button>Xuất bản ngay</button></form>`}
    <h2>Các lần gần đây</h2>
    <table><tr><th>#</th><th>Bắt đầu</th><th>Ai</th><th>Kết quả</th></tr>
    ${runs.map((r) => `<tr><td><a href="/admin/publish?run=${r.id}">#${r.id}</a></td><td>${esc(fmt(r.started_at))}</td><td>${esc(r.started_by)}</td>
      <td>${r.ok === null ? 'đang chạy' : r.ok ? '<span class="pill published">thành công</span>' : '<span class="pill draft">lỗi</span>'}</td></tr>`).join('')}
    </table>
    ${open ? `<h2>Nhật ký #${open.id}</h2><pre class="log">${esc(open.log ?? '')}</pre>` : ''}`, user);
}

async function startPublish(ctx: AdminCtx, user: User) {
  if (!isPublishing()) publish(ctx.sql, ctx.root, user.username).catch(() => {});
  await new Promise((r) => setTimeout(r, 300));
  return redirect('/admin/publish');
}

// ---------------------------------------------------------------- chat
/** Danh sách cuộc trò chuyện + xem lại từng cuộc. Chỉ chữ: ảnh khách gửi không được lưu. */
async function chatsPage({ sql }: AdminCtx, user: User, url: URL) {
  const sid = url.searchParams.get('s');
  if (sid) {
    const rows = (await sql.query<any>('SELECT role, text, payload, created_at, page_path, visitor_id FROM chat_messages WHERE session_id = $1 ORDER BY id', [sid])).rows;
    return page('Chat', `
      <h1>Cuộc trò chuyện <code>${esc(sid.slice(0, 8))}</code></h1>
      <p class="muted">Khách ${esc(rows[0]?.visitor_id ?? '')} · <a href="/admin/chats">← tất cả</a></p>
      ${rows.map((r) => {
        const extra = r.role === 'user'
          ? [r.payload?.images ? `${r.payload.images} ảnh (không lưu)` : '', r.payload?.event === 'quick_reply' ? 'nút gợi ý' : ''].filter(Boolean).join(' · ')
          /* Mọi mẩu chữ đến từ n8n (nhãn nút, tên…) đều escape — trang quản trị không tin phản hồi của bot. */
          : esc((r.payload?.messages ?? []).filter((m: any) => m.type !== 'text').map((m: any) =>
              m.type === 'product' ? `thẻ: ${m.product?.name}` : m.type === 'products' ? `dải thẻ: ${(m.products ?? []).map((p: any) => p.name).join(', ')}` : m.type === 'link' ? `nút: ${m.label}` : m.type).join(' · '))
            + (r.payload?.degraded ? ` · <b>${esc(r.payload.degraded)}</b>` : '');
        return `<div class="card" style="margin-left:${r.role === 'user' ? '15%' : '0'};margin-right:${r.role === 'user' ? '0' : '15%'};background:${r.role === 'user' ? '#eef0fb' : '#fff'}">
          <div class="muted">${r.role === 'user' ? 'Khách' : 'Bot'} · ${esc(fmt(r.created_at))} · ${esc(r.page_path ?? '')}</div>
          <div style="white-space:pre-wrap">${esc(r.text ?? '')}</div>${extra ? `<div class="muted">${r.role === 'bot' ? extra /* đã escape ở trên */ : esc(extra)}</div>` : ''}</div>`;
      }).join('') || notice('warn', 'Không có tin nào (có thể đã quá hạn lưu và bị xoá).')}`, user);
  }
  const rows = (await sql.query<any>(
    `SELECT session_id, min(visitor_id) AS visitor_id, count(*)::int AS n, max(created_at) AS last_at, min(created_at) AS first_at,
            (array_agg(text ORDER BY id) FILTER (WHERE role = 'user' AND text IS NOT NULL))[1] AS first_text,
            bool_or(payload->>'degraded' IS NOT NULL) AS degraded
       FROM chat_messages GROUP BY session_id ORDER BY max(created_at) DESC LIMIT 200`)).rows;
  return page('Chat', `
    <h1>Chat <span class="muted">(${rows.length} cuộc gần nhất)</span></h1>
    <p class="muted">Lưu chữ ${esc(process.env.CHAT_RETENTION_DAYS ?? '90')} ngày, không lưu ảnh. Cột "Khách" là mã ẩn danh của trình duyệt (cookie), không phải danh tính.</p>
    <table><tr><th>Lần cuối</th><th>Khách</th><th>Câu đầu tiên</th><th>Lượt</th><th></th></tr>
    ${rows.map((r) => `<tr><td>${esc(fmt(r.last_at))}</td><td><code>${esc(String(r.visitor_id).slice(0, 10))}</code></td>
      <td>${esc((r.first_text ?? '').slice(0, 120))}${r.degraded ? ' <span class="pill draft">có lỗi n8n</span>' : ''}</td><td>${r.n}</td>
      <td><a href="/admin/chats?s=${encodeURIComponent(r.session_id)}">Xem</a></td></tr>`).join('')}
    </table>`, user);
}

// ---------------------------------------------------------------- đơn hàng
const STATUSES = ['new', 'contacted', 'confirmed', 'shipped', 'done', 'cancelled'];
const STATUS_VI: Record<string, string> = { new: 'Mới', contacted: 'Đã gọi', confirmed: 'Đã xác nhận', shipped: 'Đang giao', done: 'Hoàn tất', cancelled: 'Huỷ' };

async function ordersPage({ sql }: AdminCtx, user: User, url: URL) {
  const st = url.searchParams.get('status');
  const rows = (await sql.query<any>(
    `SELECT order_code, created_at, status, product_slug, pack, pack_price, name, phone, address, note, staff_note, utm_source, utm_campaign
       FROM orders ${st && STATUSES.includes(st) ? 'WHERE status = $1' : ''} ORDER BY id DESC LIMIT 200`, st && STATUSES.includes(st) ? [st] : [])).rows;
  return page('Đơn hàng', `
    <h1>Đơn hàng</h1>
    <div class="row">${['', ...STATUSES].map((s) => `<a class="btn ${s === (st ?? '') ? '' : 'ghost'}" href="/admin/orders${s ? `?status=${s}` : ''}">${s ? STATUS_VI[s] : 'Tất cả'}</a>`).join('')}</div>
    <p class="muted">Dữ liệu cá nhân của khách: chỉ dùng để xác nhận và giao đơn (Nghị định 13/2023). Xuất CSV qua <code>/api/admin/orders?format=csv</code> với ADMIN_TOKEN.</p>
    <table><tr><th>Mã · lúc</th><th>Khách</th><th>Đặt</th><th>Trạng thái</th></tr>
    ${rows.map((o) => `<tr>
      <td><b>${esc(o.order_code)}</b><br><span class="muted">${esc(fmt(o.created_at))}${o.utm_source ? ` · ${esc(o.utm_source)}/${esc(o.utm_campaign ?? '')}` : ''}</span></td>
      <td>${esc(o.name)}<br><a href="tel:${esc(o.phone)}">${esc(o.phone)}</a><br><span class="muted">${esc(o.address ?? '')}</span>${o.note ? `<br><i>${esc(o.note)}</i>` : ''}</td>
      <td>${esc(o.product_slug)}<br><span class="muted">${esc(o.pack)}${o.pack_price ? ` · ${Number(o.pack_price).toLocaleString('vi-VN')}đ` : ''}</span></td>
      <td><form method="post" action="/admin/orders" class="grid" style="grid-template-columns:1fr">
        <input type="hidden" name="order_code" value="${esc(o.order_code)}">
        <select name="status">${STATUSES.map((s) => `<option value="${s}" ${s === o.status ? 'selected' : ''}>${STATUS_VI[s]}</option>`).join('')}</select>
        <input name="staff_note" value="${esc(o.staff_note ?? '')}" placeholder="ghi chú nội bộ">
        <button class="ghost">Lưu</button></form></td></tr>`).join('')}
    </table>`, user);
}

async function updateOrder({ sql }: AdminCtx, request: Request) {
  const f = await request.formData();
  const status = String(f.get('status') ?? '');
  if (!STATUSES.includes(status)) return redirect('/admin/orders');
  await sql.query('UPDATE orders SET status = $1, staff_note = $2, updated_at = $3 WHERE order_code = $4',
    [status, String(f.get('staff_note') ?? '').slice(0, 500) || null, new Date().toISOString(), String(f.get('order_code') ?? '')]);
  return redirect('/admin/orders');
}

// ---------------------------------------------------------------- tài khoản
async function usersPage({ sql }: AdminCtx, user: User, url: URL) {
  const rows = (await sql.query<any>('SELECT username, role, created_at FROM admin_users ORDER BY username')).rows;
  return page('Tài khoản', `
    <h1>Tài khoản</h1>
    ${url.searchParams.get('msg') ? notice('ok', esc(url.searchParams.get('msg'))) : ''}
    ${url.searchParams.get('err') ? notice('err', esc(url.searchParams.get('err'))) : ''}
    <table><tr><th>Tên</th><th>Quyền</th><th>Tạo lúc</th></tr>
    ${rows.map((r) => `<tr><td>${esc(r.username)}</td><td>${esc(r.role)}</td><td class="muted">${esc(fmt(r.created_at))}</td></tr>`).join('')}</table>
    <h2>Thêm hoặc đặt lại mật khẩu</h2>
    <form class="card grid" method="post" action="/admin/users">
      <label>Tên đăng nhập <input name="username" pattern="[a-z0-9._\\-]{3,32}" required></label>
      <label>Mật khẩu (≥ 10 ký tự) <input name="password" type="password" minlength="10" required autocomplete="new-password"></label>
      <label>Quyền <select name="role"><option value="editor">editor — nhập liệu, xuất bản</option><option value="admin">admin — thêm cả quản lý tài khoản</option></select></label>
      <div><button>Lưu</button></div>
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
