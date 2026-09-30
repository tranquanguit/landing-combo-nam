/**
 * Xuất bản: CSDL -> file -> astro build -> đổi bản đang phục vụ.
 *
 *   1. ghi nội dung + ảnh từ Postgres ra src/ (exportToFiles)
 *   2. build vào dist-next/ — mọi hàng rào của schema chạy ở đây
 *   3. CHỈ KHI build xanh: dist -> dist-prev, dist-next -> dist (đổi tên, gần như tức thì)
 *   4. chạy cổng ngân sách trọng lượng trên bản mới; trượt thì ghi cảnh báo
 *
 * Build đỏ thì bản đang chạy giữ nguyên, nhật ký nói rõ vì sao — đúng tinh thần
 * "hàng rào build thay cho lời dặn": một lần nhập sai không lên được trang thật.
 * Chỉ một lần xuất bản chạy tại một thời điểm.
 */
import { spawn } from 'node:child_process';
import { existsSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import type { Sql } from './db.ts';
import { exportToFiles } from './content.ts';

let running: Promise<unknown> | null = null;
export const isPublishing = () => running !== null;

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
      rmSync(join(root, 'dist-next'), { recursive: true, force: true });
      const code = await run(process.execPath, ['node_modules/astro/bin/astro.mjs', 'build'], root, {
        ASTRO_OUT_DIR: 'dist-next',
        /* Cùng tên miền với website: biểu mẫu gửi về /api/orders của chính máy chủ này. */
        PUBLIC_ORDER_ENDPOINT: process.env.PUBLIC_ORDER_ENDPOINT ?? '/api/orders',
      }, log);
      if (code !== 0) {
        log.push(`BUILD LỖI (mã ${code}) — bản đang chạy giữ nguyên.`);
      } else {
        const dist = join(root, 'dist'), prev = join(root, 'dist-prev');
        rmSync(prev, { recursive: true, force: true });
        if (existsSync(dist)) renameSync(dist, prev);
        renameSync(join(root, 'dist-next'), dist);
        ok = true;
        log.push('đã chuyển sang bản mới.');
        const budget = await run(process.execPath, ['scripts/check-budget.mjs'], root, {}, log);
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
