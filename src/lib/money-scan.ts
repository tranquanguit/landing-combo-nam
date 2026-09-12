/**
 * Dò số tiền viết tay trong nội dung.
 *
 * Tách khỏi money-text.ts và cố ý KHÔNG import gì, để bộ thử trong tests/ nạp
 * được trực tiếp mà không cần dựng cả Astro.
 */

/**
 * Chuẩn hoá chuỗi trước khi dò số tiền viết tay.
 *
 * Gom mọi cách né đã quan sát được về một dạng: chữ số full-width và Ả Rập,
 * HTML entity dạng số, ký tự zero-width, và thẻ HTML cắt giữa con số.
 */
const NAMED_ENTITY: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  ndash: '-', mdash: '-', hellip: '...', dong: '\u20ab', percnt: '%',
  num: '#', dollar: '$', euro: '\u20ac', pound: '\u00a3', yen: '\u00a5',
};

/** Giải mã entity, lặp tới khi hết, vì `&amp;#273;` cần hai lượt. */
function decodeEntities(input: string): string {
  let s = input;
  for (let i = 0; i < 4; i++) {
    const before = s;
    s = s.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)));
    s = s.replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)));
    s = s.replace(/&([a-z]+);/gi, (m, n) => NAMED_ENTITY[String(n).toLowerCase()] ?? m);
    if (s === before) break;
  }
  return s;
}

export function normaliseForScan(input: string): string {
  let s = decodeEntities(input);

  // Thẻ HTML cắt giữa con số: <strong>1.950</strong><strong>.000</strong>đ
  s = s.replace(/<[^>]*>/g, '');

  // Khoảng trắng lặp: "Cam  kết  hoàn  tiền" vượt được mọi luật có dấu cách cứng.
  s = s.replace(/[ \t]{2,}/g, ' ');

  // Zero-width và các khoảng trắng lạ
  s = s.replace(/[​-‍﻿⁠]/g, '');
  s = s.replace(/[   ]/g, ' ');

  // Full-width -> ASCII
  s = s.normalize('NFKC');

  // Chữ số Ả Rập, Ba Tư, Devanagari -> ASCII
  s = s.replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x0660));
  s = s.replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 0x06F0));
  s = s.replace(/[०-९]/g, (c) => String(c.charCodeAt(0) - 0x0966));

  return s;
}

/**
 * Tìm số tiền viết tay trong một chuỗi nội dung.
 *
 * Chỉ bắt những dạng KHÔNG THỂ hiểu nhầm. "gọi 1900 1000 đồng hành cùng bạn"
 * và "hơn 5 triệu phụ nữ" không phải là giá, nên đơn vị phải đứng độc lập
 * chứ không phải là âm tiết đầu của một từ khác.
 */
export function findHandwrittenMoney(raw: string): string[] {
  const s = normaliseForScan(raw);
  const hits: string[] = [];

  /*
   * Đơn vị tiền phải là MỘT TỪ TRỌN VẸN.
   *
   * Bản trước dùng `(?![\p{L}])` ngay sau `đ`, nên trong "1.050.000 đồng" — cách
   * viết giá phổ biến nhất tiếng Việt — sau `đ` là `ồ`, một chữ cái, và luật tự
   * loại chính nó. Cách viết thường gặp nhất lại là cách chắc chắn lọt.
   *
   * Nay liệt kê đầy đủ các dạng đơn vị (kể cả `đồng`, `dong`, `Việt Nam đồng`,
   * `dollars`) và chỉ đòi ranh giới sau toàn bộ từ đó.
   */
  /* "đồng" là đơn vị tiền, nhưng cũng là âm tiết đầu của nhiều từ ghép
     ("đồng hành", "đồng ý", "đồng thời"). Loại trừ đúng những từ đó thay vì
     loại trừ mọi chữ cái đứng sau — cách sau chính là lỗi khiến
     "1.050.000 đồng" lọt qua hàng rào ở vòng trước. */
  const DONG_COMPOUND = '(?!\\s+(?:hành|ý|thời|bào|nghiệp|đều|loạt|cảm|tình|hồ|phục|tiền|ruộng|quê))';
  const UNIT = '(?:VNĐ|VNÐ|VND|đồng' + DONG_COMPOUND + '|dồng|dong|đ|Ð|₫|USD|EUR|GBP|dollars?|euros?|\\$|€|£)';
  const explicit = new RegExp(
    String.raw`(\d[\d.,_\s]{0,15}\d|\d)\s*(?:Việt\s*Nam\s*)?` + UNIT + String.raw`(?![\p{L}\d])`,
    'giu'
  );
  for (const m of s.matchAll(explicit)) hits.push(m[0].trim());

  /*
   * Số có dấu phân cách hàng nghìn là giá, kể cả khi không kèm đơn vị.
   * "1.050.000" hay "1,050,000" không thể là số đơn hàng hay số điện thoại;
   * còn "1.234.567" thì đúng là mơ hồ nên đòi ít nhất hai nhóm phân cách.
   */
  for (const m of s.matchAll(/\d{1,3}(?:[.,]\d{3}){2,}(?![\d.,])/g)) hits.push(m[0].trim());

  // Đơn vị đứng trước số: USD 39.90, $39, € 12
  for (const m of s.matchAll(/(?:USD|EUR|GBP|VND|VNĐ|[$€£])\s*\d[\d.,]*/gi)) hits.push(m[0].trim());

  // 1tr, 1tr05, 1.05 tr, 1,05 củ
  for (const m of s.matchAll(/\d+(?:[.,]\d+)?\s*(?:tr|củ|lít)\d*(?![\p{L}])/giu)) hits.push(m[0].trim());

  // 990k — chỉ khi 'k' đứng riêng
  for (const m of s.matchAll(/\d+(?:[.,]\d+)?\s*k(?![\p{L}])/giu)) hits.push(m[0].trim());

  /* 630 nghìn đồng | 1,2 triệu.
     Có đơn vị tiền đi kèm thì luôn là giá, bất kể sau đó còn chữ gì.
     Kiểm định lần 7: bản trước đòi kết câu cho MỌI trường hợp, nên
     "990 nghìn đồng thôi" lọt còn "990 nghìn đồng thôi." thì chặn — một dấu
     chấm là toàn bộ khác biệt giữa chặn và cho qua. */
  const scaledWithUnit = /\d+(?:[.,]\d+)?\s*(?:nghìn|ngàn|triệu|tỷ)\s*(?:đồng|đ|₫|VND)(?![\p{L}])/giu;
  for (const m of s.matchAll(scaledWithUnit)) hits.push(m[0].trim());

  /* Không có đơn vị tiền: chặn TRỪ KHI theo sau là một danh từ đếm được.
     Kiểm định lần 8: bản trước đòi phải kết câu, nên "giảm còn 890 nghìn nha",
     "1.5 triệu nhé", "giá 1 triệu 50" đều lọt lên dist, JSON-LD và llms.txt —
     đúng hình dạng lỗi mà vòng 15 tuyên bố đã đóng, chỉ ở nhánh còn lại. */
  const COUNTABLE = '(?:người|phụ nữ|khách|khách hàng|lượt|đơn|sản phẩm|chai|hộp|tuýp|' +
    'năm|ngày|tháng|tuần|giờ|phút|lần|ml|mg|g|kg|km|m2|view|like|follow)';
  const scaledBare = new RegExp(
    // KHÔNG dùng \b sau danh từ tiếng Việt: \b chỉ nhận ký tự ASCII nên sau
    // "nữ" không có biên từ và lookahead tự vô hiệu. Đây là lần thứ hai cái bẫy
    // này xuất hiện trong dự án (lần đầu ở mẫu "bác sĩ khuyên dùng", vòng 10).
    '\\d+(?:[.,]\\d+)?\\s*(?:nghìn|ngàn|triệu|tỷ)(?:\\s*(?:rưỡi|\\d{1,3}))?(?!\\s*' + COUNTABLE + '(?![\\p{L}]))',
    'giu');
  for (const m of s.matchAll(scaledBare)) hits.push(m[0].trim());

  // $ đứng trước số
  for (const m of s.matchAll(/[$€]\s*\d[\d.,]*/g)) hits.push(m[0].trim());

  return [...new Set(hits)];
}

