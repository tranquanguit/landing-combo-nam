# Chat ↔ n8n

Bong bóng chat ở góc phải mọi trang. Mỗi tin khách gửi đi theo đường:

```
Trình duyệt ── POST /api/chat ──▶ máy chủ Mocha ── POST N8N_WEBHOOK_URL ──▶ n8n
           ◀── JSON đã chuẩn hoá ──             ◀── JSON phản hồi ──────────
```

Trình duyệt **không** gọi thẳng n8n. Máy chủ ở giữa để:

- giữ kín địa chỉ webhook và khoá bí mật;
- gắn định danh khách (cookie HttpOnly mà trang không đọc được);
- **kiểm tra phản hồi của n8n** trước khi tới trang: khối lạ bị bỏ, link `javascript:`
  bị bỏ, ảnh miền khác bị bỏ, thẻ sản phẩm lấy tên/giá/ảnh/link từ chính dữ liệu của site;
- không phải nới CSP của website.

Chuẩn JSON (JSON Schema): [`chat/request.schema.json`](chat/request.schema.json) (máy
chủ → n8n) và [`chat/response.schema.json`](chat/response.schema.json) (n8n → máy chủ).

## 1. Cấu hình

Trong `.env` trên máy chủ:

| Biến | Ý nghĩa |
|---|---|
| `N8N_WEBHOOK_URL` | "Production URL" của node Webhook trong n8n |
| `N8N_SHARED_SECRET` | khoá chung — `openssl rand -hex 32` |
| `N8N_TIMEOUT_MS` | chờ n8n tối đa (mặc định 25000) |
| `CHAT_MOCK` | `1` = chưa có n8n, máy chủ trả lời mẫu để xem giao diện |
| `CHAT_RATE_MAX` | số tin tối đa / 10 phút, theo khách và theo IP (mặc định 30) |
| `CHAT_RETENTION_DAYS` | số ngày giữ chữ hội thoại (mặc định 90) |

Chưa đặt `N8N_WEBHOOK_URL` (và `CHAT_MOCK` ≠ 1): chat vẫn mở được, trả lời "tạm nghỉ"
kèm nút gọi hotline / nhắn Zalo — khách không bao giờ bị bỏ lơ.

## 2. Dựng workflow trong n8n

1. **Webhook** — HTTP Method `POST`, Path ví dụ `mocha-chat`, Respond: *Using 'Respond to
   Webhook' Node*. Authentication: **Header Auth**, credential: Name `X-Mocha-Token`,
   Value = `N8N_SHARED_SECRET`.
2. *(Tuỳ chọn, chặt hơn)* **Code** kiểm chữ ký: `X-Mocha-Signature` =
   `sha256=` + HMAC-SHA256(secret, `X-Mocha-Timestamp` + `.` + body thô). Bỏ qua yêu cầu
   có timestamp lệch quá 5 phút.
3. **Xử lý** — ví dụ node AI Agent:
   - prompt người dùng: `{{$json.body.message.text}}`;
   - bộ nhớ hội thoại (Window Buffer Memory / Postgres Chat Memory) với **Session Key =
     `{{$json.body.sessionId}}`**; hoặc dùng sẵn `body.history` (20 lượt gần nhất);
   - ảnh khách gửi: `body.message.images[i].base64` (JPEG/PNG/WebP, ≤ 2MB, đã thu nhỏ ≤
     1280px) — đưa vào model đọc được ảnh;
   - danh sách sản phẩm cho agent: HTTP Request `GET https://<tên-miền>/chat-catalog.json`
     (slug, tên, giá, link, ảnh — sinh lúc build, luôn khớp website);
   - nhắc agent tuân thủ: mỹ phẩm, **không** hứa "trị khỏi", không chẩn đoán bệnh; nám cần
     can thiệp y khoa thì khuyên gặp bác sĩ da liễu (Nghị định 342/2025).
4. **Respond to Webhook** — Respond With *JSON*, body đúng `response.schema.json`.

Thời gian trả lời nên dưới 20 giây; quá `N8N_TIMEOUT_MS` thì khách nhận lời xin lỗi kèm
hotline, và lượt đó được đánh dấu "có lỗi n8n" trong `/admin/chats`.

## 3. Ví dụ

### Máy chủ gửi n8n

```json
{
  "version": "1.0",
  "event": "message",
  "messageId": "6f1c7a3e-2b8d-4c1e-9a55-0e2f3b9d7c10",
  "sessionId": "0b7e4e8a-6a0d-4c4f-8f2a-1d3c5b7e9f01",
  "visitorId": "v_MmkREK1-GV4HfCSU5OE4Mw",
  "ipHash": "0a548307b90166aa",
  "locale": "vi",
  "sentAt": "2026-10-03T08:15:00.000Z",
  "page": {
    "path": "/combo-nam/",
    "title": "Combo Nám Mocha – Kem & Serum chăm sóc da nám | Mocha Việt Nam",
    "product": { "slug": "combo-nam", "name": "Combo Nám Mocha – Smart Brightening Cream X3 + Smart First Care Serum",
                 "price": 1050000, "priceText": "1.050.000đ", "url": "/combo-nam/" },
    "utm": { "source": "facebook", "campaign": "nam-thang10" }
  },
  "message": {
    "text": "Da tôi bị sạm hai bên gò má sau sinh, dùng được không?",
    "images": [{ "mime": "image/jpeg", "base64": "/9j/4AAQSk…", "bytes": 184233, "width": 1280, "height": 960 }]
  },
  "history": [
    { "role": "user", "text": "Chào shop" },
    { "role": "bot", "text": "Chào bạn! Mình có thể giúp gì?" }
  ]
}
```

`event` = `quick_reply` khi khách bấm nút gợi ý; lúc đó `message.payload` mang giá trị
của nút (`message.text` là nhãn nút).

### n8n trả về

```json
{
  "version": "1.0",
  "messages": [
    { "type": "text", "text": "Sạm hai bên gò má sau sinh thường là **nám mảng**. Bạn nên bắt đầu bằng bộ kem + serum, và chống nắng mỗi sáng." },
    { "type": "product", "slug": "combo-nam", "note": "Kem + serum, nồng độ in trên bao bì" },
    { "type": "products", "slugs": ["smart-brightening-cream", "smart-first-care-serum", "uv-block-sunscreen"] },
    { "type": "image", "url": "/images/…", "alt": "…", "caption": "…" },
    { "type": "link", "label": "Xem giấy tờ công bố", "url": "/chung-nhan/" }
  ],
  "quickReplies": [
    { "label": "Cách dùng thế nào?", "payload": "how_to_use" },
    { "label": "Gặp chuyên viên", "payload": "handoff" }
  ],
  "handoff": false
}
```

| Khối | Hiển thị | Ghi chú |
|---|---|---|
| `text` | bong bóng chữ | chữ thuần; `**đậm**` và xuống dòng; HTML hiện nguyên văn |
| `product` | thẻ: ảnh, tên, giá, "Xem chi tiết", "Đặt hàng" | chỉ cần `slug`; giá lấy từ site, n8n không gửi giá |
| `products` | dải thẻ trượt ngang (≤ 6) | slug không có thật bị bỏ |
| `image` | ảnh trong khung chat | **chỉ ảnh cùng tên miền** (CSP); ảnh sản phẩm thì dùng `product` |
| `link` | nút bo tròn | `/…`, `https://…` (mở tab mới), `tel:`, `mailto:` |
| `quickReplies` | nút gợi ý dưới tin cuối | bấm = gửi `event: quick_reply` |
| `handoff: true` | tự thêm nút gọi hotline + Zalo | khi bot muốn chuyển cho người |

n8n trả mảng `[ {...} ]` (kiểu mặc định của vài node) cũng được — máy chủ lấy phần tử đầu.

## 4. Phân biệt khách

Chỉ dùng **IP** thì không đủ: mạng di động ở Việt Nam dùng CGNAT — hàng nghìn khách 4G
có chung một IP — còn một khách lại đổi IP liên tục giữa 4G và wifi. Nên có ba lớp:

| Trường | Là gì | Dùng để |
|---|---|---|
| `visitorId` | mã ngẫu nhiên trong cookie `mocha_vid` (HttpOnly, SameSite=Lax, 1 năm), máy chủ cấp ở tin đầu tiên | nhận ra **cùng một trình duyệt** quay lại — khoá chính để nhớ khách |
| `sessionId` | mã của **một** cuộc trò chuyện; khách bấm "Cuộc trò chuyện mới" thì đổi | khoá bộ nhớ hội thoại trong n8n |
| `ipHash` | SHA-256(`IP_SALT` + IP), cắt 16 ký tự | tín hiệu phụ, chống spam; **không bao giờ gửi IP thô** |

Khách để lại số điện thoại trong chat, hoặc đặt hàng, thì n8n mới gắn được `visitorId`
với một người cụ thể — việc đó nằm ở phía n8n/CRM, website không tự suy ra danh tính.

## 5. Dữ liệu và quyền riêng tư

- Máy chủ lưu **chữ** của từng lượt (bảng `chat_messages`) để nhân viên xem ở
  **`/admin/chats`**, tự xoá sau `CHAT_RETENTION_DAYS` ngày.
- **Ảnh khách gửi không được lưu** trên website — chỉ chuyển tiếp sang n8n; bảng chỉ ghi
  số ảnh. n8n giữ ảnh hay không là cấu hình phía n8n.
- Khung chat ghi rõ: không gửi số CCCD, mật khẩu, số thẻ; ảnh chỉ dùng để tư vấn; kèm link
  chính sách dữ liệu (Nghị định 13/2023).

## 6. Kiểm thử

```bash
npm run test:chat        # 34 phép thử: chuẩn JSON 2 chiều, chữ ký, định danh, chặn phản hồi độc, giới hạn nhịp
npm run verify:docker    # có bước gọi /api/chat (CHAT_MOCK=1)
```

Xem giao diện khi chưa có n8n: chạy máy chủ với `CHAT_MOCK=1` (xem `nhap-lieu.md`, mục cuối).
