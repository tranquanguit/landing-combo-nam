/**
 * Trả lời theo kịch bản (rule-based) — dùng khi chưa có n8n, hoặc làm dự phòng khi
 * n8n lỗi. Kịch bản quản lý ở /admin/chat-rules (CRUD), lưu bảng chat_rules.
 *
 * So khớp:
 *  - `payloads`: giá trị nút gợi ý, khớp tuyệt đối (ưu tiên cao nhất);
 *  - `keywords`: cụm từ, so KHÔNG DẤU theo ranh giới từ — khách hay gõ "da toi bi nam"
 *    không dấu. Vì "nam" không dấu cũng là "nam giới", người viết kịch bản nên dùng
 *    cụm ("bi nam", "da nam", "tri nam") thay vì một từ trần;
 *  - điều kiện: ngôn ngữ, đường dẫn trang (`path_prefix`), có ảnh (`requires_images`).
 *  Nhiều kịch bản cùng khớp: `priority` cao thắng, rồi tới nhiều cụm khớp hơn, rồi cụm dài hơn.
 *
 * Phản hồi của kịch bản viết ĐÚNG chuẩn docs/chat/response.schema.json và đi qua cùng
 * normalizeResponse() như phản hồi n8n. Biến được thay trước đó:
 *   {{product.name}} {{product.priceText}} {{product.url}}  — sản phẩm của trang đang xem
 *   {{brand.phoneDisplay}} {{brand.zalo}}
 *   slug "{{page}}" trong khối product/products — sản phẩm của trang đang xem
 *
 * Hàng rào khi lưu (guardRule): cùng bộ lọc tuyên bố cấm và số tiền viết tay mà nội dung
 * website đang qua lúc build — một kịch bản "trị nám dứt điểm" hay "chỉ 590k" không lưu được.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Sql } from './db.ts';
import { findForbiddenClaims } from '../../src/lib/claims-lexicon.ts';
import { findHandwrittenMoney } from '../../src/lib/money-scan.ts';

export interface Rule {
  id: number; name: string; topic: string; enabled: boolean; priority: number; locale: 'vi' | 'en' | '*';
  keywords: string[]; payloads: string[]; path_prefix: string | null; requires_images: boolean; is_fallback: boolean;
  response: any; hits?: number; last_hit_at?: string | null;
}
export interface MatchInput { text: string; payload: string; locale: string; path: string; images: number }

export const unaccent = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
  .toLowerCase().replace(/[^a-z0-9%]+/g, ' ').trim();
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Điểm khớp của một kịch bản; null = không khớp. */
export function scoreRule(r: Rule, m: MatchInput): { score: number; hits: string[] } | null {
  if (!r.enabled || r.is_fallback) return null;
  if (r.locale !== '*' && r.locale !== m.locale) return null;
  if (r.path_prefix && !m.path.startsWith(r.path_prefix)) return null;
  if (r.requires_images && !m.images) return null;
  const payload = m.payload.trim().toLowerCase();
  if (payload && r.payloads.some((p) => p.trim().toLowerCase() === payload)) return { score: 1_000_000 + r.priority * 1000, hits: ['payload:' + payload] };
  const text = ' ' + unaccent(m.text) + ' ';
  const hits = r.keywords.filter((k) => {
    const kk = unaccent(k);
    return kk && new RegExp(`(^|\\s)${esc(kk)}(\\s|$)`).test(text);
  });
  if (!hits.length) {
    /* Kịch bản chỉ có điều kiện (ví dụ "khách gửi ảnh"), không có cụm từ nào. */
    if (r.requires_images && !r.keywords.length && !r.payloads.length) return { score: r.priority * 1000, hits: ['images'] };
    return null;
  }
  return { score: r.priority * 1000 + hits.length * 20 + Math.max(...hits.map((h) => h.length)), hits };
}

export function pickRule(rules: Rule[], m: MatchInput): { rule: Rule; hits: string[]; fallback: boolean } | null {
  let best: { rule: Rule; score: number; hits: string[] } | null = null;
  for (const r of rules) {
    const s = scoreRule(r, m);
    if (s && (!best || s.score > best.score)) best = { rule: r, score: s.score, hits: s.hits };
  }
  if (best) return { rule: best.rule, hits: best.hits, fallback: false };
  const fb = rules.filter((r) => r.enabled && r.is_fallback && (r.locale === '*' || r.locale === m.locale))
    .sort((a, b) => b.priority - a.priority)[0];
  return fb ? { rule: fb, hits: [], fallback: true } : null;
}

/** Thay biến trong phản hồi. Khối dùng "{{page}}" mà trang không có sản phẩm thì bị bỏ. */
export function renderResponse(resp: any, ctx: { product?: { slug: string; name: string; priceText: string; url: string } | null; brand: { phoneDisplay: string; zalo: string | null } }) {
  const vars: Record<string, string> = {
    'product.name': ctx.product?.name ?? '', 'product.priceText': ctx.product?.priceText ?? '', 'product.url': ctx.product?.url ?? '',
    'brand.phoneDisplay': ctx.brand.phoneDisplay, 'brand.zalo': ctx.brand.zalo ?? '',
  };
  const sub = (s: string) => s.replace(/\{\{\s*([a-zA-Z.]+)\s*\}\}/g, (all, k) => (k in vars ? vars[k] : all));
  const messages = (Array.isArray(resp?.messages) ? resp.messages : []).flatMap((m: any) => {
    if ((m.type === 'product') && m.slug === '{{page}}') return ctx.product ? [{ ...m, slug: ctx.product.slug }] : [];
    if (m.type === 'products') {
      const slugs = (m.slugs ?? []).map((s: string) => (s === '{{page}}' ? ctx.product?.slug : s)).filter(Boolean);
      return slugs.length ? [{ ...m, slugs }] : [];
    }
    if (m.type === 'text' && /\{\{\s*product\./.test(m.text) && !ctx.product) return [];
    const out: any = { ...m };
    for (const k of ['text', 'label', 'url', 'caption', 'alt', 'note']) if (typeof out[k] === 'string') out[k] = sub(out[k]);
    return [out];
  });
  return { version: '1.0', messages, quickReplies: resp?.quickReplies ?? [], handoff: resp?.handoff === true };
}

// ----------------------------------------------------------------- hàng rào khi lưu
const textsOf = (resp: any): string[] => [
  ...(resp?.messages ?? []).flatMap((m: any) => [m.text, m.note, m.caption, m.label].filter((x: unknown) => typeof x === 'string')),
  ...(resp?.quickReplies ?? []).map((q: any) => q.label).filter(Boolean),
];
const TYPES = new Set(['text', 'image', 'product', 'products', 'link']);
export function guardRule(r: Partial<Rule>): string[] {
  const errs: string[] = [];
  if (!r.name?.trim()) errs.push('Thiếu tên kịch bản.');
  if (!r.is_fallback && !r.keywords?.length && !r.payloads?.length && !r.requires_images) {
    errs.push('Kịch bản cần ít nhất một cụm từ, một giá trị nút gợi ý, hoặc điều kiện "khách gửi ảnh" — nếu không nó không bao giờ khớp.');
  }
  for (const k of r.keywords ?? []) if (unaccent(k).length < 2) errs.push(`Cụm từ quá ngắn: "${k}".`);
  const resp = r.response;
  if (!resp || !Array.isArray(resp.messages) || !resp.messages.length) errs.push('Phản hồi cần "messages" với ít nhất một khối.');
  for (const [i, m] of (resp?.messages ?? []).entries()) {
    if (!TYPES.has(m?.type)) errs.push(`Khối #${i + 1}: loại "${m?.type}" không có trong chuẩn (text, image, product, products, link).`);
    if (m?.type === 'text' && !String(m.text ?? '').trim()) errs.push(`Khối #${i + 1}: chữ rỗng.`);
    if (m?.type === 'text' && String(m.text).length > 4000) errs.push(`Khối #${i + 1}: chữ quá 4000 ký tự.`);
    if (m?.type === 'product' && !m.slug) errs.push(`Khối #${i + 1}: thẻ sản phẩm cần "slug".`);
    if (m?.type === 'link' && !(m.label && m.url)) errs.push(`Khối #${i + 1}: nút cần "label" và "url".`);
  }
  for (const t of textsOf(resp)) {
    for (const h of findForbiddenClaims(t)) errs.push(`Tuyên bố không được dùng (Nghị định 342/2025): "${h.match}" — ${h.why}`);
    for (const h of findHandwrittenMoney(t)) errs.push(`Không viết số tiền trực tiếp ("${h}"): dùng thẻ sản phẩm (giá lấy từ website) hoặc {{product.priceText}}.`);
  }
  return [...new Set(errs)];
}

// ----------------------------------------------------------------- CSDL
let cache: { at: number; sql: Sql; rules: Rule[] } | null = null;
export const invalidateRules = () => { cache = null; };
export async function loadRules(sql: Sql): Promise<Rule[]> {
  if (cache && cache.sql === sql && Date.now() - cache.at < 5000) return cache.rules;
  const rules = (await sql.query<Rule>('SELECT * FROM chat_rules WHERE enabled ORDER BY priority DESC, id')).rows;
  cache = { at: Date.now(), sql, rules };
  return rules;
}
export async function recordHit(sql: Sql, id: number) {
  await sql.query('UPDATE chat_rules SET hits = hits + 1, last_hit_at = now() WHERE id = $1', [id]);
}

/** Lần đầu (bảng trống): nạp bộ kịch bản mẫu db/seed/chat-rules.json. */
export async function seedRules(sql: Sql, root: string, log: (s: string) => void = () => {}) {
  const n = (await sql.query<{ n: number }>('SELECT count(*)::int AS n FROM chat_rules')).rows[0].n;
  const file = join(root, 'db/seed/chat-rules.json');
  if (n > 0 || !existsSync(file)) return 0;
  const seeds: any[] = JSON.parse(readFileSync(file, 'utf8')).rules;
  for (const r of seeds) {
    await sql.query(
      `INSERT INTO chat_rules (name, topic, enabled, priority, locale, keywords, payloads, path_prefix, requires_images, is_fallback, response, updated_by)
       VALUES ($1, $2, true, $3, $4, $5, $6, $7, $8, $9, $10::text::jsonb, 'seed')`,
      [r.name, r.topic ?? 'khac', r.priority ?? 50, r.locale ?? 'vi', r.keywords ?? [], r.payloads ?? [], r.path_prefix ?? null,
        !!r.requires_images, !!r.is_fallback, JSON.stringify(r.response)]);
  }
  invalidateRules();
  log(`  nạp ${seeds.length} kịch bản tư vấn mẫu`);
  return seeds.length;
}
