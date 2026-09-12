/**
 * Nội dung sản phẩm là JSON do người biên tập sửa, và nhiều trường được render
 * bằng `set:html` để cho phép in đậm vài cụm từ. Điều đó biến file nội dung
 * thành mặt phẳng thực thi mã: một chuỗi `</script><script>…` trong FAQ chạy
 * được JavaScript trên trang (đã kiểm chứng).
 *
 * Giải pháp không phải là bỏ hẳn định dạng, mà là chỉ cho phép một tập thẻ hẹp
 * và escape mọi thứ còn lại. Người biên tập vẫn dùng được <strong> và <em>,
 * nhưng không chèn được thẻ nào khác, thuộc tính nào khác, hay script.
 */

const ALLOWED = new Set(['strong', 'em', 'b', 'i', 'br', 'sup', 'sub']);

const escapeText = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Trả về HTML an toàn để đưa vào `set:html`.
 * Mọi thẻ ngoài danh sách cho phép bị escape thành văn bản hiển thị,
 * nên lỗi của người biên tập lộ ra trên màn hình thay vì chạy ngầm.
 */
export function richText(input: string): string {
  let out = '';
  let i = 0;
  while (i < input.length) {
    const lt = input.indexOf('<', i);
    if (lt === -1) { out += escapeText(input.slice(i)); break; }
    out += escapeText(input.slice(i, lt));

    const gt = input.indexOf('>', lt);
    if (gt === -1) { out += escapeText(input.slice(lt)); break; }

    const raw = input.slice(lt + 1, gt).trim();
    const name = raw.replace(/^\//, '').split(/[\s/>]/)[0].toLowerCase();
    const closing = raw.startsWith('/');
    const selfClosing = raw.endsWith('/');

    // Chỉ chấp nhận thẻ trong danh sách và KHÔNG có thuộc tính nào.
    const bare = closing ? `/${name}` : selfClosing ? `${name}/` : name;
    if (ALLOWED.has(name) && raw.toLowerCase() === bare) {
      out += `<${closing ? '/' : ''}${name}${selfClosing && !closing ? ' /' : ''}>`;
    } else {
      out += escapeText(input.slice(lt, gt + 1));
    }
    i = gt + 1;
  }
  return out;
}

/** Bỏ toàn bộ thẻ, dùng cho JSON-LD, meta description và llms.txt. */
export function plainText(input: string): string {
  return input.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * JSON-LD nhúng trong <script> có thể bị thoát ra bằng chuỗi `</script>`
 * nằm trong chính dữ liệu. Escape các chuỗi nguy hiểm theo khuyến nghị của
 * WHATWG cho nội dung nhúng trong phần tử script.
 */
export function safeJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
