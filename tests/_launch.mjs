/**
 * Mở trình duyệt cho các cổng cần trình duyệt thật.
 *
 * Vì sao có tệp này: Playwright tải bản Chromium riêng lúc `npm install`. Trên
 * máy có chính sách chặn node.exe đi ra mạng, bước tải đó thất bại lặng lẽ và
 * HAI cổng (`test:inp`, `test:order`) cùng đỏ với một thông báo
 * nói về Playwright chứ không nói về mã — dễ bị đọc nhầm thành lỗi của bản sửa
 * vừa rồi.
 *
 * Thứ tự thử, từ ít phụ thuộc mạng nhất:
 *   1. Chrome/Edge đã cài sẵn trên máy (`channel`) — không tải gì cả;
 *   2. bản Chromium của Playwright, nếu đã tải được.
 *
 * Không nơi nào cần mạng lúc chạy. Thất bại thì ném kèm lý do thật, để người
 * đọc biết cần cài gì chứ không phải đoán.
 */
export async function launchBrowser(chromium, options = {}) {
  const attempts = [
    { channel: 'chrome', label: 'Chrome đã cài trên máy' },
    { channel: 'msedge', label: 'Edge đã cài trên máy' },
    { channel: undefined, label: 'Chromium do Playwright tải' },
  ];
  const errors = [];
  for (const a of attempts) {
    try {
      const opts = { ...options };
      if (a.channel) opts.channel = a.channel;
      return await chromium.launch(opts);
    } catch (e) {
      errors.push(`${a.label}: ${String(e.message ?? e).split('\n')[0]}`);
    }
  }
  throw new Error(
    'Không mở được trình duyệt nào. Đã thử:\n  ' + errors.join('\n  ') +
    '\nCài Chrome, hoặc chạy `npx playwright install chromium` ở nơi có mạng.',
  );
}
