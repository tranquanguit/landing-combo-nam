/**
 * Kết nối Postgres, dùng chung cho máy chủ và bộ thử.
 *
 *   DATABASE_URL=postgres://user:pass@db:5432/mocha   -> Postgres thật (driver `postgres`)
 *   DATABASE_URL=pglite:memory                        -> Postgres WASM trong RAM (bộ thử)
 *   DATABASE_URL=pglite:./.data/pg                    -> Postgres WASM lưu ra thư mục (chạy thử)
 *
 * Cả hai trả về cùng một giao diện `query(text, params)` với tham số `$1..$n`.
 * PGlite là Postgres thật biên dịch sang WASM (cùng parser, cùng kiểu dữ liệu,
 * cùng ràng buộc), nên SQL qua được bộ thử là SQL chạy được trên máy chủ — NHƯNG
 * hai DRIVER chuyển tham số khác nhau. Bẫy đã gặp: driver `postgres` thấy tham số
 * kiểu jsonb thì tự JSON.stringify thêm lần nữa, nên ép thẳng `::jsonb` một chuỗi JSON
 * bị lưu thành chuỗi chứ không phải object (PGlite thì không). Luôn viết
 * `$1::text::jsonb` (tests/server-pg.mjs chặn dạng kia); `npm run verify:docker`
 * là bước chạy trên Postgres thật.
 */
export interface Sql {
  query<T = Record<string, any>>(text: string, params?: unknown[]): Promise<{ rows: T[]; count: number }>;
  close(): Promise<void>;
  /**
   * Chạy `fn` trong MỘT giao dịch, trên MỘT kết nối. Không tự gọi BEGIN/COMMIT
   * qua `query`: với pool của driver `postgres`, hai câu liên tiếp có thể đi
   * trên hai kết nối khác nhau — driver từ chối (UNSAFE_TRANSACTION), và nó đúng.
   */
  transaction<T>(fn: (tx: Pick<Sql, 'query'>) => Promise<T>): Promise<T>;
  kind: 'postgres' | 'pglite';
}

export async function connect(url = process.env.DATABASE_URL ?? ''): Promise<Sql> {
  if (!url) throw new Error('Thiếu DATABASE_URL (ví dụ postgres://mocha:***@db:5432/mocha).');

  if (url.startsWith('pglite:')) {
    const { PGlite } = await import('@electric-sql/pglite');
    const where = url.slice('pglite:'.length);
    const db = where === 'memory' ? new PGlite() : new PGlite(where);
    const wrap = (q: any) => async (text: string, params: unknown[] = []) => {
      const r = await q.query(text, params as any[]);
      return { rows: r.rows, count: r.affectedRows ?? r.rows.length };
    };
    return {
      kind: 'pglite',
      query: wrap(db) as Sql['query'],
      transaction: (fn) => db.transaction((tx: any) => fn({ query: wrap(tx) as Sql['query'] })),
      close: () => db.close(),
    };
  }

  const { default: postgres } = await import('postgres');
  const sql = postgres(url, {
    max: Number(process.env.PG_POOL_MAX ?? 10),
    idle_timeout: 30,
    // Không in câu lệnh kèm tham số ra log: tham số của bảng orders là dữ liệu cá nhân.
    onnotice: () => {},
  });
  const wrap = (q: any) => async (text: string, params: unknown[] = []) => {
    const r: any = await q.unsafe(text, params as any[]);
    return { rows: [...r], count: r.count ?? r.length };
  };
  return {
    kind: 'postgres',
    query: wrap(sql) as Sql['query'],
    transaction: (fn) => sql.begin((tx: any) => fn({ query: wrap(tx) as Sql['query'] })) as any,
    close: () => sql.end({ timeout: 5 }),
  };
}

/**
 * Bộ chuyển giao diện D1 (Cloudflare) sang Postgres.
 *
 * Handler đơn hàng trong functions/ viết cho D1: `prepare(sql).bind(...).first()`
 * với tham số `?`. Chuyển ở đây thay vì viết lại handler: một handler cho cả hai
 * nơi triển khai, nên luật kiểm tra đơn, chống trùng, chống spam không thể lệch
 * giữa Cloudflare và máy chủ Docker.
 *
 * `?` được đổi thành `$1..$n` theo thứ tự. Các câu SQL của handler không có dấu
 * `?` nào nằm trong chuỗi ký tự, và bộ thử chạy từng câu trên Postgres thật.
 */
export function toDollar(q: string): string {
  let i = 0;
  return q.replace(/\?/g, () => `$${++i}`);
}

export function d1(sql: Sql): D1Database {
  const stmt = (q: string, params: unknown[] = []): D1PreparedStatement => ({
    bind: (...values: unknown[]) => stmt(q, values),
    async first<T>(col?: string) {
      const r = await sql.query(toDollar(q), params);
      const row = r.rows[0] ?? null;
      return (col && row ? row[col] : row) as T;
    },
    async all<T>() {
      const r = await sql.query(toDollar(q), params);
      return { results: r.rows as T[], success: true, meta: { changes: r.count } };
    },
    async run() {
      const r = await sql.query(toDollar(q), params);
      return { success: true, meta: { changes: r.count } };
    },
  });
  return {
    prepare: (q: string) => stmt(q),
    async batch(statements) { return Promise.all(statements.map((s) => s.run())); },
    async exec(q: string) { await sql.query(q); return { count: 1, duration: 0 }; },
  } as D1Database;
}

/** Áp các file db/pg/*.sql theo thứ tự tên, mỗi file đúng một lần. */
export async function migrate(sql: Sql, dir: string, log: (s: string) => void = () => {}) {
  const { readdirSync, readFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  await sql.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
  const done = new Set((await sql.query<{ name: string }>('SELECT name FROM schema_migrations')).rows.map((r) => r.name));
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) {
    if (done.has(f)) continue;
    const text = readFileSync(join(dir, f), 'utf8');
    try {
      await sql.transaction(async (tx) => {
        // Postgres nhận nhiều câu lệnh trong một lần gọi không tham số; PGlite thì tách từng câu.
        await (sql.kind === 'pglite' ? execMulti(tx, text) : tx.query(text));
        await tx.query('INSERT INTO schema_migrations (name) VALUES ($1)', [f]);
      });
      log(`  migrate ${f}`);
    } catch (e) {
      throw new Error(`Migration ${f} lỗi: ${(e as Error).message}`);
    }
  }
}

/* `query()` của PGlite chỉ nhận một câu lệnh có tham số; tách theo dấu ; cuối dòng. */
async function execMulti(sql: Pick<Sql, 'query'>, text: string) {
  /* Bỏ dòng chú thích TRƯỚC khi tách: một dấu ; trong chú thích không được
     cắt đôi câu lệnh. */
  const parts = text
    .replace(/^\s*--.*$/gm, '')
    .split(/;\s*(?:\r?\n|$)/)
    .map((s) => s.trim())
    .filter(Boolean);
  for (const p of parts) await sql.query(p);
}
