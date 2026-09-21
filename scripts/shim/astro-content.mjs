/**
 * Shim `astro:content` để chạy schema ngoài Astro.
 *
 * `scripts/gen-field-docs.mjs` cần nạp src/content.config.ts bằng node thuần
 * để đọc schema, nhưng file đó import 'astro:content' — một module ảo chỉ tồn
 * tại trong Vite. Shim này trả đúng hai thứ schema cần: `z` và một
 * `defineCollection` không làm gì.
 */
export { z } from 'zod';
export const defineCollection = (config) => config;
