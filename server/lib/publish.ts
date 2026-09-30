/**
 * Xuất bản: CSDL -> file -> astro build -> đổi bản đang phục vụ.
 *
 *   1. ghi nội dung + ảnh từ Postgres ra src/ (exportToFiles)
 *   2. build vào builds/<số> — mọi hàng rào của schema chạy ở đây
 *   3. CHỈ KHI build xanh: đổi con trỏ `.site-current` sang bản mới (nguyên tử)
 *   4. chạy cổng ngân sách trọng lượng trên bản mới; trượt thì ghi cảnh báo
 *
 * Build đỏ thì bản đang chạy giữ nguyên, nhật ký nói rõ vì sao — đúng tinh thần
 * "hàng rào build thay cho lời dặn": một lần nhập sai không lên được trang thật.
 * Chỉ một lần xuất bản chạy tại một thời điểm.
 */
import { spawn } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Sql } from './db.ts';
import { exportToFiles } from './content.ts';

let running: Promise<unknown> | null = null;
export const isPublishing = () => running !== null;

/**
 * Bản đang phục vụ = thư mục ghi trong file con trỏ `.site-current`; chưa có
 * con trỏ thì là `dist/` (bản build sẵn trong image).
 *
 * Không đổi tên `dist/` như bản đầu: trong container, `dist/` nằm ở lớp chỉ-đọc
 * của image, và overlayfs từ chối đổi tên thư mục của lớp đó (EXDEV) — bắt được
 * bằng `npm run verify:docker`. Mỗi lần xuất bản build vào `builds/<số>`, rồi đổi
 * CON TRỎ (ghi file tạm + rename: nguyên tử, chạy được trên mọi hệ thống file).
 */
export const POINTER = '.site-current';
const BUILD_DIR = /^builds\/\d+$/;

export function currentSite(root: string): string {
  try {
    const name = readFileSync(join(root, POINTER), 'utf8').trim();
    if (BUILD_DIR.test(name) && existsSync(join(root, name, 'index.html'))) return join(root, name);
  } catch { /* chưa xuất bản lần nào */ }
  return join(root, 'dist');
}

function currentName(root: string): string | null {
  try {
    const name = readFileSync(join(root, POINTER), 'utf8').trim();
    return BUILD_DIR.test(name) ? name : null;
  } catch { return null; }
}

function run(cmd: string, args: string[], cwd: string, env: Record<string, string>, log: string[]) {
  return new Promise<number>((resolve) => {
    const p = spawn(cmd, args, { cwd, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
    const push = (b: Buffer) => { for (const l of b.toString().split(/\r?\n/)) if (l.trim()) log.push(l.replace(/\x1b\[[0-9;]*m/g, '')); };
    p.stdout.on('data', push); p.stderr.on('data', push);
    p.on('close', (code) => resolve(code ?? 1));
  });
}

export interface PublishResult { id: number; ok: boolean; log: string }

export function publish(sql: Sql, root: string, by: string): Promise<PublishResult> {
  if (running) return Promise.reject(new Error('Đang có một lần xuất bản chạy. Đợi nó xong rồi thử lại.'));
  const job = (async () => {
    const id = (await sql.query<{ id: number }>('INSERT INTO publish_runs (started_by) VALUES ($1) RETURNING id', [by])).rows[0].id;
    const log: string[] = [];
    let ok = false;
    try {
      const ex = await exportToFiles(sql, root);
      log.push(`xuất ${ex.entries} nội dung, ${ex.media} ảnh — ${ex.written} file ghi mới, ${ex.removed} file xoá`);
      const out = `builds/${id}`;
      rmSync(join(root, out), { recursive: true, force: true });
      const code = await run(process.execPath, ['node_modules/astro/bin/astro.mjs', 'build'], root, {
        ASTRO_OUT_DIR: out,
        /* Cùng tên miền với website: biểu mẫu gửi về /api/orders của chính máy chủ này. */
        PUBLIC_ORDER_ENDPOINT: process.env.PUBLIC_ORDER_ENDPOINT ?? '/api/orders',
      }, log);
      if (code !== 0) {
        rmSync(join(root, out), { recursive: true, force: true });
        log.push(`BUILD LỖI (mã ${code}) — bản đang chạy giữ nguyên.`);
      } else {
        const prev = currentName(root);
        writeFileSync(join(root, POINTER + '.tmp'), out + '\n');
        renameSync(join(root, POINTER + '.tmp'), join(root, POINTER));
        ok = true;
        log.push(`đã chuyển sang bản mới (${out}).`);
        /* Giữ bản mới + bản ngay trước (để quay lại nếu cần), xoá các bản cũ hơn. */
        const keep = new Set([out, prev]);
        for (const d of existsSync(join(root, 'builds')) ? readdirSync(join(root, 'builds')) : []) {
          if (!keep.has(`builds/${d}`)) rmSync(join(root, 'builds', d), { recursive: true, force: true });
        }
        const budget = await run(process.execPath, ['scripts/check-budget.mjs'], root, { DIST_DIR: out }, log);
        if (budget !== 0) log.push('⚠️  CẢNH BÁO: bản mới vượt ngân sách trọng lượng (xem các dòng ✗ ở trên).');
      }
    } catch (e) {
      log.push(`LỖI: ${(e as Error).message}`);
    }
    const text = log.slice(-400).join('\n');
    await sql.query('UPDATE publish_runs SET finished_at = now(), ok = $2, log = $3 WHERE id = $1', [id, ok, text]);
    return { id, ok, log: text };
  })();
  running = job.finally(() => { running = null; });
  return job;
}
