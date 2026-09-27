/**
 * Điều kiện tiên quyết cho mọi bài kiểm tra có điền biểu mẫu đặt hàng.
 *
 * VÌ SAO CÓ TỆP NÀY
 *
 * Khi PUBLIC_ORDER_ENDPOINT chưa được khai, trang CỐ Ý không render thẻ
 * <form> mà chỉ hiện hotline. Đó là thiết kế đúng: thà không có ô nhập còn
 * hơn có ô nhập rồi nuốt mất đơn của khách.
 *
 * Nhưng hai bài kiểm tra điền biểu mẫu thì không biết chuyện đó. Chúng gọi
 * page.fill('#name', …), Playwright chờ ô nhập xuất hiện, và 30 giây sau ném
 * ra TimeoutError kèm một trang call log "retrying fill action / waiting
 * 500ms". Người đọc kết quả phải tự suy từ đống đó ra nguyên nhân thật — mà
 * nguyên nhân thật là một dòng: thiếu biến môi trường.
 *
 * Nửa phút chờ rồi báo sai chỗ, hai lần, mỗi lần chạy. Kiểm tra trước thì
 * biết ngay, và nói đúng thứ cần sửa.
 *
 * Đọc thẳng tệp trong dist chứ không mở trình duyệt: câu trả lời đã nằm sẵn
 * trong HTML tĩnh, không cần dựng máy chủ và bật Chrome mới biết.
 */
import { readFileSync, existsSync } from 'node:fs';

/**
 * Dừng ngay với thông báo rõ nếu bản build không có biểu mẫu đặt hàng.
 * @param {string} page đường dẫn trang có khối đặt hàng, tính từ gốc repo
 */
export function requireOrderForm(page = 'dist/combo-nam/index.html') {
  if (!existsSync(page)) {
    console.error(`\n  Chưa có ${page}. Chạy "npm run build" trước.\n`);
    process.exit(1);
  }
  const html = readFileSync(page, 'utf8');
  /* Đọc lời khai tường minh của khối đặt hàng, không suy từ tên thẻ. Khi chưa
     cấu hình, #order-form vẫn tồn tại (là <div> thay vì <form>) và các ô nhập
     vẫn được render, chỉ bị disabled — nên "có #order-form" hay "có #name"
     đều không phân biệt được hai trạng thái. data-endpoint thì có. */
  if (html.includes('data-endpoint="configured"')) return;

  console.error(`
  Bản build không có biểu mẫu đặt hàng, nên bài kiểm tra này không chạy được.

  Nguyên nhân: PUBLIC_ORDER_ENDPOINT chưa được khai lúc build, nên trang chỉ
  hiện hotline thay cho <form>. Đó là hành vi đúng, không phải lỗi.

  Cách chạy được bài này:
      PUBLIC_ORDER_ENDPOINT=http://localhost:8132/api/orders npm run build

  (Hai bài kiểm tra tự dựng endpoint giả của riêng chúng, nên địa chỉ ở trên
  chỉ cần đúng dạng URL để trang chịu render biểu mẫu.)
`);
  process.exit(1);
}
