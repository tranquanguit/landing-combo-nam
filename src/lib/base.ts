/**
 * Tiền tố đường dẫn con.
 *
 * Bản production chạy ở gốc tên miền nên BASE rỗng và mọi hàm ở đây là hàm
 * đồng nhất — không đổi một byte nào của bản thật. Bản xem thử chạy ở
 * `/<repo>/` trên github.io, và một liên kết `/nam-tham/` ở đó trỏ ra ngoài
 * site, tới một trang 404 của GitHub.
 */
/* `import.meta.env` chỉ tồn tại khi Vite dựng. Các cổng kiểm tra chạy bằng
   Node trần và vẫn nạp file schema này, nên đọc thẳng sẽ ném lỗi ở một chỗ
   không liên quan gì tới việc chúng đang kiểm. Ở đó BASE rỗng là đúng: chúng
   kiểm nội dung, không kiểm đường dẫn xuất bản. */
const BASE = ((import.meta as any).env?.BASE_URL ?? '/').replace(/\/$/, '');

/**
 * Thêm tiền tố vào đường dẫn nội bộ.
 *
 * Bỏ qua `//` (giao thức tương đối, trỏ ra miền khác), `#` (neo trong trang) và
 * mọi URL tuyệt đối — thêm tiền tố vào những thứ đó là làm hỏng chúng.
 */
export function withBase(href: string): string {
  if (!BASE) return href;
  if (!href.startsWith('/') || href.startsWith('//')) return href;
  if (href.startsWith(`${BASE}/`) || href === BASE) return href;
  return BASE + href;
}
