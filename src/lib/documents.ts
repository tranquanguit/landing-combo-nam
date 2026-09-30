/**
 * Gom chứng từ cho một trang từ collection `documents`.
 *
 * Quan hệ là DỮ LIỆU (`appliesTo`), không gõ tay theo từng trang: giấy chứng
 * nhận nhà máy khai một lần là hiện trên mọi sản phẩm.
 */
import { isOfferExpired } from './offer';

/** Thứ tự hiển thị: thứ người mua đem đi tra cứu trước, giấy tờ nền sau. */
const KIND_ORDER = ['notification', 'test-report', 'gmp', 'patent', 'trademark', 'business', 'other'];

export interface DocEntry { id: string; data: any }

const warned = new Set<string>();

/** Giấy đã xuất bản, còn hạn, và áp dụng cho `slug` (bỏ trống = mọi giấy). */
export function docsFor(all: DocEntry[], slug?: string) {
  return all
    .map((e) => e.data)
    .filter((d) => d.status === 'published')
    .filter((d) => {
      if (!d.validUntil || !isOfferExpired(d.validUntil)) return true;
      if (!warned.has(d.slug)) {
        warned.add(d.slug);
        console.warn(`\n⚠️  Chứng từ "${d.slug}" hết hiệu lực từ ${d.validUntil} — đã ẩn khỏi trang.\n`);
      }
      return false;
    })
    .filter((d) => !slug || d.appliesTo === 'all' || d.appliesTo.includes(slug))
    .sort((a, b) =>
      KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || b.issuedAt.localeCompare(a.issuedAt));
}

/**
 * Hàng rào: nếu trang có phiếu công bố, thì ÍT NHẤT MỘT phiếu phải mang đúng số
 * tiếp nhận mà sản phẩm khai trong `compliance`.
 *
 * "Ít nhất một" chứ không phải "mọi": một BỘ (combo, kit) gồm nhiều món, mỗi món
 * một phiếu công bố riêng, còn trang khai số của món chính. Nhưng nếu không phiếu
 * nào khớp, trang đang tự mâu thuẫn về một dữ kiện pháp lý — build dừng.
 */
export function assertNotificationMatches(docs: any[], product: any) {
  const own = product.compliance?.productNotificationNumber;
  const notes = docs.filter((d) => d.kind === 'notification');
  if (!notes.length) return;
  if (!own) {
    throw new Error(
      `"${product.slug}" có phiếu công bố (${notes.map((d) => d.reference).join(', ')}) nhưng chưa khai ` +
      `compliance.productNotificationNumber. Khai số của món chính vào file sản phẩm.`);
  }
  if (!notes.some((d) => d.reference === own)) {
    throw new Error(
      `"${product.slug}" khai số tiếp nhận ${own}, nhưng không phiếu công bố nào gắn cho nó mang số đó ` +
      `(${notes.map((d) => `${d.slug}: ${d.reference}`).join('; ')}). Sửa số trong file sản phẩm hoặc gắn đúng phiếu.`);
  }
}
