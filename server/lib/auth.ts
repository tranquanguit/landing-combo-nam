/**
 * Xác thực trang quản trị nhập liệu.
 *
 *  - Mật khẩu băm scrypt (node:crypto), muối riêng từng tài khoản. Không lưu thô.
 *  - Phiên: mã ngẫu nhiên 32 byte trong cookie; CSDL chỉ giữ SHA-256 của mã, nên
 *    đọc được bảng admin_sessions cũng không mạo danh được ai.
 *  - Cookie HttpOnly + SameSite=Strict + Path=/admin (+ Secure khi chạy sau HTTPS).
 *  - Mọi POST phải có Origin trùng máy chủ: SameSite=Strict chặn phần lớn CSRF,
 *    kiểm Origin chặn nốt phần còn lại (trình duyệt cũ, subdomain).
 */
import { randomBytes, scrypt as _scrypt, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import type { Sql } from './db.ts';

const scrypt = promisify(_scrypt) as (pw: string, salt: Buffer, len: number, opt: object) => Promise<Buffer>;
const N = 16384, R = 8, P = 1, LEN = 32;
export const COOKIE = 'mocha_admin';
const SESSION_HOURS = Number(process.env.ADMIN_SESSION_HOURS ?? 12);

export async function hashPassword(pw: string): Promise<string> {
  if (pw.length < 10) throw new Error('Mật khẩu tối thiểu 10 ký tự.');
  const salt = randomBytes(16);
  const h = await scrypt(pw, salt, LEN, { N, r: R, p: P, maxmem: 64 * 1024 * 1024 });
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${h.toString('base64')}`;
}

export async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  const [kind, n, r, p, salt, hash] = stored.split('$');
  if (kind !== 'scrypt') return false;
  const want = Buffer.from(hash, 'base64');
  const got = await scrypt(pw, Buffer.from(salt, 'base64'), want.length, { N: +n, r: +r, p: +p, maxmem: 64 * 1024 * 1024 });
  return got.length === want.length && timingSafeEqual(got, want);
}

const sha = (s: string) => createHash('sha256').update(s).digest('hex');

export async function createUser(sql: Sql, username: string, password: string, role: 'editor' | 'admin' = 'editor') {
  await sql.query(
    `INSERT INTO admin_users (username, password, role) VALUES ($1, $2, $3)
     ON CONFLICT (username) DO UPDATE SET password = EXCLUDED.password, role = EXCLUDED.role`,
    [username, await hashPassword(password), role]);
  /* Đổi mật khẩu / đổi quyền: mọi phiên đang đăng nhập của tài khoản này phải đăng nhập lại. */
  await sql.query('DELETE FROM admin_sessions WHERE username = $1', [username]);
}

/** Lần chạy đầu: chưa có tài khoản nào thì tạo từ ADMIN_BOOTSTRAP_USER / _PASSWORD. */
export async function bootstrapAdmin(sql: Sql, log: (s: string) => void = () => {}) {
  const n = (await sql.query<{ n: number }>('SELECT count(*)::int AS n FROM admin_users')).rows[0].n;
  const u = process.env.ADMIN_BOOTSTRAP_USER, p = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  if (n === 0 && u && p) { await createUser(sql, u, p, 'admin'); log(`  tạo tài khoản quản trị đầu tiên: ${u}`); }
}

export async function login(sql: Sql, username: string, password: string) {
  const row = (await sql.query<{ password: string }>('SELECT password FROM admin_users WHERE username = $1', [username])).rows[0];
  /* Không có tài khoản thì vẫn chạy một lần scrypt: thời gian trả lời không tiết
     lộ tên đăng nhập nào tồn tại. */
  const ok = row ? await verifyPassword(password, row.password)
    : (await verifyPassword(password, 'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='), false);
  if (!ok) return null;
  const token = randomBytes(32).toString('base64url');
  await sql.query(
    `INSERT INTO admin_sessions (token_hash, username, expires_at) VALUES ($1, $2, now() + ($3 || ' hours')::interval)`,
    [sha(token), username, String(SESSION_HOURS)]);
  await sql.query('DELETE FROM admin_sessions WHERE expires_at < now()');
  return token;
}

export async function logout(sql: Sql, token: string) {
  await sql.query('DELETE FROM admin_sessions WHERE token_hash = $1', [sha(token)]);
}

export interface User { username: string; role: 'editor' | 'admin' }

export async function userFromRequest(sql: Sql, request: Request): Promise<User | null> {
  const token = cookie(request, COOKIE);
  if (!token) return null;
  const row = (await sql.query<User>(
    `SELECT u.username, u.role FROM admin_sessions s JOIN admin_users u ON u.username = s.username
      WHERE s.token_hash = $1 AND s.expires_at > now()`, [sha(token)])).rows[0];
  return row ?? null;
}

export function cookie(request: Request, name: string): string | null {
  const raw = request.headers.get('cookie') ?? '';
  for (const part of raw.split(/;\s*/)) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i) === name) return decodeURIComponent(part.slice(i + 1));
  }
  return null;
}

export function sessionCookie(token: string, maxAgeSec = SESSION_HOURS * 3600) {
  const secure = process.env.COOKIE_SECURE === '0' ? '' : '; Secure';
  return `${COOKIE}=${encodeURIComponent(token)}; Path=/admin; HttpOnly; SameSite=Strict; Max-Age=${maxAgeSec}${secure}`;
}
export const clearCookie = () => sessionCookie('', 0);

/** POST từ trang khác tên miền thì từ chối. Thiếu Origin (trình duyệt cũ) thì xét Referer. */
export function sameOrigin(request: Request): boolean {
  const host = new URL(request.url).host;
  const origin = request.headers.get('origin') ?? request.headers.get('referer');
  if (!origin) return false;
  try { return new URL(origin).host === host; } catch { return false; }
}
