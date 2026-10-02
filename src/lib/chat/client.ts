/**
 * Giao diện chat — tải theo yêu cầu (lần đầu khách bấm bong bóng).
 *
 * An toàn: mọi thứ từ máy chủ được dựng bằng DOM + textContent, KHÔNG innerHTML.
 * Phản hồi n8n đã được máy chủ chuẩn hoá (server/lib/chat.ts), nhưng giao diện
 * vẫn không tin nó: chữ là chữ, link chỉ nhận /, https:, tel:, mailto:.
 *
 * Bộ nhớ: localStorage giữ cuộc trò chuyện (chỉ chữ + thẻ, KHÔNG giữ ảnh) 7 ngày,
 * để khách chuyển trang không mất mạch. Ảnh khách gửi được thu nhỏ trong trình
 * duyệt (≤ 1280px, JPEG) trước khi gửi.
 */
type S = Record<string, string>;
interface Config { endpoint: string; locale: 'vi' | 'en'; privacyUrl: string; strings: S }
interface Card { slug: string; name: string; tagline?: string | null; priceText: string; compareAtPriceText?: string | null;
  image?: string | null; imageAlt?: string; url: string; orderUrl: string; available: boolean }
type Block =
  | { type: 'text'; text: string }
  | { type: 'image'; url: string; alt?: string; caption?: string }
  | { type: 'product'; product: Card; note?: string }
  | { type: 'products'; products: Card[] }
  | { type: 'link'; label: string; url: string };
interface Turn { role: 'user' | 'bot'; blocks: Block[]; images?: number; at: number }
interface Saved { v: 1; sessionId: string; turns: Turn[]; quick: { label: string; payload: string }[]; at: number }
interface Pending { text: string; payload: string; event: 'message' | 'quick_reply'; images: Img[] }
interface Img { mime: string; base64: string; bytes: number; width: number; height: number; url: string }

const KEY = 'mocha-chat-v1';
const TTL = 7 * 24 * 3600 * 1000;
const MAX_IMAGES = 3;
const uuid = () => (crypto.randomUUID ? crypto.randomUUID()
  : '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) => (+c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (+c / 4)))).toString(16)));

function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string | boolean | undefined> = {}, ...kids: (Node | string | null | undefined)[]) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (k === 'class') n.className = String(v); else n.setAttribute(k, v === true ? '' : String(v));
  }
  for (const k of kids) if (k != null) n.append(k);
  return n;
}
const icon = (d: string) => {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('d', d); s.append(p);
  return s;
};
const I = {
  close: 'M6 6l12 12M18 6L6 18',
  refresh: 'M4 12a8 8 0 0 1 13.7-5.7L20 8.6M20 4v4.6h-4.6M20 12a8 8 0 0 1-13.7 5.7L4 15.4M4 20v-4.6h4.6',
  image: 'M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5zM4 16l4.5-4.5 4 4L16 12l4 4M9 9.2a.2.2 0 1 0 0-.4.2.2 0 0 0 0 .4',
  send: 'M4 12l16-8-6 16-2.5-6.5z',
};

/** Chữ: hỗ trợ **in đậm** và xuống dòng; mọi thứ khác hiện nguyên văn. */
function richText(text: string) {
  const f = document.createDocumentFragment();
  text.split(/(\*\*[^*\n]+\*\*)/g).forEach((part) => {
    if (/^\*\*[^*\n]+\*\*$/.test(part)) f.append(el('strong', {}, part.slice(2, -2)));
    else if (part) f.append(part);
  });
  return f;
}
const safeHref = (u: string) => (/^\/(?!\/)/.test(u) || /^(https:|tel:|mailto:)/i.test(u) ? u : null);
const safeSrc = (u?: string | null) => (u && /^\/(?!\/)/.test(u) ? u : null);

export function mount(root: HTMLElement) {
  const cfg: Config = JSON.parse(root.dataset.config!);
  const s = cfg.strings;
  const fab = root.querySelector<HTMLButtonElement>('.mchat-fab')!;

  // ---------------------------------------------------------------- trạng thái
  let state: Saved = load() ?? fresh();
  let pending: Img[] = [];
  let busy = false;
  let lastFailed: Pending | null = null;

  function fresh(): Saved { return { v: 1, sessionId: uuid(), turns: [], quick: [], at: Date.now() }; }
  function load(): Saved | null {
    try {
      const x = JSON.parse(localStorage.getItem(KEY) ?? 'null');
      return x && x.v === 1 && Date.now() - x.at < TTL ? x : null;
    } catch { return null; }
  }
  function save() { try { state.at = Date.now(); localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* đầy/bị chặn */ } }

  // ---------------------------------------------------------------- khung
  const log = el('div', { class: 'mchat-log', role: 'log', 'aria-live': 'polite', 'aria-relevant': 'additions' });
  const quick = el('div', { class: 'mchat-quick' });
  const previews = el('div', { class: 'mchat-previews' });
  const input = el('textarea', { class: 'mchat-input', rows: '1', placeholder: s.placeholder, 'aria-label': s.placeholder, maxlength: '2000' }) as HTMLTextAreaElement;
  const file = el('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp,image/heic,image/heif', multiple: true, hidden: true }) as HTMLInputElement;
  const attach = el('button', { type: 'button', class: 'mchat-icon', 'aria-label': s.attach, title: s.attach }, icon(I.image));
  const send = el('button', { type: 'button', class: 'mchat-send', 'aria-label': s.send, disabled: true }, icon(I.send)) as HTMLButtonElement;
  const btnNew = el('button', { type: 'button', class: 'mchat-icon', 'aria-label': s.new, title: s.new }, icon(I.refresh));
  const btnClose = el('button', { type: 'button', class: 'mchat-icon', 'aria-label': s.close, title: s.close }, icon(I.close));
  const panel = el('div', { class: 'mchat-panel', id: 'mchat-panel', role: 'dialog', 'aria-modal': 'false', 'aria-labelledby': 'mchat-title', hidden: true },
    el('div', { class: 'mchat-head' },
      el('span', { class: 'mchat-avatar', 'aria-hidden': 'true' }, 'M'),
      el('div', { class: 'mchat-head-text' }, el('p', { class: 'mchat-head-title', id: 'mchat-title' }, s.title), el('p', { class: 'mchat-head-status' }, s.status)),
      btnNew, btnClose),
    log, quick, previews,
    el('div', { class: 'mchat-compose' }, attach, file, input, send),
    el('p', { class: 'mchat-foot' }, s.notice + ' ', el('a', { href: cfg.privacyUrl }, s.privacy)));
  root.append(panel);

  // ---------------------------------------------------------------- vẽ
  function card(c: Card, note?: string) {
    const img = safeSrc(c.image);
    const view = safeHref(c.url) ?? '#';
    return el('article', { class: 'mchat-card' },
      img ? el('a', { class: 'mchat-card-img', href: view, tabindex: '-1', 'aria-hidden': 'true' }, el('img', { src: img, alt: '', loading: 'lazy', decoding: 'async' })) : null,
      el('div', { class: 'mchat-card-body' },
        el('a', { class: 'mchat-card-name', href: view, 'data-cta': 'chat-product' }, c.name),
        c.tagline ? el('span', { class: 'mchat-card-tag' }, c.tagline) : null,
        el('span', { class: 'mchat-card-price' }, c.priceText, c.compareAtPriceText ? el('s', {}, c.compareAtPriceText) : null),
        note ? el('span', { class: 'mchat-card-note' }, note) : null,
        el('div', { class: 'mchat-card-actions' },
          el('a', { class: 'view', href: view }, s.viewProduct),
          c.available ? el('a', { class: 'order', href: safeHref(c.orderUrl) ?? view, 'data-cta': 'chat-order' }, s.orderProduct)
            : el('span', { class: 'mchat-note' }, s.outOfStock))));
  }
  function renderTurn(t: Turn) {
    const row = el('div', { class: `mchat-row ${t.role}` });
    if (t.role === 'user') row.append(el('span', { class: 'mchat-sr' }, s.you + ': '));
    const links: HTMLElement[] = [];
    for (const b of t.blocks) {
      if (b.type === 'text') row.append(el('div', { class: 'mchat-bubble' }, richText(b.text)));
      else if (b.type === 'image') {
        const src = safeSrc(b.url); if (!src) continue;
        row.append(el('figure', { class: 'mchat-img' }, el('img', { src, alt: b.alt ?? '', loading: 'lazy' }), b.caption ? el('figcaption', {}, b.caption) : null));
      } else if (b.type === 'product') row.append(card(b.product, b.note));
      else if (b.type === 'products') row.append(el('div', { class: 'mchat-cards' }, ...b.products.map((c) => card(c))));
      else if (b.type === 'link') {
        const href = safeHref(b.url); if (!href) continue;
        const external = /^https:/i.test(href);
        links.push(el('a', { class: 'mchat-link', href, ...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {}) }, b.label));
      }
    }
    if (links.length) row.append(el('div', { class: 'mchat-links' }, ...links));
    if (t.images) row.append(el('span', { class: 'mchat-note' }, `${t.images} ${s.imagesSent}`));
    return row;
  }
  function renderAll() {
    log.replaceChildren();
    if (!state.turns.length) {
      log.append(renderTurn({ role: 'bot', blocks: [{ type: 'text', text: s.greeting }], at: 0 }));
      setQuick([s.suggest1, s.suggest2, s.suggest3].map((l) => ({ label: l, payload: l })));
    } else {
      for (const t of state.turns) log.append(renderTurn(t));
      setQuick(state.quick);
    }
    scrollEnd();
  }
  function setQuick(q: { label: string; payload: string }[]) {
    quick.replaceChildren(...q.map((x) => {
      const b = el('button', { type: 'button' }, x.label);
      b.addEventListener('click', () => {
        if (x.label === s.suggest3) { file.click(); return; }
        submit({ text: x.label, payload: x.payload, event: 'quick_reply', images: [] });
      });
      return b;
    }));
  }
  const scrollEnd = () => requestAnimationFrame(() => { log.scrollTop = log.scrollHeight; });
  function refreshSend() { send.disabled = busy || (!input.value.trim() && !pending.length); }

  // ---------------------------------------------------------------- ảnh
  async function toImg(f: File): Promise<Img> {
    const bmp = await createImageBitmap(f);
    const k = Math.min(1, 1280 / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * k), h = Math.round(bmp.height * k);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    c.getContext('2d')!.drawImage(bmp, 0, 0, w, h); bmp.close?.();
    let q = 0.85; let blob: Blob | null = null;
    do { blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', q)); q -= 0.15; } while (blob && blob.size > 1.8 * 1024 * 1024 && q > 0.3);
    if (!blob || blob.size > 2 * 1024 * 1024) throw new Error('too_big');
    const buf = new Uint8Array(await blob.arrayBuffer());
    let bin = ''; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    const base64 = btoa(bin);
    /* data: chứ không blob: — CSP img-src của site cho phép data:, không cho blob:. */
    return { mime: 'image/jpeg', base64, bytes: buf.length, width: w, height: h, url: `data:image/jpeg;base64,${base64}` };
  }
  function renderPreviews() {
    previews.replaceChildren(...pending.map((im, i) => {
      const x = el('button', { type: 'button', 'aria-label': s.removeImage }, '×');
      x.addEventListener('click', () => { pending.splice(i, 1); renderPreviews(); refreshSend(); });
      return el('div', { class: 'mchat-preview' }, el('img', { src: im.url, alt: '' }), x);
    }));
  }
  file.addEventListener('change', async () => {
    const files = [...(file.files ?? [])]; file.value = '';
    for (const f of files) {
      if (pending.length >= MAX_IMAGES) { flash(s.maxImages); break; }
      try { pending.push(await toImg(f)); } catch { flash(s.imageTooBig); }
    }
    renderPreviews(); refreshSend(); input.focus();
  });
  function flash(text: string) {
    log.append(el('div', { class: 'mchat-row bot' }, el('div', { class: 'mchat-note' }, text))); scrollEnd();
  }

  // ---------------------------------------------------------------- gửi
  function utm() {
    const p = new URLSearchParams(location.search); const o: Record<string, string> = {};
    for (const k of ['source', 'medium', 'campaign', 'content', 'term']) { const v = p.get('utm_' + k); if (v) o[k] = v; }
    return o;
  }
  async function submit(p: Pending) {
    if (busy) return;
    busy = true; refreshSend(); quick.replaceChildren();
    const userTurn: Turn = { role: 'user', blocks: p.text ? [{ type: 'text', text: p.text }] : [], images: p.images.length || undefined, at: Date.now() };
    const row = renderTurn(userTurn);
    if (p.images.length) row.prepend(el('div', { class: 'mchat-thumbs' }, ...p.images.map((im) => el('img', { src: im.url, alt: '' }))));
    log.append(row);
    const typing = el('div', { class: 'mchat-typing', role: 'status', 'aria-label': s.typing }, el('i'), el('i'), el('i'));
    log.append(typing); scrollEnd();
    const history = state.turns.slice(-20).map((t) => ({ role: t.role, text: t.blocks.filter((b) => b.type === 'text').map((b: any) => b.text).join('\n') })).filter((h) => h.text);
    try {
      const r = await fetch(cfg.endpoint, {
        method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          messageId: uuid(), sessionId: state.sessionId, locale: cfg.locale, event: p.event,
          text: p.text, payload: p.payload || undefined,
          images: p.images.map(({ mime, base64, bytes, width, height }) => ({ mime, base64, bytes, width, height })),
          page: { path: location.pathname, title: document.title, utm: utm() }, history,
        }),
      });
      const data = await r.json().catch(() => null);
      if (!data?.messages) throw new Error('bad_reply');
      typing.remove();
      state.turns.push(userTurn);
      const botTurn: Turn = { role: 'bot', blocks: data.messages, at: Date.now() };
      state.turns.push(botTurn); state.quick = data.quickReplies ?? [];
      state.turns = state.turns.slice(-60);
      log.append(renderTurn(botTurn)); setQuick(state.quick); save();
      lastFailed = null;
    } catch {
      typing.remove(); lastFailed = p;
      const retry = el('button', { type: 'button' }, s.retry);
      retry.addEventListener('click', () => { const x = lastFailed; err.remove(); row.remove(); if (x) submit(x); });
      const err = el('div', { class: 'mchat-row bot' }, el('div', { class: 'mchat-error', role: 'alert' }, s.error, retry));
      log.append(err);
    } finally {
      busy = false; refreshSend(); scrollEnd();
    }
  }
  function sendTyped() {
    const text = input.value.trim();
    if ((!text && !pending.length) || busy) return;
    const images = pending; pending = []; renderPreviews();
    input.value = ''; autosize();
    submit({ text, payload: '', event: 'message', images });
  }

  // ---------------------------------------------------------------- sự kiện
  const autosize = () => { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 120) + 'px'; };
  input.addEventListener('input', () => { autosize(); refreshSend(); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); sendTyped(); }
  });
  send.addEventListener('click', sendTyped);
  attach.addEventListener('click', () => file.click());
  btnNew.addEventListener('click', () => { state = fresh(); save(); pending = []; renderPreviews(); renderAll(); input.focus(); });
  btnClose.addEventListener('click', () => close());
  panel.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

  function open() {
    panel.hidden = false; root.classList.add('is-open', 'seen'); fab.setAttribute('aria-expanded', 'true');
    renderAll(); setTimeout(() => input.focus(), 30);
  }
  function close() {
    panel.hidden = true; root.classList.remove('is-open'); fab.setAttribute('aria-expanded', 'false'); fab.focus();
  }
  return { toggle: () => (panel.hidden ? open() : close()) };
}
