/**
 * Lớp đo lường cho landing quảng cáo.
 *
 * Ba ràng buộc quyết định thiết kế này:
 *
 * 1. Pixel quảng cáo là thủ phạm INP số một trên landing bán hàng. Vì vậy không
 *    dùng GTM (container chạy custom HTML đồng bộ trong click handler), và không
 *    nạp script nào trước khi người dùng tương tác lần đầu hoặc trình duyệt rảnh.
 *
 * 2. Trang này tuyên bố bán sang EU và UK. Ở đó, đặt cookie đo lường trước khi có
 *    đồng ý là vi phạm. Nên với mọi thị trường ngoài Việt Nam, không nạp gì cho
 *    tới khi người dùng bấm đồng ý.
 *
 * 3. Không có ID nào được hardcode. Chưa cấu hình biến môi trường thì lớp này
 *    chỉ phát sự kiện trên `window` để mã khác lắng nghe, và không tải gì cả.
 */

export type EventName =
  | 'view_item'
  | 'begin_checkout'
  | 'form_start'
  | 'generate_lead'
  | 'contact';

export interface AnalyticsConfig {
  ga4?: string;
  metaPixel?: string;
  tiktokPixel?: string;
  /** true với thị trường cần đồng ý trước khi đặt cookie đo lường. */
  requireConsent: boolean;
  currency: string;
  value: number;
  itemId: string;
  itemName: string;
}
