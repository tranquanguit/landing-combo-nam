/**
 * /admin/store — Thông tin cửa hàng: MỘT chỗ khai tên, địa chỉ, mã số thuế, hotline, Zalo,
 * email, mạng xã hội, thông báo Bộ Công Thương, tổ chức công bố sản phẩm và số tiếp nhận
 * phiếu công bố của từng sản phẩm.
 *
 * Dữ liệu vẫn nằm trong collection `brand` (entry "mocha") và `products` — cùng bảng, cùng
 * schema, cùng lịch sử sửa với trình sửa chung. Trang này chỉ là một biểu mẫu có nhãn thay
 * cho ô JSON: người cập nhật số hotline không cần biết JSON là gì. Mọi trang trên website
 * lấy các giá trị này lúc build (mã {{phone}}, {{email}}… trong nội dung), nên lưu xong chỉ
 * cần Xuất bản.
 */
import type { AdminCtx } from './app.ts';
import { page, esc, notice, pageHead, type Viewer } from './html.ts';
import { validate, canonicalSource, type Issue } from '../lib/content.ts';

const BRAND_ID = 'mocha';
const SOCIAL = ['Facebook', 'Instagram', 'TikTok', 'YouTube'] as const;

type Row = { entry_id: string; data: any };

/** "0367 848 918" → "+84367848918". Số đã có mã quốc gia thì giữ nguyên. */
export function intlPhone(display: string): string {
  const d = display.replace(/[^\d+]/g, '');
  if (d.startsWith('+')) return d;
  if (d.startsWith('84')) return `+${d}`;
  if (d.startsWith('0')) return `+84${d.slice(1)}`;
  return d;
}

async function load(sql: AdminCtx['sql']) {
  const brandRow = (await sql.query<{ source: string }>(
    "SELECT source FROM content_entries WHERE collection = 'brand' AND entry_id = $1", [BRAND_ID])).rows[0];
  const products = (await sql.query<Row>(
    "SELECT entry_id, data FROM content_entries WHERE collection = 'products' ORDER BY entry_id")).rows;
  return { brand: brandRow ? JSON.parse(brandRow.source) : null, products };
}

/** Sản phẩm gom theo slug (vi + en là CÙNG một sản phẩm, cùng số công bố, cùng tổ chức công bố). */
function bySlug(products: Row[]) {
  const m = new Map<string, Row[]>();
  for (const r of products) {
    const slug = r.entry_id.split('/')[0];
    m.set(slug, [...(m.get(slug) ?? []), r]);
  }
  return [...m.entries()].map(([slug, rows]) => {
    const vi = rows.find((r) => r.entry_id.endsWith('/vi')) ?? rows[0];
    return { slug, rows, name: vi.data.shortName ?? vi.data.name ?? slug, status: vi.data.status, c: vi.data.compliance ?? {} };
  });
}

const field = (name: string, label: string, value: unknown, opts: { hint?: string; type?: string; required?: boolean; wide?: boolean } = {}) => `
  <label${opts.wide ? ' class="wide"' : ''}>${esc(label)}${opts.required ? ' *' : ''}
    <input name="${esc(name)}" type="${opts.type ?? 'text'}" value="${esc(value ?? '')}"${opts.required ? ' required' : ''}>
    ${opts.hint ? `<span class="muted">${opts.hint}</span>` : ''}
  </label>`;

function form(brand: any, products: Row[], state?: { issues?: Issue[]; msg?: string; form?: FormData }) {
  const b = brand ?? {};
  const prof = (n: string) => (b.profiles ?? []).find((p: any) => p.name.toLowerCase() === n.toLowerCase())?.url ?? '';
  const decl: any[] = b.declarants ?? [];
  const groups = bySlug(products);
  const used = (id: string) => groups.filter((g) => g.c.declarant === id).length;
  const issues = state?.issues ?? [];

  return `
    ${state?.msg ? notice('ok', esc(state.msg)) : ''}
    ${issues.length ? notice('err', `<b>Chưa lưu — ${issues.length} lỗi.</b><ul>${issues.slice(0, 40).map((i) =>
      `<li><code>${esc(i.path || '(gốc)')}</code> — ${esc(i.message)}</li>`).join('')}</ul>`) : ''}
    <form method="post" action="/admin/store" class="store">
      <div class="card">
        <h2>Cửa hàng</h2>
        <div class="grid">
          ${field('tradingName', 'Tên cửa hàng', b.tradingName, { required: true, hint: 'In ở chân trang, trang Liên hệ, tiêu đề trang và dữ liệu cho Google.' })}
          ${field('legalName', 'Tên pháp nhân', b.legalName, { hint: 'Để trống nếu là đại lý / hộ kinh doanh — trang chỉ in tên cửa hàng.' })}
          ${field('address', 'Địa chỉ', b.address, { required: true, wide: true })}
          ${field('taxId', 'Mã số thuế', b.taxId)}
          ${field('hours', 'Giờ làm việc', b.hours, { hint: 'Để trống = trực 24/7.' })}
        </div>
      </div>

      <div class="card">
        <h2>Liên lạc</h2>
        <div class="grid">
          ${field('phoneDisplay', 'Hotline (cách hiển thị)', b.phoneDisplay, { required: true, hint: 'Ví dụ 0367 848 918. Số gọi quốc tế (+84…) tự suy ra.' })}
          ${field('zalo', 'Zalo (đường dẫn)', b.zalo, { type: 'url', hint: 'Ví dụ https://zalo.me/0367848918' })}
          ${field('email', 'Email', b.email, { type: 'email', required: true })}
        </div>
      </div>

      <div class="card">
        <h2>Mạng xã hội</h2>
        <p class="muted">Chỉ điền trang do chính cửa hàng/hãng vận hành: Google xem các trang này là cùng một chủ với website. Để trống = không hiện.</p>
        <div class="grid">
          ${SOCIAL.map((n) => field(`social:${n}`, n, prof(n), { type: 'url' })).join('')}
        </div>
      </div>

      <div class="card">
        <h2>Thông báo với Bộ Công Thương</h2>
        <div class="grid">
          ${field('moitNoticeUrl', 'Đường dẫn xác nhận (online.gov.vn)', b.moitNoticeUrl, { type: 'url', wide: true,
            hint: 'Có thì chân trang mọi trang hiện dòng “Đã thông báo Bộ Công Thương” trỏ về đây.' })}
        </div>
      </div>

      <div class="card">
        <h2>Tổ chức công bố sản phẩm</h2>
        <p class="muted">Tổ chức chịu trách nhiệm đưa sản phẩm ra thị trường — in ở chân trang của từng sản phẩm, theo luật mỹ phẩm.
          “Thương hiệu” là tên in trên bao bì (Mocha, Hairborn), dùng cho dữ liệu gửi Google. Mỗi hãng/dòng một dòng. Tên pháp nhân để trống = chưa có thông tin: trang sản phẩm hiện cảnh báo “cần bổ sung”.</p>
        <table>
          <tr><th>Mã</th><th>Gọi tắt</th><th>Thương hiệu</th><th>Tên pháp nhân</th><th>Địa chỉ</th><th>Số SP</th></tr>
          ${[...decl, { id: '', label: '', brand: '', name: '', address: '' }].map((d, i) => `
          <tr>
            <td><input name="d:${i}:id" value="${esc(d.id)}" ${d.id ? 'readonly' : 'placeholder="vd: hairborn"'} pattern="[a-z0-9]+(-[a-z0-9]+)*" style="width:9em"></td>
            <td><input name="d:${i}:label" value="${esc(d.label)}" placeholder="${d.id ? '' : 'Thêm tổ chức mới'}"></td>
            <td><input name="d:${i}:brand" value="${esc(d.brand ?? '')}" placeholder="vd: Mocha" style="width:8em"></td>
            <td><input name="d:${i}:name" value="${esc(d.name)}"></td>
            <td><input name="d:${i}:address" value="${esc(d.address)}"></td>
            <td class="num">${d.id ? used(d.id) : ''}</td>
          </tr>`).join('')}
        </table>
      </div>

      <div class="card">
        <h2>Sản phẩm: tổ chức công bố và số công bố</h2>
        <p class="muted">Áp dụng cho cả bản tiếng Việt và tiếng Anh của sản phẩm. Để trống số công bố = trang hiện cảnh báo “cần bổ sung”.</p>
        <table>
          <tr><th>Sản phẩm</th><th>Tổ chức công bố</th><th>Số tiếp nhận phiếu công bố</th></tr>
          ${groups.map((g) => `
          <tr>
            <td><a href="/admin/edit?c=products&id=${encodeURIComponent(g.rows[0].entry_id)}">${esc(g.name)}</a> <span class="muted">${esc(g.slug)}</span></td>
            <td><select name="p:${esc(g.slug)}:declarant">${decl.map((d) =>
              `<option value="${esc(d.id)}" ${d.id === g.c.declarant ? 'selected' : ''}>${esc(d.label || d.id)}</option>`).join('')}
              ${g.c.declarant && !decl.some((d) => d.id === g.c.declarant) ? `<option value="${esc(g.c.declarant)}" selected>${esc(g.c.declarant)} (không có trong danh sách)</option>` : ''}</select></td>
            <td><input name="p:${esc(g.slug)}:number" value="${esc(g.c.productNotificationNumber ?? '')}" placeholder="vd: 1517/25/CBMP-LA"></td>
          </tr>`).join('')}
        </table>
      </div>

      <label>Ghi chú lần sửa <input name="note" placeholder="vd: đổi hotline mới" maxlength="200"></label>
      <div class="row">
        <button>Kiểm tra &amp; lưu</button>
        <span class="muted">Lưu chưa đổi trang thật — cần <a href="/admin/publish">Xuất bản</a>.</span>
      </div>
    </form>
    <style>
      .store .grid { display: grid; gap: 12px 20px; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); }
      .store .grid .wide { grid-column: 1 / -1; }
      .store label .muted { display: block; font-weight: 400; font-size: 12px; margin-top: 4px; }
      .store table input, .store table select { width: 100%; min-width: 0; }
      .store h2 { margin-top: 0; }
    </style>`;
}

export async function storePage({ sql }: AdminCtx, user: Viewer, state?: { issues?: Issue[]; msg?: string }) {
  const { brand, products } = await load(sql);
  const body = brand
    ? form(brand, products, state)
    : notice('err', 'Chưa có dữ liệu thương hiệu trong cơ sở dữ liệu. Chạy <code>cli import</code> trước.');
  return page('Thông tin cửa hàng', `
    ${pageHead('Thông tin cửa hàng', { sub: 'Tên, địa chỉ, mã số thuế, hotline, Zalo, email, mạng xã hội, tổ chức công bố và số công bố. Mọi trang trên website lấy thông tin từ đây.' })}
    ${body}`, user, state?.issues?.length ? 422 : 200);
}

export async function saveStore(ctx: AdminCtx, user: Viewer, request: Request) {
  const { sql, root } = ctx;
  const f = await request.formData();
  const s = (k: string) => String(f.get(k) ?? '').trim();
  const { brand, products } = await load(sql);
  if (!brand) return storePage(ctx, user, { issues: [{ path: '', message: 'Chưa có dữ liệu thương hiệu.' }] });

  /* ---- thương hiệu ---- */
  const b: any = { ...brand };
  const setOpt = (k: string, v: string) => { if (v) b[k] = v; else delete b[k]; };
  b.tradingName = s('tradingName');
  setOpt('legalName', s('legalName'));
  b.address = s('address');
  setOpt('taxId', s('taxId'));
  setOpt('hours', s('hours'));
  b.phoneDisplay = s('phoneDisplay');
  b.phone = intlPhone(b.phoneDisplay);
  setOpt('zalo', s('zalo'));
  b.email = s('email');
  setOpt('moitNoticeUrl', s('moitNoticeUrl'));
  /* Mạng xã hội: bốn kênh có ô riêng; kênh khác (nếu có trong JSON) giữ nguyên. */
  const others = (b.profiles ?? []).filter((p: any) => !SOCIAL.some((n) => n.toLowerCase() === p.name.toLowerCase()));
  b.profiles = [...SOCIAL.map((n) => ({ name: n, url: s(`social:${n}`) })).filter((p) => p.url), ...others];
  /* Tổ chức công bố */
  const decl: any[] = [];
  for (let i = 0; f.has(`d:${i}:id`); i++) {
    const d = { id: s(`d:${i}:id`), label: s(`d:${i}:label`), brand: s(`d:${i}:brand`), name: s(`d:${i}:name`), address: s(`d:${i}:address`) };
    if (!d.id && !d.label && !d.brand && !d.name && !d.address) continue;   // dòng trống để thêm mới
    decl.push({ ...d, label: d.label || d.id });
  }
  b.declarants = decl;

  const issues: Issue[] = (await validate(root, 'brand', b)).map((i) => ({ ...i, path: `Thông tin cửa hàng › ${i.path}` }));
  const ids = new Set(decl.map((d) => d.id));
  if (ids.size !== decl.length) issues.push({ path: 'Tổ chức công bố', message: 'Hai tổ chức trùng mã.' });

  /* ---- sản phẩm: tổ chức công bố + số công bố, cho mọi bản dịch ---- */
  const changed: Row[] = [];
  for (const g of bySlug(products)) {
    const dk = `p:${g.slug}:declarant`, nk = `p:${g.slug}:number`;
    if (!f.has(dk) && !f.has(nk)) continue;
    const declarant = s(dk), number = s(nk);
    if (declarant && !ids.has(declarant)) {
      issues.push({ path: g.slug, message: `Tổ chức công bố "${declarant}" không còn trong danh sách.` });
      continue;
    }
    for (const r of g.rows) {
      const c = { ...(r.data.compliance ?? {}) };
      const before = JSON.stringify(c);
      if (declarant) { c.declarant = declarant; delete c.declaringOrganization; delete c.declaringAddress; }
      if (number) c.productNotificationNumber = number; else delete c.productNotificationNumber;
      if (JSON.stringify(c) === before) continue;
      const data = { ...r.data, compliance: c };
      for (const i of await validate(root, 'products', data)) issues.push({ ...i, path: `${r.entry_id} › ${i.path}` });
      changed.push({ entry_id: r.entry_id, data });
    }
  }
  /* Tổ chức bị bỏ khỏi danh sách mà vẫn có sản phẩm trỏ tới (và form không đổi sản phẩm đó) */
  for (const g of bySlug(products)) {
    if (g.c.declarant && !ids.has(g.c.declarant) && !changed.some((x) => x.entry_id.startsWith(`${g.slug}/`))) {
      issues.push({ path: g.slug, message: `Vẫn dùng tổ chức công bố "${g.c.declarant}" — chọn tổ chức khác trước khi xoá.` });
    }
  }
  if (issues.length) return storePage(ctx, user, { issues });

  const note = s('note').slice(0, 200) || 'Thông tin cửa hàng';
  const write = async (collection: string, id: string, data: any) => {
    const source = canonicalSource(data);
    await sql.query(
      `INSERT INTO content_entries (collection, entry_id, data, source, updated_by) VALUES ($1, $2, $3::text::jsonb, $4, $5)
       ON CONFLICT (collection, entry_id) DO UPDATE SET data = EXCLUDED.data, source = EXCLUDED.source, updated_at = now(), updated_by = EXCLUDED.updated_by`,
      [collection, id, source, source, user.username]);
    await sql.query('INSERT INTO content_revisions (collection, entry_id, source, saved_by, note) VALUES ($1, $2, $3, $4, $5)',
      [collection, id, source, user.username, note]);
  };
  if (canonicalSource(b) !== canonicalSource(brand)) await write('brand', BRAND_ID, b);
  for (const r of changed) await write('products', r.entry_id, r.data);
  return storePage(ctx, user, { msg: `Đã lưu${changed.length ? ` (kèm ${changed.length} bản sản phẩm)` : ''}. Trang thật chỉ đổi sau khi Xuất bản.` });
}
