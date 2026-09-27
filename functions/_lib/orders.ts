/**
 * Phần thuần logic của API đặt hàng: chuẩn hoá, kiểm tra, dựng câu lệnh.
 *
 * Tách ra khỏi handler để kiểm thử được bằng SQLite thật trong Node, thay vì
 * phải dựng cả runtime Workers. Cả hai nơi dùng CHUNG mã này — nên phép thử
 * kiểm đúng thứ đang chạy trên production, không phải một bản mô phỏng.
 */

export const MAX_BODY_BYTES = 8 * 1024;

/** Giới hạn độ dài, khớp với maxlength trên biểu mẫu. */
export const LIMITS = {
  name: 80,
  phone: 20,
  address: 240,
  country: 60,
  note: 500,
  pack: 40,
  productSlug: 60,
  consentText: 500,
  utm: 120,
} as const;

export type OrderInput = Record<string, unknown>;

export interface CleanOrder {
  orderCode: string;
  createdAt: string;
  productSlug: string;
  locale: string;
  pack: string;
  packPrice: number | null;
  currency: string;
  name: string;
  phone: string;
  address: string | null;
  country: string | null;
  note: string | null;
  consentText: string;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  referrerHost: string | null;
}

export interface Rejection { field: string; code: string; }

/**
 * Chuẩn hoá số điện thoại Việt Nam về dạng 0xxxxxxxxx.
 * Khách hay dán số từ Zalo ở dạng +84 hoặc 84 — cùng một số, phải gộp lại,
 * nếu không cùng một người sẽ thành hai khách trong cơ sở dữ liệu.
 */
export function normalisePhone(raw: string): string {
  return raw.replace(/[\s.\-()]/g, '').replace(/^\+?84/, '0');
}

const VN_PHONE = /^0\d{9}$/;
/** Số quốc tế: cho qua dạng E.164 để còn bán được ra ngoài Việt Nam. */
const INTL_PHONE = /^\+\d{8,15}$/;

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/** Ký tự điều khiển trong dữ liệu khách là dấu hiệu bị nhét thêm, không phải lỗi gõ. */
const CONTROL = /[\u0000-\u001f\u007f]/;

const LOCALES = new Set(['vi', 'en', 'th', 'id']);

/**
 * Mã đơn đọc được qua điện thoại. Bỏ các ký tự dễ nghe nhầm (0/O, 1/I/L, 5/S)
 * — nhân viên đọc mã cho khách qua hotline, không phải copy-paste.
 */
const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRTUVWXYZ';
export function makeOrderCode(now: Date, random: () => number = Math.random): string {
  const d = now.toISOString().slice(2, 10).replace(/-/g, '');
  let tail = '';
  for (let i = 0; i < 4; i++) tail += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)];
  return `MC-${d}-${tail}`;
}

/** Chỉ giữ tên miền của referrer. URL đầy đủ có thể mang theo tham số nhận dạng. */
export function referrerHost(referer: string | null): string | null {
  if (!referer) return null;
  try { return new URL(referer).hostname.slice(0, 120); } catch { return null; }
}

export interface ValidateOptions {
  now?: Date;
  random?: () => number;
  /** Gói nào cần địa chỉ giao hàng. Gói "chỉ tư vấn" thì không. */
  requiresAddress?: boolean;
}

/**
 * Kiểm tra và làm sạch. Trả về { ok: false, rejections } thay vì ném lỗi, để
 * handler trả về đúng trường nào sai cho biểu mẫu tô đỏ.
 */
export function validateOrder(
  body: OrderInput,
  opts: ValidateOptions = {},
): { ok: true; order: CleanOrder } | { ok: false; rejections: Rejection[] } {
  const now = opts.now ?? new Date();
  const bad: Rejection[] = [];

  // Bẫy bot: ô ẩn mà người thật không bao giờ điền được.
  if (str(body.website) !== '') bad.push({ field: 'website', code: 'honeypot' });

  const name = str(body.name);
  if (name.length < 2) bad.push({ field: 'name', code: 'too_short' });
  else if (name.length > LIMITS.name) bad.push({ field: 'name', code: 'too_long' });
  else if (CONTROL.test(name)) bad.push({ field: 'name', code: 'invalid' });

  const phoneRaw = str(body.phone);
  const phone = normalisePhone(phoneRaw);
  if (phoneRaw.length > LIMITS.phone) bad.push({ field: 'phone', code: 'too_long' });
  else if (!VN_PHONE.test(phone) && !INTL_PHONE.test(phone)) {
    bad.push({ field: 'phone', code: 'invalid' });
  }

  const pack = str(body.pack);
  if (!pack) bad.push({ field: 'pack', code: 'required' });
  else if (pack.length > LIMITS.pack) bad.push({ field: 'pack', code: 'too_long' });

  const needsAddress = opts.requiresAddress ?? true;
  const address = str(body.address);
  if (needsAddress && address.length < 8) bad.push({ field: 'address', code: 'too_short' });
  else if (address.length > LIMITS.address) bad.push({ field: 'address', code: 'too_long' });

  const note = str(body.note);
  if (note.length > LIMITS.note) bad.push({ field: 'note', code: 'too_long' });

  const country = str(body.country);
  if (country.length > LIMITS.country) bad.push({ field: 'country', code: 'too_long' });

  // Đồng ý dữ liệu cá nhân là điều kiện để LƯU, không phải một ô tuỳ chọn.
  // Không tick thì không có cơ sở pháp lý để ghi vào cơ sở dữ liệu.
  if (body.dataConsent !== true && body.dataConsent !== 'true' && body.dataConsent !== 'on') {
    bad.push({ field: 'dataConsent', code: 'required' });
  }
  const consentText = str(body.consentText).slice(0, LIMITS.consentText);
  if (!consentText) bad.push({ field: 'consentText', code: 'required' });

  const productSlug = str(body.productSlug);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(productSlug) || productSlug.length > LIMITS.productSlug) {
    bad.push({ field: 'productSlug', code: 'invalid' });
  }

  const locale = str(body.locale) || 'vi';
  if (!LOCALES.has(locale)) bad.push({ field: 'locale', code: 'invalid' });

  // Giá gói: tin vào dữ liệu build chứ không tin trình duyệt — nhưng vẫn ghi lại
  // để đối chiếu nếu khách nói "lúc tôi đặt giá khác".
  let packPrice: number | null = null;
  if (body.packPrice !== undefined && body.packPrice !== null && body.packPrice !== '') {
    const n = Number(body.packPrice);
    if (!Number.isInteger(n) || n < 0 || n > 1_000_000_000) {
      bad.push({ field: 'packPrice', code: 'invalid' });
    } else packPrice = n;
  }

  if (bad.length) return { ok: false, rejections: bad };

  const utm = (v: unknown) => {
    const s = str(v).slice(0, LIMITS.utm);
    return s && !CONTROL.test(s) ? s : null;
  };

  return {
    ok: true,
    order: {
      orderCode: makeOrderCode(now, opts.random),
      createdAt: now.toISOString(),
      productSlug,
      locale,
      pack,
      packPrice,
      currency: 'VND',
      name,
      phone,
      address: address || null,
      country: country || null,
      note: note || null,
      consentText,
      utmSource: utm(body.utmSource),
      utmMedium: utm(body.utmMedium),
      utmCampaign: utm(body.utmCampaign),
      utmContent: utm(body.utmContent),
      utmTerm: utm(body.utmTerm),
      referrerHost: typeof body.referrerHost === 'string' ? body.referrerHost.slice(0, 120) : null,
    },
  };
}

export const INSERT_SQL = `
INSERT INTO orders (
  order_code, created_at, product_slug, locale, pack, pack_price, currency,
  name, phone, address, country, note, data_consent, consent_text,
  utm_source, utm_medium, utm_campaign, utm_content, utm_term, referrer_host
) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1,?,?,?,?,?,?,?)`;

export function insertParams(o: CleanOrder): unknown[] {
  return [
    o.orderCode, o.createdAt, o.productSlug, o.locale, o.pack, o.packPrice, o.currency,
    o.name, o.phone, o.address, o.country, o.note, o.consentText,
    o.utmSource, o.utmMedium, o.utmCampaign, o.utmContent, o.utmTerm, o.referrerHost,
  ];
}

/**
 * Cùng số điện thoại + cùng gói trong vòng 2 phút = một lần bấm hai lần, không
 * phải hai đơn. Trả về mã đơn cũ để khách thấy đúng một xác nhận.
 */
export const DEDUPE_SQL = `
SELECT order_code FROM orders
 WHERE phone = ? AND pack = ? AND created_at > ?
 ORDER BY id DESC LIMIT 1`;

export const DEDUPE_WINDOW_MS = 2 * 60 * 1000;

/** Băm IP để đếm nhịp gửi mà không lưu được chính IP đó. */
export async function hashIp(ip: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${ip}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].slice(0, 8)
    .map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const RATE_LIMIT_MAX = 8;
export const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

/** So sánh chuỗi trong thời gian không đổi — token quản trị không được dò từng ký tự. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
