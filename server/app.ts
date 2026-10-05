/**
 * Máy chủ của bản triển khai Docker: một tiến trình Node phục vụ
 *
 *   /api/orders          nhận đơn — ĐÚNG handler của Cloudflare (functions/api/orders.ts)
 *   /api/admin/orders    đọc/sửa đơn bằng Bearer ADMIN_TOKEN (xuất CSV, tự động hoá)
 *   /api/chat            chat — kịch bản hoặc webhook n8n (server/lib/chat.ts)
 *   /api/chat/event      sự kiện trong khung chat (mở, bấm thẻ, bấm đặt hàng) cho phân tích
 *   /api/admin/chats     xuất lịch sử chat (NDJSON) bằng Bearer ADMIN_TOKEN
 *   /admin/*             trang nhập liệu + đơn hàng + xuất bản (đăng nhập bằng tài khoản)
 *   /healthz             kiểm tra sống + CSDL
 *   mọi đường dẫn khác   file tĩnh trong dist/ với header bảo mật của public/_headers
 *
 * `createApp` nhận Request trả Response (chuẩn Web), nên bộ thử gọi thẳng được
 * mà không cần mở cổng mạng.
 */
import { join } from 'node:path';
import type { Sql } from './lib/db.ts';
import { d1 } from './lib/db.ts';
import { createStatic } from './lib/static.ts';
import { adminHandler } from './admin/app.ts';
import { currentSite } from './lib/publish.ts';
import { chatHandler, chatEventHandler, linkOrderToChat } from './lib/chat.ts';
import { chatExportHandler } from './lib/chat-analytics.ts';
import { onRequest as ordersHandler } from '../functions/api/orders.ts';
import { onRequest as adminOrdersHandler } from '../functions/api/admin/orders.ts';

export interface AppOptions {
  sql: Sql;
  root: string;
  env?: Record<string, string | undefined>;
  /** Cho bộ thử: thay fetch tới n8n. */
  fetch?: typeof fetch;
}

export function createApp(opts: AppOptions) {
  const { sql, root, env = process.env } = opts;
  const DB = d1(sql);
  const serveStatic = createStatic(() => currentSite(root));
  const cfEnv = { DB, IP_SALT: env.IP_SALT, ALLOWED_ORIGIN: env.ALLOWED_ORIGIN, ADMIN_TOKEN: env.ADMIN_TOKEN };
  const ctx = (request: Request) => ({ request, env: cfEnv, params: {}, data: {}, next: async () => new Response(null, { status: 404 }), waitUntil: () => {} });

  return async function handle(request: Request): Promise<Response> {
    const { pathname } = new URL(request.url);
    try {
      if (pathname === '/api/orders') {
        const res = await ordersHandler(ctx(request) as any);
        /* Đơn đặt sau khi chat (cùng visitorId) = chuyển đổi của chat. Không bao giờ làm hỏng đơn. */
        if (res.ok && request.method === 'POST') {
          const body = await res.clone().json().catch(() => null) as { orderCode?: string; deduped?: boolean } | null;
          if (body?.orderCode && !body.deduped) await linkOrderToChat(sql, request, body.orderCode).catch((e) => console.error('chat_link_order_failed', (e as Error).message.slice(0, 120)));
        }
        return res;
      }
      if (pathname === '/api/admin/orders') return await adminOrdersHandler(ctx(request) as any);
      if (pathname === '/api/chat') return await chatHandler(request, sql, root, env as any, opts.fetch);
      if (pathname === '/api/chat/event') return await chatEventHandler(request, sql, env as any);
      if (pathname === '/api/admin/chats') return await chatExportHandler(request, sql, env as any);
      if (pathname === '/admin' || pathname.startsWith('/admin/')) return await adminHandler(request, { sql, root, env: env as any, fetch: opts.fetch });
      if (pathname === '/healthz') {
        await sql.query('SELECT 1');
        return new Response('ok', { headers: { 'content-type': 'text/plain', 'cache-control': 'no-store' } });
      }
      return await serveStatic(request);
    } catch (e) {
      /* Không in nội dung yêu cầu ra log: thân yêu cầu đặt hàng là dữ liệu cá nhân. */
      console.error('request_failed', pathname, (e as Error).message?.slice(0, 200));
      return new Response('Lỗi máy chủ', { status: 500, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });
    }
  };
}
