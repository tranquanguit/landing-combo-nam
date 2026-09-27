# QA đáp ứng

> Sinh tự động bằng `npm run check:responsive -- --md docs/responsive-qa.md`. Đừng sửa tay.
> Chạy ngày 2026-09-26 trên Chromium (Chrome cài sẵn trên máy).

## Cách đo

Mỗi trang mở ở 16 bề ngang, lấy từ máy thật chứ không từ "breakpoint đẹp":

```
320  360  375  390  412  430  480  768  820  834  912  1024  1280  1440  1536  1920
```

Bốn phép đo, mỗi phép ứng với một lỗi từng xảy ra thật:

| Phép đo | Ngưỡng | Vì sao |
| --- | --- | --- |
| Tràn ngang | `scrollWidth <= clientWidth` | thanh cuộn ngang ở khổ hẹp là lỗi bố cục hay gặp và khó chịu nhất |
| Phần tử gây tràn | không có | biết đúng phần tử nào, không chỉ biết là có |
| Vùng chạm | ≥ 24×24 CSS px | WCAG 2.2 AA 2.5.8; link trong câu văn được miễn trừ |
| Thanh CTA dính đáy | không đè nút gửi đơn | nó nổi trên nội dung nên phải kiểm, không suy luận |

Bảng có `overflow-x: auto` được loại khỏi phép đo tràn: chúng cuộn ngang
**có chủ ý**, và đó là cách đúng để một bảng nhiều cột sống trên màn hình hẹp.

## Kết quả

| Trang | Vai trò | Bề ngang đạt | Vấn đề |
| --- | --- | ---: | --- |
| `/` | trang chủ | 16/16 | không |
| `/combo-nam/` | landing combo (bundle) | 16/16 | không |
| `/uv-block-sunscreen/` | landing đơn (single-product) | 16/16 | không |
| `/retinol-mixpeel-kit/` | landing giáo dục (education-led) | 16/16 | không |
| `/nam-tham/` | trang dòng | 16/16 | không |
| `/goc-tu-van/nam-noi-tiet-la-gi/` | bài tư vấn | 16/16 | không |
| `/chinh-sach/chinh-sach-doi-tra/` | trang chính sách | 16/16 | không |
| `/404.html` | trang 404 | 16/16 | không |

**Tổng: 128/128 phép đo đạt.**

## Những gì phép đo này KHÔNG nói

Không tràn ngang không có nghĩa là bố cục đẹp. Cổng này bắt lỗi hỏng,
không chấm thẩm mỹ: nhịp thị giác, chỗ xuống dòng của tiêu đề và sức nặng
của ảnh vẫn phải nhìn bằng mắt. Ảnh chụp ở `--shots` là để làm việc đó.

