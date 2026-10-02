# CLAUDE DESIGN HANDOFF PROMPT: MAN-B-TASK-001
## Executive Handoff Summary & Package Artifacts

- **Manual ID:** `MAN-B-TASK-001`
- **Manual Title:** Task & Communication Guide (할 일, 업무 조율 및 1:1 케이스 소통 가이드)
- **Target Audience:** Brand Portal Users (B)
- **Package Status:** COMPLETE & VERIFIED (Ready for Final PDF Compilation / QA)
- **Creation Date:** 2026-10-02

---

## 1. Package Contents Inventory

```
02_CLAUDE_PACKAGE/
├── PACKAGE_README.md
├── CLAUDE_DESIGN_MASTER_PROMPT.md
├── CLAUDE_DESIGN_HANDOFF_PROMPT.md
├── MAN-B-TASK-001_Design_Structure.md
├── 01_CONTENT/
│   └── MAN-B-TASK-001_Manual_Content.md
├── 02_SCREENSHOTS/
│   ├── SCREENSHOT_ANNOTATION_GUIDE.md
│   ├── SCR-B-TASK-001.png  (Main Support Hub & List)
│   ├── SCR-B-TASK-002.png  (New Inquiry Submission Modal)
│   ├── SCR-B-TASK-003.png  (Threaded Message Stream)
│   ├── SCR-B-TASK-004.png  (Action Required Alert & Supplement Form)
│   ├── SCR-B-TASK-005.png  (Case Closed & 5-Star CSAT Rating)
│   ├── SCR-B-TASK-006.png  (PO Deep Link Prefill & related_po_id FK)
│   ├── SCR-B-TASK-007.png  (Settlement AP Deep Link Prefill)
│   ├── SCR-B-TASK-008.png  (Header In-App Notification Feed)
│   ├── SCR-B-TASK-009.png  (Viewer Role Read-Only Restriction)
│   ├── SCR-B-TASK-010.png  (Access Denied View - support:none)
│   ├── SCR-B-TASK-011.png  (Admin Partner Inquiries Console)
│   └── SCR-B-TASK-012.png  (Admin Internal Tasks Console)
├── 03_DIAGRAMS/
│   └── TASK_COMMUNICATION_ARCHITECTURE_DIAGRAMS.md (7 Verified Diagrams)
└── 04_REFERENCE/
    └── REFERENCE_GUIDE.md (Tables, Enums, Prefills, ACL Matrix)
```

---

## 2. Key Architecture Commitments for PDF Generation

1. **PERM Tasks vs Dynamic Case Communication**:
   - `MAN-B-PERM-001` contact tasks are static routing points (`company_apply`, `contract`, `product_cert`, `pricing_quote`, `logistics_inventory`, `settlement_inquiry`).
   - `MAN-B-TASK-001` is the dynamic case lifecycle (`partner_inquiries`).
2. **Status Normalization**:
   - Always display the 4 official presentation states: `RECEIVED` (Amber), `UNDER_REVIEW` (Blue), `ACTION_REQUIRED` (Rose), `CLOSED` (Zinc).
3. **Storage Specs**:
   - Bucket: `"company-uploads"`, Max 20MB, Images & PDF, Signed URLs.
4. **No Hyperbolic Statements**:
   - All text maintains strict technical neutrality and accuracy.

---
*End of CLAUDE_DESIGN_HANDOFF_PROMPT.md*
