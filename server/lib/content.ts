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
  lines: { dir: 'src/content/lines' },
  pages: { dir: 'src/content/pages' },
  articles: { dir: 'src/content/articles' },
  policies: { dir: 'src/content/policies' },
  guides: { dir: 'src/content/guides' },
  documents: { dir: 'src/content/documents' },
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

export async function importFromFiles(sql: Sql, root: string, by = 'import') {
  let entries = 0, media = 0;
  for (const c of Object.keys(COLLECTIONS)) {
    for (const { file, id } of entryFiles(root, c)) {
      const source = readFileSync(file, 'utf8');
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
      await putMedia(sql, path, bytes, by);
      media++;
    }
  }
  return { entries, media };
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
