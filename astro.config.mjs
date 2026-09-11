// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

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
