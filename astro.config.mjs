// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export const SITE = 'https://mochatrinam.com';

export default defineConfig({
  site: SITE,
  trailingSlash: 'ignore',

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

  image: {
    responsiveStyles: true,
    layout: 'constrained',
    breakpoints: [360, 414, 640, 750, 1080, 1440],
  },

  vite: {
    build: { cssMinify: 'lightningcss' },
  },
});
