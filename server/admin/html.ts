/**
 * Khung HTML của trang quản trị. Render ở máy chủ, không JS (CSP chặn mọi script):
 * biểu mẫu thuần, menu điện thoại dùng <details>.
 *
 * Bố cục: thanh bên chia nhóm theo việc hằng ngày — Bán hàng, Nội dung, Website,
 * Chat, Hệ thống — đánh dấu trang đang mở và số việc đang chờ (đơn mới, thay đổi
 * chưa xuất bản, câu chat chưa trả lời được). Trên điện thoại thanh bên thu thành
 * nút "Menu".
 */
import type { User } from '../lib/auth.ts';

export const esc = (v: unknown) => String(v ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export const SECURITY_HEADERS: Record<string, string> = {
  'content-type': 'text/html; charset=utf-8',
  'cache-control': 'no-store',
  'x-robots-tag': 'noindex, nofollow, noarchive',
  /* same-origin, KHÔNG phải no-referrer: với no-referrer Chrome gửi "Origin: null"
     cho form POST, và kiểm tra CSRF (sameOrigin) chặn luôn chính trang quản trị.
     same-origin vẫn không để lộ đường dẫn nội bộ ra bất kỳ trang ngoài nào. */
  'referrer-policy': 'same-origin',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  /* Cửa sổ admin mở từ website (window.open) không được giữ tham chiếu để đọc nội dung. */
  'cross-origin-opener-policy': 'same-origin',
  'cross-origin-resource-policy': 'same-origin',
  'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
};

/** Người đang xem + ngữ cảnh menu (gắn ở adminHandler sau khi đăng nhập). */
export interface Viewer extends User {
  /** khoá mục menu đang mở, ví dụ "content/products", "orders", "chat-rules" */
  section?: string;
  badges?: { orders?: number; pending?: number; unanswered?: number };
}

// ----------------------------------------------------------------- nhãn tiếng Việt
export const STATUS_LABEL: Record<string, string> = { published: 'Đang hiện', draft: 'Bản nháp' };
export const AVAILABILITY_LABEL: Record<string, string> = { InStock: 'Còn hàng', OutOfStock: 'Hết hàng', PreOrder: 'Đặt trước', BackOrder: 'Chờ hàng về' };
export const statusPill = (s: unknown) => (s ? `<span class="pill ${s === 'published' ? 'published' : 'draft'}">${esc(STATUS_LABEL[String(s)] ?? s)}</span>` : '');

export const COLLECTION_LABEL: Record<string, string> = {
  products: 'Sản phẩm', lines: 'Dòng sản phẩm', documents: 'Giấy tờ', articles: 'Bài tư vấn', guides: 'Góc tư vấn',
  policies: 'Chính sách', pages: 'Trang chủ', brand: 'Thương hiệu',
};

// ----------------------------------------------------------------- menu
interface Item { key: string; href: string; label: string; badge?: number; admin?: boolean }
function groups(v: Viewer): { title: string; items: Item[] }[] {
  return [
    { title: '', items: [{ key: 'home', href: '/admin/', label: 'Tổng quan' }] },
    { title: 'Bán hàng', items: [{ key: 'orders', href: '/admin/orders', label: 'Đơn hàng', badge: v.badges?.orders }] },
    { title: 'Nội dung', items: [
      ...['products', 'lines', 'documents', 'articles', 'guides', 'policies', 'pages', 'brand']
        .map((c) => ({ key: `content/${c}`, href: `/admin/content/${c}`, label: COLLECTION_LABEL[c] })),
      { key: 'media', href: '/admin/media', label: 'Ảnh' },
    ] },
    { title: 'Website', items: [{ key: 'publish', href: '/admin/publish', label: 'Xuất bản', badge: v.badges?.pending }] },
    { title: 'Chat', items: [
      { key: 'chats', href: '/admin/chats', label: 'Hội thoại & số liệu', badge: v.badges?.unanswered },
      { key: 'chat-rules', href: '/admin/chat-rules', label: 'Kịch bản tư vấn' },
      { key: 'settings/chat', href: '/admin/settings/chat', label: 'Cấu hình chat', admin: true },
    ] },
    { title: 'Hệ thống', items: [{ key: 'users', href: '/admin/users', label: 'Tài khoản', admin: true }] },
  ].map((g) => ({ ...g, items: g.items.filter((i) => !i.admin || v.role === 'admin') })).filter((g) => g.items.length);
}
function navHtml(v: Viewer) {
  return groups(v).map((g) => `
    <div class="nav-group">${g.title ? `<div class="nav-title">${g.title}</div>` : ''}
      ${g.items.map((i) => `<a href="${i.href}"${v.section === i.key ? ' aria-current="page"' : ''}>${i.label}${i.badge ? `<span class="badge">${i.badge}</span>` : ''}</a>`).join('')}
    </div>`).join('');
}
const account = (v: Viewer) => `
  <form method="post" action="/admin/logout" class="who"><span>${esc(v.username)} · ${v.role === 'admin' ? 'quản trị' : 'biên tập'}</span><button class="link">Đăng xuất</button></form>`;

export function page(title: string, body: string, user: Viewer | null, status = 200, extra: Record<string, string> = {}, head = '') {
  const shell = user ? `
<div class="shell">
  <aside class="side">
    <a class="brand" href="/admin/">MOCHA <small>quản trị</small></a>
    <nav aria-label="Quản trị">${navHtml(user)}</nav>
    ${account(user)}
  </aside>
  <header class="mbar">
    <a class="brand" href="/admin/">MOCHA <small>quản trị</small></a>
    <details class="mnav"><summary>Menu${(user.badges?.orders ?? 0) + (user.badges?.pending ?? 0) ? '<span class="badge"></span>' : ''}</summary>
      <nav aria-label="Quản trị">${navHtml(user)}</nav>${account(user)}</details>
  </header>
  <main>${body}</main>
</div>` : `<main class="bare">${body}</main>`;
  return new Response(`<!doctype html><html lang="vi"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow"><link rel="icon" href="data:,">${head}
<title>${esc(title)} · Mocha quản trị</title><style>${CSS}</style></head>
<body>${shell}</body></html>`, { status, headers: { ...SECURITY_HEADERS, ...extra } });
}

export const redirect = (to: string, headers: Record<string, string> = {}) =>
  new Response(null, { status: 303, headers: { location: to, 'cache-control': 'no-store', ...headers } });

export const notice = (kind: 'ok' | 'err' | 'warn', html: string) => `<div class="note ${kind}" role="${kind === 'err' ? 'alert' : 'status'}">${html}</div>`;

/** Tiêu đề trang: đường quay lại (tuỳ chọn) + tên + nút hành động bên phải. */
export const pageHead = (title: string, opts: { back?: [string, string]; actions?: string; sub?: string } = {}) => `
  <div class="phead">
    <div>${opts.back ? `<a class="back" href="${opts.back[0]}">← ${esc(opts.back[1])}</a>` : ''}<h1>${title}</h1>${opts.sub ? `<p class="muted">${opts.sub}</p>` : ''}</div>
    ${opts.actions ? `<div class="row">${opts.actions}</div>` : ''}
  </div>`;

const CSS = `
:root{--ink:#15162e;--navy:#1a1d52;--cobalt:#2b34b8;--muted:#5d6076;--line:#d9dce5;--bone:#f1f2f6;--paper:#fbfbfd;--ok:#1f6b4d;--err:#a3261b;--warn:#6b4e00}
*{box-sizing:border-box}body{margin:0;font:15px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:var(--ink);background:var(--bone)}
a{color:var(--cobalt)}
.shell{display:grid;grid-template-columns:236px minmax(0,1fr);min-height:100vh}
.side{position:sticky;top:0;height:100vh;overflow-y:auto;background:var(--navy);color:#fff;padding:18px 12px;display:flex;flex-direction:column;gap:14px}
.brand{color:#fff;text-decoration:none;font-weight:800;letter-spacing:.08em;padding:0 10px}.brand small{font-weight:500;letter-spacing:0;color:#aeb2e6;margin-left:4px}
.nav-group{display:grid;gap:2px}.nav-title{font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:#8f94d6;padding:6px 10px 2px}
.nav-group a{display:flex;align-items:center;justify-content:space-between;gap:8px;color:#e4e6fb;text-decoration:none;font-size:14px;padding:7px 10px;border-radius:9px}
.nav-group a:hover{background:rgba(255,255,255,.08)}.nav-group a[aria-current=page]{background:#fff;color:var(--navy);font-weight:700}
.badge{display:inline-flex;min-width:20px;height:20px;padding:0 6px;border-radius:999px;background:#f2b84b;color:#2a1d00;font-size:12px;font-weight:700;align-items:center;justify-content:center}
.who{margin-top:auto;display:grid;gap:6px;padding:12px 10px 0;border-top:1px solid rgba(255,255,255,.14);font-size:13px;color:#c9ccf0}
button.link{background:none;border:0;padding:0;color:#fff;text-decoration:underline;font-weight:600;cursor:pointer;justify-content:flex-start}
.mbar{display:none}
main{padding:28px 32px 80px;max-width:1240px;width:100%}main.bare{margin:0 auto;max-width:440px;padding:72px 16px}
@media (max-width:960px){
  .shell{grid-template-columns:minmax(0,1fr)}.side{display:none}
  .mbar{display:flex;position:sticky;top:0;z-index:5;align-items:center;justify-content:space-between;background:var(--navy);padding:10px 16px}
  .mnav summary{list-style:none;cursor:pointer;color:#fff;font-weight:600;border:1px solid #6b70c9;border-radius:999px;padding:5px 14px;display:flex;gap:6px;align-items:center}
  .mnav summary::-webkit-details-marker{display:none}.mnav summary .badge{min-width:10px;height:10px;padding:0}
  .mnav[open]>nav,.mnav[open]>.who{position:fixed;left:0;right:0;background:var(--navy);padding:8px 16px}
  .mnav[open]>nav{top:52px;bottom:64px;overflow-y:auto;display:grid;gap:8px;align-content:start}
  .mnav[open]>.who{bottom:0;height:64px;margin:0}
  main{padding:18px 16px 60px}
  table{display:block;overflow-x:auto}table>tbody{display:table;width:100%}
  .hide-sm{display:none}
}
h1{font-size:26px;margin:4px 0 0;color:var(--navy);letter-spacing:-.02em;overflow-wrap:anywhere}h2{font-size:18px;margin:28px 0 10px;color:var(--navy)}
.phead{display:flex;flex-wrap:wrap;gap:12px 24px;align-items:flex-end;justify-content:space-between;margin:0 0 18px}.phead p{margin:6px 0 0}
.back{font-size:13px;text-decoration:none}.back:hover{text-decoration:underline}
table{width:100%;border-collapse:collapse;background:#fff;border-radius:12px;overflow:hidden;font-size:14px;border:1px solid var(--line)}
th,td{text-align:left;padding:9px 12px;border-bottom:1px solid var(--line);vertical-align:top}tr:last-child td{border-bottom:0}
th{background:var(--paper);font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);white-space:nowrap}
td.num,th.num{text-align:right;white-space:nowrap}td.nowrap{white-space:nowrap}
.card{background:#fff;border:1px solid var(--line);border-radius:14px;padding:16px;margin:0 0 14px}
.grid{display:grid;gap:12px;grid-template-columns:repeat(auto-fill,minmax(min(220px,100%),1fr))}
.stats{display:grid;gap:12px;grid-template-columns:repeat(auto-fill,minmax(min(180px,46%),1fr));margin:0 0 18px}
.stat{display:block;background:#fff;border:1px solid var(--line);border-radius:14px;padding:14px 16px;text-decoration:none;color:inherit}
a.stat:hover{border-color:var(--cobalt)}.stat b{display:block;font-size:28px;line-height:1.2;color:var(--navy)}.stat .muted{display:block}
.stat.alert{border-color:#f2b84b;background:#fffaf0}
label{display:grid;gap:4px;align-content:start;font-size:13px;font-weight:600;color:var(--navy)}
input,select,textarea{font:inherit;padding:8px 10px;border:1px solid #8b90a2;border-radius:10px;background:#fff;color:var(--ink);width:100%;min-width:0}
input:focus,select:focus,textarea:focus,button:focus-visible,a:focus-visible{outline:3px solid #9aa2ff;outline-offset:1px}
textarea.json{font:13px/1.5 ui-monospace,Consolas,monospace;min-height:520px;tab-size:2;white-space:pre}
button,.btn{display:inline-flex;align-items:center;gap:6px;background:var(--navy);color:#fff;border:0;border-radius:999px;padding:9px 18px;font:inherit;font-weight:600;cursor:pointer;text-decoration:none;white-space:nowrap}
button.ghost,.btn.ghost{background:#fff;color:var(--navy);border:1px solid var(--line)}button.danger,.btn.danger{background:var(--err)}
button.sm,.btn.sm{padding:5px 12px;font-size:13px}
.row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:12px 0}.phead .row,.thumbs .row{margin:0}
.chips{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 14px}.chips a{padding:5px 12px;border-radius:999px;border:1px solid var(--line);background:#fff;text-decoration:none;color:var(--navy);font-size:14px;font-weight:600}
.chips a[aria-current=page]{background:var(--navy);color:#fff;border-color:var(--navy)}.chips .n{color:var(--muted);font-weight:500;margin-left:4px}.chips a[aria-current=page] .n{color:#c9ccf0}
.note{padding:10px 14px;border-radius:12px;margin:0 0 14px;font-size:14px}.note.ok{background:#e6f3ec;color:var(--ok)}
.note.err{background:#fbe9e7;color:var(--err)}.note.warn{background:#fdf6e3;color:var(--warn)}
.note ul{margin:6px 0 0;padding-left:18px}.note code{background:rgba(0,0,0,.06);padding:1px 5px;border-radius:5px}
.pill{display:inline-block;padding:1px 9px;border-radius:999px;font-size:12px;font-weight:600;background:var(--bone);color:var(--navy);white-space:nowrap}
.pill.published{background:#e6f3ec;color:var(--ok)}.pill.draft{background:#fdf6e3;color:var(--warn)}.pill.bad{background:#fbe9e7;color:var(--err)}
.muted{color:var(--muted);font-size:13px}code{overflow-wrap:anywhere}
pre.log{background:#0c0e2e;color:#d6d9ff;padding:12px;border-radius:12px;overflow:auto;max-height:520px;font-size:12px;white-space:pre-wrap;overflow-wrap:anywhere}
.danger-zone{border-color:#efc2bc}.danger-zone h2{margin-top:0;color:var(--err);font-size:16px}
.thumbs{display:grid;gap:10px;grid-template-columns:repeat(auto-fill,minmax(160px,1fr))}
.thumbs figure{margin:0;background:#fff;border:1px solid var(--line);border-radius:12px;padding:8px;display:grid;gap:6px;align-content:start}
.thumbs img{width:100%;height:120px;object-fit:contain;background:var(--paper);border-radius:8px}
.thumbs figcaption{font-size:12px;display:grid;gap:4px}.thumbs figcaption form{margin:0}
.split{display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(min(340px,100%),1fr))}
.split>*{min-width:0;overflow-x:auto}.card table{border-radius:8px}
`;
