/**
 * Neo mặc định của từng loại khối — MỘT nguồn sự thật.
 *
 * Trước đây mỗi component tự khai mặc định trong `Astro.props`, nên schema không
 * biết trang thật có những neo nào. Kiểm định lần 6 chỉ ra hệ quả: CTA phụ của
 * hero hardcode "#thanh-phan", sản phẩm nào không có khối ingredients thì nút đó
 * không đi đâu cả, và build vẫn xanh.
 */
export const DEFAULT_ANCHOR: Record<string, string> = {
  problem: 'van-de',
  ingredients: 'thanh-phan',
  steps: 'huong-dan',
  gallery: 'hieu-qua',
  testimonials: 'danh-gia',
  order: 'dat-hang',
  faq: 'faq',
};
