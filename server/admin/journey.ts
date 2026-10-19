/**
 * /admin/journey — hành trình của khách trên website (chỉ khách đã đồng ý đo lường).
 *
 *   /admin/journey?days=7[&order=1]   tổng quan: chỉ số, phễu, trang, khối được đọc lâu,
 *                                     nút bấm, câu hỏi được mở, nguồn, thiết bị, danh sách phiên
 *   /admin/journey/session?id=…       dòng thời gian của một phiên, từng giây
 *
 * Mọi con số đếm trên những khách ĐÃ bấm "Đồng ý" — không phải toàn bộ lượt truy cập. Trang
 * nói rõ điều đó ngay dưới tiêu đề, để không ai đọc nó như số liệu tổng.
 */
import type { AdminCtx } from './app.ts';
import { page, esc, notice, pageHead, type Viewer } from './html.ts';

const PERIODS = [1, 7, 30, 90];
const vnTime = (d: unknown, withDate = true) => (d ? new Date(String(d)).toLocaleString('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', second: '2-digit',
  ...(withDate ? { day: '2-digit', month: '2-digit' } : {}),
}) : '—');
/** 754000 -> "12 phút 34 giây"; 8000 -> "8 giây". */
export function dur(ms: unknown): string {
  const s = Math.round(Number(ms ?? 0) / 1000);
  if (!s) return '—';
  if (s < 60) return `${s} giây`;
  const m = Math.floor(s / 60), r = s % 60;
  if (m < 60) return r ? `${m} phút ${r} giây` : `${m} phút`;
  return `${Math.floor(m / 60)} giờ ${m % 60} phút`;
}
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 1000) / 10}%` : '—');
const num = (n: unknown) => Number(n ?? 0).toLocaleString('vi-VN');
const bar = (v: number, max: number) => `<span class="jbar"><i style="width:${max ? Math.max(2, Math.round((v / max) * 100)) : 0}%"></i></span>`;
const SOURCE = `COALESCE(NULLIF(s.utm_source, ''), CASE s.ad_click WHEN 'google' THEN 'Google Ads' WHEN 'facebook' THEN 'Facebook Ads' WHEN 'tiktok' THEN 'TikTok Ads' END, s.referrer_host, '(vào thẳng)')`;

/** Sự kiện của các lời mời (src/components/PromoPopup, ChatWidget, ExitLead, RecentOrders). */
const POPUP_LABEL: Record<string, string> = {
  'promo:show': 'Thấy popup khuyến mãi', 'promo:order': '<b>Bấm “Đặt hàng” trên popup khuyến mãi</b>', 'promo:close': 'Đóng popup khuyến mãi',
  'chat:show': 'Thấy lời mời chat', 'chat:ask': '<b>Bấm câu hỏi gợi ý trong lời mời chat</b>', 'chat:close': 'Đóng lời mời chat',
  'exit:show': 'Sắp rời trang — thấy biểu mẫu để lại số', 'exit:submit': '<b>Để lại số điện thoại</b>', 'exit:close': 'Đóng biểu mẫu để lại số',
  'recent:show': 'Thấy thông báo đơn gần đây', 'recent:close': 'Tắt thông báo đơn gần đây',
};
const POPUP_ROWS: [string, string, [string, string][]][] = [
  ['promo', 'Popup khuyến mãi', [['show', 'Hiện'], ['order', 'Bấm đặt hàng'], ['close', 'Đóng']]],
  ['chat', 'Lời mời chat', [['show', 'Hiện'], ['ask', 'Bấm câu hỏi'], ['close', 'Đóng']]],
  ['exit', 'Giữ chân khách sắp rời', [['show', 'Hiện'], ['submit', 'Để lại số'], ['close', 'Đóng']]],
  ['recent', 'Thông báo đơn gần đây', [['show', 'Hiện'], ['close', 'Tắt']]],
];

/** Nhãn dễ đọc cho một sự kiện trong dòng thời gian. */
function describe(e: any): string {
  const label = e.label ? `“${esc(e.label)}”` : '';
  const target = e.target ? `<code>${esc(e.target)}</code>` : '';
  switch (e.type) {
    case 'page': return `Mở trang <b>${esc(e.path)}</b>`;
    case 'leave': return `Rời trang <b>${esc(e.path)}</b> sau <b>${dur(e.duration_ms)}</b> xem thật`;
    case 'section': return `Đọc khối ${label || target} trong <b>${dur(e.duration_ms)}</b>`;
    case 'click': {
      const [kind, id] = String(e.target ?? '').split(':');
      const verb = kind === 'order' ? 'Bấm nút đặt hàng' : kind === 'contact' ? 'Bấm gọi / Zalo' : kind === 'select' ? 'Chọn' : 'Bấm';
      return `${verb} ${label} <span class="muted">${esc(id ?? '')}</span>`;
    }
    case 'faq': return `Mở câu hỏi ${label}`;
    case 'form_start': return '<b>Bắt đầu điền biểu mẫu đặt hàng</b>';
    case 'order': return `<b>Gửi đơn</b> ${label}`;
    case 'thanks': return '<b>Tới trang cảm ơn</b>';
    case 'chat': return `Chat ${label}`;
    case 'popup': return `${POPUP_LABEL[e.target] ?? `Lời mời <code>${esc(e.target)}</code>`}${label ? ` ${label}` : ''}`;
    default: return esc(e.type);
  }
}

export async function journeyPage({ sql }: AdminCtx, user: Viewer, url: URL) {
  const days = PERIODS.includes(Number(url.searchParams.get('days'))) ? Number(url.searchParams.get('days')) : 7;
  const onlyOrders = url.searchParams.get('order') === '1';
  const since = `now() - interval '${days} days'`;
  const q = <T = any>(text: string, params: unknown[] = []) => sql.query<T>(text, params).then((r) => r.rows);

  const [k] = await q(`SELECT count(*)::int AS sessions, count(DISTINCT visitor_id)::int AS visitors,
      count(*) FILTER (WHERE is_returning)::int AS returning_n, count(order_code)::int AS orders,
      COALESCE(avg(active_ms), 0)::float AS avg_active, COALESCE(avg(page_views), 0)::float AS avg_pages,
      count(*) FILTER (WHERE page_views <= 1 AND active_ms < 10000)::int AS bounced
    FROM journey_sessions WHERE started_at > ${since}`);

  /* Phễu: số PHIÊN đã đi tới từng bước (không phải số sự kiện). */
  const productPaths = (await q<{ slug: string }>(
    "SELECT DISTINCT data->>'slug' AS slug FROM content_entries WHERE collection = 'products'")).map((r) => r.slug);
  const isProductPage = `(e.path LIKE '/combo/%' OR e.path LIKE '/en/combos/%' OR e.path = ANY($1))`;
  const prodPaths = productPaths.flatMap((s) => [`/${s}/`, `/en/${s}/`]);
  const [f] = await q(`SELECT
      count(DISTINCT e.session_id) FILTER (WHERE e.type = 'page' AND ${isProductPage})::int AS product,
      count(DISTINCT e.session_id) FILTER (WHERE e.type = 'click' AND e.target LIKE 'order:%')::int AS cta,
      count(DISTINCT e.session_id) FILTER (WHERE e.type = 'form_start')::int AS form,
      count(DISTINCT e.session_id) FILTER (WHERE e.type = 'order')::int AS ordered,
      count(DISTINCT e.session_id) FILTER (WHERE e.type = 'thanks')::int AS thanks
    FROM journey_events e JOIN journey_sessions s USING (session_id) WHERE s.started_at > ${since}`, [prodPaths]);

  /* Một lượt xem có thể có NHIỀU sự kiện 'leave' (khách chuyển tab rồi quay lại — mỗi lần
     ẩn tab gửi phần thời gian vừa xem), nên thời gian TB = tổng thời gian xem / số lượt xem.
     "Rời site tại đây" = trang MỞ CUỐI CÙNG của phiên. */
  const pages = await q(`WITH ev AS (
      SELECT e.* FROM journey_events e JOIN journey_sessions s USING (session_id)
      WHERE s.started_at > ${since} AND e.type IN ('page', 'leave')),
    lastp AS (SELECT DISTINCT ON (session_id) session_id, path FROM ev WHERE type = 'page' ORDER BY session_id, at DESC, id DESC),
    exits AS (SELECT path, count(*)::int AS n FROM lastp GROUP BY path)
    SELECT ev.path,
      count(*) FILTER (WHERE type = 'page')::int AS views,
      count(DISTINCT session_id) FILTER (WHERE type = 'page')::int AS sessions,
      (COALESCE(sum(duration_ms) FILTER (WHERE type = 'leave'), 0) / NULLIF(count(*) FILTER (WHERE type = 'page'), 0))::float AS avg_ms,
      COALESCE(max(exits.n), 0)::int AS exits
    FROM ev LEFT JOIN exits USING (path) GROUP BY ev.path ORDER BY views DESC LIMIT 25`);

  const sections = await q(`SELECT e.path, e.target, max(e.label) AS label, count(DISTINCT e.session_id)::int AS sessions,
      sum(e.duration_ms)::bigint AS total_ms, (sum(e.duration_ms) / count(DISTINCT e.session_id))::float AS avg_ms
    FROM journey_events e JOIN journey_sessions s USING (session_id)
    WHERE s.started_at > ${since} AND e.type = 'section'
    GROUP BY e.path, e.target ORDER BY total_ms DESC LIMIT 25`);

  const clicks = await q(`SELECT e.target, max(e.label) AS label, count(*)::int AS n, count(DISTINCT e.session_id)::int AS sessions
    FROM journey_events e JOIN journey_sessions s USING (session_id)
    WHERE s.started_at > ${since} AND e.type = 'click' GROUP BY e.target ORDER BY n DESC LIMIT 20`);

  const faqs = await q(`SELECT e.label, count(DISTINCT e.session_id)::int AS sessions
    FROM journey_events e JOIN journey_sessions s USING (session_id)
    WHERE s.started_at > ${since} AND e.type = 'faq' AND e.label IS NOT NULL GROUP BY e.label ORDER BY sessions DESC LIMIT 15`);

  const popups = new Map((await q<{ target: string; sessions: number }>(`SELECT e.target, count(DISTINCT e.session_id)::int AS sessions
    FROM journey_events e JOIN journey_sessions s USING (session_id)
    WHERE s.started_at > ${since} AND e.type = 'popup' GROUP BY e.target`)).map((r) => [r.target, r.sessions]));

  const sources = await q(`SELECT ${SOURCE} AS source, count(*)::int AS sessions, count(s.order_code)::int AS orders,
      COALESCE(avg(s.active_ms), 0)::float AS avg_ms
    FROM journey_sessions s WHERE s.started_at > ${since} GROUP BY 1 ORDER BY sessions DESC LIMIT 15`);

  const devices = await q(`SELECT COALESCE(device, '?') AS device, count(*)::int AS sessions, count(order_code)::int AS orders
    FROM journey_sessions WHERE started_at > ${since} GROUP BY 1 ORDER BY sessions DESC`);

  const recent = await q(`SELECT s.*, ${SOURCE} AS source FROM journey_sessions s
    WHERE s.started_at > ${since} ${onlyOrders ? 'AND s.order_code IS NOT NULL' : ''}
    ORDER BY s.started_at DESC LIMIT 60`);

  const tabs = PERIODS.map((d) => `<a class="btn ${d === days ? '' : 'ghost'} sm" href="/admin/journey?days=${d}${onlyOrders ? '&order=1' : ''}">${d === 1 ? '24 giờ' : `${d} ngày`}</a>`).join(' ');
  const maxSec = Math.max(0, ...sections.map((x: any) => Number(x.total_ms)));
  const maxPage = Math.max(0, ...pages.map((x: any) => x.views));
  const steps: [string, number][] = [
    ['Phiên có truy cập', k.sessions], ['Xem trang sản phẩm / combo', f.product], ['Bấm nút đặt hàng', f.cta],
    ['Bắt đầu điền biểu mẫu', f.form], ['Gửi đơn', f.ordered], ['Tới trang cảm ơn', f.thanks],
  ];

  return page('Hành trình khách', `
    ${pageHead('Hành trình khách', {
      sub: 'Khách vào trang nào, đọc khối nào lâu, bấm gì, đến từ đâu. <b>Chỉ gồm khách đã bấm “Đồng ý” ở thanh đo lường</b> — không phải toàn bộ lượt truy cập. Dữ liệu tự xoá sau 90 ngày.',
      actions: tabs })}

    <div class="card kpis">
      <div><b>${num(k.sessions)}</b><span>phiên</span></div>
      <div><b>${num(k.visitors)}</b><span>khách (${pct(k.returning_n, k.sessions)} phiên của khách quay lại)</span></div>
      <div><b>${num(k.orders)}</b><span>phiên có đặt đơn · ${pct(k.orders, k.sessions)}</span></div>
      <div><b>${dur(k.avg_active)}</b><span>xem thật trung bình / phiên</span></div>
      <div><b>${(Math.round(k.avg_pages * 10) / 10).toLocaleString('vi-VN')}</b><span>trang / phiên</span></div>
      <div><b>${pct(k.bounced, k.sessions)}</b><span>rời ngay (1 trang, dưới 10 giây)</span></div>
    </div>

    <div class="card"><h2>Phễu đặt hàng</h2>
      <table class="funnel">${steps.map(([l, n], i) => `<tr><td>${i + 1}. ${l}</td><td class="num"><b>${num(n)}</b></td>
        <td>${bar(n, k.sessions)}</td><td class="num muted">${i ? pct(n, steps[i - 1][1]) + ' từ bước trước' : ''}</td></tr>`).join('')}</table>
    </div>

    <div class="cols">
      <div class="card"><h2>Khối nội dung được đọc lâu nhất</h2>
        <p class="muted">Thời gian khối nằm trong màn hình (từ một nửa khối trở lên) khi khách đang mở tab.</p>
        <table><tr><th>Trang · khối</th><th class="num">Tổng</th><th class="num">TB / phiên</th><th class="num">Phiên</th></tr>
        ${sections.map((x: any) => `<tr><td><span class="muted">${esc(x.path)}</span><br>${esc(x.label ?? x.target)} ${bar(Number(x.total_ms), maxSec)}</td>
          <td class="num">${dur(x.total_ms)}</td><td class="num">${dur(x.avg_ms)}</td><td class="num">${num(x.sessions)}</td></tr>`).join('')
          || '<tr><td colspan="4" class="muted">Chưa có dữ liệu.</td></tr>'}</table>
      </div>
      <div class="card"><h2>Trang</h2>
        <table><tr><th>Trang</th><th class="num">Lượt xem</th><th class="num">Xem thật TB</th><th class="num">Rời site tại đây</th></tr>
        ${pages.map((x: any) => `<tr><td>${esc(x.path)} ${bar(x.views, maxPage)}</td><td class="num">${num(x.views)}</td>
          <td class="num">${dur(x.avg_ms)}</td><td class="num">${pct(x.exits, x.sessions)}</td></tr>`).join('')
          || '<tr><td colspan="4" class="muted">Chưa có dữ liệu.</td></tr>'}</table>
      </div>
    </div>

    <div class="cols">
      <div class="card"><h2>Nút được bấm</h2>
        <table><tr><th>Nút</th><th class="num">Lượt</th><th class="num">Phiên</th></tr>
        ${clicks.map((x: any) => `<tr><td>${esc(x.label ?? '')} <span class="muted">${esc(x.target)}</span></td><td class="num">${num(x.n)}</td><td class="num">${num(x.sessions)}</td></tr>`).join('')
          || '<tr><td colspan="3" class="muted">Chưa có dữ liệu.</td></tr>'}</table>
      </div>
      <div class="card"><h2>Câu hỏi được mở</h2>
        <table><tr><th>Câu hỏi</th><th class="num">Phiên</th></tr>
        ${faqs.map((x: any) => `<tr><td>${esc(x.label)}</td><td class="num">${num(x.sessions)}</td></tr>`).join('')
          || '<tr><td colspan="2" class="muted">Chưa có dữ liệu.</td></tr>'}</table>
      </div>
    </div>

    <div class="card"><h2>Popup &amp; lời mời</h2>
      <p class="muted">Số phiên đã thấy / đã bấm từng lời mời. Bật tắt ở <a href="/admin/store">Thông tin cửa hàng → Tương tác trên website</a>.</p>
      <table><tr><th>Lời mời</th><th>Kết quả</th></tr>
      ${POPUP_ROWS.map(([k, name, cols]) => {
        const shown = popups.get(`${k}:show`) ?? 0;
        return `<tr><td>${name}</td><td>${cols.map(([c, l]) => `${l}: <b>${num(popups.get(`${k}:${c}`) ?? 0)}</b>${c !== 'show' && shown ? ` <span class="muted">(${pct(popups.get(`${k}:${c}`) ?? 0, shown)})</span>` : ''}`).join(' · ')}</td></tr>`;
      }).join('')}</table>
    </div>

    <div class="cols">
      <div class="card"><h2>Nguồn</h2>
        <table><tr><th>Nguồn</th><th class="num">Phiên</th><th class="num">Đặt đơn</th><th class="num">Xem thật TB</th></tr>
        ${sources.map((x: any) => `<tr><td>${esc(x.source)}</td><td class="num">${num(x.sessions)}</td><td class="num">${num(x.orders)} · ${pct(x.orders, x.sessions)}</td><td class="num">${dur(x.avg_ms)}</td></tr>`).join('')
          || '<tr><td colspan="4" class="muted">Chưa có dữ liệu.</td></tr>'}</table>
      </div>
      <div class="card"><h2>Thiết bị</h2>
        <table><tr><th>Thiết bị</th><th class="num">Phiên</th><th class="num">Đặt đơn</th></tr>
        ${devices.map((x: any) => `<tr><td>${({ mobile: 'Điện thoại', tablet: 'Máy tính bảng', desktop: 'Máy tính' } as Record<string, string>)[x.device] ?? esc(x.device)}</td>
          <td class="num">${num(x.sessions)}</td><td class="num">${num(x.orders)} · ${pct(x.orders, x.sessions)}</td></tr>`).join('')
          || '<tr><td colspan="3" class="muted">Chưa có dữ liệu.</td></tr>'}</table>
      </div>
    </div>

    <div class="card"><h2>Phiên gần đây</h2>
      <p><a class="btn ${onlyOrders ? '' : 'ghost'} sm" href="/admin/journey?days=${days}${onlyOrders ? '' : '&order=1'}">${onlyOrders ? '✓ ' : ''}Chỉ phiên có đặt đơn</a></p>
      <table><tr><th>Bắt đầu</th><th>Vào từ</th><th>Trang đầu</th><th class="num">Trang</th><th class="num">Xem thật</th><th>Đơn</th><th></th></tr>
      ${recent.map((s: any) => `<tr>
        <td class="nowrap">${vnTime(s.started_at)}${s.is_returning ? ' <span class="pill">quay lại</span>' : ''}</td>
        <td>${esc(s.source)}${s.utm_campaign ? `<br><span class="muted">${esc(s.utm_campaign)}</span>` : ''}</td>
        <td>${esc(s.landing_path ?? '')}<br><span class="muted">${({ mobile: 'điện thoại', tablet: 'máy tính bảng', desktop: 'máy tính' } as Record<string, string>)[s.device] ?? ''}</span></td>
        <td class="num">${num(s.page_views)}</td><td class="num">${dur(s.active_ms)}</td>
        <td>${s.order_code ? `<a href="/admin/orders?q=${encodeURIComponent(s.order_code)}"><b>${esc(s.order_code)}</b></a>` : ''}</td>
        <td><a class="btn ghost sm" href="/admin/journey/session?id=${encodeURIComponent(s.session_id)}">Xem</a></td></tr>`).join('')
        || '<tr><td colspan="7" class="muted">Chưa có phiên nào trong khoảng này.</td></tr>'}</table>
    </div>
    ${STYLE}`, user);
}

export async function journeySessionPage({ sql }: AdminCtx, user: Viewer, url: URL) {
  const id = url.searchParams.get('id') ?? '';
  const s = (await sql.query<any>(`SELECT s.*, ${SOURCE} AS source FROM journey_sessions s WHERE session_id = $1`, [id])).rows[0];
  if (!s) return page('Không có', pageHead('Không có phiên này', { back: ['/admin/journey', 'Hành trình khách'] }) + notice('err', 'Có thể đã quá 90 ngày và bị xoá.'), user, 404);
  const events = (await sql.query<any>('SELECT * FROM journey_events WHERE session_id = $1 ORDER BY at, id', [id])).rows;
  const others = (await sql.query<any>(
    'SELECT session_id, started_at, page_views, active_ms, order_code FROM journey_sessions WHERE visitor_id = $1 AND session_id <> $2 ORDER BY started_at DESC LIMIT 20',
    [s.visitor_id, id])).rows;
  const t0 = new Date(s.started_at).getTime();
  const rel = (at: unknown) => {
    const sec = Math.max(0, Math.round((new Date(String(at)).getTime() - t0) / 1000));
    return `+${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  };
  return page('Phiên truy cập', `
    ${pageHead(`Phiên ${vnTime(s.started_at)}`, { back: ['/admin/journey', 'Hành trình khách'],
      sub: `${esc(s.source)}${s.utm_campaign ? ` · chiến dịch ${esc(s.utm_campaign)}` : ''} · ${esc(({ mobile: 'điện thoại', tablet: 'máy tính bảng', desktop: 'máy tính' } as Record<string, string>)[s.device] ?? '')} · ${num(s.page_views)} trang · xem thật ${dur(s.active_ms)}${
        s.order_code ? ` · đơn <a href="/admin/orders?q=${encodeURIComponent(s.order_code)}"><b>${esc(s.order_code)}</b></a>` : ''}` })}
    <div class="card"><table class="timeline"><tr><th>Giờ</th><th>Sau</th><th>Hành động</th></tr>
      ${events.map((e: any) => `<tr class="t-${esc(e.type)}"><td class="nowrap">${vnTime(e.at, false)}</td><td class="nowrap muted">${rel(e.at)}</td><td>${describe(e)}</td></tr>`).join('')}
    </table></div>
    ${others.length ? `<div class="card"><h2>Các lần ghé khác của khách này</h2><table>
      ${others.map((o: any) => `<tr><td class="nowrap">${vnTime(o.started_at)}</td><td class="num">${num(o.page_views)} trang</td><td class="num">${dur(o.active_ms)}</td>
        <td>${o.order_code ? esc(o.order_code) : ''}</td><td><a class="btn ghost sm" href="/admin/journey/session?id=${encodeURIComponent(o.session_id)}">Xem</a></td></tr>`).join('')}
    </table></div>` : ''}
    ${STYLE}`, user);
}

/** Phiên hành trình gắn với một đơn (để trang Đơn hàng đặt link "Xem hành trình"). */
export async function journeyByOrders(sql: AdminCtx['sql'], codes: string[]): Promise<Map<string, string>> {
  if (!codes.length) return new Map();
  const rows = (await sql.query<{ order_code: string; session_id: string }>(
    'SELECT order_code, session_id FROM journey_sessions WHERE order_code = ANY($1)', [codes])).rows;
  return new Map(rows.map((r) => [r.order_code, r.session_id]));
}

const STYLE = `<style>
  .kpis { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 14px; }
  .kpis div { display: grid; gap: 2px; } .kpis b { font-size: 24px; } .kpis span { font-size: 13px; color: #5d6076; }
  .cols { display: grid; gap: 16px; } @media (min-width: 1100px) { .cols { grid-template-columns: 1fr 1fr; } }
  .jbar { display: inline-block; vertical-align: middle; width: 120px; max-width: 40%; height: 6px; border-radius: 3px; background: #eceef5; margin-left: 6px; }
  .jbar i { display: block; height: 100%; border-radius: 3px; background: #2b34b8; }
  .funnel td:first-child { width: 40%; } .funnel .jbar { width: 100%; max-width: none; margin: 0; }
  .timeline .t-page td:last-child, .timeline .t-order td:last-child, .timeline .t-thanks td:last-child { background: #f3f4fd; }
  .num { text-align: right; white-space: nowrap; }
</style>`;
