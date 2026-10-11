# Chương trình khuyến mãi theo lịch

Mỗi đợt khuyến mãi là **một nội dung riêng** trong trang quản trị (**Bán hàng → Khuyến mãi**).
Không sửa trang sản phẩm. Đợt có giờ bắt đầu và giờ kết thúc; tới giờ là website **tự hiện**,
hết giờ là **tự gỡ**.

## Website tự làm gì

| Lúc | Website |
|---|---|
| Tới giờ bắt đầu | Trong vòng ~1–3 phút: máy chủ tự xuất bản lại. Trang sản phẩm có khối ưu đãi ngay dưới phần đầu trang. Biểu mẫu đặt hàng có gói khuyến mãi xếp trên cùng, chọn sẵn. Đầu mọi trang có dải thông báo (nếu khai `banner`). |
| Đang chạy | Giờ kết thúc in đúng giờ thật ("Kết thúc lúc 23:59, 11/10/2026"), không dùng đồng hồ đếm ngược giả. |
| Hết giờ | Trong vòng ~1–3 phút: tự xuất bản lại, gói và dải thông báo biến mất. |
| Khách đặt theo gói đã hết | Ví dụ khách mở trang từ hôm trước rồi mới đặt. Đơn **vẫn vào**, và ghi chú nội bộ của đơn có dòng ⚠ để nhân viên báo đúng giá khi gọi xác nhận. |

Giá mua lẻ **không gõ tay**. Máy cộng giá đang bán của từng món trong gói, rồi tính "tiết kiệm"
và "giảm %" trên giá đó (làm tròn xuống). Quà có khai giá trị thì in "trị giá …", nhưng không
cộng vào phần tiết kiệm.

## Tạo đợt của tháng mới (5 phút)

1. **Khuyến mãi → Nhân bản đợt gần nhất.**
2. Sửa:
   - **Mã (id)**: dạng `2026-11-sale-1111` (chữ thường, số, gạch nối).
   - **Bắt đầu / Kết thúc**: luôn ghi đủ giờ và `+07:00`. "Đến hết ngày 11/11" thì ghi kết thúc
     là `2026-11-12T00:00:00+07:00`.
   - Trong ô JSON: `name`, `badge`, `banner`, các gói (`packs`), điều kiện (`terms`).
   - **Trạng thái: Đang hiện.** Bản nháp thì không bao giờ chạy.
3. **Kiểm tra & lưu.** Sai định dạng hoặc gõ số tiền vào chữ thì trang báo lỗi ngay, chưa lưu.
4. Mở lại **Khuyến mãi** và xem:
   - giá gói, giá mua lẻ, % giảm, giá trị quà có đúng ý không;
   - ô **"Cần xem lại trước khi chạy"** (xem phần pháp lý bên dưới).
5. Xong. Đợt **chưa tới giờ** thì không cần bấm Xuất bản: tới giờ máy chủ tự làm.

> Sửa một đợt **đang chạy** (đổi giá, thêm gói) thì phải bấm **Xuất bản**. Lịch tự động chỉ
> phản ứng khi một đợt bắt đầu hoặc kết thúc, không phản ứng khi nội dung đợt thay đổi.

## Các trường

| Trường | Ý nghĩa |
|---|---|
| `status` | `published` = được chạy theo lịch; `draft` = không chạy |
| `name` | tên đợt, hiện làm tiêu đề khối ưu đãi (≤ 60 ký tự) |
| `startsAt`, `endsAt` | mốc giờ có múi giờ, ví dụ `2026-10-08T00:00:00+07:00`; `endsAt` là lúc **hết** |
| `locales` | ngôn ngữ trang được chạy, mặc định `["vi"]` |
| `badge` | nhãn ngắn trên giá và dải đầu trang: `10.10`, `11.11` |
| `banner` | `{ "text": "…", "href": "/uv-block-sunscreen/#uu-dai" }`; bỏ đi nếu không muốn dải đầu trang |
| `packs[].id` | mã gói, không trùng trong cùng đợt |
| `packs[].showOn` | các trang sản phẩm hiện gói này (slug); một combo có thể hiện ở nhiều trang |
| `packs[].label` | tên gói, **đúng chữ lưu vào đơn hàng**, tối đa 40 ký tự |
| `packs[].items` | gồm gì: `[{ "product": "uv-block-sunscreen", "qty": 2 }]` |
| `packs[].price` | giá gói (VND, số nguyên) |
| `packs[].gifts` | quà: `[{ "name": "Sữa rửa mặt Bio-Active mini", "qty": 2, "value": 140000 }]`; `value` là giá trị **một** món |
| `packs[].recommended` | `true` = gói được chọn sẵn trong biểu mẫu, có nhãn "Nhiều người chọn" |
| `terms` | điều kiện chương trình, in dưới các gói |
| `registration` | `{ "authority", "reference", "date" }` của thông báo khuyến mại đã gửi Sở Công Thương |

Gói chỉ có **1 món × 1, không quà** thì được hiểu là **giá bán ưu đãi** của chính sản phẩm đó.
Khi ấy dữ liệu cho Google (JSON-LD) cũng phát giá ưu đãi, kèm hạn bằng ngày kết thúc đợt.

## Cảnh báo pháp lý trên trang Khuyến mãi

Trang **không chặn** các trường hợp dưới đây, mà hiện cảnh báo để người có thẩm quyền quyết định:

- **Mức giảm trên 50%** so với giá đang bán. Khuyến mại giảm giá thường bị giới hạn 50% theo
  Nghị định 81/2018/NĐ-CP (đã sửa đổi, bổ sung bởi Nghị định 128/2024/NĐ-CP), trừ chương trình
  khuyến mại tập trung.
- **Quà trị giá trên 50%** giá trị hàng mua.
- **Gói không rẻ hơn mua lẻ** mà cũng không có quà khai giá trị.
- **Chưa ghi `registration`**: phần lớn hình thức khuyến mại phải thông báo Sở Công Thương trước
  khi chạy.

Mức giảm tính trên **giá đang bán ngay trước đợt**, không tính trên "giá niêm yết". Vì vậy con số
trên website có thể thấp hơn con số trên banner quảng cáo (banner thường tính trên giá niêm
yết). Con số trên website là con số khách đối chiếu được. Các mức trên chỉ là kiểm tra nhanh;
trước mỗi đợt lớn nên hỏi lại người phụ trách pháp lý.

## Xem trước một đợt chưa tới giờ (cho kỹ thuật)

```bash
PROMO_NOW=2026-10-15T09:00:00+07:00 npm run build && npm run preview
```

Trên máy chủ thật không đặt `PROMO_NOW`. `PROMO_SCHEDULER=0` tắt lịch tự xuất bản (chỉ dùng khi
chạy thử trên máy).

## Ví dụ

[`src/content/promotions/2026-10-ngay-doi-1010.json`](../src/content/promotions/2026-10-ngay-doi-1010.json):
combo 2 kem chống nắng tặng 2 sữa rửa mặt mini, và combo mụn + thâm + chống nắng hiện ở cả ba
trang sản phẩm liên quan.

## Duyệt trước các đợt nháp (bản demo)

Đợt ở trạng thái **Nháp** không bao giờ chạy trên website thật. Muốn xem nó hiện ra thế nào:

```bash
PUBLIC_DEMO_CONTENT=1 npm run build
```

Bản demo cho mọi đợt nháp chạy theo đúng lịch của nó, kèm nhãn **"Bản xem thử"** (hoặc "Gói xem thử" khi trộn
với đợt thật), và tự gắn `noindex`. Hai đợt nháp mẫu phủ mọi sản phẩm và mọi combo:
`2026-10-xem-thu-gia-tot.json` (giá ưu đãi từng món) và `2026-10-xem-thu-combo-qua.json` (combo kèm quà).
Sinh lại bằng `node ads/_work/tools/gen-promos.mjs`. Gói có thể hiện trên trang combo: ghi slug combo vào `showOn`.
