/**
 * Ghi hành trình của khách trên CHÍNH website này (bên thứ nhất), gửi về /api/j, xem ở
 * /admin/journey. Chỉ chạy sau khi khách bấm "Đồng ý" ở thanh đo lường (Analytics.astro).
 *
 * Ghi: trang đã mở, thời gian XEM THẬT (tab đang hiện), khối nội dung nằm trong màn hình bao
 * lâu, nút/link đã bấm, câu hỏi đã mở, bắt đầu điền biểu mẫu, gửi đơn, tới trang cảm ơn.
 * KHÔNG ghi: chữ khách gõ, tên, số điện thoại, vị trí chuột, IP (máy chủ cũng không lưu IP).
 *
 * Mã khách / mã phiên là chuỗi ngẫu nhiên trong localStorage. Phiên hết sau 30 phút không
 * hoạt động. Cookie `mocha_js` (mã phiên, 30 phút) chỉ để máy chủ gắn đơn hàng vào phiên.
 */
const K = { visitor: 'mocha_jv', session: 'mocha_js', last: 'mocha_jl', meta: 'mocha_jm' };
const IDLE = 30 * 60 * 1000;
const FLUSH_MS = 20_000;
const MIN_SECTION_MS = 1000;

type Ev = { t: string; a: number; p: string; x?: string; b?: string; d?: number };

const store = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* chế độ riêng tư */ } },
  del: (k: string) => { try { localStorage.removeItem(k); } catch { /* chế độ riêng tư */ } },
};

/** "j_" + 22 ký tự base64url (128 bit ngẫu nhiên). */
function rid() {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return `j_${btoa(String.fromCharCode(...a)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`;
}
const ID = /^j_[A-Za-z0-9_-]{22}$/;
const text = (el: Element | null | undefined, max: number) =>
  (el?.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, max) || undefined;
const safeId = (s: string) => s.replace(/[^A-Za-z0-9_\-:.#/]/g, '').slice(0, 70) || 'x';

/** Xoá mọi dấu vết hành trình trên máy khách (khi rút lại đồng ý). */
export function forgetJourney() {
  Object.values(K).forEach(store.del);
  document.cookie = `${K.session}=; Max-Age=0; path=/`;
}

let started = false;
let pushRef: ((t: string, extra?: Partial<Ev>) => void) | null = null;
let flushRef: (() => void) | null = null;

export function startJourney(endpoint: string) {
  if (started) return;
  started = true;
  const now = Date.now();
  const path = location.pathname.slice(0, 200);

  /* ---- mã khách + mã phiên ---- */
  let visitor = store.get(K.visitor) ?? '';
  const known = ID.test(visitor);
  if (!known) { visitor = rid(); store.set(K.visitor, visitor); }
  let session = store.get(K.session) ?? '';
  const last = Number(store.get(K.last) ?? 0);
  const fresh = !ID.test(session) || !last || now - last > IDLE;
  const q = new URLSearchParams(location.search);
  if (fresh) {
    session = rid();
    store.set(K.session, session);
    /* Thông tin phiên chụp MỘT lần ở trang đầu: nguồn, chiến dịch, thiết bị. */
    let ref: string | undefined;
    try { const r = document.referrer && new URL(document.referrer); if (r && r.host !== location.host) ref = r.hostname; } catch { /* referrer lạ */ }
    const meta = {
      l: (document.documentElement.lang || '').slice(0, 2),
      w: innerWidth,
      ref,
      us: q.get('utm_source')?.slice(0, 80) || undefined,
      um: q.get('utm_medium')?.slice(0, 80) || undefined,
      uc: q.get('utm_campaign')?.slice(0, 80) || undefined,
      ad: q.has('gclid') || q.has('gbraid') || q.has('wbraid') ? 'google' : q.has('fbclid') ? 'facebook' : q.has('ttclid') ? 'tiktok' : undefined,
      r: known ? 1 : 0,
    };
    store.set(K.meta, JSON.stringify(meta));
  }
  let meta: Record<string, unknown> = {};
  try { meta = JSON.parse(store.get(K.meta) ?? '{}'); } catch { /* hỏng thì bỏ */ }

  const touch = () => {
    store.set(K.last, String(Date.now()));
    document.cookie = `${K.session}=${session}; path=/; max-age=1800; samesite=lax${location.protocol === 'https:' ? '; secure' : ''}`;
  };
  touch();

  /* ---- hàng đợi + gửi ---- */
  const queue: Ev[] = [];
  const push = (t: string, extra: Partial<Ev> = {}) => { queue.push({ t, a: Date.now(), p: path, ...extra }); touch(); };
  const flush = () => {
    if (!queue.length) return;
    const body = JSON.stringify({ v: visitor, s: session, m: meta, e: queue.splice(0, 60) });
    try {
      if (!navigator.sendBeacon?.(endpoint, new Blob([body], { type: 'text/plain' }))) {
        fetch(endpoint, { method: 'POST', body, keepalive: true, headers: { 'content-type': 'text/plain' } }).catch(() => {});
      }
    } catch { /* mạng hỏng: thiếu một lô thống kê, không ảnh hưởng khách */ }
    if (queue.length) flush();
  };
  setInterval(flush, FLUSH_MS);
  pushRef = push; flushRef = flush;

  push('page', { b: document.title.slice(0, 100) || undefined });

  /* ---- thời gian xem thật: chỉ đếm khi tab đang hiện ---- */
  let shownAt = document.visibilityState === 'visible' ? Date.now() : 0;
  let shownMs = 0;
  const pauseClock = () => { if (shownAt) { shownMs += Date.now() - shownAt; shownAt = 0; } };

  /* ---- khối nội dung trong màn hình ---- */
  const inView = new Map<Element, number>();        // khối -> lúc bắt đầu thấy (0 = không thấy)
  const dwell = new Map<Element, number>();         // khối -> ms đã cộng, chưa gửi
  const sections = [...document.querySelectorAll<HTMLElement>('main section[id]')];
  const stopSection = (el: Element) => {
    const t0 = inView.get(el);
    if (t0) { dwell.set(el, (dwell.get(el) ?? 0) + Date.now() - t0); inView.set(el, 0); }
  };
  if ('IntersectionObserver' in window && sections.length) {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        /* "Đang đọc" = khối chiếm ít nhất nửa khối HOẶC nửa màn hình (khối cao hơn màn hình
           không bao giờ hiện được quá nửa chính nó). */
        const seen = e.isIntersecting && (e.intersectionRatio >= 0.5 || e.intersectionRect.height >= innerHeight * 0.5);
        if (seen && !inView.get(e.target) && document.visibilityState === 'visible') inView.set(e.target, Date.now());
        else if (!seen) stopSection(e.target);
      }
    }, { threshold: [0, 0.25, 0.5, 0.75, 1] });
    sections.forEach((s) => io.observe(s));
  }

  const settle = () => {
    pauseClock();
    if (shownMs > 0) { push('leave', { d: shownMs }); shownMs = 0; }
    for (const el of inView.keys()) stopSection(el);
    for (const [el, ms] of dwell) {
      if (ms >= MIN_SECTION_MS) {
        push('section', { x: safeId(el.id), b: text(el.querySelector('h2, h1, h3'), 80), d: ms });
      }
    }
    dwell.clear();
    flush();
  };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') settle();
    else {
      shownAt = Date.now();
      /* Quay lại tab: khối nào đang trong màn hình thì đếm tiếp. */
      for (const el of inView.keys()) {
        const r = el.getBoundingClientRect();
        if (r.bottom > 0 && r.top < innerHeight) inView.set(el, Date.now());
      }
    }
  });
  addEventListener('pagehide', settle);

  /* ---- bấm ---- */
  document.addEventListener('click', (ev) => {
    const el = (ev.target as Element | null)?.closest?.<HTMLElement>('[data-cta], a[href], button, summary');
    if (!el || el.tagName === 'SUMMARY') return;
    const label = text(el, 40) ?? el.getAttribute('aria-label')?.slice(0, 40);
    let x: string;
    if (el.dataset.cta) {
      const id = el.dataset.cta;
      x = /call|zalo|contact/.test(id) ? `contact:${safeId(id)}` : el.dataset.ctaKind === 'select' ? `select:${safeId(id)}` : `order:${safeId(id)}`;
    } else if (el instanceof HTMLAnchorElement) {
      try {
        const u = new URL(el.href, location.href);
        x = u.protocol === 'tel:' ? 'contact:tel' : u.protocol === 'mailto:' ? 'contact:email'
          : u.host === location.host ? `link:${safeId(u.pathname + u.hash)}` : `out:${safeId(u.hostname)}`;
      } catch { return; }
    } else {
      if ((el as HTMLButtonElement).type === 'submit' && el.closest('#order-form')) return;   // gửi đơn: sự kiện 'order'
      x = `btn:${safeId(el.id || el.className.split(' ')[0] || 'x')}`;
    }
    push('click', { x, b: label });
  }, { capture: true, passive: true });

  /* ---- câu hỏi mở ra (FAQ, <details>) ---- */
  document.addEventListener('toggle', (ev) => {
    const d = ev.target as HTMLDetailsElement;
    if (d?.tagName !== 'DETAILS' || !d.open) return;
    if (d.closest('header, nav')) return;                     // menu, không phải câu hỏi
    push('faq', { x: safeId(d.closest('section[id]')?.id ?? 'x'), b: text(d.querySelector('summary'), 100) });
  }, true);

  /* ---- biểu mẫu ---- */
  let typing = false;
  document.getElementById('order-form')?.addEventListener('input', () => {
    if (typing) return;
    typing = true;
    push('form_start');
  });
  addEventListener('mocha:lead', (e) => {
    push('order', { b: String((e as CustomEvent).detail?.pack ?? '').slice(0, 80) || undefined });
    flush();
  });
}

/** Một sự kiện từ trang: 'thanks' ở trang cảm ơn, 'popup' cho các lời mời (x = "promo:show"…).
    Chưa bắt đầu (khách chưa đồng ý đo lường) thì bỏ. */
export function journeyEvent(t: 'thanks' | 'popup', label?: string, target?: string) {
  pushRef?.(t, { b: label?.slice(0, 80) || undefined, x: target ? safeId(target) : undefined });
  if (t === 'thanks') flushRef?.();
}
