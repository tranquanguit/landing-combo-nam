/**
 * Khai báo kiểu tối thiểu cho Cloudflare Pages Functions và D1.
 *
 * Vì sao không dùng @cloudflare/workers-types: gói đó kéo theo vài nghìn dòng
 * khai báo cho toàn bộ runtime Workers, trong khi ở đây chỉ dùng đúng năm hàm.
 * Viết ra rõ ràng thì người đọc thấy được API đang phụ thuộc vào những gì —
 * và bộ kiểm thử trong Node dựng đúng năm hàm này, không hơn.
 */

interface D1Result<T = Record<string, unknown>> {
  results?: T[];
  success: boolean;
  meta?: { changes?: number; last_row_id?: number; duration?: number };
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(colName?: string): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run(): Promise<D1Result>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<D1Result[]>;
  exec(query: string): Promise<{ count: number; duration: number }>;
}

interface EventContext<Env, Params extends string = string, Data = Record<string, unknown>> {
  request: Request;
  env: Env;
  params: Record<Params, string | string[]>;
  data: Data;
  next(input?: Request | string, init?: RequestInit): Promise<Response>;
  waitUntil(promise: Promise<unknown>): void;
}

type PagesFunction<Env = unknown, Params extends string = string> =
  (context: EventContext<Env, Params>) => Response | Promise<Response>;
