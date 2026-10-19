/**
 * Khởi động máy chủ (Docker / Ubuntu).
 *
 *   node --import ./scripts/shim/register.mjs server/main.ts
 *
 * Lúc khởi động:
 *   1. áp migration db/pg/*.sql
 *   2. chưa có tài khoản nào -> tạo từ ADMIN_BOOTSTRAP_USER / ADMIN_BOOTSTRAP_PASSWORD
 *   3. CSDL chưa có nội dung -> nạp nội dung đang có trong image (lần chạy đầu);
 *      đã có -> ĐỒNG BỘ bản code mới (SYNC_ON_BOOT=1, mặc định): thêm mục/ảnh mới, cập nhật mục
 *      chưa từng sửa trong trang quản trị, giữ nguyên mục nhân viên đã sửa (xem syncFromFiles)
 *   4. PUBLISH_ON_BOOT=1 (mặc định) -> build lại site từ CSDL ở nền; trong lúc đó
 *      vẫn phục vụ bản dist/ có sẵn trong image, nên khởi động lại không có lúc trắng trang.
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { connect, migrate } from './lib/db.ts';
import { bootstrapAdmin } from './lib/auth.ts';
import { seedRules } from './lib/chat-rules.ts';
import { importFromFiles, syncFromFiles } from './lib/content.ts';
import { publish } from './lib/publish.ts';
import { createApp } from './app.ts';
import { clientKey, purgeRateLimit } from './lib/rate-limit.ts';
import { purgeJourney } from './lib/journey.ts';
import { startPromoScheduler } from './lib/promo-server.ts';
import { isPublishing } from './lib/publish.ts';

const ROOT = process.cwd();
const PORT = Number(process.env.PORT ?? 8080);
const TRUST_PROXY = process.env.TRUST_PROXY === '1';
/* Giới hạn thân yêu cầu theo đường dẫn, áp TRƯỚC khi handler đọc: một yêu cầu
   chunked không khai Content-Length không được đọc hết 30MB vào RAM rồi mới bị từ chối. */
function maxBody(path: string) {
  if (path === '/admin/media') return 30 * 1024 * 1024;     // ảnh gốc trước khi nén
  if (path === '/api/chat') return 8 * 1024 * 1024;         // tối đa 3 ảnh đã thu nhỏ
  if (path.startsWith('/admin')) return 2 * 1024 * 1024;    // biểu mẫu nội dung JSON
  if (path === '/api/j') return 32 * 1024;                  // một lô sự kiện hành trình
  return 64 * 1024;                                         // đơn hàng, sự kiện chat
}

const log = (s: string) => console.log(`[mocha] ${s}`);
const sql = await connect();
await migrate(sql, join(ROOT, 'db/pg'), log);
await bootstrapAdmin(sql, log);
await seedRules(sql, ROOT, log);
const n = (await sql.query<{ n: number }>('SELECT count(*)::int AS n FROM content_entries')).rows[0].n;
if (n === 0) {
  const r = await importFromFiles(sql, ROOT, 'seed');
  log(`nạp nội dung lần đầu từ image: ${r.entries} nội dung, ${r.media} ảnh`);
} else if (process.env.SYNC_ON_BOOT !== '0') {
  const r = await syncFromFiles(sql, ROOT);
  log(`đồng bộ bản code mới: thêm ${r.added.length}, cập nhật ${r.updated.length}, bổ sung ${r.merged.length} nội dung; ` +
    `ảnh thêm ${r.mediaAdded}, cập nhật ${r.mediaUpdated}`);
  if (r.keptEdited.length) log(`giữ bản đã sửa trong trang quản trị (bản code mới KHÁC — kiểm tra lại): ${r.keptEdited.join(', ')}`);
  if (r.mediaKept.length) log(`giữ ảnh đã tải lên trong trang quản trị: ${r.mediaKept.join(', ')}`);
}
if (process.env.PUBLISH_ON_BOOT !== '0') {
  publish(sql, ROOT, 'boot').then((r) => log(`xuất bản lúc khởi động #${r.id}: ${r.ok ? 'thành công' : 'LỖI — xem /admin/publish'}`))
    .catch((e) => log(`xuất bản lúc khởi động lỗi: ${e.message}`));
}

const app = createApp({ sql, root: ROOT });

function toRequest(req: IncomingMessage): Request {
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.split(',')[0].trim();
  const proto = (TRUST_PROXY && first(req.headers['x-forwarded-proto'])) || 'http';
  const host = (TRUST_PROXY && first(req.headers['x-forwarded-host'])) || req.headers.host || 'localhost';
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (v === undefined || k === 'cf-connecting-ip') continue;   // không tin header này từ bên ngoài
    for (const x of Array.isArray(v) ? v : [v]) headers.append(k, x);
  }
  /* Handler đơn hàng + chat đọc IP ở cf-connecting-ip (chuẩn Cloudflare) để chống spam.
     Sau reverse proxy lấy mục CUỐI của X-Forwarded-For — mục do chính proxy của mình
     thêm vào; các mục trước do client tự khai, giả được. IPv6 gom theo khối /64. */
  const xff = TRUST_PROXY ? [req.headers['x-forwarded-for']].flat().join(',').split(',').map((x) => x.trim()).filter(Boolean) : [];
  const ip = xff.at(-1) || req.socket.remoteAddress;
  if (ip) headers.set('cf-connecting-ip', clientKey(ip));
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
  const limit = maxBody((req.url ?? '/').split('?')[0]);
  let size = 0;
  const body = hasBody ? Readable.toWeb(req.on('data', (c: Buffer) => {
    size += c.length;
    if (size > limit) req.destroy(new Error('body_too_large'));
  })) as ReadableStream : undefined;
  return new Request(`${proto}://${host}${req.url}`, { method: req.method, headers, body, duplex: 'half' } as RequestInit);
}

async function send(res: ServerResponse, r: Response) {
  const headers: Record<string, string | string[]> = {};
  r.headers.forEach((v, k) => { if (k !== 'set-cookie') headers[k] = v; });
  const cookies = r.headers.getSetCookie?.() ?? [];
  if (cookies.length) headers['set-cookie'] = cookies;
  res.writeHead(r.status, headers);
  if (!r.body) return res.end();
  res.end(Buffer.from(await r.arrayBuffer()));
}

const server = createServer(async (req, res) => {
  const declared = Number(req.headers['content-length'] ?? 0);
  if (declared > maxBody((req.url ?? '/').split('?')[0])) {
    res.writeHead(413, { 'content-type': 'text/plain; charset=utf-8', connection: 'close' });
    res.end('Yêu cầu quá lớn');
    req.destroy();
    return;
  }
  try { await send(res, await app(toRequest(req))); }
  catch (e) {
    if (!res.headersSent) res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Lỗi máy chủ');
    console.error('server_error', (e as Error).message);
  }
});
server.listen(PORT, () => log(`đang chạy ở cổng ${PORT}`));
/* Khuyến mãi tự bật / tự tắt: mỗi phút xem tập đợt đang chạy có đổi không; đổi thì xuất bản lại.
   PROMO_SCHEDULER=0 để tắt (chạy thử trên máy, khi không muốn bản build bị thay). */
if (process.env.PROMO_SCHEDULER !== '0') {
  startPromoScheduler(sql, { publish: (by) => publish(sql, ROOT, by), isPublishing, log });
}
/* Bảng rate_limit có một dòng cho mỗi IP / khách từng ghé — dọn mỗi giờ. */
setInterval(() => { purgeRateLimit(sql).catch((e) => console.error('purge_rate_limit_failed', e.message)); }, 3600_000).unref();
/* Hành trình khách giữ JOURNEY_RETENTION_DAYS ngày (mặc định 90) rồi xoá. */
setInterval(() => { purgeJourney(sql).catch((e) => console.error('purge_journey_failed', e.message)); }, 3600_000).unref();

const stop = async () => { log('dừng…'); server.close(); await sql.close(); process.exit(0); };
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
