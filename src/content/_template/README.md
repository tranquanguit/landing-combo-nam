# Thư mục mẫu

Chép cả thư mục này để thêm sản phẩm:

```bash
cp -r src/content/_template src/content/products/<ten-san-pham>/
```

Thư mục `_template` nằm **ngoài** `src/content/products/` nên không bao giờ lên trang.

Sau khi chép, sửa: `slug`, `translationKey`, `name`, `sku`, `price`, `seo`,
`compliance`, rồi nội dung trong `blocks`. Đặt `status: "published"` khi muốn lên trang.

**Bảng trường đầy đủ: [`docs/truong-du-lieu.md`](../../../docs/truong-du-lieu.md)**

Vài điều tiết kiệm thời gian:

- **Không khai kích thước ảnh.** Đặt file vào `src/assets/images/` là đủ; máy đọc
  số pixel từ chính file. Đường dẫn sai thì build dừng và nói rõ cần đặt file ở đâu.
- **Không viết số tiền trực tiếp.** Dùng `{{price}}`, `{{compareAtPrice}}`, `{{save}}`.
- **Không thêm khoá lạ.** Mọi nhóm trường đều bật `strict`, nên `headding` hay
  `ogimage` bị chỉ đích danh thay vì bị bỏ qua âm thầm. Muốn ghi chú thì viết ở
  file README như file này, không nhét vào JSON.
- **Thứ tự `blocks` là thứ tự hiển thị.** Phải có đúng một khối `order`.
- **Lời chứng và ảnh khách hàng** chỉ được đặt trong khối `testimonials`/`gallery`
  có trường `consent`. Chưa có văn bản đồng ý thì đặt `consent.obtained: false` —
  khối tự ẩn khỏi trang và ảnh không được phát ra bản build.
