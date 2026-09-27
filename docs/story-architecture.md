# Kiến trúc kể chuyện

Tài liệu này trả lời: **một trang sản phẩm kể chuyện bằng cách nào**, và **sửa
câu chuyện ở đâu** mà không phải đụng vào một dòng `.astro`.

---

## 1. Vấn đề mà mô hình này sinh ra để giải

Đo được vào lúc bắt đầu: **10 trên 12 sản phẩm đã xuất bản dùng ĐÚNG một chuỗi
khối giống hệt nhau.**

```
hero > problem > cards > ingredients > routine > steps > compare > order > faq > relatedProducts
```

Không phải vì người viết lười. Nguyên nhân nằm trong mã: nhịp thị giác của
trang được tính theo **LOẠI** khối, bằng một bảng tra nằm ngay trong
`ProductLanding.astro`:

```js
const ACT = {
  problem: 'bone', cards: 'bone',
  ingredients: 'paper', timeline: 'paper', ...
};
```

Nên `Ingredients` **luôn** là nền paper, `Steps` **luôn** là mist — bất kể
trang đang kể chuyện gì. Component tự quyết định nó là phần nào của câu chuyện,
và câu chuyện không có tiếng nói nào.

Hệ quả: kem chống nắng và bộ kit peel có hai câu chuyện rất khác nhau, nhưng
hai trang đọc lên thì giống nhau.

---

## 2. Tách "khối LÀ GÌ" khỏi "khối ở ĐÂY để làm gì"

Mô hình mới thêm đúng một khái niệm: **vai** (`narrativeRole`).

```json
{ "type": "ingredients", "narrativeRole": "proof" }
```

- `type` — khối này hiển thị **cái gì** (bảng thành phần)
- `narrativeRole` — nó đang trả lời **câu hỏi nào** của người đọc

Cùng một component đóng được hai vai ở hai trang. Bảng thành phần có thể là
`proof` ở trang này (bằng chứng chính), và là `mechanism` ở trang kia (giải
thích cách hoạt động, còn bằng chứng thật nằm ở khối chứng từ).

**Không khai thì rơi về mặc định theo loại** (`DEFAULT_ROLE` trong
`src/lib/narrative.ts`). Mọi file nội dung cũ chạy y như trước — đây là điều
kiện để mô hình này được thêm vào mà không phải viết lại 24 file JSON.

### Mười bốn vai, mỗi vai một câu hỏi có thật

| Vai | Câu hỏi của người đọc |
| --- | --- |
| `orient` | Đây là cái gì, và có liên quan gì tới tôi? |
| `problem` | Vì sao chuyện này đáng bận tâm? |
| `fit` | Có hợp với tôi không, và ai KHÔNG nên dùng? |
| `mechanism` | Nó hoạt động bằng cách nào? |
| `proof` | Dựa vào đâu mà tin? |
| `safety` | Có gì cần cẩn thận, và giới hạn tới đâu? |
| `usage` | Dùng thế nào cho đúng? |
| `expectation` | Bao lâu thì thấy, và thấy tới mức nào? |
| `comparison` | So với lựa chọn kia thì khác gì? |
| `value` | Bỏ ra ngần này thì nhận được gì? |
| `trust` | Ai đang bán, và nếu có chuyện thì tìm ai? |
| `decision` | Mua thì chuyện gì xảy ra? |
| `faq` | Còn băn khoăn nào chưa được trả lời? |
| `next-step` | Bước hợp lý tiếp theo là gì? |

Danh sách cố tình ngắn. Thêm một vai mà không chỉ ra được câu hỏi của nó là bắt
đầu dựng phân loại cho vui.

---

## 3. Nhịp đi theo vai, không đi theo loại

`resolveRhythm()` trong `src/lib/narrative.ts` gom vai thành **bốn mạch**, mỗi
mạch một bề mặt:

| Mạch | Vai | Bề mặt |
| --- | --- | --- |
| kể chuyện | `problem`, `fit` | `bone` |
| dẫn chứng | `mechanism`, `proof`, `expectation`, `comparison`, `trust` | `paper` |
| hướng dẫn | `usage`, `safety` | `mist` |
| quyết định | `orient`, `value`, `decision` | tự lo nền của mình |

Việc của bề mặt không phải trang trí: khi mắt thấy nền đổi là biết câu chuyện
sang phần khác — đọc được cấu trúc trước khi đọc chữ. Bốn mạch chứ không phải
mười bốn, vì mỗi lần đổi nền phải còn mang nghĩa.

Hai khối liền nhau **cùng mạch** thì bỏ đệm ở chỗ nối (`sameSurface`), thành một
cụm có chủ ý thay vì hai khối dính nhau do trùng màu. Chỗ chuyển mạch thì giãn ra.

Mật độ cũng theo vai: `proof` và `comparison` được `lg` (phần nặng nhất, cần
thở), `decision` được `lg` (đứng tách hẳn ra), phần còn lại `md`.

`surface` và `space` khai trong JSON vẫn thắng. Bảng trên là mặc định hợp lý,
không phải luật — nhưng đừng khai chỉ để "cho khác": nền đổi mà không ứng với
đoạn nào của câu chuyện thì tệ hơn là không đổi.

---

## 4. Năm nguyên mẫu — MÔ TẢ, không phải khuôn ép

`storyArchetype` nói trang này định kể kiểu gì.

| Nguyên mẫu | Câu hỏi trội | Dùng ở |
| --- | --- | --- |
| `single-product` | "Cái này có hợp với tôi không?" | `uv-block-sunscreen`, `smart-target-acne-gel`, `smart-whitening-turmergel` |
| `routine` | "Nó nằm ở đâu trong lộ trình?" | *(chưa dùng)* |
| `bundle` | "Vì sao những món này đi với nhau?" | `combo-nam` |
| `education-led` | "Tôi đang hiểu sai điều gì?" | `retinol-mixpeel-kit`, `bio-active-cleanser`, `bio-deep-detox-rebalance`, `ultra-egf-bio-gel-mask` |
| `comparison` | "Tôi nên chọn cái nào trong hai?" | `smart-brightening-cream`, `smart-first-care-serum`, `biovector-brightening-cream`, `collagen-peptide-cream` |

**Không đoạn mã nào ép thứ tự khối theo nguyên mẫu.** Ép thì lại về đúng chỗ
cũ: mười hai trang một khuôn, chỉ là khuôn mới. `tests/narrative.mjs` đối chiếu
rồi **báo**, không chặn.

### Ví dụ: cùng dữ liệu, ba câu chuyện khác nhau

```
combo-nam            (bundle)         problem > fit > expectation > proof > usage > usage > safety
retinol-mixpeel-kit  (education-led)  problem > safety > proof > expectation > usage > comparison
uv-block-sunscreen   (single-product) problem > comparison > fit > proof > usage > usage
```

Ba khác biệt trên đều **có lý do trong chính sản phẩm**, không phải để bảng
trông đa dạng:

- **combo-nam**: khối ưu đãi chuyển từ vị trí thứ hai xuống ngay trước biểu mẫu
  đặt hàng. Lời hứa về giá đáng ra phải rơi **sau** bằng chứng, không mở màn như
  một biển giảm giá. Và khối `cards` có id `ai-khong-nen-dung` mang vai `safety`
  chứ không phải `fit` — nó nói ai **không nên** mua.
- **retinol-mixpeel-kit**: hero viết thẳng "đọc hết trước khi đặt", và danh sách
  năm trường hợp chống chỉ định đứng ngay sau phần mở đầu, mang vai `safety`.
- **uv-block-sunscreen**: bảng so sánh "kem chống nắng riêng hay hũ kem có màng
  lọc" chuyển lên trước bảng thành phần, vì đó là quyết định người đọc phải làm
  **trước** khi quan tâm tới bảy màng lọc.

---

## 5. Câu nối giữa hai khối

`transition` là một câu, in ở cuối khối, trả lời "vì sao phần sau tồn tại".

```json
{ "type": "problem", "transition": "Nám không phải một loại. Trước khi bàn tới công thức, phải biết mảng sạm trên mặt bạn thuộc nhóm nào." }
```

Dùng **tiết chế**. Đặt câu nối ở mọi khối thì nó thành một loại nhiễu mới, và
người đọc học cách bỏ qua nó. Hiện mỗi trang có nhiều nhất hai câu.

---

## 6. Câu chuyện ĐỌC ĐƯỢC từ HTML

Mỗi `<section>` phát ra `data-narrative-role`. Không có tác dụng thị giác nào —
nó tồn tại để cổng QA kiểm **trang thật** thay vì kiểm lại file JSON mà nó vừa
đọc. Kiểm dữ liệu đầu vào bằng chính dữ liệu đầu vào thì không chứng minh được
gì về trang.

```bash
grep -o 'data-narrative-role="[a-z-]*"' dist/combo-nam/index.html
```

`tests/narrative.mjs` đối chiếu chuỗi render được với chuỗi tính từ dữ liệu, sau
khi loại hai nhóm không render: khối tự lo nền (hero/offer/order) và khối có
cổng consent chưa được đồng ý.

---

## 7. Cổng giữ cho nó không trôi về chỗ cũ

`npm run test:narrative` — 0 lỗi là điều kiện để build xanh.

| Phép đo | Chặn? |
| --- | --- |
| Có đủ vai bắt buộc (`orient`, `proof`, `decision`) | có |
| Bằng chứng đứng **trước** khối đặt hàng | có |
| Đúng một vùng quyết định | có |
| Gợi ý không tự trỏ về chính nó | có |
| **Không phải mọi trang dùng chung một chuỗi vai** (< 75%) | có |
| Khớp nhịp của nguyên mẫu đã khai | không — chỉ báo |
| Khối chứng từ có mục thật | có |
| Vai render ra HTML khớp vai tính từ dữ liệu | có |

Ngưỡng 75% chứ không phải 100%: các sản phẩm cùng một dòng, cùng độ phức tạp thì
**được phép** kể giống nhau. Ép khác nhau chỉ để khác là tạo khác biệt giả.

> **Con số hiện tại: chuỗi phổ biến nhất chiếm 8/12 (67%).**
>
> Đây là điều cần nói thẳng. Tám trang dùng chung
> `problem > comparison > fit > proof > usage > usage > faq > next-step`, và con
> số này **tăng** so với lúc đầu (7/12) sau khi chuyển bảng so sánh lên sớm.
> Từng trang một thì việc chuyển đều có lý do thật. Nhưng cộng lại, danh mục này
> đơn giản là có rất nhiều quyết định dạng "chọn cái nào trong hai" — và những
> trang đối diện cùng một câu hỏi thì kể giống nhau là **đúng**, không phải lười.
>
> Việc của cổng không phải ép con số xuống, mà là giữ nó **nhìn thấy được**: nếu
> có ngày nền tảng trôi về một khuôn duy nhất, cổng đỏ trước khi ai kịp quen.

---

## 8. Thêm một sản phẩm thì làm gì

1. Thêm `src/content/products/<slug>/vi.json` (và `en.json`).
2. Khai `storyArchetype` theo **câu hỏi trội** của trang, đọc từ chính nội dung —
   không phải theo dòng sản phẩm.
3. Xếp `blocks[]` theo câu chuyện thật của sản phẩm đó.
4. Khai `narrativeRole` **chỉ ở chỗ mặc định sai**. Khối "ai không nên dùng" là
   `safety`, không phải `fit` — đây là chỗ sai hay gặp nhất.
5. Thêm nhiều nhất hai `transition`, ở chỗ người đọc thật sự cần biết vì sao
   phần sau tồn tại.
6. Khai `adContext` (xem `docs/ad-readiness.md`).
7. `npm run test:narrative` và đọc cả phần **lưu ý**, không chỉ phần lỗi.

Không sửa file `.astro` nào.
