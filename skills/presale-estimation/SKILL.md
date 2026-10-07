---
name: presale-estimation
description: Estimate dev effort cho presale theo WBS chi tiết (màn hình/chức năng, mỗi item ≤1 ngày), có tính AI support, xuất ra template Detail Estimation (xlsx) bằng công thức Excel. Dùng khi user yêu cầu estimate/WBS/báo giá từ tài liệu scope, sitemap, screen spec, integration map. TRIGGER on "estimate", "estimation", "WBS", "báo giá", "presale", "ước lượng effort", "detail estimation", /presale-estimation.
---

# Presale Estimation

Nguyên lý: estimate **từ dưới lên** (bottom-up). Mỗi dòng nhỏ đến mức một người làm xong trong một
ngày, ranh giới giữa các module rõ ràng để không tính trùng, mọi con số kiểm chứng được bằng script,
và mọi phép tính trong file output là **công thức Excel**.

## 0. Q&A trước khi làm (bắt buộc)
Đọc template trước để hỏi có căn cứ, rồi hỏi user (AskUserQuestion), không tự giả định:
1. Danh sách module của hệ thống, và module **Common** cho phần dùng chung
2. Module nào có FE responsive
3. Phạm vi khối: chỉ Development (khối II), hay cả Preparation (I) / Other costs (III: SRS, test, UAT, NFR, PM theo tỷ lệ của template)
4. Cách xác định AI %: theo loại task (mặc định) / cố định / riêng từng cột
5. Quy tắc "1 ngày": mỗi cột ≤ 1 MD (mặc định) / tổng sau AI ≤ 1 / tổng trước AI ≤ 1
6. Cách chia agent và model. Agent tool chỉ có `opus | sonnet | haiku | fable` — nếu user đòi model cụ thể không có (vd "Opus 4.5"), nói rõ và đề xuất gần nhất
7. Output: template nào (sheet, cấu trúc cột), file nào (local xlsx / Google Sheet / md), có ghi đè bản cũ không. Làm trên main tree hay worktree
8. Map cột của mình vào template khi template không có cột tương ứng (xem §5)

## 1. Input
- Tài liệu scope / sitemap, screen specification, integration map (HTML/diagram, đặc biệt phần data flow), QnA / decision log, technical solution, prototype — dùng những gì dự án có
- Template estimation user chỉ định (xlsx; có thể là zip HTML export). Đọc sheet chi tiết để lấy cấu trúc cột và công thức gốc, không tự đặt cột.
- Estimate cũ (nếu có): chỉ dùng để cross-check độ phủ và giải thích chênh lệch, không copy số.

## 2. Quy tắc estimate
- Đơn vị: MD (8h), bước 0.25
- Mỗi dòng = 1 chức năng chi tiết của màn hình. **Mỗi cột BE / FE / FE responsive ≤ 1 MD** (một người xong trong 1 ngày). Lớn hơn thì tách nhỏ.
- Effort thủ công = chưa có AI, dev mid-level, gồm hiểu yêu cầu + detailed design + code + unit test
- FE responsive chỉ áp dụng cho module user đã chọn, các module khác = 0. Với POS/Kiosk responsive: chấm theo từng màn hình (cart/tender cao hơn, màn in/peripheral = 0), không để cả module chỉ vài phần tư MD
- AI % (mặc định theo loại task): CRUD/list 40–50%, UI form 40%, business logic 25–30%, tích hợp ngoài 15–20%, security/payment/dữ liệu nhạy cảm 15%
- **Total with AI = MAX(0.25, ROUND(Total × (1 − AI%), bước 0.25))**: tối thiểu 2h/item
- Phase: P1 / P2 / P1-Option (hạng mục đề xuất, chờ khách xác nhận)
- Priority: Must / Should / Could
- Không estimate phần đã bị loại khỏi scope (đối chiếu decision log)
- **Agent estimate chỉ ghi be/fe/fe_resp/ai_pct**; total và total_with_ai do coordinator tính bằng script (và bằng công thức trong xlsx), không để agent tự tính
- Khi báo cáo: item càng nhỏ thì mức sàn 0.25 càng kéo tổng sau AI lên (AI saving thực tế thường chỉ ~30% dù AI % từng dòng 40–50%). Báo con số này và chênh lệch so với estimate cũ kèm lý do

## 3. Ranh giới module (chống tính trùng)
- **Module màn hình**: UI + API riêng của màn hình đó
- **Common**: thứ nhiều module dùng chung — khung code, auth/session, phân quyền, audit log, các domain engine dùng chung (catalog, inventory, cart/order state machine, pricing/promotion, booking), consent/PDPA engine, notification/templating, event bus/outbox, job scheduler
- **Integration**: adapter cho từng hệ thống ngoài (auth, mapping, sync, webhook, retry/DLQ, idempotency, reconciliation, sandbox test). Chỉ giữ phần riêng của Integration Service (host, subscription, HTTP client, DLQ handler); outbox/event bus thuộc Common. Màn hình monitor tích hợp thuộc module quản trị.
- Một hạng mục xuyên suốt chỉ có **1 module sở hữu**, ghi rõ trong brief. Ví dụ: tracking client-side (data layer, tag trên trang) thuộc Storefront; server-side tracking (Measurement Protocol) thuộc Integration
- Các điểm hay bị tính trùng — audit phải soi: kết quả thanh toán (trang kết quả / order engine / webhook processor), luồng refund (màn duyệt / adapter), rule personalization (màn cấu hình / API storefront), notification (Common / ESP adapter / màn hình), consent/DSR (engine / màn hình), login SSO (UI storefront / adapter), outbox (Common / Integration host)
- Phần nào chưa rõ thuộc module nào: chốt trong brief trước khi estimate, không để hai agent cùng tính

## 4. Quy trình agent
1. Viết `BRIEF.md` (nguồn, ranh giới, quy tắc, JSON schema) vào scratchpad. Schema item:
   `{medium, overview, screen, flow_ref, priority, phase, be, fe, fe_resp, ai_pct, note}` lồng trong `modules[].groups[{major, items[]}]`, kèm `assumptions[]`, `open_questions[]`
2. **Research integration TRƯỚC khi estimate Integration** (1 agent, WebSearch/WebFetch tài liệu chính thức): mỗi hệ thống ghi mục đích & flow liên quan, chuẩn/auth, bảng API (direction, endpoint, trigger, input, output, sync/async, retry/idempotency), task list ≤1 MD, rủi ro & câu hỏi cho khách, nguồn URL. Hệ thống nội bộ không có tài liệu công khai: ghi giả định (vd OIDC chuẩn) + MD phát sinh nếu sai. Ghi ra `integration-api-research.md` trong repo. Nếu research xong sau estimate thì bắt agent Integration chỉnh lại theo research (tên API thật trong medium/overview)
3. **Estimate**: các agent chạy song song, mỗi agent một nhóm module cân tải (thường 3 nhóm; Common đi cùng nhóm Admin hoặc nhóm nhẹ nhất — theo lựa chọn của user). Mỗi agent ghi `est/<nhóm>.json`, tự validate bằng python, báo số dòng + MD từng module
4. **Merge + validate** bằng script (`merge.py`): ≤1 MD/cột, bước 0.25, fe_resp=0 ở module không responsive, phase/priority hợp lệ, không dòng 0 effort. Tính total_with_ai bằng **làm tròn half-up như Excel** (`floor(x*4+0.5)/4`), không dùng `round()` của Python (banker's rounding) — nếu không số md/xlsx sẽ lệch
5. **Audit round 1**: một agent riêng đối chiếu bản merge với sitemap và integration map:
   - Độ phủ: đủ màn hình, module, workflow, integration (P1 và P2); mỗi data flow (sync/async/inbound) có item BE
   - Ngoài scope; đúng phase; quy tắc ≤1 MD, ≥0.25, AI % hợp lý; trùng giữa Common và module (§3)
   - Ghi `audit-r1.json`: `findings[{id, check, severity, detail, resolution}]` + `patches[{action: add|update|delete, module, major, medium, item|fields}]` tham chiếu **đúng chuỗi** major/medium có sẵn, tự kiểm patch apply được
6. Áp patch bằng script (hoặc gửi về agent gốc qua SendMessage nếu cần phản biện), merge lại, rồi ghi output (§5). Báo user: tổng MD theo module/phase, trước và sau AI, AI saving thực tế, chênh lệch so với bản cũ, các item P1-Option, rủi ro từ research

## 5. Output vào template xlsx (Detail Estimation)
**Mọi phép tính phải là công thức Excel**, chỉ BE/FE/FE resp/AI % là số nhập tay:
- Total mỗi dòng: `=SUM(H{r}:J{r})`
- Sau AI mỗi dòng: `=MAX(0.25,ROUND(K{r}*(1-L{r})*4,0)/4)`
- Dòng module: `=SUM(H{first}:H{last})` cho từng cột effort; AI % module `=IF(K=0,0,(K-M)/K)`
- Dòng section/total: giữ cách tính gốc của template (vd `SUM(...)/2`), chỉ mở rộng range
- Khối không làm (I/III) giữ nguyên công thức tỷ lệ của template, chỉ dời tham chiếu
- Map cột mặc định (template HBLAB BM-SX-03-06): Backend = BE, Web App = FE, Mobile = FE responsive, Apply AI (%) = AI %, Remained Total = Total with AI. Phase + màn hình ghi đầu Note: `[P1 · #17] ...`. Major merge dọc theo nhóm

**File xlsx export từ Google Sheets / có ảnh, drawing, extension:**
- KHÔNG load-save bằng openpyxl (mất ảnh, drawing, extension Google). Sửa **trực tiếp XML** của sheet: thay dòng khối II, dời các dòng phía dưới (row r, cell r, công thức, `ref` của shared formula), mergeCells, conditionalFormatting, dataValidation, autoFilter, dimension, comments + vmlDrawing anchor, **tham chiếu từ sheet khác** (vd `'6_Detail Estimation'!K66` ở sheet Cost)
- Text mới dùng inline string (`t="inlineStr"`), không đụng sharedStrings. Copy style `s=` từ dòng mẫu của template (dòng module, dòng item đầu nhóm, dòng item thường)
- Xoá cached `<v>` của công thức đã dời, đặt `<calcPr fullCalcOnLoad="1"/>` để Excel/Google tự tính lại
- Sao lưu bản gốc trước khi ghi; sau khi ghi: parse lại mọi XML part, load bằng openpyxl (chỉ đọc) để kiểm công thức/tham chiếu, và emulate công thức để tổng khớp với md
- Đặt row height theo độ dài text (wrap) vì Excel không tự autofit row có customHeight

**Google Sheets:** cần user kết nối connector Google Sheets (`/mcp`) với tài khoản có quyền Editor. File .xlsx nằm trên Drive (không phải Google Sheet) thì API không ghi được → user "Save as Google Sheets", hoặc sửa file xlsx local rồi user tự upload lại.

**Markdown** (nếu user muốn): tổng hợp theo module, theo phase, bảng chi tiết theo module, giả định, open questions, kết quả audit — sinh từ cùng `merged.json` với xlsx.
