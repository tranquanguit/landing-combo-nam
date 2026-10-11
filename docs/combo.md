# Combo sản phẩm

Mỗi combo là một nội dung riêng ở `src/content/combos/<slug>/{vi,en}.json` (trang quản trị: **Nội dung →
Combo**). Website tự dựng:

- trang combo `/combo/<slug>/` (EN: `/en/combos/<slug>/`) gồm ảnh bìa, giá bộ, từng món (bấm sang trang sản
  phẩm), thứ tự dùng khi kết hợp và biểu mẫu đặt hàng;
- trang danh sách `/combo/`, xếp theo nhu cầu;
- khối "Combo có sản phẩm này" trên mỗi trang sản phẩm, "Combo của dòng này" trên trang dòng, và 4 combo
  tiêu biểu ở trang chủ.

## Giá

Chỉ khai **giá bộ** (`price`). Giá mua lẻ = tổng giá đang bán × số lượng của từng món, máy tự cộng. Mức giảm
in ra là phần trăm làm tròn xuống. Combo có giá **không thấp hơn** mua lẻ thì build dừng.

Nguồn giá: *BẢNG GIÁ SẢN PHẨM MOCHA – CHÍNH THỨC.pdf* (Drive đại lý, mục Giấy tờ sản phẩm). Combo không có
trong bảng thì tính theo quy định ở cuối bảng: cộng giá lẻ từng món, giảm tối đa 5% (đơn dưới 500k), 10%
(500k–1tr), 13% (1–2tr), 15% (trên 2tr), làm tròn trong 5.000đ.

**Mua nhiều cùng một món** (2 tuýp kem chống nắng, 3 chai sữa rửa mặt…) không phải combo: đó là một lựa chọn
trong biểu mẫu của chính sản phẩm (`variants`, kèm `qty` để biểu mẫu gạch giá lẻ × số lượng).

## Các trường

| Trường | Ý nghĩa |
|---|---|
| `name`, `shortName` | tên đầy đủ (H1, tên gói trong đơn) và tên ngắn cho thẻ |
| `group` | `nam` · `toan-dien` · `mun` · `peel` · `duong` · `lam-sach` · `toc` — mục trên trang danh sách |
| `order` | thứ tự trong mục |
| `items` | `[{ "product": "<slug sản phẩm>", "qty": 1 }]` — món phải có trang sản phẩm đã xuất bản |
| `gifts` | quà kèm: `{ "product": "<slug>" }` hoặc `{ "name": "Cốc tạo bọt" }` |
| `price` | giá bộ (VND) |
| `purpose` | 1–2 câu: bộ này để làm gì, hợp với ai |
| `note` | lưu ý riêng (không bắt buộc) |
| `image` | bỏ trống = `/images/combo-<slug>.webp` |

Combo có **bộ peel** cùng serum/kem nám/gel mụn/gel thâm/Biovector thì trang tự in lưu ý: dùng peel thành đợt
riêng, các món có hoạt chất để dành tới khi da hết bong và hết nhạy (từ ngày 14 theo hướng dẫn của bộ peel).

## Ảnh bìa combo

Ảnh ghép tự động từ ảnh tách nền của từng món (nền trắng, không chữ, không giá, sản phẩm đặt theo tỉ lệ
kích thước thật). Thêm hoặc sửa combo thì chạy lại:

```bash
python ads/_work/tools/compose.py combos            # mọi combo
python ads/_work/tools/compose.py combos <slug>     # một combo
```

Ảnh nguồn: `ads/mocha-drive/raw/tach-nen/` (dòng Mocha) và `ads/_work/sprite-src/` (Hairborn, tách nền bằng
`ads/_work/tools/cutout.py`). **Không** dùng ảnh banner có in giá / "SIÊU SALE" / ảnh bác sĩ làm ảnh bìa.
