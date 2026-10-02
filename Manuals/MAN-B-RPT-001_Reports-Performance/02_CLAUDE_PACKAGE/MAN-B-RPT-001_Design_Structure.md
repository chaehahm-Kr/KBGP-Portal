# MAN-B-RPT-001 DESIGN STRUCTURE & LAYOUT GUIDE
## Reports & Performance Visual Hierarchy & Component Specifications

- **Manual ID:** `MAN-B-RPT-001`
- **Topic:** `Reports & Performance (성과 분석, 대시보드 KPI 및 운영 지표)`
- **Audience:** `B — Brand Portal Users`
- **Authoritative Date:** 2026-10-01
- **Master Design Reference:** `MAN-B-BRAND-001_Brand-Policy_V1.pdf`

---

## 1. Page Grid & Typography Standards

### 1.1 12-Column Grid System
- **Page Canvas**: Standard A4 Landscape / Desktop Web Display (1440px Canvas)
- **Margins**: Top 32px, Bottom 32px, Left 40px, Right 40px
- **Grid Gutters**: 16px horizontal gutter between content columns

### 1.2 Typography Hierarchy
- **Document Title (H1)**: 24pt Bold / Neutral 900 (`#0F172A`)
- **Chapter Heading (H2)**: 18pt Bold / Neutral 800 (`#1E293B`)
- **Section Heading (H3)**: 14pt Semi-Bold / Indigo 700 (`#4338CA`)
- **Body Text**: 10pt Regular / Neutral 700 (`#334155`), Line-height 1.6
- **Captions & Callouts**: 8.5pt Regular / Neutral 500 (`#64748B`)
- **Table Data**: 9pt Regular / Neutral 800 (`#1E293B`)

---

## 2. Color Palette & Component Tokens

| Token Name | Hex Code | Purpose & Application |
| :--- | :--- | :--- |
| `primary-brand` | `#4F46E5` (Indigo 600) | Primary KPI headers, active navigation, key action buttons |
| `primary-dark` | `#3730A3` (Indigo 800) | Chapter headers, main table headers |
| `urgent-badge` | `#EF4444` (Red 500) | `URGENT` action required badges, overdue alerts |
| `due-soon-badge`| `#F59E0B` (Amber 500) | `DUE_SOON` badges, pending packing notifications |
| `success-badge` | `#10B981` (Emerald 500) | `COMPLETE` product status, settled invoice badges |
| `neutral-border`| `#E2E8F0` (Slate 200) | Table borders, card outlines |
| `neutral-bg` | `#F8FAFC` (Slate 50) | Callout card background, table header fill |
| `accent-bg` | `#EEF2FF` (Indigo 50) | Highlighted KPI card background |

---

## 3. Chapter Layout Blueprint

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ PAGE LAYOUT BLUEPRINT: 6 CORE CHAPTERS                                                 │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ • Chapter 1: Reports & Performance Module Overview (시스템 개요 및 지표 원칙)             │
│   - Role of Reporting Layer & Real-time Measurement                                    │
│   - Multi-tenant data isolation and authoritative data flow                            │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ • Chapter 2: Brand Portal Operational Dashboard & Action Queue (SCR-B-RPT-001, 002)    │
│   - 4-Domain KPI cards (Orders, Finance, Products, Support)                            │
│   - Action Required Queue 3-level priority bottleneck engine (URGENT / DUE_SOON)       │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ • Chapter 3: PO Pipeline Performance & Filtering (SCR-B-RPT-003, SCR-B-RPT-004)        │
│   - 5-stage lifecycle summary cards, 90-day time window filter                         │
│   - Status chip filtering and multi-column table sorting                               │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ • Chapter 4: Finance & Settlement Cash Flow Tracking (SCR-B-RPT-005)                   │
│   - Total invoiced, total paid, balance due, and overdue balance tracking              │
│   - Payment schedules and invoice reconciliation                                       │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ • Chapter 5: Product Catalog Completeness Audit (SCR-B-RPT-006)                        │
│   - 28-criteria evaluation engine, Complete vs Draft status breakdown                  │
│   - Missing field alerts and catalog readiness resolution                              │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ • Chapter 6: Support Resolution & Admin Purchasing Sync (SCR-B-RPT-007, SCR-B-RPT-008) │
│   - 1:1 support case resolution tracking and response state                            │
│   - Admin backoffice purchasing synchronization and supplier summary                   │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---
*End of MAN-B-RPT-001_Design_Structure.md*
