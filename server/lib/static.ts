/**
 * Phục vụ dist/ khi chạy trong Docker, với ĐÚNG các header bảo mật mà
 * public/_headers khai cho Cloudflare (CSP, HSTS, nosniff, cache).
 *
 * Đọc lại chính file _headers thay vì chép header sang đây: CSP chỉ được khai ở
 * một chỗ, và `check-budget.mjs` đang đối chiếu endpoint đặt hàng với đúng chỗ đó.
 */
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, normalize, extname, resolve as resolvePath, sep } from 'node:path';
import { gzipSync, brotliCompressSync, constants } from 'node:zlib';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml; charset=utf-8',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.avif': 'image/avif', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json',
};
const COMPRESSIBLE = /^(text\/|application\/(json|xml|manifest)|image\/svg)/;

interface Rule { pattern: RegExp; headers: [string, string][] }

/** Cú pháp _headers của Cloudflare: dòng đường dẫn, rồi các dòng "  Tên: giá trị". */
export function parseHeaders(text: string): Rule[] {
  const rules: Rule[] = [];
  let cur: Rule | null = null;
  for (const raw of text.split(/\r?\n/)) {
    if (!raw.trim() || raw.trim().startsWith('#')) continue;
    if (!/^\s/.test(raw)) {
      const glob = raw.trim().replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
      cur = { pattern: new RegExp(`^${glob}$`), headers: [] };
      rules.push(cur);
    } else if (cur) {
      const i = raw.indexOf(':');
      if (i > 0) cur.headers.push([raw.slice(0, i).trim(), raw.slice(i + 1).trim()]);
    }
  }
  return rules;
}

export function createStatic(distDir: () => string) {
  const cache = new Map<string, { mtime: number; raw: Buffer; gz?: Buffer; br?: Buffer }>();
  let rules: Rule[] = [];
  let rulesFrom = '';

  const loadRules = () => {
    const f = join(distDir(), '_headers');
    if (f === rulesFrom) return;
    rules = existsSync(f) ? parseHeaders(readFileSync(f, 'utf8')) : [];
    rulesFrom = f;
  };

  function headersFor(path: string): Headers {
    loadRules();
    const h = new Headers();
    for (const r of rules) if (r.pattern.test(path)) for (const [k, v] of r.headers) h.set(k, v);
    return h;
  }

  function resolve(pathname: string): string | null {
    const dist = resolvePath(distDir());
    let decoded: string;
    try { decoded = decodeURIComponent(pathname); } catch { return null; }
    /* Chặn đi ra ngoài dist/ bằng ĐƯỜNG DẪN ĐÃ CHUẨN HOÁ, không bằng dò chuỗi "..":
       Astro đặt tên bundle CSS chính là "_..<hash>.css" (từ trang [...path].astro),
       và bản đầu dò chuỗi con nên trả 404 cho chính file CSS đó — trang mất hết
       định dạng. Chỉ một ĐOẠN đường dẫn đúng bằng ".." mới là đi ngược thư mục. */
    if (decoded.split(/[/\\]/).includes('..') || decoded.includes('\0')) return null;
    let f = resolvePath(dist, '.' + normalize('/' + decoded));
    if (f !== dist && !f.startsWith(dist + sep)) return null;
    if (existsSync(f) && statSync(f).isDirectory()) f = join(f, 'index.html');
    return existsSync(f) && statSync(f).isFile() ? f : null;
  }

  let cacheFor = '';
  return async function serve(request: Request): Promise<Response> {
    const url = new URL(request.url);
    /* Mỗi lần xuất bản là một thư mục builds/<số> mới: bỏ bộ đệm của bản cũ, không thì RAM
       tăng theo số lần xuất bản. */
    const dir = distDir();
    if (dir !== cacheFor) { cache.clear(); cacheFor = dir; }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method Not Allowed', { status: 405, headers: { allow: 'GET, HEAD' } });
    }
    /* trailingSlash: 'always' trong astro.config — một dạng URL duy nhất. */
    if (!extname(url.pathname) && !url.pathname.endsWith('/')) {
      /* "//evil.com/x" là URL tương đối theo giao thức — chuyển hướng nguyên văn sẽ đưa khách
         sang tên miền khác (open redirect). Gộp các dấu "/" đầu thành một. */
      return new Response(null, { status: 308, headers: { location: '/' + url.pathname.replace(/^\/+/, '') + '/' + url.search } });
    }
    let file = resolve(url.pathname);
    let status = 200;
    if (!file) { file = resolve('/404.html'); status = 404; }
    if (!file) return new Response('Not found', { status: 404 });

    const st = statSync(file);
    let entry = cache.get(file);
    if (!entry || entry.mtime !== st.mtimeMs) { entry = { mtime: st.mtimeMs, raw: readFileSync(file) }; cache.set(file, entry); }

    const type = TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream';
    const h = headersFor(url.pathname);
    h.set('content-type', type);
    if (!h.has('cache-control')) h.set('cache-control', type.startsWith('text/html') ? 'no-cache' : 'public, max-age=3600');

    let body: Buffer = entry.raw;
    const accept = request.headers.get('accept-encoding') ?? '';
    if (COMPRESSIBLE.test(type) && entry.raw.length > 1024) {
      h.set('vary', 'accept-encoding');
      if (/\bbr\b/.test(accept)) {
        entry.br ??= brotliCompressSync(entry.raw, { params: { [constants.BROTLI_PARAM_QUALITY]: 9 } });
        body = entry.br; h.set('content-encoding', 'br');
      } else if (/\bgzip\b/.test(accept)) {
        entry.gz ??= gzipSync(entry.raw, { level: 9 });
        body = entry.gz; h.set('content-encoding', 'gzip');
      }
    }
    /* Buffer là Uint8Array — Response nhận được lúc chạy; ép kiểu chỉ vì định
       nghĩa kiểu DOM của TypeScript chưa khớp Uint8Array<ArrayBufferLike>. */
    return new Response(request.method === 'HEAD' ? null : (body as unknown as BodyInit), { status, headers: h });
  };
}
