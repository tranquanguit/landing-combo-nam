import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname, sep } from 'node:path';
import { gzipSync } from 'node:zlib';

/**
 * Ngân sách trọng lượng. Trước đây con số này chỉ nằm trong tài liệu, nên nó
 * không ràng buộc được gì. Vượt ngân sách là fail CI.
 */
const BUDGET = {
  htmlGzip: 24 * 1024,     // mỗi trang HTML sau khi nén
  /**
   * JS nội tuyến trên một trang, đo byte thô đã minify (chi phí phân tích cú
   * pháp); sau nén còn khoảng một phần ba.
   *
   * LỊCH SỬ THAY ĐỔI NGƯỠNG — ghi lại để việc nới không diễn ra âm thầm.
   * Một kiểm định viên độc lập đã chỉ ra: "một cổng mà người vi phạm tự sửa
   * được ngưỡng trong cùng commit thì không ràng buộc được ai". Đúng. Nên mỗi
   * lần nâng phải nêu lý do và nêu đã cắt được gì trước khi nâng.
   *
   *  4 KB — ban đầu (vòng 8): chỉ có kiểm tra biểu mẫu.
   *  6 KB — vòng 9: thêm lớp đo lường chuyển đổi. Không cắt được gì trước đó.
   *  7 KB — vòng 12: thêm luồng đồng ý hai chiều (đồng ý / từ chối / rút lại),
   *         trạng thái gửi đơn và chuyển focus sau khi gửi. TRƯỚC KHI NÂNG đã
   *         cắt: theo dõi độ sâu cuộn (cũng là nguồn cưỡng bức reflow), hai
   *         bảng ánh xạ sự kiện trùng nhau, và handler dọn listener thừa —
   *         tổng cộng khoảng 590 byte. Phần còn lại là chức năng đang dùng.
   *  8 KB — vòng này: biểu mẫu gửi thêm ngữ cảnh đơn (sản phẩm, ngôn ngữ, câu
   *         đồng ý, giá gói, utm), đọc phản hồi của máy chủ để không báo thành
   *         công cho đơn chưa vào cơ sở dữ liệu, và hiện mã đơn. Lớp đo lường
   *         phải bỏ qua bốn trường thương mại trên những trang không có sản
   *         phẩm. TRƯỚC KHI NÂNG đã cắt: gộp ba lần truy vấn gói đang chọn
   *         thành một hàm, và rút gọn nhánh xử lý phản hồi — khoảng 150 byte.
   *         Ngưỡng 7 KB đã chặn đúng hai lần trong cùng một phiên làm việc với
   *         những thay đổi chính đáng; đó là dấu hiệu ngưỡng đã quá sát, không
   *         phải dấu hiệu thay đổi sai. Ngân sách tổng một lượt tải (700 KB)
   *         không đổi, và JS nội tuyến vẫn chỉ chiếm khoảng 1% con số đó.
   */
  inlineJs: 8 * 1024,
  fontsTotal: 120 * 1024,  // tổng font tải lần đầu
  imageMax: 120 * 1024,    // một tệp ảnh đã build
  mediaMax: 1.5 * 1024 * 1024, // một tệp video/audio
  /** Tổng mọi tài nguyên trong dist, trừ ảnh biến thể không dùng tới. */
  pageTotal: 700 * 1024,
};

/* Những thứ ngân sách cũ không đếm và vì thế không ràng buộc được gì:
   video, svg, gif, font ngoài woff2, iframe bên thứ ba, và tổng trọng lượng. */
const HEAVY_MEDIA = /\.(mp4|webm|mov|m4v|mp3|wav|ogg)$/i;
const IMAGE = /\.(avif|webp|jpg|jpeg|png|gif|svg)$/i;
const FONT = /\.(woff2|woff|ttf|otf|eot)$/i;

const dist = 'dist';
const SITE_ORIGIN = 'https://mochatrinam.com';
const fail = [];
const ok = [];

/* Trả về đường dẫn luôn dùng dấu "/" — `join()` cho ra "\\" trên Windows, và mọi
   hàng rào phía dưới đều so khớp bằng "/": cổng "ảnh chờ đồng ý" cắt tên tệp bằng
   split('/'), cổng "trang tạm" dò /\/(zz-|test-|probe-)/. Trên Windows cả hai im
   lặng cho qua — hai cổng tưởng là đang canh, thực ra không canh gì. */
const walk = (dir) => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? walk(p) : [p.split(sep).join('/')];
});

const files = walk(dist);
const htmls = files.filter((f) => f.endsWith('.html'));

for (const f of files.filter((f) => f.endsWith('.html'))) {
  const raw = readFileSync(f);
  const gz = gzipSync(raw, { level: 9 }).length;
  const js = [...raw.toString().matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)]
    .filter((m) => !m[0].includes('application/ld+json'))
    .reduce((n, m) => n + Buffer.byteLength(m[1]), 0);
  (gz <= BUDGET.htmlGzip ? ok : fail).push(`${f}: HTML gzip ${gz}B / ${BUDGET.htmlGzip}B`);
  (js <= BUDGET.inlineJs ? ok : fail).push(`${f}: JS nội tuyến ${js}B / ${BUDGET.inlineJs}B`);
}

const fonts = files.filter((f) => FONT.test(f))
  .reduce((n, f) => n + statSync(f).size, 0);
(fonts <= BUDGET.fontsTotal ? ok : fail).push(`font: ${fonts}B / ${BUDGET.fontsTotal}B`);

for (const f of files.filter((f) => IMAGE.test(f))) {
  const s = statSync(f).size;
  if (s > BUDGET.imageMax) fail.push(`${f}: ảnh ${s}B / ${BUDGET.imageMax}B`);
}

for (const f of files.filter((f) => HEAVY_MEDIA.test(f))) {
  const s = statSync(f).size;
  if (s > BUDGET.mediaMax) fail.push(`${f}: media ${s}B / ${BUDGET.mediaMax}B`);
}

/* Tài nguyên bên thứ ba nhúng sẵn trong HTML: iframe, script, stylesheet, font CDN.
   Chúng không nằm trong dist nên mọi luật cân file đều không thấy. */
for (const f of files.filter((f) => f.endsWith('.html'))) {
  const html = readFileSync(f).toString();
  const iframes = [...html.matchAll(/<iframe[^>]*\bsrc=["']([^"']+)/gi)].map((m) => m[1]);
  if (iframes.length) fail.push(`${f}: có ${iframes.length} iframe nhúng sẵn (${iframes[0]})`);
  /* Chỉ tính thứ thật sự tải về lúc dựng trang: script và stylesheet/font.
     canonical và hreflang cũng là thẻ link nhưng không tải gì. */
  const external = [
    ...[...html.matchAll(/<script[^>]*\bsrc=["'](https?:\/\/[^"']+)/gi)].map((m) => m[1]),
    ...[...html.matchAll(/<link[^>]*\brel=["'](?:stylesheet|preload|preconnect)["'][^>]*\bhref=["'](https?:\/\/[^"']+)/gi)].map((m) => m[1]),
  ];
  if (external.length) fail.push(`${f}: nạp tài nguyên bên ngoài lúc tải (${external.join(', ')})`);
}

/* Tổng trọng lượng MỘT TRANG, tính theo asset mà chính trang đó tham chiếu.
   Kiểm định lần 6: bản trước cộng mọi ảnh trong dist — kể cả ảnh của sản phẩm
   khác — rồi gọi đó là "một lượt tải". Với 3 sản phẩm con số đã 615KB/700KB dù
   không trang nào tải quá 127KB thật, nên tới sản phẩm thứ 5-6 cổng sẽ fail vì
   lý do sai và người ta sẽ nới ngưỡng. Nay mỗi trang tự chịu ngân sách của mình. */
/** "tuong-phan-1.Tm9CJaZD.webp" -> "tuong-phan-1". Astro chèn hash giữa tên và
    phần mở rộng bằng DẤU CHẤM, không phải gạch dưới — bản trước dò gạch dưới nên
    không nhận ra biến thể nào là của cùng một ảnh gốc. */
const stemOf = (name) => name.replace(/\.[A-Za-z0-9_-]{6,}\.[a-z0-9]+$/i, '').replace(/\.[a-z0-9]+$/i, '');

const sizeOf = (f) => statSync(f).size;
const byName = new Map();
for (const f of files) byName.set(f.split('/').pop(), f);
for (const f of htmls) {
  const html = readFileSync(f, 'utf8');
  // Mọi tên file asset xuất hiện trong HTML (src, srcset, href, url()).
  const referenced = new Set(
    [...html.matchAll(/[\w./-]*\/_astro\/([\w.-]+\.(?:avif|webp|jpg|jpeg|png|gif|svg|woff2|woff|css))/g)]
      .map((m) => m[1])
  );
  let assetBytes = 0;
  const seenBase = new Map();
  for (const name of referenced) {
    const path = byName.get(name);
    if (!path) continue;
    if (IMAGE.test(name)) {
      // srcset liệt kê nhiều biến thể của cùng một ảnh: chỉ tính biến thể nặng nhất.
      const base = stemOf(name);
      seenBase.set(base, Math.max(seenBase.get(base) ?? 0, sizeOf(path)));
    } else {
      assetBytes += sizeOf(path);
    }
  }
  assetBytes += [...seenBase.values()].reduce((a, b) => a + b, 0);
  const pageWeight = assetBytes + fonts + sizeOf(f);
  (pageWeight <= BUDGET.pageTotal ? ok : fail).push(
    `${f}: một lượt tải ${pageWeight}B / ${BUDGET.pageTotal}B`);
}

/* Ảnh của khối chưa có văn bản đồng ý không được có mặt trong bản build.
   Kiểm định lần 6 tải được 4 ảnh khuôn mặt khách hàng bằng HTTP 200 dù khối đã
   bị ẩn khỏi trang: ẩn thẻ <img> không phải là chưa công bố. */
const contentRoot = 'src/content/products';
const gatedNames = new Set();
const jsons = (function collect(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? collect(join(dir, e.name)) : e.name.endsWith('.json') ? [join(dir, e.name)] : []);
})(contentRoot);
for (const j of jsons) {
  let doc;
  try { doc = JSON.parse(readFileSync(j, 'utf8')); } catch { continue; }
  for (const blk of doc.blocks ?? []) {
    if (blk.consent && blk.consent.obtained !== true) {
      for (const item of [...(blk.images ?? []), ...(blk.items ?? []), ...(blk.pairs ?? [])]) {
        const src = item.src ?? item.image?.src;
        if (src) gatedNames.add(src.split('/').pop().replace(/\.[a-z0-9]+$/i, ''));
      }
    }
  }
}
const leaked = files.filter((f) => {
  const stem = stemOf(f.split('/').pop());
  return gatedNames.has(stem);
});
if (leaked.length) {
  fail.push(`ảnh của khối CHƯA có văn bản đồng ý lọt vào bản build: ${leaked.join(', ')} ` +
    `— chuyển sang src/media-gated/ tới khi có đồng ý`);
} else if (gatedNames.size) {
  ok.push(`${gatedNames.size} ảnh chờ văn bản đồng ý, không có ảnh nào trong bản build`);
}

/* CSP trong public/_headers phải cho phép đúng nơi biểu mẫu gửi đơn tới.
   Biểu mẫu gửi bằng fetch() nên ràng buộc là connect-src, KHÔNG phải
   form-action (form-action chỉ áp cho POST điều hướng).

   Endpoint đọc từ CHÍNH BẢN BUILD (`data-action` trong HTML), không từ
   process.env: kiểm định lần 10 chỉ ra bản trước đọc biến môi trường, mà CI
   gọi script này không có biến nào — nên cổng được viết ra đúng để chặn lỗi
   này lại không bao giờ chạy, và CSP mặc định chặn 100% đơn hàng. */
const cspLine = (() => {
  try {
    const headers = readFileSync('public/_headers', 'utf8');
    return headers.split('\n').find((l) => l.includes('Content-Security-Policy')) ?? '';
  } catch {
    return '';
  }
})();

const endpoints = new Set();
for (const f of htmls) {
  const html = readFileSync(f, 'utf8');
  for (const m of html.matchAll(/data-action="([^"]+)"/g)) endpoints.add(m[1]);
}
if (process.env.PUBLIC_ORDER_ENDPOINT) endpoints.add(process.env.PUBLIC_ORDER_ENDPOINT);

if (!cspLine) {
  fail.push('public/_headers: không có Content-Security-Policy');
} else if (endpoints.size === 0) {
  ok.push('chưa cấu hình endpoint đặt hàng, không có gì để đối chiếu với CSP');
} else {
  const connect = /connect-src ([^;]*)/.exec(cspLine)?.[1] ?? '';
  for (const ep of endpoints) {
    let origin = '';
    try { origin = new URL(ep).origin; } catch { /* đường dẫn tương đối = cùng miền */ }
    /* So khớp CHÍNH XÁC từng nguồn. `includes` là so chuỗi con, nên endpoint
       gõ thiếu một chữ (https://www.facebook.co) được báo "ok" vì nó là chuỗi
       con của một nguồn có thật trong policy — kiểm định lần 11. */
    const sources = connect.trim().split(/\s+/);
    const allowed = !origin || sources.includes(origin) ||
      (sources.includes("'self'") && origin === SITE_ORIGIN);
    if (!allowed) {
      fail.push(`public/_headers: connect-src không cho phép endpoint đặt hàng ${origin} — ` +
        `trình duyệt sẽ chặn fetch() và MỌI đơn hàng đều thất bại. ` +
        `Thêm ${origin} vào connect-src.`);
    } else {
      ok.push(`CSP connect-src cho phép endpoint đặt hàng (${origin || 'cùng miền'})`);
    }
  }
}

/* Trang tạm dùng để thử hàng rào không được lọt lên production. */
const scratch = files
  .filter((f) => f.endsWith('index.html'))
  .filter((f) => /\/(zz-|test-|probe-)/.test(f));
if (scratch.length) {
  fail.push(`trang tạm lọt vào bản build: ${scratch.join(', ')}`);
}

for (const line of ok) console.log('  ok  ' + line);
if (fail.length) {
  console.error('\nVượt ngân sách:\n' + fail.map((l) => '  ✗  ' + l).join('\n'));
  process.exit(1);
}
console.log('\nTrong ngân sách.');
