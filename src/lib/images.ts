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
  width = 1200
): Promise<string | undefined> {
  if (!src) return undefined;
  const mod = assets[`/src/assets${src}`];
  // Picture.astro đã dừng build khi ảnh không tồn tại; ở đây ảnh trong public/ là
  // trường hợp còn lại hợp lệ duy nhất.
  if (!mod) return new URL(src, site).href;
  const img = await getImage({
    src: mod.default,
    width: Math.min(width, mod.default.width),
    format: 'webp',
  });
  return new URL(img.src, site).href;
}
