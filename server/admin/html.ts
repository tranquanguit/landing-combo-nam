/**
 * Khung HTML của trang quản trị. Render ở máy chủ, không JS: biểu mẫu thuần.
 * Cùng bảng màu với website (mực indigo, cobalt), bố cục làm việc — không phải
 * trang bán hàng.
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
  'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
};

export function page(title: string, body: string, user: User | null, status = 200, extra: Record<string, string> = {}) {
  const nav = user ? `
    <nav class="top">
      <a class="brand" href="/admin/">MOCHA · Nhập liệu</a>
      <a href="/admin/content/products">Sản phẩm</a>
      <a href="/admin/content/documents">Giấy tờ</a>
      <a href="/admin/content/lines">Dòng</a>
      <a href="/admin/content/articles">Bài viết</a>
      <a href="/admin/media">Ảnh</a>
      <a href="/admin/orders">Đơn hàng</a>
      <a href="/admin/chats">Chat</a>
      <a href="/admin/chat-rules">Kịch bản chat</a>
      <a href="/admin/publish">Xuất bản</a>
      ${user.role === 'admin' ? '<a href="/admin/settings/chat">Cấu hình chat</a><a href="/admin/users">Tài khoản</a>' : ''}
      <form method="post" action="/admin/logout" class="out"><span>${esc(user.username)}</span><button>Đăng xuất</button></form>
    </nav>` : '';
  return new Response(`<!doctype html><html lang="vi"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow"><link rel="icon" href="data:,">
<title>${esc(title)} · Mocha nhập liệu</title><style>${CSS}</style></head>
<body>${nav}<main>${body}</main></body></html>`, { status, headers: { ...SECURITY_HEADERS, ...extra } });
}

export const redirect = (to: string, headers: Record<string, string> = {}) =>
  new Response(null, { status: 303, headers: { location: to, 'cache-control': 'no-store', ...headers } });

export const notice = (kind: 'ok' | 'err' | 'warn', html: string) => `<div class="note ${kind}">${html}</div>`;

const CSS = `
:root{--ink:#15162e;--navy:#1a1d52;--cobalt:#2b34b8;--muted:#5d6076;--line:#d9dce5;--bone:#f1f2f6;--paper:#fbfbfd;--ok:#1f6b4d;--err:#a3261b;--warn:#6b4e00}
*{box-sizing:border-box}body{margin:0;font:15px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:var(--ink);background:var(--bone)}
main{max-width:1180px;margin:0 auto;padding:24px 16px 80px}
h1{font-size:26px;margin:8px 0 16px;color:var(--navy);letter-spacing:-.02em}h2{font-size:18px;margin:28px 0 10px;color:var(--navy)}
a{color:var(--cobalt)}.top{display:flex;flex-wrap:wrap;gap:4px 16px;align-items:center;padding:10px 16px;background:var(--navy)}
.top a{color:#fff;text-decoration:none;font-weight:600;font-size:14px}.top .brand{margin-right:12px}
.top .out{margin-left:auto;display:flex;gap:8px;align-items:center;color:#c9ccf0;font-size:13px}
.top .out button{background:transparent;color:#fff;border:1px solid #6b70c9;border-radius:999px;padding:4px 12px;cursor:pointer}
table{width:100%;border-collapse:collapse;background:#fff;border-radius:12px;overflow:hidden;font-size:14px}
th,td{text-align:left;padding:8px 10px;border-bottom:1px solid var(--line);vertical-align:top}th{background:var(--paper);font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}
.card{background:#fff;border:1px solid var(--line);border-radius:14px;padding:16px;margin:12px 0}
.grid{display:grid;gap:12px;grid-template-columns:repeat(auto-fill,minmax(220px,1fr))}
label{display:grid;gap:4px;align-content:start;font-size:13px;font-weight:600;color:var(--navy)}
input,select,textarea{font:inherit;padding:8px 10px;border:1px solid #8b90a2;border-radius:10px;background:#fff;color:var(--ink);width:100%}
textarea.json{font:13px/1.5 ui-monospace,Consolas,monospace;min-height:520px;tab-size:2;white-space:pre}
button,.btn{display:inline-flex;align-items:center;gap:6px;background:var(--navy);color:#fff;border:0;border-radius:999px;padding:9px 18px;font:inherit;font-weight:600;cursor:pointer;text-decoration:none}
button.ghost,.btn.ghost{background:#fff;color:var(--navy);border:1px solid var(--line)}button.danger{background:var(--err)}
.row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:12px 0}
.note{padding:10px 14px;border-radius:12px;margin:12px 0;font-size:14px}.note.ok{background:#e6f3ec;color:var(--ok)}
.note.err{background:#fbe9e7;color:var(--err)}.note.warn{background:#fdf6e3;color:var(--warn)}
.note ul{margin:6px 0 0;padding-left:18px}.note code{background:rgba(0,0,0,.06);padding:1px 5px;border-radius:5px}
.pill{display:inline-block;padding:1px 9px;border-radius:999px;font-size:12px;font-weight:600;background:var(--bone);color:var(--navy)}
.pill.published{background:#e6f3ec;color:var(--ok)}.pill.draft{background:#fdf6e3;color:var(--warn)}
.muted{color:var(--muted);font-size:13px}pre.log{background:#0c0e2e;color:#d6d9ff;padding:12px;border-radius:12px;overflow:auto;max-height:480px;font-size:12px}
.thumbs{display:grid;gap:10px;grid-template-columns:repeat(auto-fill,minmax(150px,1fr))}.thumbs figure{margin:0;background:#fff;border:1px solid var(--line);border-radius:12px;padding:8px}
.thumbs img{width:100%;height:120px;object-fit:contain}
@media (max-width:720px){table{display:block;overflow-x:auto}main{padding:16px 16px 60px}}.thumbs figcaption{font-size:12px;word-break:break-all}
`;
