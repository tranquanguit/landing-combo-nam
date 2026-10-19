/**
 * Cấu hình tương tác trên website (brand.engagement, sửa ở /admin/store) — giá trị mặc định
 * ở MỘT chỗ, dùng cho cả lúc build lẫn trang quản trị.
 */
export interface Engagement {
  promoPopup: boolean; promoDelaySec: number;
  chatInvite: boolean; chatDelaySec: number;
  exitLead: boolean;
  recentOrders: boolean; recentOrdersGapSec: number;
}

export const ENGAGEMENT_DEFAULTS: Engagement = {
  promoPopup: true, promoDelaySec: 4,
  chatInvite: true, chatDelaySec: 10,
  exitLead: true,
  recentOrders: true, recentOrdersGapSec: 20,
};

export function engagementOf(brand: any): Engagement {
  return { ...ENGAGEMENT_DEFAULTS, ...(brand?.engagement ?? {}) };
}

/** Trang đang nói về một sản phẩm / combo / dòng: lời mời chat và biểu mẫu "để lại số" gọi đúng tên nó. */
export interface Subject { slug: string; name: string; kind: 'product' | 'combo' | 'line' }
