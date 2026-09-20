/**
 * Báo cáo SEO kiểm chứng được — đọc từ bản build thật trong dist/, không đọc
 * mã nguồn và không tin bất cứ điều gì tài liệu nói.
 *
 * Lý do tồn tại: qua mười mấy vòng kiểm định, phần SEO chỉ được khẳng định
 * bằng lời. Kịch bản này biến từng khẳng định thành một phép đo có thể chạy
 * lại: mỗi dòng in ra kèm giá trị đo được, để người đọc tự đối chiếu.
 *
 *   node scripts/seo-report.mjs            # in báo cáo, thoát 1 nếu có lỗi
 *   node scripts/seo-report.mjs --md FILE  # đồng thời ghi báo cáo Markdown
 */
import fs from 'node:fs';
import path from 'node:path';

const DIST = path.resolve('dist');
const SITE = 'https://mochatrinam.com';

if (!fs.existsSync(path.join(DIST, 'index.html'))) {
  console.error('Chưa có dist/. Chạy `npm run build` trước.');
  process.exit(1);
}

/* ---------- tiện ích đọc HTML bằng biểu thức chính quy ----------
   Không dùng trình phân tích DOM để kịch bản này không có phụ thuộc: nếu nó
   cần cài gì mới chạy được thì sẽ không ai chạy. */
const attr = (tag, name) => {
  const m = tag.match(new RegExp(`${name}\\s*=\\s*"([^"]*)"`, 'i'));
  return m ? m[1] : null;
};
const tagsOf = (html, name) =>
  html.match(new RegExp(`<${name}\\b[^>]*>`, 'gi')) || [];
const decode = (s) =>
  s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
   .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');

const pages = [];
const walk = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.html')) pages.push(p);
  }
};
walk(DIST);

/** URL công khai của một tệp trong dist, luôn có dấu / cuối. */
const urlOf = (file) => {
  const rel = path.relative(DIST, file).split(path.sep).join('/');
  if (rel === 'index.html') return `${SITE}/`;
  if (rel.endsWith('/index.html')) return `${SITE}/${rel.slice(0, -'index.html'.length)}`;
  return `${SITE}/${rel}`;
};

/* Trang lỗi không phải nội dung được đánh chỉ mục — kiểm riêng. */
const contentPages = pages.filter((p) => path.basename(p) !== '404.html');

const rows = [];
let fails = 0;
/** @param ok true = đạt, false = lỗi, null = chỉ ghi nhận */
const check = (scope, name, ok, detail) => {
  rows.push({ scope, name, ok, detail });
  if (ok === false) fails++;
};

/* ====================== 1. Từng trang nội dung ====================== */
const titles = new Map();
const descs = new Map();

for (const file of contentPages) {
  const html = fs.readFileSync(file, 'utf8');
  const url = urlOf(file);
  const S = url.replace(SITE, '') || '/';

  // --- thẻ tiêu đề ---
  const title = decode((html.match(/<title>([\s\S]*?)<\/title>/i) || [, ''])[1]).trim();
  check(S, 'title dài 15–65 ký tự', title.length >= 15 && title.length <= 65,
    `${title.length} ký tự: "${title}"`);
  if (title) titles.set(title, (titles.get(title) || 0) + 1);

  // --- mô tả ---
  const descTag = tagsOf(html, 'meta').find((t) => attr(t, 'name') === 'description');
  const desc = descTag ? decode(attr(descTag, 'content') || '') : '';
  check(S, 'description dài 70–160 ký tự', desc.length >= 70 && desc.length <= 160,
    `${desc.length} ký tự`);
  if (desc) descs.set(desc, (descs.get(desc) || 0) + 1);

  // --- canonical tự trỏ ---
  const canon = tagsOf(html, 'link').find((t) => attr(t, 'rel') === 'canonical');
  const canonHref = canon ? attr(canon, 'href') : null;
  check(S, 'canonical tự trỏ, tuyệt đối', canonHref === url, `${canonHref}`);

  // --- meta robots ---
  const rb = tagsOf(html, 'meta').find((t) => attr(t, 'name') === 'robots');
  const rbv = rb ? attr(rb, 'content') : '';
  check(S, 'không noindex', !/noindex/i.test(rbv || ''), rbv || '(không khai báo)');

  // --- lang khớp hreflang tự trỏ ---
  const lang = attr((html.match(/<html\b[^>]*>/i) || [''])[0], 'lang');
  const alts = tagsOf(html, 'link')
    .filter((t) => attr(t, 'rel') === 'alternate' && attr(t, 'hreflang'))
    .map((t) => ({ lang: attr(t, 'hreflang'), href: attr(t, 'href') }));
  const self = alts.find((a) => a.href === url && a.lang !== 'x-default');
  check(S, 'lang trên <html> khớp hreflang tự trỏ', !!self && self.lang === lang,
    `lang=${lang}, hreflang tự trỏ=${self ? self.lang : '(không có)'}`);
  check(S, 'có hreflang x-default', alts.some((a) => a.lang === 'x-default'),
    alts.map((a) => a.lang).join(', '));

  // --- đúng một h1 ---
  const h1s = html.match(/<h1\b[^>]*>/gi) || [];
  check(S, 'đúng một <h1>', h1s.length === 1, `${h1s.length} thẻ`);

  // --- thứ bậc tiêu đề không nhảy cấp ---
  const levels = [...html.matchAll(/<h([1-6])\b/gi)].map((m) => +m[1]);
  let jump = null, prev = levels[0];
  for (const l of levels.slice(1)) { if (l > prev + 1) { jump = `h${prev} -> h${l}`; break; } prev = l; }
  check(S, 'không nhảy cấp tiêu đề', jump === null, jump || `chuỗi ${levels.join('')}`);

  // --- ảnh có alt ---
  const imgs = tagsOf(html, 'img');
  const noAlt = imgs.filter((t) => attr(t, 'alt') === null);
  check(S, 'mọi <img> có thuộc tính alt', noAlt.length === 0,
    `${imgs.length} ảnh, ${noAlt.length} thiếu alt`);

  // --- Open Graph ---
  const og = {};
  for (const t of tagsOf(html, 'meta')) {
    const p = attr(t, 'property');
    if (p && p.startsWith('og:')) og[p] = attr(t, 'content');
  }
  const needOg = ['og:title', 'og:description', 'og:url', 'og:image', 'og:type', 'og:locale'];
  const missOg = needOg.filter((k) => !og[k]);
  check(S, 'đủ thẻ Open Graph bắt buộc', missOg.length === 0,
    missOg.length ? `thiếu ${missOg.join(', ')}` : needOg.length + ' thẻ');
  check(S, 'og:image là URL tuyệt đối', /^https?:\/\//.test(og['og:image'] || ''),
    og['og:image'] || '(không có)');
  check(S, 'og:url khớp canonical', og['og:url'] === canonHref, og['og:url'] || '(không có)');

  // --- dữ liệu có cấu trúc ---
  const blocks = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)]
    .map((m) => m[1]);
  let parsed = [];
  let parseErr = null;
  try { parsed = blocks.map((b) => JSON.parse(b)); }
  catch (e) { parseErr = e.message; }
  check(S, 'JSON-LD phân tích được', parseErr === null, parseErr || `${blocks.length} khối`);

  const flat = [];
  const collect = (n) => {
    if (Array.isArray(n)) return n.forEach(collect);
    if (n && typeof n === 'object') { flat.push(n); Object.values(n).forEach(collect); }
  };
  parsed.forEach(collect);
  const types = new Set(flat.map((n) => n['@type']).filter(Boolean));
  /* Yêu cầu khác nhau theo LOẠI trang. Bản trước đòi mọi trang phải có Product
     và Offer — đúng khi site chỉ có landing, sai từ lúc có trang chủ, trang dòng
     và bài viết; và một phép đo sai thì tệ hơn không đo, vì nó dạy người đọc bỏ
     qua màu đỏ. */
  const isProduct = types.has('Product');
  const isArticle = types.has('Article');
  const isCollection = types.has('CollectionPage');
  const kind = isProduct ? 'sản phẩm' : isArticle ? 'bài viết' : isCollection ? 'danh mục' : 'trang chủ';

  check(S, 'có Organization và một node trang',
    types.has('Organization') && (types.has('WebPage') || types.has('CollectionPage')),
    `${kind}: ${[...types].sort().join(', ')}`);

  if (isProduct) {
    check(S, 'trang sản phẩm có node Product', types.has('Product'), 'có');
  }
  if (isArticle) {
    const art = flat.find((n) => n['@type'] === 'Article');
    const missArt = ['headline', 'datePublished', 'author', 'publisher']
      .filter((k) => !art?.[k]);
    check(S, 'Article đủ trường bắt buộc', missArt.length === 0,
      missArt.length ? `thiếu ${missArt.join(', ')}` : 'headline, datePublished, author, publisher');
  }
  if (isCollection) {
    const list = flat.find((n) => n['@type'] === 'ItemList');
    check(S, 'trang danh mục có ItemList khớp số mục',
      !!list && Array.isArray(list.itemListElement)
      && list.numberOfItems === list.itemListElement.length,
      list ? `${list.numberOfItems} mục` : 'không có ItemList');
  }

  // Quyết định của dự án: KHÔNG khai aggregateRating khi chưa có đánh giá
  // thật kiểm chứng được. Đây là phép đo giữ cho quyết định đó không trôi.
  check(S, 'không khai aggregateRating/review bịa',
    !flat.some((n) => n.aggregateRating || n.review),
    flat.some((n) => n.aggregateRating) ? 'CÓ aggregateRating' : 'không có');

  const offers = flat.filter((n) => n['@type'] === 'Offer');
  for (const [i, o] of offers.entries()) {
    const miss = ['price', 'priceCurrency', 'availability', 'url'].filter((k) => !o[k]);
    check(S, `Offer #${i + 1} đủ trường bắt buộc`, miss.length === 0,
      miss.length ? `thiếu ${miss.join(', ')}` : `${o.price} ${o.priceCurrency}`);
  }
  if (isProduct) check(S, 'trang sản phẩm có ít nhất một Offer', offers.length > 0, `${offers.length} Offer`);

  // Giá trong JSON-LD phải bằng giá hiện trên trang, nếu không Google báo
  // "giá không khớp" và bỏ đoạn trích giàu.
  /* Bóc CẢ <style>, không chỉ <script>.
     Bản trước chỉ bóc <script>, nên khi CSS còn nhúng thẳng vào HTML thì mỗi
     selector, mỗi tên thuộc tính đều được đếm là một "từ hiển thị". Phép đo
     "nội dung hiển thị > 300 từ" vì thế luôn xanh trên mọi trang, kể cả trang
     rỗng — nó không đo gì suốt từ đầu. Chuyển CSS ra file rời làm lộ ra điều
     đó: hai trang chính sách tụt ngay xuống 165 và 223 từ. */
  const text = decode(html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' '));
  // Bỏ dấu phân nhóm trước khi so: trang tiếng Việt viết 1.050.000, trang
  // tiếng Anh viết 1,050,000 — cùng một con số.
  const digitsOnly = text.replace(/(?<=\d)[.,\u00a0\u202f ](?=\d{3}\b)/g, '');
  const priceMismatch = offers.filter((o) => {
    const n = Number(o.price);
    if (!Number.isFinite(n)) return true;
    return !digitsOnly.includes(String(n));
  });
  check(S, 'giá trong JSON-LD xuất hiện trên trang', priceMismatch.length === 0,
    priceMismatch.length ? `lệch: ${priceMismatch.map((o) => o.price).join(', ')}` : 'khớp');

  // --- liên kết nội bộ không gãy ---
  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
  const hrefs = [...html.matchAll(/<a\b[^>]*href="([^"]+)"/gi)].map((m) => m[1]);
  const brokenAnchor = hrefs.filter((h) => h.startsWith('#') && !ids.has(h.slice(1)));
  check(S, 'neo trong trang đều tồn tại', brokenAnchor.length === 0,
    brokenAnchor.join(', ') || `${hrefs.filter((h) => h.startsWith('#')).length} neo`);

  const brokenLocal = hrefs
    .filter((h) => h.startsWith('/') && !h.startsWith('//'))
    .filter((h) => {
      const rel = h.split('#')[0].split('?')[0].replace(/^\//, '');
      const f = path.join(DIST, rel);
      return !(fs.existsSync(f) && !fs.statSync(f).isDirectory()) &&
             !fs.existsSync(path.join(DIST, rel, 'index.html'));
    });
  check(S, 'liên kết nội bộ đều tồn tại trong dist', brokenLocal.length === 0,
    brokenLocal.join(', ') || 'không gãy');

  // --- văn bản hiển thị đủ để xếp hạng ---
  const words = text.split(/\s+/).filter((w) => w.length > 1).length;
  check(S, 'nội dung hiển thị > 300 từ', words > 300, `${words} từ`);
}

/* ====================== 2. Giữa các trang ====================== */
const dupTitle = [...titles].filter(([, n]) => n > 1);
check('site', 'title không trùng giữa các trang', dupTitle.length === 0,
  dupTitle.map(([t]) => t).join(' | ') || `${titles.size} title khác nhau`);
const dupDesc = [...descs].filter(([, n]) => n > 1);
check('site', 'description không trùng giữa các trang', dupDesc.length === 0,
  `${descs.size} mô tả khác nhau`);

/* hreflang phải đối xứng: A trỏ B thì B phải trỏ lại A. Thiếu chiều về là
   lỗi Google bỏ qua cả cụm, và là lỗi không thấy được khi chỉ đọc một trang. */
const altMap = new Map();
for (const file of contentPages) {
  const html = fs.readFileSync(file, 'utf8');
  altMap.set(urlOf(file), tagsOf(html, 'link')
    .filter((t) => attr(t, 'rel') === 'alternate' && attr(t, 'hreflang') && attr(t, 'hreflang') !== 'x-default')
    .map((t) => ({ lang: attr(t, 'hreflang'), href: attr(t, 'href') })));
}
const asym = [];
for (const [url, alts] of altMap) {
  for (const a of alts) {
    const back = altMap.get(a.href);
    if (!back) { asym.push(`${url} -> ${a.href} (không có trang đích)`); continue; }
    if (!back.some((b) => b.href === url)) asym.push(`${a.href} không trỏ lại ${url}`);
  }
}
check('site', 'hreflang đối xứng hai chiều', asym.length === 0,
  asym.join('; ') || `${altMap.size} trang, mỗi trang ${[...altMap.values()][0].length} bản dịch`);

/* ============ 2b. Liên kết nội bộ: trang mồ côi và độ sâu ============ */
/* Phép đo quan trọng nhất khi site có nhiều tầng. Một trang không ai trỏ tới
   thì gần như không được thu thập, dù nó nằm trong sitemap — và không cách nào
   phát hiện bằng cách đọc từng file. */
const allUrls = contentPages.map(urlOf);
const linkGraph = new Map();
for (const file of contentPages) {
  const html = fs.readFileSync(file, 'utf8');
  const from = urlOf(file);
  const out = new Set();
  for (const m of html.matchAll(/<a\b[^>]*href="([^"]+)"/gi)) {
    const href = m[1].split('#')[0].split('?')[0];
    if (!href.startsWith('/') || href.startsWith('//')) continue;
    const abs = `${SITE}${href.endsWith('/') || /\.[a-z0-9]+$/i.test(href) ? href : `${href}/`}`;
    if (abs !== from && allUrls.includes(abs)) out.add(abs);
  }
  linkGraph.set(from, out);
}

/* Lan từ trang chủ của TỪNG ngôn ngữ: bản tiếng Anh không được phép chỉ tới
   được qua bộ chuyển ngôn ngữ. */
const homes = allUrls.filter((u) => u === `${SITE}/` || /^https?:\/\/[^/]+\/[a-z]{2}\/$/.test(u));
const depth = new Map(homes.map((h) => [h, 0]));
const queue = [...homes];
while (queue.length) {
  const cur = queue.shift();
  for (const next of linkGraph.get(cur) || []) {
    if (depth.has(next)) continue;
    depth.set(next, depth.get(cur) + 1);
    queue.push(next);
  }
}

const orphans = allUrls.filter((u) => !depth.has(u));
check('liên kết', 'không có trang mồ côi', orphans.length === 0,
  orphans.join(' ') || `${allUrls.length} trang đều tới được từ trang chủ`);

const tooDeep = [...depth].filter(([, d]) => d > 3);
check('liên kết', 'mọi trang cách trang chủ tối đa 3 cú nhấp', tooDeep.length === 0,
  tooDeep.map(([u, d]) => `${u} (${d})`).join(' ') || `sâu nhất: ${Math.max(...depth.values())}`);

/* Trang dòng sản phẩm và bài viết chỉ có giá trị khi chúng dẫn được sang nơi
   bán hàng; một bài viết cụt là một bài đọc xong rồi thoát. Trang danh mục
   (dòng sản phẩm) cũng tính là đích thương mại — nó liệt kê sản phẩm. */
const productUrls = new Set(
  contentPages.map((f) => ({ f, html: fs.readFileSync(f, 'utf8') }))
    .filter(({ html }) => /"@type":"Product"/.test(html))
    .map(({ f }) => urlOf(f)));
const commercialUrls = new Set([
  ...productUrls,
  ...contentPages.map((f) => ({ f, html: fs.readFileSync(f, 'utf8') }))
    .filter(({ html }) => /"@type":"CollectionPage"/.test(html) && /"@type":"ItemList"/.test(html))
    .map(({ f }) => urlOf(f)),
]);
const noPathToProduct = [...linkGraph]
  .filter(([u]) => !commercialUrls.has(u) && !u.endsWith('/404.html'))
  .filter(([, out]) => ![...out].some((o) => commercialUrls.has(o)))
  .map(([u]) => u);
check('liên kết', 'mọi trang dẫn được sang nơi bán hàng',
  noPathToProduct.length === 0,
  noPathToProduct.join(' ') || `${commercialUrls.size} đích thương mại, đều có đường dẫn vào`);

/* ====================== 3. Sitemap, robots, llms ====================== */
const smPath = path.join(DIST, 'sitemap-0.xml');
const sm = fs.existsSync(smPath) ? fs.readFileSync(smPath, 'utf8') : '';
const smUrls = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const wanted = contentPages.map(urlOf);
check('sitemap', 'mọi trang nội dung có trong sitemap',
  wanted.every((u) => smUrls.includes(u)),
  `${smUrls.length}/${wanted.length}: ${smUrls.join(' ')}`);
check('sitemap', 'sitemap không chứa URL không tồn tại',
  smUrls.every((u) => wanted.includes(u)),
  smUrls.filter((u) => !wanted.includes(u)).join(' ') || 'sạch');
const lastmods = [...sm.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map((m) => m[1]);
check('sitemap', 'lastmod hợp lệ và không ở tương lai',
  lastmods.length > 0 && lastmods.every((d) => !Number.isNaN(Date.parse(d)) && Date.parse(d) <= Date.now()),
  lastmods.join(', '));
check('sitemap', 'sitemap khai hreflang xhtml:link',
  /xhtml:link/.test(sm), /xhtml:link/.test(sm) ? 'có' : 'không');

const rob = fs.existsSync(path.join(DIST, 'robots.txt'))
  ? fs.readFileSync(path.join(DIST, 'robots.txt'), 'utf8') : '';
check('robots', 'robots.txt khai sitemap đúng URL',
  rob.includes(`Sitemap: ${SITE}/sitemap-index.xml`), rob ? 'có' : 'thiếu robots.txt');
check('robots', 'không Disallow nhầm toàn site',
  !/^\s*Disallow:\s*\/\s*$/m.test(rob), 'không có Disallow: /');
const AI = ['GPTBot', 'OAI-SearchBot', 'ClaudeBot', 'PerplexityBot', 'Google-Extended', 'Applebot-Extended', 'CCBot'];
const missAI = AI.filter((b) => !new RegExp(`User-agent:\\s*${b}\\b`, 'i').test(rob));
check('robots', 'cho phép các crawler AI chính', missAI.length === 0,
  missAI.length ? `thiếu ${missAI.join(', ')}` : `${AI.length} tác tử`);

const llms = fs.existsSync(path.join(DIST, 'llms.txt'))
  ? fs.readFileSync(path.join(DIST, 'llms.txt'), 'utf8') : '';
check('llms', 'có llms.txt', llms.length > 0, `${llms.length} byte`);
/* llms.txt sinh từ dữ liệu; nếu một sản phẩm vắng mặt nghĩa là bộ sinh
   trượt khỏi nguồn dữ liệu thật. */
const missLlms = wanted.filter((u) => !llms.includes(u));
check('llms', 'llms.txt dẫn URL của mọi trang nội dung', missLlms.length === 0,
  missLlms.join(' ') || `${wanted.length} URL`);

/* ====================== 4. Trang 404 ====================== */
const p404 = path.join(DIST, '404.html');
if (fs.existsSync(p404)) {
  const h = fs.readFileSync(p404, 'utf8');
  const rb = tagsOf(h, 'meta').find((t) => attr(t, 'name') === 'robots');
  check('404', '404 khai noindex', /noindex/i.test(rb ? attr(rb, 'content') : ''),
    rb ? attr(rb, 'content') : '(không khai báo)');
  check('404', '404 không nằm trong sitemap', !smUrls.includes(`${SITE}/404.html`), 'không');
}

/* ====================== in ra ====================== */
const pass = rows.filter((r) => r.ok === true).length;
const W = Math.max(...rows.map((r) => r.scope.length));
let cur = null;
for (const r of rows) {
  if (r.scope !== cur) { cur = r.scope; console.log(`\n── ${cur} ${'─'.repeat(Math.max(0, 56 - cur.length))}`); }
  console.log(`  ${r.ok ? 'ĐẠT ' : 'LỖI '} ${r.name.padEnd(42)} ${r.detail}`);
}
console.log(`\n${pass}/${rows.length} phép đo đạt, ${fails} lỗi.`);

const mdArg = process.argv.indexOf('--md');
if (mdArg > -1 && process.argv[mdArg + 1]) {
  const out = [
    '<!-- Sinh tự động bởi scripts/seo-report.mjs — đừng sửa tay. -->',
    '# Báo cáo SEO (đo từ bản build)',
    '',
    `Đo lúc: ${new Date().toISOString()}  `,
    `Kết quả: **${pass}/${rows.length} phép đo đạt**, ${fails} lỗi.`,
    '',
    '| Phạm vi | Phép đo | Kết quả | Giá trị đo được |',
    '| --- | --- | --- | --- |',
    ...rows.map((r) => `| \`${r.scope}\` | ${r.name} | ${r.ok ? '✅' : '❌'} | ${String(r.detail).replace(/\|/g, '\\|')} |`),
    '',
    'Chạy lại: `npm run build && node scripts/seo-report.mjs`',
  ].join('\n');
  fs.writeFileSync(path.resolve(process.argv[mdArg + 1]), out + '\n');
  console.log(`Đã ghi ${process.argv[mdArg + 1]}`);
}

process.exit(fails ? 1 : 0);
