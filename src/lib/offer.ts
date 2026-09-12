/**
 * Hạn ưu đãi hết hạn hay chưa.
 *
 * Một chỗ duy nhất, vì kiểm định lần 6 phát hiện Offer.astro ẩn dòng hạn ưu đãi
 * khi quá hạn nhưng JSON-LD vẫn phát `priceValidUntil` của 20 tháng trước — giao
 * diện và structured data nói hai điều khác nhau, và Google sẽ ngừng hiển thị giá.
 *
 * Ngày trong file nội dung là ngày theo giờ Việt Nam và tính HẾT ngày đó.
 * `new Date("2026-09-30") < new Date()` so sánh theo UTC nên ưu đãi biến mất từ
 * 07:00 ngày 30/9 giờ Việt Nam — sớm một ngày.
 */
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

export function isOfferExpired(validUntil?: string | null, now: Date = new Date()): boolean {
  if (!validUntil) return false;
  const day = Date.parse(`${validUntil}T00:00:00Z`);
  if (Number.isNaN(day)) return false;
  // Hết ngày đó theo giờ VN = 00:00 ngày hôm sau UTC+7.
  const endOfDayUtc = day + 24 * 60 * 60 * 1000 - VN_OFFSET_MS;
  return now.getTime() >= endOfDayUtc;
}
