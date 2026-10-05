# Lịch sử chat và dữ liệu phân tích

Mục tiêu: mỗi cuộc trò chuyện để lại đủ dữ liệu để trả lời bốn câu hỏi kinh doanh, mà
**không giữ nhiều dữ liệu cá nhân hơn mức cần**:

1. Khách hỏi gì nhiều nhất, và câu nào **chưa trả lời được**? → viết thêm kịch bản / dạy n8n.
2. Kịch bản / n8n nào **dẫn tới bấm thẻ, bấm đặt, ra đơn**? → giữ, nhân rộng, sửa cái yếu.
3. Khách chat đến từ **trang nào, chiến dịch nào**? → đo quảng cáo theo cả đường đi.
4. Chat có **chạy ổn** không (n8n lỗi, chậm, gửi dồn)? → vận hành.

Cấu hình thời hạn lưu: `/admin/settings/chat`. Xem số liệu: `/admin/chats`.
Migration: [`db/pg/0004_chat_admin_rules_analytics.sql`](../db/pg/0004_chat_admin_rules_analytics.sql).

## 1. Ba lớp dữ liệu, ba thời hạn

| Lớp | Bảng | Chứa | Giữ (mặc định) | Vì sao |
|---|---|---|---|---|
| Lượt | `chat_messages` | **chữ** khách gõ + câu trả lời, nguồn trả lời, kịch bản, thẻ đã hiện, độ trễ | **90 ngày** | chữ là dữ liệu cá nhân; đủ để chăm sóc lại và rút câu hỏi mới |
| Phiên | `chat_sessions` | một dòng mỗi cuộc: số đếm, trang vào, utm, chuyển người, đơn | **400 ngày** | không có chữ → giữ được qua một năm để so sánh theo mùa / chiến dịch |
| Sự kiện | `chat_events` | mở khung, bấm thẻ, bấm đặt, bấm link, đơn đặt sau chat | 400 ngày | phễu chuyển đổi |

Xoá tự động chạy mỗi giờ (lúc có tin nhắn mới). Khi chữ hết hạn, `/admin/chats` vẫn
hiện số liệu phiên, chỉ trang xem lại cuộc báo "đã quá hạn lưu".

**Không bao giờ lưu:** ảnh khách gửi (chỉ số ảnh), IP thô (chỉ `ip_hash` = SHA-256 có
muối, 16 ký tự hex), tên / số điện thoại trong chat (nếu khách tự gõ thì nằm trong chữ và
hết hạn theo chữ).

### `chat_messages` — mỗi lượt hai dòng

| Cột | |
|---|---|
| `session_id` | do trình duyệt tạo (UUID), đổi khi khách bấm "cuộc mới" hoặc sau 7 ngày |
| `visitor_id` | cookie HttpOnly `mocha_vid` do máy chủ cấp, 1 năm — "cùng một trình duyệt" |
| `ip_hash` | tín hiệu phụ chống gửi dồn; **không** dùng để định danh (CGNAT 4G: một IP = nhiều nghìn người) |
| `message_id` | nối dòng khách với dòng bot trả lời nó |
| `role` | `user` \| `bot` |
| `text`, `payload` | chữ; `payload` (JSON) giữ khối đã hiện, nút gợi ý, `degraded`, `upstream` |
| `source` | dòng bot: `rules` · `n8n` · `fallback` (kịch bản thay n8n lỗi) · `off` · `rate_limited` · `error` |
| `rule_id` | kịch bản đã trả lời (không khoá ngoại — xoá kịch bản không xoá lịch sử) |
| `matched` | dòng bot: `false` = rơi vào câu dự phòng, hoặc n8n trả `"matched": false` |
| `products` | slug các thẻ sản phẩm đã hiện |
| `latency_ms` | từ lúc nhận tin tới lúc trả lời (gồm thời gian chờ n8n) |
| `locale`, `page_path`, `created_at` | |

### `chat_sessions`

`entry_path`, `last_path`, `utm_source/medium/campaign` (lấy từ tin đầu tiên có utm),
`user_messages`, `bot_messages`, `images`, `answered_rules`, `answered_n8n`, `unmatched`,
`degraded`, `handoff`, `product_clicks`, `order_clicks`, `order_code`, `first_at`, `last_at`.

### Chuyển đổi: đơn đặt sau chat

Khi `/api/orders` nhận một đơn mới, máy chủ đọc cookie `mocha_vid` của chính yêu cầu đó;
nếu trình duyệt này có cuộc chat trong **7 ngày** qua thì ghi `chat_events(order_placed)`
và đặt `chat_sessions.order_code`. Không so số điện thoại, không gửi gì thêm cho khách.
Đây là quy về **lần chạm cuối** trong 7 ngày — đủ để so sánh kịch bản với nhau, không
phải "chat tạo ra đơn này" (khách có thể đã định mua sẵn).

### Sự kiện từ trình duyệt

`POST /api/chat/event` (navigator.sendBeacon, `text/plain` JSON):
`{ "sessionId": "…", "type": "open|product_click|order_click|link_click", "slug"?: "…", "value"?: "…" }`.
Chỉ ghi khi trình duyệt đã có `mocha_vid` (đã nhắn ít nhất một lần); luôn trả `204`; giới
hạn 200 sự kiện / 10 phút / khách; slug không đúng dạng bị bỏ.

## 2. Chỉ số trên `/admin/chats`

| Chỉ số | Định nghĩa |
|---|---|
| Cuộc trò chuyện | số `chat_sessions` có `last_at` trong kỳ |
| Trả lời được | (`answered_rules` + `answered_n8n`) / tin khách gửi |
| Chưa hiểu câu hỏi | `unmatched` — câu dự phòng hoặc n8n `matched:false` |
| Chuyển chuyên viên | cuộc có ít nhất một câu trả lời `handoff` |
| Bấm thẻ / bấm đặt | `product_clicks` / `order_clicks` |
| Đơn sau khi chat | cuộc có `order_code` (≤ 7 ngày) |
| Sự cố | n8n lỗi/chậm/trả rỗng (kể cả khi kịch bản đã trả lời thay), chat tắt, gửi quá nhanh |

Kèm: **Câu chưa trả lời được** (gom theo chữ, đếm số lần, nút "Tạo kịch bản" điền sẵn câu
đó), kịch bản dùng nhiều, ai trả lời (kịch bản / n8n / dự phòng), sản phẩm được hiện →
bấm xem → bấm đặt, số cuộc theo ngày. Lọc danh sách cuộc: có câu chưa hiểu, chuyển người,
có đơn, có sự cố.

## 3. Xuất dữ liệu

```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  "https://<tên-miền>/api/admin/chats?type=messages&from=2026-10-01&to=2026-10-31" > chat-10.ndjson
# type = messages | sessions | events ; from/to tuỳ chọn (ngày, gồm cả hai đầu)
```

NDJSON (một JSON mỗi dòng), tối đa 200.000 dòng mỗi lần — nạp thẳng:

```python
import pandas as pd; df = pd.read_json("chat-10.ndjson", lines=True)
```
```sql
-- DuckDB
SELECT source, count(*) FROM read_json_auto('chat-10.ndjson') WHERE role = 'bot' GROUP BY 1;
```

hoặc cho n8n đọc định kỳ (HTTP Request + Header Auth) để đẩy sang Google Sheets / BigQuery.

## 4. Truy vấn mẫu (chạy trên Postgres)

```sql
-- Kịch bản nào dẫn tới đơn (cuộc có ít nhất một lượt do kịch bản đó trả lời)
SELECT r.name, count(DISTINCT m.session_id) AS cuoc,
       count(DISTINCT m.session_id) FILTER (WHERE s.order_code IS NOT NULL) AS co_don,
       round(100.0 * count(DISTINCT m.session_id) FILTER (WHERE s.order_code IS NOT NULL) / count(DISTINCT m.session_id), 1) AS ty_le
  FROM chat_messages m JOIN chat_rules r ON r.id = m.rule_id JOIN chat_sessions s USING (session_id)
 WHERE m.created_at > now() - interval '30 days'
 GROUP BY r.name ORDER BY co_don DESC, cuoc DESC;

-- Chiến dịch nào có khách chat nhiều / ra đơn qua chat
SELECT coalesce(utm_source, '(trực tiếp)') AS nguon, utm_campaign, count(*) AS cuoc,
       count(*) FILTER (WHERE order_code IS NOT NULL) AS don
  FROM chat_sessions WHERE first_at > now() - interval '30 days'
 GROUP BY 1, 2 ORDER BY cuoc DESC;

-- Khách bỏ đi sau câu nào (lượt bot cuối cùng của cuộc không ra đơn)
SELECT r.name, count(*) FROM (
  SELECT DISTINCT ON (session_id) session_id, rule_id FROM chat_messages
   WHERE role = 'bot' ORDER BY session_id, id DESC) last
  JOIN chat_sessions s USING (session_id) LEFT JOIN chat_rules r ON r.id = last.rule_id
 WHERE s.order_code IS NULL GROUP BY r.name ORDER BY 2 DESC;

-- Độ trễ n8n (p50 / p95) theo ngày
SELECT created_at::date, percentile_cont(0.5) WITHIN GROUP (ORDER BY latency_ms) AS p50,
       percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms) AS p95
  FROM chat_messages WHERE role = 'bot' AND source = 'n8n' GROUP BY 1 ORDER BY 1;

-- Khách quay lại (nhiều cuộc trên cùng trình duyệt)
SELECT count(*) FILTER (WHERE n > 1) AS quay_lai, count(*) AS tong
  FROM (SELECT visitor_id, count(*) AS n FROM chat_sessions GROUP BY 1) v;
```

## 5. Quyền riêng tư (Nghị định 13/2023)

- **Mục đích** ghi ở chân khung chat + chính sách dữ liệu: tư vấn, chăm sóc, cải thiện
  câu trả lời. Không dùng chữ chat để quảng cáo nhắm lại, không bán, không chia sẻ.
- **Tối thiểu hoá:** không ảnh, không IP thô, định danh là mã ngẫu nhiên của trình duyệt.
- **Thời hạn:** chữ 90 ngày, số liệu không chữ 400 ngày — đổi ở `/admin/settings/chat`.
- **Quyền truy cập:** `/admin/chats` cần đăng nhập; xuất dữ liệu cần `ADMIN_TOKEN`. File
  đã xuất là dữ liệu cá nhân — lưu ở nơi có kiểm soát, xoá khi phân tích xong.
- **Khách yêu cầu xoá:** xoá theo `visitor_id` (nhân viên lấy từ trang xem lại cuộc):
  ```sql
  DELETE FROM chat_messages WHERE visitor_id = 'v_…';
  DELETE FROM chat_events   WHERE visitor_id = 'v_…';
  DELETE FROM chat_sessions WHERE visitor_id = 'v_…';
  ```
- n8n là bên xử lý thứ hai: chữ + ảnh chuyển sang n8n theo cấu hình của n8n (bộ nhớ hội
  thoại, log thực thi). Đặt thời hạn xoá log thực thi trong n8n tương ứng
  (`EXECUTIONS_DATA_MAX_AGE`).

## 6. Bước tiếp theo (chưa làm — theo thứ tự đáng làm)

1. **Nút 👍/👎 dưới mỗi câu trả lời** → sự kiện `feedback` gắn `message_id`. Thước đo chất
   lượng trực tiếp nhất, rẻ nhất; cho biết kịch bản nào "khớp nhưng trả lời dở".
2. **Gắn chủ đề (intent) cho lượt n8n**: n8n trả thêm `"topic": "nam"` → cùng cột chủ đề
   với kịch bản, so sánh được kịch bản và AI trên cùng một câu hỏi.
3. **Gom cụm câu chưa trả lời** bằng n8n định kỳ (đọc xuất NDJSON, nhờ LLM gom nhóm ý,
   đề xuất cụm từ khoá) → bản nháp kịch bản cho người duyệt.
4. **Thử A/B kịch bản**: hai phiên bản một kịch bản, chia theo `visitor_id`, so tỷ lệ bấm
   đặt. Cần thêm cột `variant`.
5. **Kho dữ liệu**: đẩy NDJSON hằng đêm sang BigQuery / DuckDB file, nối với đơn hàng và
   chi phí quảng cáo — tính chi phí / đơn qua chat theo chiến dịch.
6. **Chuyển người thật**: khi `handoff`, gửi tóm tắt cuộc (không ảnh) sang Zalo OA / nhóm
   chăm sóc qua n8n, để chuyên viên không hỏi lại từ đầu.
