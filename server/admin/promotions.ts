/**
 * /admin/promotions — lịch các đợt khuyến mãi.
 *
 * Mỗi đợt là một nội dung trong collection `promotions` (sửa ở trình sửa chung, cùng
 * schema với lúc build). Trang này chỉ đọc: cho thấy đợt nào sắp chạy / đang chạy / đã
 * kết thúc, giá từng gói so với mua lẻ (tự tính từ giá đang bán), cảnh báo cần người
 * quyết, và lúc nào máy chủ sẽ tự xuất bản lại.
 */
import type { AdminCtx } from './app.ts';
import { page, esc, notice, pageHead, type Viewer } from './html.ts';
import { loadPromos, priceBook, storedSignature, nextChange } from '../lib/promo-server.ts';
import { phase, viewPack, promoWarnings, liveSignature, vnDateTime, type PackView } from '../../src/lib/promotions.ts';

const PHASE: Record<string, [string, string]> = {
  live: ['Đang chạy', 'published'], upcoming: ['Sắp chạy', ''], ended: ['Đã kết thúc', 'draft'], draft: ['Bản nháp', 'draft'],
};
const vnd = (n: number) => `${n.toLocaleString('vi-VN')}đ`;

export async function promotionsPage({ sql }: AdminCtx, user: Viewer) {
  const now = new Date();
  const promos = await loadPromos(sql);
  const prices = await priceBook(sql, 'vi');
  const order = { live: 0, upcoming: 1, draft: 2, ended: 3 } as Record<string, number>;
  const rows = promos.map((e) => ({ e, ph: phase(e.data, now) }))
    .sort((a, b) => order[a.ph] - order[b.ph] || Date.parse(a.e.data.startsAt) - Date.parse(b.e.data.startsAt));
  const next = await nextChange(sql, now);
  const sig = liveSignature(promos, now);
  const stored = await storedSignature(sql);
  const latest = rows.map((r) => r.e).sort((a, b) => Date.parse(b.data.startsAt) - Date.parse(a.data.startsAt))[0];

  const packRow = (v: PackView | { error: string; label: string }) => 'error' in v
    ? `<tr><td colspan="5">${esc(v.label)}<br><span class="pill bad">${esc(v.error)}</span></td></tr>`
    : `<tr><td><b>${esc(v.label)}</b><br><span class="muted">${v.items.map((it) => `${it.qty}× ${esc(it.name)}`).join(' + ')}${
        v.gifts.length ? ` · tặng ${v.gifts.map((g) => `${g.qty} ${esc(g.name)}`).join(', ')}` : ''}</span></td>
      <td class="num"><b>${vnd(v.price)}</b></td><td class="num muted">${vnd(v.regular)}</td>
      <td class="num">${v.save > 0 ? `−${v.savePct}%` : '—'}</td><td class="num muted">${v.giftValue ? vnd(v.giftValue) : '—'}</td></tr>`;

  return page('Khuyến mãi', `
    ${pageHead('Khuyến mãi', {
      sub: 'Mỗi đợt một nội dung: giờ bắt đầu, giờ kết thúc, các gói. Trang sản phẩm tự hiện gói đang chạy và tự gỡ khi hết giờ — không sửa trang sản phẩm.',
      actions: `${latest ? `<a class="btn ghost" href="/admin/edit?c=promotions&new=1&from=${encodeURIComponent(latest.id)}">Nhân bản đợt gần nhất</a>` : ''}
        <a class="btn" href="/admin/edit?c=promotions&new=1">+ Đợt mới</a>` })}
    <div class="card">
      <b>Tự xuất bản theo lịch.</b> Mỗi phút máy chủ xem đợt nào đang chạy; khác với lần xuất bản gần nhất thì tự build lại (1–2 phút).
      <div class="muted" style="margin-top:6px">Đang chạy bây giờ: <b>${esc(sig || 'không có đợt nào')}</b> ·
        bản đang phục vụ được build với: <b>${esc(stored === null ? 'chưa ghi nhận' : stored || 'không có đợt nào')}</b>
        ${stored !== null && stored !== sig ? ' · <span class="pill draft">sẽ xuất bản lại trong ít phút</span>' : ''}
        ${next ? ` · lần đổi tiếp theo: <b>${esc(vnDateTime(next.toISOString()))}</b>` : ''}</div>
      <div class="muted" style="margin-top:6px">Sửa giá, gói, giờ của một đợt đang chạy thì bấm <a href="/admin/publish">Xuất bản</a> như mọi nội dung khác.
        Hướng dẫn: <code>docs/khuyen-mai.md</code>.</div>
    </div>
    ${rows.length ? '' : notice('warn', 'Chưa có đợt khuyến mãi nào.')}
    ${rows.map(({ e, ph }) => {
      const d = e.data;
      const packs = d.packs.map((pk) => { try { return viewPack(e, pk, prices); } catch (err) { return { error: (err as Error).message, label: pk.label }; } });
      const warns = [...promoWarnings(d), ...packs.flatMap((v) => ('warnings' in v ? v.warnings : []))];
      const pages = [...new Set(d.packs.flatMap((p) => p.showOn))];
      return `<div class="card">
        <div class="row" style="margin:0;justify-content:space-between">
          <div><span class="pill ${PHASE[ph][1]}">${PHASE[ph][0]}</span> ${d.badge ? `<span class="pill">${esc(d.badge)}</span>` : ''}
            <b style="font-size:17px;color:var(--navy)">${esc(d.name)}</b><br>
            <span class="muted">${esc(vnDateTime(d.startsAt))} → ${esc(vnDateTime(d.endsAt, 'vi', true))} · hiện ở ${pages.map((s) => `<a href="/${esc(s)}/" target="_blank" rel="noopener">${esc(s)}</a>`).join(', ')}</span></div>
          <div class="row" style="margin:0"><a class="btn ghost sm" href="/admin/edit?c=promotions&id=${encodeURIComponent(e.id)}">Sửa</a>
            <a class="btn ghost sm" href="/admin/edit?c=promotions&new=1&from=${encodeURIComponent(e.id)}">Nhân bản</a></div>
        </div>
        <table style="margin-top:12px"><tr><th>Gói</th><th class="num">Giá gói</th><th class="num">Mua lẻ</th><th class="num">Giảm</th><th class="num">Quà trị giá</th></tr>
          ${packs.map(packRow).join('')}</table>
        ${warns.length ? notice('warn', `<b>Cần xem lại trước khi chạy:</b><ul>${warns.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>`) : ''}
        ${d.banner ? `<p class="muted" style="margin:8px 0 0">Dải đầu trang: “${esc(d.banner.text)}” → <code>${esc(d.banner.href)}</code></p>` : ''}
      </div>`;
    }).join('')}`, user);
}
