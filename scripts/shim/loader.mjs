/**
 * Đổi `astro:content` và `astro/loaders` sang bản giả, để các bộ thử chạy được
 * bằng node trần mà không cần dựng cả Astro.
 *
 * `new URL('./x.mjs', import.meta.url)` đã là một file:// URL hoàn chỉnh — dùng
 * thẳng `.href`. Trước đây chỗ này lấy `.pathname` rồi bọc lại bằng
 * `pathToFileURL()`: trên Linux `.pathname` là "/home/..." nên vô tình đúng,
 * còn trên Windows nó là "/Q:/Projects/..." và bị hiểu thành đường dẫn tương
 * đối, cho ra "Q:\Q:\Projects\..." — toàn bộ test:schema trở xuống không chạy.
 */
const CONTENT = new URL('./astro-content.mjs', import.meta.url).href;
const LOADERS = new URL('./astro-loaders.mjs', import.meta.url).href;

export function resolve(specifier, context, next) {
  if (specifier === 'astro:content') return { url: CONTENT, shortCircuit: true };
  if (specifier === 'astro/loaders') return { url: LOADERS, shortCircuit: true };
  return next(specifier, context);
}
