# Ảnh chờ văn bản đồng ý

Ảnh người thật chưa có văn bản đồng ý (`consent.obtained: false`) nằm ở đây, KHÔNG
nằm trong `src/assets/`.

Lý do: `Gallery.astro` ẩn khối khỏi trang, nhưng `import.meta.glob(..., { eager: true })`
vẫn khiến Astro phát ảnh ra `dist/_astro/`. Kiểm định lần 6 tải được cả 4 ảnh
trước/sau khuôn mặt khách hàng bằng HTTP 200 trên bản production, dù khối đã ẩn.
Nghị định 13/2023 không phân biệt "có link tới" và "đã công bố".

Khi đã có văn bản đồng ý: chuyển file vào `src/assets/images/` và đổi
`consent.obtained` thành `true` trong file nội dung. `scripts/check-budget.mjs`
chặn trường hợp ngược lại — ảnh của khối chưa có đồng ý mà lọt vào `dist`.
