/**
 * Bộ thử sanitizer. Mỗi ca là một cách phá mà kiểm định viên độc lập đã thử,
 * hoặc một lỗi hiển thị mà bản sanitizer trước đây gây ra.
 */
import { richText, plainText, safeJsonLd } from '../src/lib/richtext.ts';

const cases = [];
const eq = (name, got, want) => cases.push([name, got === want, `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`]);
const has = (name, got, needle, present = true) =>
  cases.push([name, got.includes(needle) === present, `${JSON.stringify(got.slice(0, 70))}`]);

// --- phải chặn thực thi mã ---
has('script tag', richText('a</script><script>x=1</script>b'), '<script', false);
has('img onerror', richText('<img src=x onerror=alert(1)>'), '<img', false);
has('svg onload', richText('<svg onload=alert(1)>'), '<svg', false);
has('iframe', richText('<iframe src=//evil>'), '<iframe', false);
has('thuộc tính lén', richText('<strong id=x onclick=y>hi</strong>'), '<strong id', false);
has('thẻ viết hoa lạ', richText('<SCRIPT>x</SCRIPT>'), '<script', false);
has('comment', richText('<!-- x -->'), '<!--', false);
has('CDATA', richText('<![CDATA[x]]>'), '<![CDATA[', false);

// --- phải giữ định dạng hợp lệ ---
eq('strong', richText('<strong>a</strong>'), '<strong>a</strong>');
eq('STRONG viết hoa', richText('<STRONG>a</STRONG>'), '<strong>a</strong>');
eq('br không dấu cách', richText('a<br>b'), 'a<br>b');
eq('br tự đóng', richText('a<br/>b'), 'a<br>b');
eq('br chuẩn có dấu cách', richText('a<br />b'), 'a<br>b');
eq('em lồng trong strong', richText('<strong><em>a</em></strong>'), '<strong><em>a</em></strong>');

// --- bất biến ---
for (const src of ['a<br />b', '<strong>x</strong>', 'a < b > c', '<img src=x>']) {
  eq(`bất biến: ${JSON.stringify(src)}`, richText(richText(src)), richText(src));
}

// --- plainText không được nuốt nội dung ---
eq('plainText giữ dấu nhỏ hơn', plainText('a < b > c'), 'a < b > c');
eq('plainText bỏ thẻ hợp lệ', plainText('giá <strong>rẻ</strong> hơn'), 'giá rẻ hơn');
eq('plainText bỏ br', plainText('a<br />b'), 'a b');

// --- JSON-LD ---
has('safeJsonLd thoát script', safeJsonLd({ a: '</script>' }), '</script>', false);
cases.push(['safeJsonLd vẫn parse được', (() => {
  try { JSON.parse(safeJsonLd({ a: '</script>', b: 'x<y>z' }).replace(/\\u003c/g, '<').replace(/\\u003e/g, '>').replace(/\\u0026/g, '&')); return true; }
  catch { return false; }
})(), '']);

let bad = 0;
for (const [name, ok, detail] of cases) {
  if (!ok) { console.error(`  HỎNG  ${name} — ${detail}`); bad++; }
}
console.log(`  ${cases.length - bad}/${cases.length} ca đúng`);
process.exit(bad ? 1 : 0);
