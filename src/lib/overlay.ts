/**
 * Mỗi lúc chỉ MỘT lớp phủ mời chào: popup khuyến mãi, lời mời chat, biểu mẫu "để lại số",
 * thông báo đơn gần đây. Hai cái cùng bật lên một lúc trên điện thoại là khách đóng hết rồi đi.
 */

/**
 * Đang có hộp thoại / bảng chat / lời mời / thông báo đơn đang hiện, hoặc khách đang gõ vào một ô nhập.
 * `passiveOk`: lời mời chat và thông báo đơn là lớp phủ THỤ ĐỘNG — biểu mẫu "để lại số" khi khách
 * sắp rời được chen trước chúng (và cất chúng đi bằng `hidePassive()`).
 */
export function overlayBusy(passiveOk = false): boolean {
  if (document.querySelector('dialog[open], .mchat.is-open')) return true;
  if (!passiveOk && document.querySelector('.mchat.inviting, #recent-orders.in')) return true;
  const a = document.activeElement as HTMLElement | null;
  return !!a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT');
}

/** Khách đã bắt đầu điền biểu mẫu đặt hàng / tư vấn trên trang. */
export function formTouched(): boolean {
  return document.documentElement.dataset.formTouched === '1';
}

/** Khách đã từng nhắn chat (cuộc trò chuyện còn lưu trên máy). */
export function hasChatted(): boolean {
  try {
    const x = JSON.parse(localStorage.getItem('mocha-chat-v1') ?? 'null');
    return !!x?.turns?.length;
  } catch { return false; }
}

export const store = {
  get(k: string, session = false) { try { return (session ? sessionStorage : localStorage).getItem(k); } catch { return null; } },
  set(k: string, v: string, session = false) { try { (session ? sessionStorage : localStorage).setItem(k, v); } catch { /* chế độ riêng tư */ } },
};

/** Chờ `ms` mili giây TAB ĐANG HIỆN (ẩn tab thì đồng hồ dừng) rồi gọi `fn`. */
export function afterVisible(ms: number, fn: () => void) {
  let left = ms; let t0 = 0; let timer = 0;
  const run = () => { t0 = Date.now(); timer = window.setTimeout(() => { cleanup(); fn(); }, left); };
  const onVis = () => {
    if (document.visibilityState === 'hidden') { clearTimeout(timer); left -= Date.now() - t0; }
    else run();
  };
  const cleanup = () => document.removeEventListener('visibilitychange', onVis);
  document.addEventListener('visibilitychange', onVis);
  if (document.visibilityState === 'visible') run();
}

/** Cất lời mời chat / thông báo đơn đang hiện (ChatWidget, RecentOrders nghe sự kiện này). */
export function hidePassive() {
  window.dispatchEvent(new CustomEvent('mocha:hide-passive'));
}
