/**
 * Thông tin cửa hàng là MỘT nguồn: `src/data/mocha.json` (trang quản trị: Website → Thông tin
 * cửa hàng). Nội dung không chép số điện thoại, email, địa chỉ hay mã số thuế — nó viết mã:
 *
 *   {{storeName}} · {{phone}} · {{zalo}} · {{email}} · {{address}} · {{taxId}} · {{facebook}} · {{hours}}
 *
 * và trang thay bằng giá trị đang khai lúc build. Đổi số hotline ở trang quản trị là mọi
 * trang, mọi câu hỏi đáp, llms.txt và dữ liệu có cấu trúc đổi theo, không sót chỗ nào.
 */

export interface Declarant { id: string; label: string; brand?: string; name: string; address: string }

export function brandTokens(b: any): Record<string, string> {
  const fb = (b.profiles ?? []).find((p: any) => /facebook/i.test(p.name))?.url ?? '';
  return {
    storeName: b.tradingName ?? '',
    phone: b.phoneDisplay ?? '',
    phoneIntl: b.phone ?? '',
    zalo: b.zalo ?? '',
    email: b.email ?? '',
    address: b.address ?? '',
    taxId: b.taxId ?? '',
    facebook: fb,
    /* Để trống giờ làm việc = phục vụ 24/7. */
    hours: b.hours || '24/7',
  };
}

const TOKEN = /\{\{(storeName|phone|phoneIntl|zalo|email|address|taxId|facebook|hours)\}\}/g;

/** Thay mã thông tin cửa hàng trong MỌI chuỗi của một cây dữ liệu (không đụng mã giá như {{price}}). */
export function expandBrandTokens<T>(data: T, b: any): T {
  const v = brandTokens(b);
  const walk = (n: any): any => {
    if (typeof n === 'string') return n.includes('{{') ? n.replace(TOKEN, (_, k) => v[k]) : n;
    if (Array.isArray(n)) return n.map(walk);
    if (n && typeof n === 'object') return Object.fromEntries(Object.entries(n).map(([k, x]) => [k, walk(x)]));
    return n;
  };
  return walk(data);
}

/**
 * Tên + địa chỉ tổ chức công bố của một sản phẩm, lấy từ `brand.declarants` theo
 * `compliance.declarant`.
 *
 * Mã không có trong danh sách: CẢNH BÁO lúc build và để trống, trang tự hiện "cần bổ sung".
 * Bản trước dừng build — đúng về nguyên tắc, nhưng lần deploy 2026-10-11 cho thấy hậu quả:
 * Thông tin cửa hàng trong CSDL còn bản cũ chưa có danh sách tổ chức, thế là MỌI lần xuất bản
 * đều hỏng, kể cả những sửa đổi không liên quan. Thiếu dữ liệu pháp lý của một sản phẩm phải
 * hiện ra ở đúng sản phẩm đó, không được chặn cả website.
 */
export function resolveCompliance<T extends { slug: string; compliance: any }>(p: T, b: any): T {
  const c = p.compliance;
  if (!c?.declarant) return p;
  const d: Declarant | undefined = (b.declarants ?? []).find((x: Declarant) => x.id === c.declarant);
  if (!d) {
    console.warn(`
⚠️  Sản phẩm "${p.slug}": tổ chức công bố "${c.declarant}" chưa có trong Thông tin cửa hàng ` +
      `(trang quản trị → Thông tin cửa hàng → Tổ chức công bố). Trang hiện cảnh báo "cần bổ sung".`);
    return { ...p, compliance: { ...c, declaringOrganization: undefined, declaringAddress: undefined } };
  }
  return { ...p, compliance: { ...c, declaringOrganization: d.name || undefined, declaringAddress: d.address || undefined, brandName: d.brand || undefined } };
}

/** Thương hiệu in trên bao bì của sản phẩm (Mocha, Hairborn) — KHÔNG phải tên cửa hàng bán nó. */
export function productBrand(p: { compliance?: any }, b: any): string {
  const id = p.compliance?.declarant;
  const d = (b.declarants ?? []).find((x: Declarant) => x.id === id);
  return d?.brand || p.compliance?.brandName || b.tradingName;
}
