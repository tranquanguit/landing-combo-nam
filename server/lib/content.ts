/**
 * Kho nội dung: Postgres <-> file JSON + ảnh trong src/.
 *
 * Postgres là nơi NHẬP LIỆU. File là ĐẦU VÀO CỦA BUILD. Hai chiều:
 *   importFromFiles  — nạp nội dung đang có trong repo vào CSDL (lần đầu, hoặc đồng bộ lại)
 *   exportToFiles    — ghi CSDL ra file ngay trước khi build (bước đầu của "xuất bản")
 *
 * Xuất ra file giữ nguyên VĂN BẢN người biên tập đã lưu (cột `source`), không
 * dựng lại từ JSONB — JSONB không giữ thứ tự khoá, và một diff git xáo trộn toàn
 * bộ thứ tự khoá thì không ai đọc được. Bộ thử kiểm: nhập rồi xuất = y nguyên từng byte.
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, statSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { createHash } from 'node:crypto';
import type { Sql } from './db.ts';

/** Thư mục của từng collection — trùng `base` trong src/content.config.ts. */
export const COLLECTIONS: Record<string, { dir: string; skip?: RegExp }> = {
  products: { dir: 'src/content/products' },
  combos: { dir: 'src/content/combos' },
  lines: { dir: 'src/content/lines' },
  pages: { dir: 'src/content/pages' },
  articles: { dir: 'src/content/articles' },
  policies: { dir: 'src/content/policies' },
  guides: { dir: 'src/content/guides' },
  documents: { dir: 'src/content/documents' },
  promotions: { dir: 'src/content/promotions' },
  testimonials: { dir: 'src/content/testimonials' },
  /* File bắt đầu bằng "_" là dữ liệu nội bộ (đặc tả ảnh…), không phải một entry. */
  brand: { dir: 'src/data', skip: /(^|\/)_/ },
};

/** Ảnh: đường dẫn nội dung "/images/x.webp" <-> file src/assets/images/x.webp. */
export const MEDIA_DIRS = ['images', 'documents'];
const IMAGE = /\.(webp|jpe?g|png|avif)$/i;
const MIME: Record<string, string> = { webp: 'image/webp', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', avif: 'image/avif' };

const posix = (p: string) => p.split(sep).join('/');

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]);
}

export function entryFiles(root: string, collection: string) {
  const { dir, skip } = COLLECTIONS[collection];
  const base = join(root, dir);
  return walk(base)
    .filter((f) => f.endsWith('.json'))
    .map((f) => ({ file: f, id: posix(relative(base, f)).replace(/\.json$/, '') }))
    .filter((x) => !skip || !skip.test(x.id));
}

export const entryPath = (root: string, collection: string, id: string) =>
  join(root, COLLECTIONS[collection].dir, `${id}.json`);

/** Văn bản chuẩn khi lưu từ trang quản trị: thụt 2 dấu cách, xuống dòng cuối file. */
export const canonicalSource = (data: unknown) => JSON.stringify(data, null, 2) + '\n';

// --------------------------------------------------------------- kiểm tra

let schemas: Record<string, any> | null = null;
/**
 * Schema lấy từ CHÍNH src/content.config.ts — một schema cho cả build lẫn nhập
 * liệu. Tiến trình phải chạy với `--import ./scripts/shim/register.mjs` (đổi
 * `astro:content` sang bản giả), đúng như test:schema đang làm.
 */
export async function loadSchemas(root: string) {
  if (schemas) return schemas;
  const mod = await import(new URL(`file:///${posix(join(root, 'src/content.config.ts')).replace(/^\//, '')}`).href);
  schemas = Object.fromEntries(Object.entries(mod.collections).map(([k, v]: [string, any]) => [k, v.schema]));
  return schemas;
}

export interface Issue { path: string; message: string }

export async function validate(root: string, collection: string, data: unknown): Promise<Issue[]> {
  const all = await loadSchemas(root);
  const schema = all[collection];
  if (!schema) return [{ path: '', message: `Không có collection "${collection}".` }];
  const r = schema.safeParse(data);
  if (r.success) return [];
  return r.error.issues.map((i: any) => ({ path: i.path.join('.'), message: vietnamese(i) }));
}

/**
 * Thông báo lỗi dành cho NGƯỜI BIÊN TẬP, không phải cho lập trình viên.
 * Lỗi tự viết trong schema (superRefine) vốn đã là tiếng Việt — giữ nguyên.
 */
const KIND: Record<string, string> = {
  string: 'chữ', number: 'số', boolean: 'đúng/sai', object: 'một nhóm trường', array: 'một danh sách',
};
function vietnamese(i: any): string {
  switch (i.code) {
    case 'invalid_type':
      /* zod v4 không gắn `input` vào issue (trừ khi bật reportInput), nên phân
         biệt "thiếu" với "sai kiểu" bằng chính thông báo gốc. */
      return /received undefined/.test(i.message ?? '')
        ? 'Thiếu trường bắt buộc.'
        : `Sai kiểu: cần ${KIND[i.expected] ?? i.expected}.`;
    case 'unrecognized_keys':
      return `Trường không có trong schema: ${(i.keys ?? []).map((k: string) => `"${k}"`).join(', ')} — gõ sai tên trường? Xem docs/truong-du-lieu.md.`;
    case 'too_small':
      return i.origin === 'array' ? `Cần ít nhất ${i.minimum} mục.`
        : i.origin === 'string' ? `Quá ngắn: tối thiểu ${i.minimum} ký tự.` : `Nhỏ hơn mức tối thiểu ${i.minimum}.`;
    case 'too_big':
      return i.origin === 'array' ? `Nhiều nhất ${i.maximum} mục.`
        : i.origin === 'string' ? `Quá dài: tối đa ${i.maximum} ký tự.` : `Lớn hơn mức tối đa ${i.maximum}.`;
    case 'invalid_value':
      return `Giá trị không hợp lệ. Chỉ nhận: ${(i.values ?? []).map((v: unknown) => JSON.stringify(v)).join(', ')}.`;
    case 'invalid_format':
      return i.format === 'date' ? 'Ngày phải có dạng YYYY-MM-DD, ví dụ 2026-12-31.'
        : i.format === 'regex' ? `Sai định dạng. ${i.message}` : `Sai định dạng (${i.format}).`;
    case 'invalid_union':
      return 'Giá trị không khớp dạng nào được phép.';
    default:
      return i.message;
  }
}

// --------------------------------------------------------------- nhập / xuất

/**
 * `onlyNew`: chỉ thêm nội dung/ảnh CHƯA có trong CSDL, không đụng bản đã có — dùng khi
 * phát hành bản code mới có thêm sản phẩm/bài trong git mà không muốn ghi đè những gì
 * người biên tập đã sửa trên trang quản trị (giá, câu chữ…).
 */
export async function importFromFiles(sql: Sql, root: string, by = 'import', onlyNew = false, only?: Set<string>) {
  let entries = 0, media = 0;
  for (const c of Object.keys(COLLECTIONS)) {
    for (const { file, id } of entryFiles(root, c)) {
      const source = readFileSync(file, 'utf8');
      /* `only`: chỉ nạp (và GHI ĐÈ) đúng các mục "collection/id" được chỉ định. */
      if (only && !only.has(`${c}/${id}`)) continue;
      if (onlyNew && !only && (await sql.query('SELECT 1 FROM content_entries WHERE collection = $1 AND entry_id = $2', [c, id])).rows.length) continue;
      await sql.query(
        `INSERT INTO content_entries (collection, entry_id, data, source, updated_by)
         VALUES ($1, $2, $3::text::jsonb, $4, $5)
         ON CONFLICT (collection, entry_id) DO UPDATE
           SET data = EXCLUDED.data, source = EXCLUDED.source, updated_at = now(), updated_by = EXCLUDED.updated_by`,
        [c, id, source, source, by]);
      entries++;
    }
  }
  for (const d of MEDIA_DIRS) {
    const base = join(root, 'src/assets', d);
    for (const f of walk(base).filter((x) => IMAGE.test(x))) {
      const bytes = readFileSync(f);
      const path = `/${d}/${posix(relative(base, f))}`;
      if (onlyNew && (await sql.query('SELECT 1 FROM media WHERE path = $1', [path])).rows.length) continue;
      if (only && !onlyNew) continue;
      await putMedia(sql, path, bytes, by);
      media++;
    }
  }
  return { entries, media };
}

/** Người ghi là MÁY (nạp từ mã nguồn), không phải nhân viên sửa trong trang quản trị. */
export const MACHINE = new Set(['seed', 'import', 'cli', 'sync']);

export interface SyncReport {
  added: string[]; updated: string[]; merged: string[];
  /** Nhân viên đã sửa trong trang quản trị và bản trong mã nguồn khác — giữ bản trang quản trị. */
  keptEdited: string[];
  mediaAdded: number; mediaUpdated: number; mediaKept: string[];
}

/**
 * Đồng bộ nội dung + ảnh của BẢN CODE MỚI vào CSDL, không cần liệt kê từng mục.
 *
 * Trước đây phát hành bản mới phải chạy `import --only-new` rồi `import --entries <danh sách
 * dài>` cho mọi mục đã sửa — sót một mục là trang thật giữ bản cũ mà không ai biết (lỗi gặp
 * thật lần deploy 2026-10-11: sản phẩm mới có, khối mới của sản phẩm cũ thì không).
 *
 * Quy tắc, cho từng mục trong mã nguồn:
 *   - CSDL chưa có -> thêm;
 *   - CSDL có, lần ghi cuối là MÁY (seed/import/cli/sync) và khác mã nguồn -> ghi đè: chưa ai
 *     sửa tay thì bản mới trong mã nguồn chính là bản đúng;
 *   - CSDL có, nhân viên đã sửa trong trang quản trị -> GIỮ bản trang quản trị, báo tên mục.
 *     Riêng Thông tin cửa hàng (`brand`): bổ sung các trường bản mới thêm mà CSDL chưa có
 *     (vd danh sách tổ chức công bố), không đụng giá trị nhân viên đã điền.
 * Ảnh: cùng quy tắc theo người tải lên. Không xoá gì: mục bị bỏ khỏi mã nguồn vẫn ở CSDL.
 */
export async function syncFromFiles(sql: Sql, root: string): Promise<SyncReport> {
  const rep: SyncReport = { added: [], updated: [], merged: [], keptEdited: [], mediaAdded: 0, mediaUpdated: 0, mediaKept: [] };
  const write = (c: string, id: string, source: string) => sql.query(
    `INSERT INTO content_entries (collection, entry_id, data, source, updated_by)
     VALUES ($1, $2, $3::text::jsonb, $4, 'sync')
     ON CONFLICT (collection, entry_id) DO UPDATE
       SET data = EXCLUDED.data, source = EXCLUDED.source, updated_at = now(), updated_by = 'sync'`,
    [c, id, source, source]);
  for (const c of Object.keys(COLLECTIONS)) {
    for (const { file, id } of entryFiles(root, c)) {
      const source = readFileSync(file, 'utf8');
      const row = (await sql.query<{ source: string; updated_by: string | null }>(
        'SELECT source, updated_by FROM content_entries WHERE collection = $1 AND entry_id = $2', [c, id])).rows[0];
      const key = `${c}/${id}`;
      if (!row) {
        /* Nhân viên đã XOÁ mục này trong trang quản trị (lịch sử ghi bản xoá): không tự thêm lại. */
        const last = (await sql.query<{ source: string | null }>(
          'SELECT source FROM content_revisions WHERE collection = $1 AND entry_id = $2 ORDER BY id DESC LIMIT 1', [c, id])).rows[0];
        if (last && last.source === null) { rep.keptEdited.push(`${key} (đã xoá trong trang quản trị)`); continue; }
        await write(c, id, source); rep.added.push(key); continue;
      }
      if (row.source === source) continue;
      if (MACHINE.has(row.updated_by ?? '')) { await write(c, id, source); rep.updated.push(key); continue; }
      if (c === 'brand') {
        /* Bổ sung trường mới (nông) + tổ chức công bố còn thiếu theo mã; giữ mọi giá trị đã sửa. */
        const db = JSON.parse(row.source), repo = JSON.parse(source);
        const merged = { ...db };
        for (const [k, v] of Object.entries(repo)) if (!(k in merged)) merged[k] = v;
        if (Array.isArray(repo.declarants)) {
          const have = new Set((merged.declarants ?? []).map((d: any) => d.id));
          merged.declarants = [...(merged.declarants ?? []), ...repo.declarants.filter((d: any) => !have.has(d.id))];
        }
        const next = canonicalSource(merged);
        if (next !== canonicalSource(db)) {
          await sql.query(
            `UPDATE content_entries SET data = $1::text::jsonb, source = $2, updated_at = now() WHERE collection = $3 AND entry_id = $4`,
            [next, next, c, id]);
          await sql.query('INSERT INTO content_revisions (collection, entry_id, source, saved_by, note) VALUES ($1, $2, $3, $4, $5)',
            [c, id, next, 'sync', 'bổ sung trường mới từ bản code mới']);
          rep.merged.push(key);
        }
        continue;
      }
      rep.keptEdited.push(key);
    }
  }
  for (const d of MEDIA_DIRS) {
    const base = join(root, 'src/assets', d);
    for (const f of walk(base).filter((x) => IMAGE.test(x))) {
      const bytes = readFileSync(f);
      const path = `/${d}/${posix(relative(base, f))}`;
      const row = (await sql.query<{ sha256: string; uploaded_by: string | null }>(
        'SELECT sha256, uploaded_by FROM media WHERE path = $1', [path])).rows[0];
      if (!row) { await putMedia(sql, path, bytes, 'sync'); rep.mediaAdded++; continue; }
      if (row.sha256 === createHash('sha256').update(bytes).digest('hex')) continue;
      if (MACHINE.has(row.uploaded_by ?? '')) { await putMedia(sql, path, bytes, 'sync'); rep.mediaUpdated++; continue; }
      rep.mediaKept.push(path);
    }
  }
  return rep;
}

export async function putMedia(sql: Sql, path: string, bytes: Buffer, by: string) {
  const ext = path.split('.').pop()!.toLowerCase();
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  let width: number | null = null, height: number | null = null;
  try {
    const { default: sharp } = await import('sharp');
    const m = await sharp(bytes).metadata();
    width = m.width ?? null; height = m.height ?? null;
  } catch { /* ảnh hỏng thì build sẽ báo; không chặn ở đây */ }
  await sql.query(
    `INSERT INTO media (path, bytes, sha256, mime, width, height, uploaded_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (path) DO UPDATE SET bytes = EXCLUDED.bytes, sha256 = EXCLUDED.sha256, mime = EXCLUDED.mime,
       width = EXCLUDED.width, height = EXCLUDED.height, uploaded_at = now(), uploaded_by = EXCLUDED.uploaded_by`,
    [path, bytes, sha256, MIME[ext] ?? 'application/octet-stream', width, height, by]);
}

/**
 * Ghi CSDL ra cây src/. Entry hay ảnh không còn trong CSDL thì file tương ứng
 * bị xoá — CSDL là nguồn sự thật khi chạy trên máy chủ. Chỉ đụng tới file .json
 * trong thư mục collection và file ảnh trong src/assets/{images,documents}.
 */
export async function exportToFiles(sql: Sql, root: string) {
  const rows = (await sql.query<{ collection: string; entry_id: string; source: string }>(
    'SELECT collection, entry_id, source FROM content_entries ORDER BY collection, entry_id')).rows;
  const keep = new Set<string>();
  let written = 0, removed = 0;
  for (const r of rows) {
    if (!COLLECTIONS[r.collection]) continue;
    const f = entryPath(root, r.collection, r.entry_id);
    keep.add(f);
    mkdirSync(dirname(f), { recursive: true });
    if (!existsSync(f) || readFileSync(f, 'utf8') !== r.source) { writeFileSync(f, r.source); written++; }
  }
  for (const c of Object.keys(COLLECTIONS)) {
    for (const { file } of entryFiles(root, c)) if (!keep.has(file)) { rmSync(file); removed++; }
  }

  const media = (await sql.query<{ path: string; bytes: Uint8Array; sha256: string }>('SELECT path, bytes, sha256 FROM media')).rows;
  const keepMedia = new Set<string>();
  for (const m of media) {
    const f = join(root, 'src/assets', m.path.slice(1));
    keepMedia.add(f);
    mkdirSync(dirname(f), { recursive: true });
    const same = existsSync(f) && createHash('sha256').update(readFileSync(f)).digest('hex') === m.sha256;
    if (!same) { writeFileSync(f, Buffer.from(m.bytes)); written++; }
  }
  for (const d of MEDIA_DIRS) {
    for (const f of walk(join(root, 'src/assets', d)).filter((x) => IMAGE.test(x))) {
      if (!keepMedia.has(f)) { rmSync(f); removed++; }
    }
  }
  return { entries: rows.length, media: media.length, written, removed };
}

export const isDir = (p: string) => existsSync(p) && statSync(p).isDirectory();
