import { getImage } from 'astro:assets';

const assets = import.meta.glob<{ default: ImageMetadata }>(
  '/src/assets/**/*.{jpg,jpeg,png,webp,avif}',
  { eager: true }
);

/**
 * Đổi đường dẫn nội dung dạng "/images/x.webp" thành URL thật sau khi build.
 *
 * Ảnh nằm trong src/assets nên chỉ tồn tại dưới /_astro/ sau khi build; mọi chỗ
 * dùng URL tuyệt đối (og:image, Organization.logo, Product.image) phải đi qua đây,
 * nếu không sẽ trả 404 và mất ảnh xem trước khi chia sẻ.
 */
export async function resolveAssetUrl(
  src: string | undefined,
  site: string,
  width = 1200,
  /**
   * Định dạng đầu ra. Mặc định giữ nguyên định dạng nguồn thay vì ép WebP.
   *
   * Kiểm định lần 7: og:image bị ép sang .webp dù nội dung cố ý khai .jpg, mà
   * Zalo — kênh chia sẻ lớn nhất ở Việt Nam — không render preview WebP.
   */
  format?: 'webp' | 'jpeg' | 'png'
): Promise<string | undefined> {
  if (!src) return undefined;
  const mod = assets[`/src/assets${src}`];
  // Picture.astro đã dừng build khi ảnh không tồn tại; ở đây ảnh trong public/ là
  // trường hợp còn lại hợp lệ duy nhất.
  if (!mod) return new URL(src, site).href;
  const srcFormat = /\.(jpe?g)$/i.test(src) ? 'jpeg' : /\.png$/i.test(src) ? 'png' : 'webp';
  const img = await getImage({
    src: mod.default,
    width: Math.min(width, mod.default.width),
    format: format ?? srcFormat,
  });
  return new URL(img.src, site).href;
}
