// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { execSync } from 'node:child_process';

/**
 * lastmod lấy từ lần commit cuối của chính file nội dung.
 *
 * Kiểm định lần 6: sitemap không có lastmod nào. Dùng ngày build thì sai — mỗi
 * lần deploy lại báo "vừa cập nhật" cho những trang không đổi gì. Ngày commit
 * của file JSON là mốc thật, và ổn định giữa các lần build.
 */
function lastmodFor(pathname) {
  const slug = pathname.replace(/^\/(en|th|id)\//, '/').replace(/\/$/, '') || '/';
  const name = slug === '/' ? 'combo-nam' : slug.slice(1);
  const locale = /^\/(en|th|id)\//.test(pathname) ? pathname.split('/')[1] : 'vi';
  const file = `src/content/products/${name}/${locale}.json`;
  try {
    const iso = execSync(`git log -1 --format=%cI -- ${file}`, { encoding: 'utf8' }).trim();
    return iso || undefined;
  } catch {
    return undefined;
  }
}

export const SITE = 'https://mochatrinam.com';

export default defineConfig({
  site: SITE,
  // Một dạng URL duy nhất: canonical và sitemap phải khớp nhau tuyệt đối
  trailingSlash: 'always',

  i18n: {
    defaultLocale: 'vi',
    locales: ['vi', 'en', 'th', 'id'],
    routing: {
      // Tiếng Việt là thị trường chính -> không thêm tiền tố /vi/
      prefixDefaultLocale: false,
      redirectToDefaultLocale: false,
    },
  },

  integrations: [
    sitemap({
      serialize(item) {
        const lastmod = lastmodFor(new URL(item.url).pathname);
        return lastmod ? { ...item, lastmod } : item;
      },
      i18n: {
        defaultLocale: 'vi',
        locales: { vi: 'vi-VN', en: 'en', th: 'th-TH', id: 'id-ID' },
      },
    }),
  ],

  build: {
    // CSS nhỏ thì nhúng thẳng, tiết kiệm một vòng request trên mạng 4G Việt Nam
    inlineStylesheets: 'always',
  },

  // Chưa bật astro:assets: ảnh hiện được tham chiếu bằng đường dẫn chuỗi trong JSON
  // nên pipeline ảnh của Astro không chạm tới. Ảnh đang được nén thủ công.
  // Việc còn lại: chuyển sang import.meta.glob để có srcset tự động.

  vite: {
    build: { cssMinify: 'lightningcss' },
  },
});
