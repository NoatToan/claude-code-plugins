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
5. Độ chi tiết: **1 item = 1 flow / tính năng, mỗi cột ≤ 3 MD** (mặc định) / 1 item = 1 màn hình, không giới hạn / mỗi cột ≤ 2 MD. Không mặc định tách ≤1 MD/cột: tách quá nhỏ làm WBS khó đọc và mức sàn 0.25 đẩy tổng lên
6. Cách chia agent và model. Agent tool chỉ có `opus | sonnet | haiku | fable` — nếu user đòi model cụ thể không có (vd "Opus 4.5"), nói rõ và đề xuất gần nhất
7. Output: template nào (sheet, cấu trúc cột), file nào (local xlsx / Google Sheet / md), có ghi đè bản cũ không. Làm trên main tree hay worktree
8. Map cột của mình vào template khi template không có cột tương ứng (xem §5)

## 1. Input
- Tài liệu scope / sitemap, screen specification, integration map (HTML/diagram, đặc biệt phần data flow), QnA / decision log, technical solution, prototype — dùng những gì dự án có
- Template estimation user chỉ định (xlsx; có thể là zip HTML export). Đọc sheet chi tiết để lấy cấu trúc cột và công thức gốc, không tự đặt cột.
- Estimate cũ (nếu có): chỉ dùng để cross-check độ phủ và giải thích chênh lệch, không copy số.

## 2. Quy tắc estimate
- Đơn vị: MD (8h), bước 0.25
- **1 item = 1 flow / tính năng** (không phải 1 bước con). Mỗi cột BE / FE / FE responsive ≤ 3 MD; lớn hơn thì tách theo sub-flow nghiệp vụ, không tách theo tầng kỹ thuật
  - Một flow xuyên module = 1 item ở **mỗi** module chạm tới. Vd thanh toán online: Storefront "Checkout & payment", Integration "I2 Adyen online payment" (khởi tạo, nhận kết quả, refund, payment link), Common "Order & payment processing" — không phải 15 dòng
  - Màn hình admin: 1–3 item/màn (list + filter + export, detail + action); CRUD đơn giản = 1 item
  - Integration: 1–3 item/hệ thống + 1 item nền tảng; item Phase 2 tách riêng khỏi Phase 1
- **Chỉ estimate tính năng truy được về requirement của khách** (BRD, QnA, decision log, policy bảo mật/dữ liệu, màn hình/workflow trong scope). Mỗi item ghi `source`. Nice-to-have do vendor tự thêm (tamper evidence, PAM/JIT, malware scan, settlement reconciliation, offline cache, review, a11y/performance "pass", test data generator, backfill, mock server…) → bỏ, liệt kê ở sheet Assumptions
- **Edge case không thành item riêng** (retry/timeout recovery, conflict UX, duplicate check, error page, idempotency, rate limit, amendment): nằm trong effort của flow chính, không cộng thêm
- **Không có item testing** (SIT, sandbox/real-device test, test suite, QA): testing nằm ở khối III của template. Mỗi item dev đã gồm một ít dev testing (unit + self test, ~10%)
- **Không tính source base** (skeleton BE/FE, component library, app shell, pagination, CI) trong khối II — thuộc khối I "Build a development environment"
- Nền tảng kỹ thuật dùng chung trong Common (Database design, Masking sensitive data, Event sharing/outbox, Scheduled jobs, File storage, Search, Notification, Audit log, Reporting data) = **1 dòng overview mỗi nhóm**, kéo các phần tương ứng từ module khác về; overview liệt kê nội dung (vd danh sách job)
- Effort thủ công = chưa có AI, dev mid-level, gồm hiểu yêu cầu + detailed design + code + unit test
- **Ngôn ngữ cho người đọc non-tech**: Medium Function (≤ 8 từ) và Overview mô tả *làm gì* bằng ngôn ngữ nghiệp vụ; endpoint, API, protocol, thư viện → Note dạng `Tech: …`. Vd `POST /payments/{pspRef}/cancels` → "Cancel or reverse an unpaid payment"
- FE responsive chỉ áp dụng cho module user đã chọn, các module khác = 0. Với POS/Kiosk responsive: chấm theo từng màn hình (cart/tender cao hơn, màn in/peripheral = 0), không để cả module chỉ vài phần tư MD
- AI % (mặc định theo loại task): CRUD/list 40–50%, UI form 40%, business logic 25–30%, tích hợp ngoài 15–20%, security/payment/dữ liệu nhạy cảm 15%
- **Total with AI = MAX(0.25, ROUND(Total × (1 − AI%), bước 0.25))**: tối thiểu 2h/item
- Phase: theo file scope; hiển thị `Phase 1 / Phase 2 / Phase 1 (Option)` ở **cột riêng trước Priority** (dropdown). Trong mỗi module, dòng Phase 2 xếp cuối; module toàn Phase 2 xếp cuối khối
- Priority: Must / Should / Could
- Không estimate phần đã bị loại khỏi scope (đối chiếu decision log)
- **Agent estimate chỉ ghi be/fe/fe_resp/ai_pct**; total và total_with_ai do coordinator tính bằng script (và bằng công thức trong xlsx), không để agent tự tính
- Khi báo cáo: báo AI saving thực tế (mức sàn 0.25 làm giảm saving khi item nhỏ), chênh lệch so với estimate cũ kèm lý do, và MD đã bỏ theo lý do (không có trong requirement / testing / edge case)
- Module Common và Admin hay bị phình: soi kỹ trước khi giao — engine/tính năng không có nguồn requirement thì bỏ

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
2. **Research integration TRƯỚC khi estimate Integration** (1 agent, WebSearch/WebFetch tài liệu chính thức): mỗi hệ thống ghi mục đích & flow liên quan, chuẩn/auth, bảng API (direction, endpoint, trigger, input, output, sync/async, retry/idempotency), task list theo flow (không tách SIT/sandbox test thành task), rủi ro & câu hỏi cho khách, nguồn URL. Hệ thống nội bộ không có tài liệu công khai: ghi giả định (vd OIDC chuẩn) + MD phát sinh nếu sai. Ghi ra `integration-api-research.md` trong repo. Nếu research xong sau estimate thì bắt agent Integration chỉnh lại theo research (tên API thật để ở Note `Tech: …`, Medium Function vẫn viết theo nghiệp vụ)
3. **Estimate**: các agent chạy song song, mỗi agent một nhóm module cân tải (thường 3 nhóm; Common đi cùng nhóm Admin hoặc nhóm nhẹ nhất — theo lựa chọn của user). Mỗi agent ghi `est/<nhóm>.json`, tự validate bằng python, báo số dòng + MD từng module
4. **Merge + validate** bằng script (`merge.py`): ≤ giới hạn MD/cột đã chốt ở Q&A, bước 0.25, mỗi uid của bản trước có mặt đúng 1 lần (trong item mới hoặc danh sách removed), fe_resp=0 ở module không responsive, phase/priority hợp lệ, không dòng 0 effort. Tính total_with_ai bằng **làm tròn half-up như Excel** (`floor(x*4+0.5)/4`), không dùng `round()` của Python (banker's rounding) — nếu không số md/xlsx sẽ lệch
5. **Audit round 1**: một agent riêng đối chiếu bản merge với sitemap và integration map:
   - Độ phủ: đủ màn hình, module, workflow, integration (P1 và P2); mỗi data flow (sync/async/inbound) có item BE
   - Ngoài scope; đúng phase; quy tắc giới hạn MD/cột, ≥0.25, AI % hợp lý, không còn item testing / edge case / source base, mỗi item có `source` requirement; trùng giữa Common và module (§3)
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

## 6. Non-Functional Requirement (sheet NFR của template)
- 1 agent đọc lại **toàn bộ input gốc của khách** (BRD, deck, QnA, policy bảo mật & dữ liệu) — PDF bằng pypdf, docx bằng python-docx; file hỏng thì báo user và dùng bản còn đọc được
- Mỗi NFR: ID, Category, Requirement Item, Details (chỉ tiêu đo được + nguồn, hoặc "HBLAB rec." nếu khách chưa nêu), Measures / Actions, MD (bước 0.5)
- Không tính trùng với khối II: phần đã có trong Detail Estimation (auth/RBAC, audit log, consent/masking, responsive…) ghi "Covered in Detail Estimation" với 0 MD, hoặc chỉ tính phần config/hardening/verify thêm
- Ghi vào sheet NFR (chèn/dời dòng bằng XML như §5), tổng bằng `=SUM(...)`, cập nhật mọi tham chiếu tới ô tổng NFR (khối III sheet Detail, sheet Cost)
- Kèm file review tiếng Việt (bảng NFR + nguồn + câu hỏi mở cho khách: SLA/uptime, RPO/RTO, VAPT, log retention, WCAG…)
