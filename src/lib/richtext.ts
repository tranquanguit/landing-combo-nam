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
const VOID = new Set(['br']);

/**
 * Escape văn bản, nhưng KHÔNG escape lại các entity đã hợp lệ.
 *
 * Nhờ đó hàm bất biến qua nhiều lần gọi (`richText(richText(x))` bằng
 * `richText(x)`), và người biên tập gõ `&lt;` thì thấy dấu `<` trên trang chứ
 * không thấy chữ `&lt;`.
 */
const ENTITY = /&(?:[a-z][a-z0-9]{1,9}|#\d{1,7}|#x[0-9a-f]{1,6});/gi;

const escapeText = (s: string) => {
  const keep: string[] = [];
  const stashed = s.replace(ENTITY, (m) => `\u0000${keep.push(m) - 1}\u0000`);
  return stashed
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\u0000(\d+)\u0000/g, (_, i) => keep[Number(i)]);
};

/** Nhận diện một thẻ hợp lệ: tên trong danh sách, không thuộc tính. */
const TAG = /^(\/?)([a-z][a-z0-9]*)\s*(\/?)$/i;

/**
 * Trả về HTML an toàn để đưa vào `set:html`.
 *
 * Mọi thẻ ngoài danh sách cho phép bị escape thành văn bản hiển thị, nên lỗi
 * của người biên tập lộ ra trên màn hình thay vì chạy ngầm.
 *
 * Hai tính chất được bảo đảm, và có bộ thử đi kèm trong tests/richtext.mjs:
 *  - Chấp nhận cả `<br>` và `<br />` — dạng sau là cú pháp chuẩn mà tài liệu
 *    bảo người biên tập dùng, bản trước lại escape nó thành chữ.
 *  - Bất biến: `richText(richText(x)) === richText(x)`. Bản trước biến
 *    `<br/>` thành `<br />` rồi lần chạy sau escape chính kết quả đó.
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

    const m = TAG.exec(input.slice(lt + 1, gt).trim());
    const name = m?.[2].toLowerCase();

    if (m && name && ALLOWED.has(name)) {
      const closing = m[1] === '/';
      // Chuẩn hoá về đúng một dạng để hàm bất biến qua nhiều lần gọi.
      out += VOID.has(name) ? (closing ? '' : `<${name}>`) : `<${closing ? '/' : ''}${name}>`;
    } else {
      out += escapeText(input.slice(lt, gt + 1));
    }
    i = gt + 1;
  }
  return out;
}

/**
 * Bỏ định dạng, giữ nguyên văn bản. Dùng cho JSON-LD, meta description, llms.txt.
 *
 * Bản trước dùng `replace(/<[^>]*>/g, '')` nên câu "a < b > c" mất luôn phần
 * giữa — âm thầm nuốt nội dung của người biên tập. Nay chỉ bỏ đúng những thẻ
 * mà `richText` cho phép; mọi dấu `<` khác được giữ lại như ký tự bình thường.
 */
export function plainText(input: string): string {
  const tags = [...ALLOWED].join('|');
  return input
    // <br> ngắt dòng nên thay bằng khoảng trắng, các thẻ khác thì bỏ hẳn.
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(new RegExp(`</?(?:${tags})\\s*/?>`, 'gi'), '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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
