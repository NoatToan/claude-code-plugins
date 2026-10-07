---
name: presale-estimation
description: Estimate dev effort cho presale theo WBS chi tiết (màn hình/chức năng, mỗi item ≤1 ngày), có tính AI support. Dùng khi user yêu cầu estimate/WBS/báo giá từ tài liệu scope, sitemap, screen spec, integration map. TRIGGER on "estimate", "estimation", "WBS", "báo giá", "presale", "ước lượng effort", "detail estimation", /presale-estimation.
---

# Presale Estimation

Nguyên lý: estimate **từ dưới lên** (bottom-up). Mỗi dòng nhỏ đến mức một người làm xong trong một
ngày, ranh giới giữa các module rõ ràng để không tính trùng, và mọi con số kiểm chứng được bằng script.

## 0. Q&A trước khi làm (bắt buộc)
Hỏi user (AskUserQuestion), không tự giả định:
1. Danh sách module của hệ thống, và module **Common** cho phần dùng chung
2. Module nào có FE responsive
3. Phạm vi khối: chỉ Development, hay cả Preparation / Other costs (SRS, test, UAT, NFR, PM theo tỷ lệ của template)
4. Cách xác định AI %: theo loại task (mặc định) / cố định / riêng từng cột
5. Cách chia agent và model
6. Output: template nào (sheet, cấu trúc cột), file nào, có ghi đè bản cũ không. Làm trên main tree hay worktree

## 1. Input
- Tài liệu scope / sitemap, screen specification, integration map (HTML/diagram), QnA / decision log, technical solution, prototype — dùng những gì dự án có
- Template estimation user chỉ định (xlsx; có thể là HTML export). Đọc sheet chi tiết để lấy cấu trúc cột, không tự đặt cột.

## 2. Quy tắc estimate
- Đơn vị: MD (8h), bước 0.25
- Mỗi dòng = 1 chức năng chi tiết của màn hình. **Mỗi cột BE / FE / FE responsive ≤ 1 MD** (một người xong trong 1 ngày). Lớn hơn thì tách nhỏ.
- Effort thủ công = chưa có AI, dev mid-level, gồm hiểu yêu cầu + detailed design + code + unit test
- FE responsive chỉ áp dụng cho module user đã chọn, các module khác = 0
- AI % (mặc định theo loại task): CRUD/list 40–50%, UI form 40%, business logic 25–30%, tích hợp ngoài 15–20%, security/payment/dữ liệu nhạy cảm 15%
- **Total with AI = MAX(0.25, ROUND(Total × (1 − AI%), bước 0.25))**: tối thiểu 2h/item
- Phase: P1 / P2 / P1-Option (hạng mục đề xuất, chờ khách xác nhận)
- Priority: Must / Should / Could
- Không estimate phần đã bị loại khỏi scope (đối chiếu decision log)

## 3. Ranh giới module (chống tính trùng)
- **Module màn hình**: UI + API riêng của màn hình đó
- **Common**: thứ nhiều module dùng chung — khung code, auth/session, phân quyền, audit log, các domain engine dùng chung, notification, event bus, job scheduler
- **Integration**: adapter cho từng hệ thống ngoài (auth, mapping, sync, webhook, retry/DLQ, idempotency, reconciliation, sandbox test). Màn hình monitor tích hợp thuộc module quản trị.
- Một hạng mục xuyên suốt (vd tracking client-side) chỉ có **1 module sở hữu**, ghi rõ trong brief
- Phần nào chưa rõ thuộc module nào: chốt trong brief trước khi estimate, không để hai agent cùng tính

## 4. Quy trình agent
1. Viết `BRIEF.md` (nguồn, ranh giới, quy tắc, JSON schema) vào scratchpad. Schema tối thiểu cho mỗi item:
   `{module, major, medium, item, be, fe, fe_responsive, total, ai_pct, total_with_ai, phase, priority, note}`
2. **Research integration** (1 agent, WebSearch/WebFetch tài liệu chính thức): mỗi hệ thống ghi rõ mục đích, chuẩn/auth, bảng API (direction, endpoint, trigger, input, output, sync/async, retry), task list, rủi ro. Ghi ra `integration-api-research.md`
3. **Estimate**: các agent chạy song song, mỗi agent một nhóm module cân tải (thường 3 nhóm; Common đi cùng nhóm nhẹ nhất). Mỗi agent ghi `est/<nhóm>.json`
4. **Audit round 1**: một agent riêng đối chiếu với sitemap và integration map:
   - Độ phủ: đủ màn hình, module, workflow, integration; mỗi data flow có item BE
   - Ngoài scope; đúng phase; quy tắc ≤1 MD, ≥0.25, AI % hợp lý; trùng giữa Common và module
   - Ghi patch list `{action: add|update|delete, module, major, medium, item|fields, reason}`
5. Gửi finding về agent đã estimate (SendMessage) để sửa hoặc phản biện
6. Gộp `est/*.json` sau khi chốt patch, kiểm lại quy tắc §2 bằng script (không tính tay), rồi ghi output theo câu trả lời Q&A #6. Báo user: tổng MD theo module/phase, trước và sau AI, và các item P1-Option / finding còn tranh cãi.
