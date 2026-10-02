# CLAUDE DESIGN HANDOFF PROMPT: MAN-B-RPT-001
## Executive Handoff Summary & Package Artifacts

- **Manual ID:** `MAN-B-RPT-001`
- **Manual Title:** Reports & Performance Guide (성과 분석, 대시보드 KPI 및 운영 지표 가이드)
- **Target Audience:** Brand Portal Users (B)
- **Package Status:** COMPLETE & VERIFIED (Ready for Final PDF Compilation / QA)
- **Creation Date:** 2026-10-01

---

## 1. Package Contents Inventory

```
02_CLAUDE_PACKAGE/
├── PACKAGE_README.md
├── CLAUDE_DESIGN_MASTER_PROMPT.md
├── CLAUDE_DESIGN_HANDOFF_PROMPT.md
├── MAN-B-RPT-001_Design_Structure.md
├── 01_CONTENT/
│   └── MAN-B-RPT-001_Manual_Content.md
├── 02_SCREENSHOTS/
│   ├── SCREENSHOT_ANNOTATION_GUIDE.md
│   ├── SCR-B-RPT-001.png  (Brand Portal Dashboard Overview & 4 KPI Cards)
│   ├── SCR-B-RPT-002.png  (Action Required Queue & Priority Badges)
│   ├── SCR-B-RPT-003.png  (PO Pipeline Performance Hub & 90-Day Filter)
│   ├── SCR-B-RPT-004.png  (PO Filter Chips & Table Sorting Dropdown)
│   ├── SCR-B-RPT-005.png  (Finance & Settlement Summary & Balance Due)
│   ├── SCR-B-RPT-006.png  (Product Catalog Completeness & Issue Alerts)
│   ├── SCR-B-RPT-007.png  (1:1 Support Ticket Resolution Tracking)
│   └── SCR-B-RPT-008.png  (Admin Purchasing Dashboard & Supplier Summary)
├── 03_DIAGRAMS/
│   └── REPORTS_PERFORMANCE_ARCHITECTURE_DIAGRAMS.md (5 Verified Diagrams)
└── 04_REFERENCE/
    └── REFERENCE_GUIDE.md (7 Metric Groups, Formulas, Boundary Matrix)
```

---

## 2. Key Architecture Commitments for PDF Generation

1. **Reporting & Measurement Layer Focus**:
   - RPT aggregates existing data from PROD, ORD, LOG, FIN, SUP; it does NOT alter transactional statuses.
2. **Action Required Priority Algorithm**:
   - `URGENT` (Red), `DUE_SOON` (Amber), `NORMAL` (Blue/Gray).
3. **Product Completeness**:
   - 28-point evaluation engine distinguishes `COMPLETE` vs `Draft (Incomplete)`.
4. **Zero Unsupported Claims**:
   - Explicitly reflects that `/admin/reports` is a placeholder, no dedicated `/portal/reports` page exists, and no bulk report export is provided.

---
*End of CLAUDE_DESIGN_HANDOFF_PROMPT.md*
