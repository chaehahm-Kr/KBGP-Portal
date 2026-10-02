# CLAUDE DESIGN MASTER PROMPT: MAN-B-TASK-001
## K SELECT Brand Portal Task & Communication Official PDF Manual Generation Prompt

```text
You are an expert technical documentation designer and visual layout specialist.
Your task is to generate the authoritative, production-grade PDF manual for:

Manual ID: MAN-B-TASK-001
Manual Name: Task & Communication Guide (할 일, 업무 조율 및 1:1 케이스 소통 가이드)
Target Audience: B — Brand Portal Users (Company Owner / Admin / Authorized Brand Staff)
Master Reference: MAN-B-BRAND-001_Brand-Policy_V1.pdf

==================================================
1. SOURCE INTEGRITY & FACTUAL ACCURACY RULES
==================================================
1. Strict Domain Separation:
   - MAN-B-PERM-001: Static 6 Primary Contact Tasks (company_apply, contract, product_cert, pricing_quote, logistics_inventory, settlement_inquiry) on table company_task_assignments.
   - MAN-B-TASK-001: Dynamic 1:1 Case Communication on table partner_inquiries and partner_inquiry_messages.
   - public.tasks / /admin/tasks is an early unlinked admin internal monitoring schema (Internal Admin Task Prototype / Not connected to Brand Portal Support Cases) and NOT a brand workflow.
2. Presentation Status Normalization:
   - Normalize the 10 internal DB statuses into the 4 official presentation states:
     • RECEIVED (접수됨) — Amber (#F59E0B)
     • UNDER_REVIEW (검토중) — Blue (#3B82F6)
     • ACTION_REQUIRED (조치필요) — Rose (#E11D48)
     • CLOSED (종료됨) — Zinc (#71717A)
3. 9 Standard Categories:
   - po_change, agreement_change, product, onboarding, logistics, translation, settlement, system, general.
4. Storage & Attachment:
   - Bucket: "company-uploads", Path: ${companyId}/inquiries/..., Max Size: 20MB, Types: Images & PDF, Time-limited Signed URLs.
5. Cross-Domain Deep Links:
   - PO inquiries bind the foreign key `related_po_id` to purchase_orders.
   - Settlement and Agreement inquiries prefill context parameters (No DB FK).
6. 6 Canonical In-App Notification Events & Conditional Email:
   - 1. New Inquiry, 2. Admin Reply, 3. Action Required, 4. Action Resolved, 5. Case Closed, 6. CSAT Submission.
   - Transactional Email sent strictly on `isActionRequired && sendEmail` or admin case creation with email option (never on routine replies).
7. Absolute Claim Restrictions:
   - Prohibit broad absolute claims like "모든 비즈니스 문의/모든 소통". Use precise wording: "브랜드 포털 내 공식 지원 문의, 변경 요청 및 관련 커뮤니케이션".

==================================================
2. VISUAL LAYOUT & TYPOGRAPHY SYSTEM
==================================================
- Grid: 12-column layout with 16px gutter, 32px/40px margins.
- Typography: Sans-serif Korean Clear Sans + Inter numbers, strict H1/H2/H3 hierarchy.
- Color Tokens:
  • Primary Brand: #4F46E5 (Indigo 600)
  • Primary Dark: #3730A3 (Indigo 800)
  • Status Colors: Amber #F59E0B, Blue #3B82F6, Rose #E11D48, Zinc #71717A
  • Borders & Backgrounds: Slate 200 / Slate 50
- Callout Pins: Indigo Solid Circle with White Number `(1)`, `(2)`, `(3)`, `(4)` matching SCREENSHOT_ANNOTATION_GUIDE.md.
- High-Resolution Production Screenshots: Integrate all 12 verified screenshots (SCR-B-TASK-001.png ~ SCR-B-TASK-012.png).

==================================================
3. DOCUMENT STRUCTURE (8 SECTIONS)
==================================================
- Section 1: System Overview & Architectural Principles
- Section 2: Support Hub UI & Case List (SCR-B-TASK-001)
- Section 3: New Inquiry & 9 Standard Categories (SCR-B-TASK-002)
- Section 4: Threaded Discussion & Status Normalization (SCR-B-TASK-003)
- Section 5: Action Required Escalation & Resolution Lifecycle (SCR-B-TASK-004, SCR-B-TASK-005)
- Section 6: Cross-Domain Deep Linking Inflow (SCR-B-TASK-006, SCR-B-TASK-007)
- Section 7: ACL, Storage Security & Notifications (SCR-B-TASK-008 ~ SCR-B-TASK-010)
- Section 8: Appendix: Admin Operations Console (SCR-B-TASK-011, SCR-B-TASK-012: Internal Admin Task Prototype / Not connected to Brand Portal Support Cases)
```

---
*End of CLAUDE_DESIGN_MASTER_PROMPT.md*
