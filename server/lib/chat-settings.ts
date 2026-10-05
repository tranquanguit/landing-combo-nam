/**
 * Cấu hình chat — quản lý ở /admin/settings/chat, lưu bảng app_settings (khoá 'chat').
 *
 * Thứ tự ưu tiên: giá trị đã lưu trên trang quản trị > biến môi trường > mặc định.
 * Biến môi trường (N8N_WEBHOOK_URL…) chỉ còn là giá trị khởi đầu cho máy chủ mới:
 * đổi webhook, bật/tắt n8n, đổi khoá không phải sửa .env hay khởi động lại.
 */
import type { Sql } from './db.ts';

export type ChatMode = 'off' | 'rules' | 'n8n';
export interface ChatSettings {
  mode: ChatMode;
  /** Chế độ n8n: n8n lỗi/chậm/trả rỗng thì trả lời bằng kịch bản thay vì xin lỗi. */
  rulesFallback: boolean;
  webhookUrl: string;
  sharedSecret: string;
  timeoutMs: number;
  rateMax: number;
  retentionDays: number;
  sessionRetentionDays: number;
}
export interface ChatSettingsEnv {
  N8N_WEBHOOK_URL?: string; N8N_SHARED_SECRET?: string; N8N_TIMEOUT_MS?: string;
  CHAT_MODE?: string; CHAT_RATE_MAX?: string; CHAT_RETENTION_DAYS?: string; CHAT_SESSION_RETENTION_DAYS?: string;
}

const num = (v: unknown, d: number, min: number, max: number) => {
  const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : d;
};

export function defaults(env: ChatSettingsEnv): ChatSettings {
  const mode = (['off', 'rules', 'n8n'] as const).includes(env.CHAT_MODE as ChatMode)
    ? env.CHAT_MODE as ChatMode : env.N8N_WEBHOOK_URL ? 'n8n' : 'rules';
  return {
    mode, rulesFallback: true,
    webhookUrl: env.N8N_WEBHOOK_URL ?? '',
    sharedSecret: env.N8N_SHARED_SECRET ?? '',
    timeoutMs: num(env.N8N_TIMEOUT_MS, 25000, 2000, 60000),
    rateMax: num(env.CHAT_RATE_MAX, 30, 3, 500),
    retentionDays: num(env.CHAT_RETENTION_DAYS, 90, 1, 3650),
    sessionRetentionDays: num(env.CHAT_SESSION_RETENTION_DAYS, 400, 30, 3650),
  };
}

/** Kiểm + chuẩn hoá một bộ cấu hình (từ biểu mẫu hoặc từ CSDL). Trả lỗi tiếng Việt. */
export function validate(input: Partial<ChatSettings>, base: ChatSettings): { ok: true; value: ChatSettings } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const mode = (['off', 'rules', 'n8n'] as const).includes(input.mode as ChatMode) ? input.mode as ChatMode : base.mode;
  const webhookUrl = String(input.webhookUrl ?? base.webhookUrl).trim();
  if (webhookUrl) {
    try {
      const u = new URL(webhookUrl);
      if (u.protocol !== 'https:' && !(u.protocol === 'http:' && /^(localhost|127\.0\.0\.1|n8n|[a-z0-9-]+)$/.test(u.hostname))) {
        errors.push('Webhook phải là https:// (http:// chỉ cho máy nội bộ, ví dụ http://n8n:5678 trong cùng Docker).');
      }
    } catch { errors.push('Webhook URL không hợp lệ.'); }
  }
  if (mode === 'n8n' && !webhookUrl) errors.push('Chế độ n8n cần Webhook URL.');
  const sharedSecret = String(input.sharedSecret ?? base.sharedSecret);
  if (sharedSecret && sharedSecret.length < 16) errors.push('Khoá chung tối thiểu 16 ký tự (sinh: openssl rand -hex 32).');
  const value: ChatSettings = {
    mode, webhookUrl, sharedSecret,
    rulesFallback: input.rulesFallback ?? base.rulesFallback,
    timeoutMs: num(input.timeoutMs ?? base.timeoutMs, base.timeoutMs, 2000, 60000),
    rateMax: num(input.rateMax ?? base.rateMax, base.rateMax, 3, 500),
    retentionDays: num(input.retentionDays ?? base.retentionDays, base.retentionDays, 1, 3650),
    sessionRetentionDays: num(input.sessionRetentionDays ?? base.sessionRetentionDays, base.sessionRetentionDays, 30, 3650),
  };
  return errors.length ? { ok: false, errors } : { ok: true, value };
}

/* Đệm 5 giây cho mỗi (CSDL, env): mỗi tin nhắn không phải đọc lại bảng; lưu thì xoá đệm. */
let cache: { at: number; sql: Sql; env: ChatSettingsEnv; value: ChatSettings } | null = null;
export const invalidate = () => { cache = null; };

export async function getChatSettings(sql: Sql, env: ChatSettingsEnv): Promise<ChatSettings> {
  if (cache && cache.sql === sql && cache.env === env && Date.now() - cache.at < 5000) return cache.value;
  const base = defaults(env);
  const row = (await sql.query<{ value: any }>("SELECT value FROM app_settings WHERE key = 'chat'")).rows[0];
  const v = row ? validate(row.value, base) : { ok: true as const, value: base };
  const value = v.ok ? v.value : base;
  cache = { at: Date.now(), sql, env, value };
  return value;
}

export async function saveChatSettings(sql: Sql, value: ChatSettings, by: string) {
  await sql.query(
    `INSERT INTO app_settings (key, value, updated_by) VALUES ('chat', $1::text::jsonb, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now(), updated_by = EXCLUDED.updated_by`,
    [JSON.stringify(value), by]);
  invalidate();
}

/** "a1b2…9f0e" — đủ để nhận ra đã đặt khoá nào, không đủ để dùng. */
export const maskSecret = (s: string) => (!s ? '' : s.length <= 8 ? '••••' : `${s.slice(0, 4)}…${s.slice(-4)}`);
