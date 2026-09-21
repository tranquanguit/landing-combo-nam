/**
 * /admin — bảng xem đơn cho nhân viên Mocha.
 *
 * Một trang HTML duy nhất, không framework, không build. Token nhập một lần và
 * giữ trong sessionStorage của tab — đóng tab là mất, không lưu vào máy.
 *
 * Trang này KHÔNG tự chứa dữ liệu: nó rỗng cho tới khi có token hợp lệ, nên
 * kể cả khi ai đó mở được URL cũng không thấy gì. Mọi dữ liệu đi qua
 * /api/admin/orders, nơi token được kiểm ở phía máy chủ.
 */
interface Env { ADMIN_TOKEN?: string }

const PAGE = `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow, noarchive">
<title>Đơn hàng · Mocha</title>
<style>
  :root { --ink:#15162e; --slate:#63677c; --line:#e3e4ea; --paper:#fbfbfd; --cobalt:#2b34b8; }
  * { box-sizing: border-box; }
  body { margin:0; padding:24px 16px; background:var(--paper); color:var(--ink);
         font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif; }
  .wrap { max-width:1180px; margin:0 auto; }
  h1 { font-size:22px; margin:0 0 4px; letter-spacing:-.02em; }
  .sub { color:var(--slate); margin:0 0 20px; font-size:13px; }
  .bar { display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin-bottom:16px; }
  input, select, button { font:inherit; padding:8px 12px; border:1px solid var(--line);
         border-radius:4px; background:#fff; color:inherit; min-height:40px; }
  button { cursor:pointer; }
  button.primary { background:var(--ink); color:#fff; border-color:var(--ink); font-weight:600; }
  .scroll { overflow-x:auto; }
  table { width:100%; border-collapse:collapse; font-size:13px; min-width:900px; }
  th, td { text-align:left; padding:10px 12px 10px 0; border-bottom:1px solid var(--line);
           vertical-align:top; }
  th { font-size:11px; letter-spacing:.14em; text-transform:uppercase; color:var(--slate); }
  .code { font-variant-numeric:tabular-nums; font-weight:600; white-space:nowrap; }
  .tag { display:inline-block; padding:2px 8px; border-radius:99px; font-size:11px;
         border:1px solid var(--line); white-space:nowrap; }
  .tag.new { border-color:var(--cobalt); color:var(--cobalt); font-weight:600; }
  .msg { padding:12px; border:1px solid var(--line); border-radius:4px; background:#fff; }
  .msg.bad { border-color:#b3261e; color:#7c1d16; }
  .muted { color:var(--slate); }
  form.gate { display:grid; gap:10px; max-width:380px; }
</style>
</head>
<body>
<div class="wrap">
  <h1>Đơn hàng</h1>
  <p class="sub">Dữ liệu cá nhân của khách. Không chụp màn hình, không gửi ra ngoài,
     không mở trên máy dùng chung.</p>

  <form class="gate" id="gate">
    <label for="tok">Mã truy cập</label>
    <input type="password" id="tok" autocomplete="current-password" required>
    <button class="primary" type="submit">Mở</button>
    <p class="msg bad" id="gate-err" hidden></p>
  </form>

  <div id="app" hidden>
    <div class="bar">
      <select id="status">
        <option value="">Tất cả trạng thái</option>
        <option value="new">Mới</option>
        <option value="contacted">Đã gọi</option>
        <option value="confirmed">Đã chốt</option>
        <option value="shipped">Đã gửi</option>
        <option value="done">Xong</option>
        <option value="cancelled">Huỷ</option>
      </select>
      <button id="reload">Tải lại</button>
      <button id="csv">Tải CSV</button>
      <button id="out">Thoát</button>
      <span class="muted" id="count"></span>
    </div>
    <div class="scroll"><table>
      <thead><tr>
        <th>Mã</th><th>Lúc</th><th>Khách</th><th>Điện thoại</th><th>Địa chỉ</th>
        <th>Gói</th><th>Nguồn</th><th>Trạng thái</th>
      </tr></thead>
      <tbody id="rows"></tbody>
    </table></div>
    <p class="msg" id="empty" hidden>Chưa có đơn nào.</p>
  </div>
</div>

<script>
const KEY = 'mocha_admin_token';
const $ = (id) => document.getElementById(id);
const token = () => sessionStorage.getItem(KEY) || '';

const api = (path, init = {}) => fetch('/api/admin/orders' + path, {
  ...init,
  headers: { authorization: 'Bearer ' + token(), ...(init.headers || {}) },
});

// textContent ở mọi chỗ: nội dung các ô do khách tự gõ, không bao giờ đi qua innerHTML.
function cell(text, cls) {
  const td = document.createElement('td');
  if (cls) td.className = cls;
  td.textContent = text == null || text === '' ? '—' : String(text);
  return td;
}

const STATUSES = ['new','contacted','confirmed','shipped','done','cancelled'];
const LABEL = { new:'Mới', contacted:'Đã gọi', confirmed:'Đã chốt',
                shipped:'Đã gửi', done:'Xong', cancelled:'Huỷ' };

async function load() {
  const q = $('status').value ? '?status=' + $('status').value + '&limit=200' : '?limit=200';
  const res = await api(q);
  if (res.status === 401) return logout('Mã truy cập không đúng.');
  const data = await res.json();
  const tbody = $('rows');
  tbody.replaceChildren();
  for (const o of data.orders) {
    const tr = document.createElement('tr');
    tr.append(
      cell(o.order_code, 'code'),
      cell(new Date(o.created_at).toLocaleString('vi-VN')),
      cell(o.name),
      cell(o.phone),
      cell(o.address),
      cell(o.pack + (o.pack_price ? ' · ' + Number(o.pack_price).toLocaleString('vi-VN') + 'đ' : '')),
      cell([o.utm_source, o.utm_campaign].filter(Boolean).join(' / ') || o.referrer_host),
    );
    const td = document.createElement('td');
    const sel = document.createElement('select');
    for (const s of STATUSES) {
      const opt = document.createElement('option');
      opt.value = s; opt.textContent = LABEL[s]; opt.selected = s === o.status;
      sel.append(opt);
    }
    sel.addEventListener('change', async () => {
      sel.disabled = true;
      const r = await api('', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ orderCode: o.order_code, status: sel.value }),
      });
      sel.disabled = false;
      if (!r.ok) { sel.value = o.status; alert('Không cập nhật được.'); }
      else o.status = sel.value;
    });
    td.append(sel);
    tr.append(td);
    tbody.append(tr);
  }
  $('count').textContent = data.count + ' đơn';
  $('empty').hidden = data.orders.length > 0;
}

function logout(message) {
  sessionStorage.removeItem(KEY);
  $('app').hidden = true;
  $('gate').hidden = false;
  if (message) { $('gate-err').textContent = message; $('gate-err').hidden = false; }
}

$('gate').addEventListener('submit', async (e) => {
  e.preventDefault();
  sessionStorage.setItem(KEY, $('tok').value);
  $('tok').value = '';
  const res = await api('?limit=1');
  if (!res.ok) return logout(res.status === 503
    ? 'Máy chủ chưa cấu hình ADMIN_TOKEN.' : 'Mã truy cập không đúng.');
  $('gate').hidden = true;
  $('gate-err').hidden = true;
  $('app').hidden = false;
  load();
});

$('reload').addEventListener('click', load);
$('status').addEventListener('change', load);
$('out').addEventListener('click', () => logout(''));

// Tải CSV phải đi qua fetch để gắn được token, rồi mới dựng liên kết tải về.
$('csv').addEventListener('click', async () => {
  const res = await api('?format=csv&limit=200');
  if (!res.ok) return logout('Phiên đã hết hạn.');
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = 'don-hang.csv';
  a.click();
  URL.revokeObjectURL(url);
});

if (token()) { $('gate').hidden = true; $('app').hidden = false; load(); }
</script>
</body>
</html>`;

export const onRequest: PagesFunction<Env> = async () =>
  new Response(PAGE, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'x-robots-tag': 'noindex, nofollow, noarchive',
      'referrer-policy': 'no-referrer',
      // Trang này nằm ngoài CSP trong public/_headers (đó là header cho tài sản
      // tĩnh), nên tự khai lấy. Không script ngoài, không khung nhúng.
      'content-security-policy':
        "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; "
        + "connect-src 'self'; img-src 'self' data:; form-action 'none'; "
        + "frame-ancestors 'none'; base-uri 'none'",
    },
  });
